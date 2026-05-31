import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── SSE Helper (Safe Writer) ────────────────────────────────────────────
interface SafeWriter {
  writer: WritableStreamDefaultWriter<Uint8Array>;
  closed: boolean;
}

function sseSend(sw: SafeWriter, event: Record<string, unknown>): boolean {
  if (sw.closed) return false;
  try {
    sw.writer.write(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
    return true;
  } catch {
    sw.closed = true;
    return false;
  }
}

async function startHeartbeat(sw: SafeWriter, stopSignal: { stopped: boolean }) {
  while (!stopSignal.stopped) {
    await sleep(8000);
    if (!stopSignal.stopped) {
      const ok = sseSend(sw, { type: "ping", t: Date.now() });
      if (!ok) stopSignal.stopped = true;
    }
  }
}

// ─── Upload Image to KIE ─────────────────────────────────────────────────
async function uploadImageToKie(
  base64Data: string,
  fileName: string,
  apiKey: string
): Promise<string> {
  let rawBase64 = base64Data;
  if (rawBase64.includes(",")) {
    rawBase64 = rawBase64.split(",")[1];
  }

  const res = await fetch("https://kieai.redpandaai.co/api/file-base64-upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ base64Data: rawBase64, fileName, uploadPath: "images" }),
  });

  const json = await res.json();
  if (!json.success) throw new Error("Image upload failed: " + (json.msg || JSON.stringify(json)));
  const downloadUrl = json.data?.downloadUrl;
  if (!downloadUrl) throw new Error("Upload succeeded but no downloadUrl returned");
  return downloadUrl;
}

// ─── Generate Video (KIE AI Veo with start+end frames) ──────────────────
async function generateVideoVeo(
  startFrameUrl: string,
  endFrameUrl: string,
  prompt: string,
  apiKey: string,
  model: string = "veo3_lite"
): Promise<string> {
  console.log("[Claymotion] Generating video with Veo (start+end frames), model:", model);

  const res = await fetch("https://api.kie.ai/api/v1/veo/generate", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      imageUrls: [startFrameUrl, endFrameUrl],
      model,
      aspect_ratio: "9:16",
      enableTranslation: false,
    }),
  });

  const json = await res.json();
  console.log("[Claymotion] Veo submit response:", JSON.stringify(json).slice(0, 300));

  if (json.code !== 200) throw new Error("Video submit failed: " + (json.msg || JSON.stringify(json)));
  const taskId = json.data?.taskId;
  if (!taskId) throw new Error("No taskId for video generation");

  console.log("[Claymotion] Veo task submitted:", taskId);

  // Poll for video completion
  for (let i = 0; i < 180; i++) {
    try {
      const pollRes = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const pollJson = await pollRes.json();

      if (i % 10 === 0 || pollJson.code !== 200 || pollJson.data?.successFlag === 1 || pollJson.data?.successFlag === 2 || pollJson.data?.successFlag === 3) {
        console.log(`[Claymotion] Veo poll #${i}:`, JSON.stringify(pollJson).slice(0, 500));
      }

      if (pollJson.code === 200) {
        const d = pollJson.data;
        if (d?.successFlag === 1 || d?.status === "success" || d?.state === "success") {
          let resp = d.response || d.result || d;
          if (typeof resp === "string") { try { resp = JSON.parse(resp); } catch {} }

          let videoUrl =
            resp?.resultUrls?.[0] ||
            resp?.originUrls?.[0] ||
            resp?.url ||
            resp?.videoUrl ||
            resp?.video_url ||
            d.resultUrls?.[0] ||
            d.videoUrl ||
            d.url;

          // Try parsing string resultUrls
          if (!videoUrl && typeof resp?.resultUrls === "string") {
            try { videoUrl = JSON.parse(resp.resultUrls)[0]; } catch {}
          }
          if (!videoUrl && typeof d?.resultUrls === "string") {
            try { videoUrl = JSON.parse(d.resultUrls)[0]; } catch {}
          }

          // Deep search for URL
          if (!videoUrl) {
            const urlPattern = /https?:\/\/[^\s"']+\.(mp4|mov|avi|webm)/i;
            const allStrings = JSON.stringify(d);
            const match = allStrings.match(urlPattern);
            if (match) videoUrl = match[0];
          }

          if (!videoUrl) {
            const anyUrlPattern = /https?:\/\/[^\s"']+/g;
            const allStr = JSON.stringify(d);
            const allUrls = allStr.match(anyUrlPattern) || [];
            videoUrl = allUrls.find((u: string) => /video|cdn|media|output|result|download|veo|sora/i.test(u)) || allUrls[0] || "";
          }

          if (videoUrl) {
            console.log("[Claymotion] Veo video ready:", videoUrl);
            return videoUrl;
          }

          throw new Error("Video ready but no URL found");
        }
        if (d?.successFlag === 2 || d?.successFlag === 3 || d?.status === "failed" || d?.state === "fail") {
          throw new Error("Video generation failed: " + (d?.errorMessage || d?.error || d?.failMsg || "unknown"));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("generation failed") || msg.includes("no URL")) throw err;
    }
    await sleep(5000);
  }
  throw new Error("Video generation timed out after 15 minutes");
}

// ─── Generate Video (Grok Imagine via fal.ai) ──────────────────────────
async function generateVideoGrok(
  startFrameUrl: string,
  prompt: string,
  falApiKey: string
): Promise<string> {
  console.log("[Claymotion] Generating video with Grok Imagine (start frame only)");

  // Submit to fal.ai queue
  const submitRes = await fetch("https://queue.fal.run/xai/grok-imagine-video/image-to-video", {
    method: "POST",
    headers: {
      Authorization: `Key ${falApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_url: startFrameUrl,
      duration: 6,
      resolution: "720p",
      aspect_ratio: "9:16",
    }),
  });

  const submitJson = await submitRes.json();
  console.log("[Claymotion] Grok submit response:", JSON.stringify(submitJson).slice(0, 500));

  // Check for direct result (synchronous)
  if (submitJson.video && typeof submitJson.video === "object" && submitJson.video.url) {
    console.log("[Claymotion] Grok video ready (sync):", submitJson.video.url);
    return submitJson.video.url;
  }

  // Async result — need to poll
  const requestId = submitJson.request_id;
  if (!requestId) {
    // Maybe it returned directly
    if (submitJson.url && typeof submitJson.url === "string") {
      return submitJson.url;
    }
    throw new Error("Grok submit failed: no request_id and no direct URL. Response: " + JSON.stringify(submitJson).slice(0, 300));
  }

  console.log("[Claymotion] Grok task submitted, request_id:", requestId);

  const statusUrl = `https://queue.fal.run/xai/grok-imagine-video/image-to-video/requests/${requestId}/status`;
  const responseUrl = `https://queue.fal.run/xai/grok-imagine-video/image-to-video/requests/${requestId}`;

  // Poll for completion
  for (let i = 0; i < 120; i++) {
    await sleep(3000);

    try {
      const statusRes = await fetch(statusUrl, {
        method: "GET",
        headers: { Authorization: `Key ${falApiKey}` },
      });
      const statusJson = await statusRes.json();

      if (i % 10 === 0) {
        console.log(`[Claymotion] Grok poll #${i}:`, JSON.stringify(statusJson).slice(0, 300));
      }

      if (statusJson.status === "COMPLETED") {
        const resultRes = await fetch(responseUrl, {
          method: "GET",
          headers: { Authorization: `Key ${falApiKey}` },
        });
        const resultJson = await resultRes.json();

        const videoObj = resultJson.video;
        if (videoObj?.url) {
          console.log("[Claymotion] Grok video ready:", videoObj.url);
          return videoObj.url;
        }
        if (typeof resultJson.url === "string") {
          console.log("[Claymotion] Grok video ready (url):", resultJson.url);
          return resultJson.url;
        }

        throw new Error("Grok video done but no URL: " + JSON.stringify(resultJson).slice(0, 300));
      }

      if (statusJson.status === "FAILED") {
        throw new Error("Grok video generation failed: " + (statusJson.error || "unknown"));
      }

      // IN_QUEUE or IN_PROGRESS — keep waiting
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("generation failed") || msg.includes("no URL") || msg.includes("done but")) throw err;
      console.warn(`[Claymotion] Grok poll ${i} error:`, msg);
    }
  }

  throw new Error("Grok video generation timed out after 6 minutes");
}

// ─── Generate Video (dispatch by model) ─────────────────────────────────
async function generateVideo(
  startFrameUrl: string,
  endFrameUrl: string | undefined,
  prompt: string,
  kieApiKey: string,
  falApiKey: string,
  videoModel: string
): Promise<string> {
  if (videoModel === "grok-imagine") {
    if (!falApiKey) throw new Error("fal.ai API key is required for Grok Imagine model");
    // Grok only uses start frame, but we enhance the prompt with end frame description
    const enhancedPrompt = endFrameUrl
      ? `${prompt} The video should transition smoothly to match the next scene.`
      : prompt;
    return generateVideoGrok(startFrameUrl, enhancedPrompt, falApiKey);
  } else {
    // Default: Veo 3.1 Lite via KIE AI
    if (!kieApiKey) throw new Error("KIE AI API key is required for Veo model");
    if (!endFrameUrl) throw new Error("End frame URL is required for Veo model");
    return generateVideoVeo(startFrameUrl, endFrameUrl, prompt, kieApiKey, videoModel);
  }
}

// ─── Merge Videos (fal.ai) ──────────────────────────────────────────────
async function mergeVideosFal(
  videoUrls: string[],
  apiKey: string
): Promise<string> {
  console.log("[Claymotion] Merging", videoUrls.length, "videos via fal.ai");

  const res = await fetch("https://queue.fal.run/fal-ai/ffmpeg-api/merge-videos", {
    method: "POST",
    headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ video_urls: videoUrls }),
  });

  const json = await res.json();

  // Check for direct result (synchronous)
  if (json.video && typeof json.video === "object" && json.video.url) {
    return json.video.url;
  }
  if (json.url && typeof json.url === "string") {
    return json.url;
  }

  // Async result — need to poll
  const requestId = json.request_id;
  if (requestId) {
    const statusUrl = `https://queue.fal.run/fal-ai/ffmpeg-api/requests/${requestId}/status`;
    const responseUrl = `https://queue.fal.run/fal-ai/ffmpeg-api/requests/${requestId}`;

    for (let i = 0; i < 90; i++) {
      await sleep(3000);

      try {
        const statusRes = await fetch(statusUrl, {
          method: "GET",
          headers: { Authorization: `Key ${apiKey}` },
        });
        const statusJson = await statusRes.json();

        if (statusJson.status === "COMPLETED") {
          const resultRes = await fetch(responseUrl, {
            method: "GET",
            headers: { Authorization: `Key ${apiKey}` },
          });
          const resultJson = await resultRes.json();

          const videoObj = resultJson.video;
          if (videoObj?.url) return videoObj.url;
          if (typeof resultJson.url === "string") return resultJson.url;

          throw new Error("Merge done but no URL: " + JSON.stringify(resultJson).slice(0, 300));
        }

        if (statusJson.status === "FAILED") {
          throw new Error("Video merge failed: " + (statusJson.error || "unknown"));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("merge failed") || msg.includes("no URL")) throw err;
        console.warn(`[Claymotion] Merge poll ${i} error:`, msg);
      }
    }
    throw new Error("Video merge timed out after 4.5 minutes");
  }

  throw new Error("Merge failed: no URL and no request_id: " + JSON.stringify(json).slice(0, 300));
}

// ═══════════════════════════════════════════════════════════════════════
// POST Handler
// ═══════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, sceneImageUrls, videoPrompts, kieApiKey, falApiKey, videoUrls, startFrameUrl, endFrameUrl, prompt, videoModel } = body as {
    action?: string;
    sceneImageUrls?: string[];
    videoPrompts?: string[];
    kieApiKey?: string;
    falApiKey?: string;
    videoUrls?: string[];
    startFrameUrl?: string;
    endFrameUrl?: string;
    prompt?: string;
    videoModel?: string;
  };

  const model = videoModel || "veo3_lite";

  // ── Single video retry action ──
  if (action === "single_video") {
    if (!startFrameUrl) {
      return NextResponse.json({ error: "startFrameUrl is required" }, { status: 400 });
    }
    if (model === "veo3_lite" && !kieApiKey) {
      return NextResponse.json({ error: "KIE API key is required for Veo model" }, { status: 400 });
    }
    if (model === "grok-imagine" && !falApiKey) {
      return NextResponse.json({ error: "fal.ai API key is required for Grok model" }, { status: 400 });
    }

    const singlePrompt = prompt || "Smooth transition between scenes. Natural camera movement, cinematic quality.";

    // Set up SSE stream
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const sw: SafeWriter = { writer, closed: false };

    const heartbeatStop = { stopped: false };
    startHeartbeat(sw, heartbeatStop);

    (async () => {
      try {
        sseSend(sw, { type: "started", totalVideos: 1 });
        sseSend(sw, { type: "video_progress", videoIndex: 0, pct: 5, message: `Submitting video to ${model === "grok-imagine" ? "Grok Imagine" : "Veo 3.1 Lite"}...` });

        const videoUrl = await generateVideo(startFrameUrl, endFrameUrl, singlePrompt, kieApiKey || "", falApiKey || "", model);
        sseSend(sw, { type: "video_done", videoIndex: 0, videoUrl });
        sseSend(sw, { type: "done", videoUrl, videoUrls: [videoUrl], message: "Video retry complete!" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sseSend(sw, { type: "video_error", videoIndex: 0, error: msg });
        sseSend(sw, { type: "error", message: msg });
      } finally {
        heartbeatStop.stopped = true;
        try { await writer.close(); } catch {}
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // ── Merge-only action ──
  if (action === "merge") {
    if (!videoUrls || videoUrls.length < 2 || !falApiKey) {
      return NextResponse.json({ error: "Video URLs and Fal.ai API key are required for merge" }, { status: 400 });
    }
    try {
      const mergedUrl = await mergeVideosFal(videoUrls, falApiKey);
      return NextResponse.json({ videoUrl: mergedUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // ── Full generation pipeline ──
  if (!sceneImageUrls || sceneImageUrls.length < 2) {
    return NextResponse.json({ error: "At least 2 scene images are required" }, { status: 400 });
  }
  if (model === "veo3_lite" && !kieApiKey) {
    return NextResponse.json({ error: "KIE API key is required for Veo model" }, { status: 400 });
  }
  if (model === "grok-imagine" && !falApiKey) {
    return NextResponse.json({ error: "fal.ai API key is required for Grok model" }, { status: 400 });
  }

  const prompts = videoPrompts || [];
  const totalVideos = sceneImageUrls.length - 1;

  // Set up SSE stream
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const sw: SafeWriter = { writer, closed: false };

  const heartbeatStop = { stopped: false };
  startHeartbeat(sw, heartbeatStop);

  // Run pipeline in background
  (async () => {
    try {
      const modelLabel = model === "grok-imagine" ? "Grok Imagine (fal.ai)" : "Veo 3.1 Lite (KIE AI)";
      sseSend(sw, { type: "started", totalVideos, message: `Starting generation of ${totalVideos} videos using ${modelLabel}...` });

      const videoUrls: string[] = [];

      for (let i = 0; i < totalVideos; i++) {
        const startFrame = sceneImageUrls[i];
        const endFrame = sceneImageUrls[i + 1];
        const videoPrompt = prompts[i] || `Smooth transition from scene ${i + 1} to scene ${i + 2}. Natural camera movement, cinematic quality.`;

        sseSend(sw, { type: "video_progress", videoIndex: i, pct: 5, message: `Video ${i + 1}/${totalVideos}: Submitting to ${modelLabel}...` });

        try {
          const videoUrl = await generateVideo(startFrame, endFrame, videoPrompt, kieApiKey || "", falApiKey || "", model);
          videoUrls.push(videoUrl);
          sseSend(sw, { type: "video_done", videoIndex: i, videoUrl, message: `Video ${i + 1}/${totalVideos} complete!` });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          sseSend(sw, { type: "video_error", videoIndex: i, error: msg, message: `Video ${i + 1}/${totalVideos} failed: ${msg}` });
          // Continue with remaining videos even if one fails
        }

        // Progress for next video
        if (i < totalVideos - 1) {
          sseSend(sw, { type: "video_progress", videoIndex: i + 1, pct: 0, message: `Preparing video ${i + 2}/${totalVideos}...` });
        }
      }

      // Merge if we have multiple successful videos
      const successfulVideos = videoUrls.filter(Boolean);
      if (successfulVideos.length > 1 && falApiKey) {
        sseSend(sw, { type: "merge_progress", message: `Merging ${successfulVideos.length} videos...` });

        try {
          const mergedUrl = await mergeVideosFal(successfulVideos, falApiKey);
          sseSend(sw, { type: "done", videoUrl: mergedUrl, videoUrls: successfulVideos, message: "All done! Merged video ready." });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          sseSend(sw, { type: "merge_error", error: msg, message: `Merge failed: ${msg}. Individual videos are still available.` });
          if (successfulVideos.length === 1) {
            sseSend(sw, { type: "done", videoUrl: successfulVideos[0], videoUrls: successfulVideos, message: "Single video ready." });
          }
        }
      } else if (successfulVideos.length === 1) {
        sseSend(sw, { type: "done", videoUrl: successfulVideos[0], videoUrls: successfulVideos, message: "Single video ready." });
      } else if (successfulVideos.length > 1 && !falApiKey) {
        sseSend(sw, { type: "done", videoUrls: successfulVideos, message: "Videos ready. Fal.ai API key needed for merge." });
      } else {
        sseSend(sw, { type: "error", message: "No videos were generated successfully." });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sseSend(sw, { type: "error", message: msg });
    } finally {
      heartbeatStop.stopped = true;
      try {
        await writer.close();
      } catch {}
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
