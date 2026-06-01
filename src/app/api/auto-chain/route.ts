import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── SSE Helper ────────────────────────────────────────────────────────
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

// ─── Upload Image to KIE ─────────────────────────────────────────────
async function uploadImageToKie(
  base64Data: string,
  fileName: string,
  apiKey: string
): Promise<string> {
  let rawBase64 = base64Data;
  if (rawBase64.includes(",")) rawBase64 = rawBase64.split(",")[1];

  const res = await fetch("https://kieai.redpandaai.co/api/file-base64-upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ base64Data: rawBase64, fileName, uploadPath: "images" }),
  });

  const json = await res.json();
  if (!json.success) throw new Error("Image upload failed: " + (json.msg || JSON.stringify(json)));
  const downloadUrl = json.data?.downloadUrl;
  if (!downloadUrl) throw new Error("Upload succeeded but no downloadUrl returned");
  return downloadUrl;
}

// ─── Generate Script (DeepSeek) ────────────────────────────────────────
async function generateScript(
  topic: string,
  duration: number,
  apiKey: string,
  provider: string = "deepseek"
): Promise<Array<{ script: string; framePrompt: string; description: string; label: string }>> {
  const AI_PROVIDERS: Record<string, { apiUrl: string; model: string }> = {
    deepseek: { apiUrl: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-chat" },
    groq: { apiUrl: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile" },
    gemini: { apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-2.0-flash" },
  };

  const prov = AI_PROVIDERS[provider] || AI_PROVIDERS.deepseek;
  const sceneCount = Math.max(2, Math.ceil(duration / 8));

  const systemPrompt =
    `You are an expert video scriptwriter. You create engaging scripts for AI avatar videos.` +
    `\n\nRules:` +
    `\n- Create EXACTLY ${sceneCount} scenes` +
    `\n- Each scene should be 15-25 words (2-3 short sentences, ~8 seconds spoken)` +
    `\n- Each scene flows naturally into the next` +
    `\n- Use conversational, engaging language` +
    `\n- For EACH scene, create a detailed IMAGE PROMPT describing the visual setting, person's appearance, pose, expression, and environment` +
    `\n- The image prompts should describe DIFFERENT backgrounds/environments per scene to make the video visually interesting` +
    `\n- Person should be looking at camera in every scene` +
    `\n\nCRITICAL: Respond ONLY with a valid JSON object. No markdown. No code blocks.` +
    `\n{"scenes": [{"label": "SCENE_LABEL", "script": "the spoken dialogue", "framePrompt": "detailed image prompt: describe the person, their pose, expression, clothing, and the background/setting for this scene. Looking at camera. Photorealistic.", "description": "brief visual setting"}]}`;

  const userPrompt = `Topic: "${topic}"\nDuration: ${duration} seconds (${sceneCount} scenes)\n\nCreate the script:`;

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const response = await fetch(prov.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: prov.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.9,
          max_tokens: 4000,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "Unknown error");
        if (attempt < 2) { await sleep(2000); continue; }
        throw new Error(`Script API error (${response.status}): ${errText.slice(0, 300)}`);
      }

      const completion = await response.json();
      const rawContent = completion?.choices?.[0]?.message?.content || "";
      if (!rawContent.trim()) { if (attempt < 2) { await sleep(2000); continue; } throw new Error("Empty script response"); }

      // Parse JSON
      let jsonStr = rawContent.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();
      const braceStart = jsonStr.indexOf("{");
      const braceEnd = jsonStr.lastIndexOf("}");
      if (braceStart !== -1 && braceEnd !== -1) jsonStr = jsonStr.slice(braceStart, braceEnd + 1);

      let parsed;
      try { parsed = JSON.parse(jsonStr); } catch { if (attempt < 2) { await sleep(2000); continue; } throw new Error("Failed to parse script JSON"); }

      const scenes = parsed.scenes;
      if (!Array.isArray(scenes) || scenes.length === 0) throw new Error("No scenes in script");

      return scenes.map((s: any, i: number) => ({
        script: s.script || "",
        framePrompt: s.framePrompt || `Person looking at camera, ${s.description || "neutral background"}`,
        description: s.description || `Scene ${i + 1}`,
        label: s.label || `Scene ${i + 1}`,
      }));
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(2000);
    }
  }
  throw new Error("Script generation failed after retries");
}

// ─── Generate Frame with Reference (nano-banana-edit) ─────────────────
async function generateFrameWithRef(
  prompt: string,
  referenceImageUrl: string,
  apiKey: string
): Promise<string> {
  const imgPrompt =
    prompt.trim() +
    ". Keep the EXACT SAME person from the reference image — same face, same facial features, same hair, same skin tone, same body. " +
    "Photorealistic, high quality, 9:16 vertical format. Fixed tripod shot, looking at camera.";

  const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/nano-banana-edit",
      input: { prompt: imgPrompt, image_urls: [referenceImageUrl], image_size: "9:16", output_format: "png", strength: 0.5 },
    }),
  });

  const json = await res.json();
  if (json.code !== 200) throw new Error("Frame submit failed: " + (json.msg || JSON.stringify(json)));
  const taskId = json.data?.taskId;
  if (!taskId) throw new Error("No taskId for frame generation");

  // Poll for result
  for (let i = 0; i < 120; i++) {
    try {
      const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const pollJson = await pollRes.json();

      if (pollJson.code === 200) {
        const d = pollJson.data;
        if (d?.state === "success") {
          let result;
          if (typeof d.resultJson === "string") { try { result = JSON.parse(d.resultJson); } catch { result = d.resultJson; } }
          else { result = d.resultJson; }
          const imageUrl = result?.resultUrls?.[0] || result?.result_url || result?.url;
          if (imageUrl) return imageUrl;
          throw new Error("Frame ready but no URL");
        }
        if (d?.state === "fail") throw new Error("Frame generation failed: " + (d?.failMsg || "unknown"));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("generation failed") || msg.includes("no URL")) throw err;
    }
    await sleep(3000);
  }
  throw new Error("Frame generation timed out after 6 minutes");
}

// ─── Download & Re-upload Frame to KIE ────────────────────────────────
async function downloadAndReupload(imageUrl: string, apiKey: string, label: string): Promise<string> {
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Download failed: ${imgRes.status}`);
    const imgBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(imgBuffer).toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;
    return await uploadImageToKie(dataUrl, `${label}_${Date.now()}.png`, apiKey);
  } catch {
    return imageUrl; // Fallback to original URL
  }
}

// ─── Generate Video (Veo) ────────────────────────────────────────────
async function generateVideo(
  frameUrl: string,
  script: string,
  apiKey: string,
  videoModel: string = "veo3_lite"
): Promise<string> {
  const VIDEO_VOICE_PROMPT =
    "AUDIO RULES: MUTE ALL BACKGROUND AUDIO COMPLETELY. " +
    "ZERO music, ZERO ambient sounds. " +
    "The ONLY audio allowed is the person's own voice: clear, warm, natural speaking voice. " +
    "Voice-only audio, no music, no effects. ";

  const videoPrompt =
    `This is a talking-head video. The reference image is the ONLY source of truth for the person's appearance. ` +
    `NO transitions, NO fade-in, NO fade-out, NO cuts. RAW unedited footage. Static camera. ` +
    `The person speaks with natural hand gestures and expressive body language. ` +
    `Dialogue: "${script}" ${VIDEO_VOICE_PROMPT}`;

  const res = await fetch("https://api.kie.ai/api/v1/veo/generate", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: videoPrompt,
      imageUrls: [frameUrl],
      model: videoModel,
      aspect_ratio: "9:16",
      enableTranslation: true,
    }),
  });

  const json = await res.json();
  if (json.code !== 200) throw new Error("Video submit failed: " + (json.msg || JSON.stringify(json)));
  const taskId = json.data?.taskId;
  if (!taskId) throw new Error("No taskId for video generation");

  // Poll for result
  for (let i = 0; i < 180; i++) {
    try {
      const pollRes = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const pollJson = await pollRes.json();

      if (pollJson.code === 200) {
        const d = pollJson.data;
        if (d?.successFlag === 1 || d?.status === "success" || d?.state === "success") {
          let resp = d.response || d.result || d;
          if (typeof resp === "string") { try { resp = JSON.parse(resp); } catch {} }
          let videoUrl =
            resp?.resultUrls?.[0] || resp?.originUrls?.[0] || resp?.url ||
            resp?.videoUrl || resp?.video_url ||
            d.resultUrls?.[0] || d.videoUrl || d.url;
          if (!videoUrl && typeof resp?.resultUrls === "string") { try { videoUrl = JSON.parse(resp.resultUrls)[0]; } catch {} }
          if (!videoUrl) {
            const urlPattern = /https?:\/\/[^\s"']+\.(mp4|mov|avi|webm)/i;
            const match = JSON.stringify(d).match(urlPattern);
            if (match) videoUrl = match[0];
          }
          if (!videoUrl) {
            const anyUrlPattern = /https?:\/\/[^\s"']+/g;
            const allUrls = JSON.stringify(d).match(anyUrlPattern) || [];
            videoUrl = allUrls.find((u: string) => /video|cdn|media|output|result|download|veo|sora/i.test(u)) || allUrls[0] || "";
          }
          if (videoUrl) return videoUrl;
          throw new Error("Video ready but no URL");
        }
        if (d?.successFlag === 2 || d?.successFlag === 3 || d?.status === "failed" || d?.state === "fail") {
          throw new Error("Video generation failed: " + (d?.errorMessage || d?.error || "unknown"));
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

// ─── Merge Videos (fal.ai) ───────────────────────────────────────────
async function mergeVideos(videoUrls: string[], falApiKey: string): Promise<string> {
  const res = await fetch("https://queue.fal.run/fal-ai/ffmpeg-api/merge-videos", {
    method: "POST",
    headers: { Authorization: `Key ${falApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ video_urls: videoUrls }),
  });

  const json = await res.json();

  // Direct result
  if (json.video?.url) return json.video.url;
  if (typeof json.url === "string") return json.url;

  // Async polling
  const requestId = json.request_id;
  if (requestId) {
    const statusUrl = json.status_url || `https://queue.fal.run/fal-ai/ffmpeg-api/requests/${requestId}/status`;
    const responseUrl = json.response_url || `https://queue.fal.run/fal-ai/ffmpeg-api/requests/${requestId}`;

    for (let i = 0; i < 90; i++) {
      await sleep(3000);
      try {
        const statusRes = await fetch(statusUrl, { headers: { Authorization: `Key ${falApiKey}` } });
        const statusJson = await statusRes.json();

        if (statusJson.status === "COMPLETED") {
          const resultRes = await fetch(responseUrl, { headers: { Authorization: `Key ${falApiKey}` } });
          const resultJson = await resultRes.json();
          if (resultJson.video?.url) return resultJson.video.url;
          if (typeof resultJson.url === "string") return resultJson.url;
          throw new Error("Merge done but no URL");
        }
        if (statusJson.status === "FAILED") throw new Error("Merge failed: " + (statusJson.error || "unknown"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Merge failed") || msg.includes("no URL")) throw err;
      }
    }
    throw new Error("Merge timed out");
  }

  throw new Error("Merge failed: " + JSON.stringify(json).slice(0, 300));
}

// ═══════════════════════════════════════════════════════════════════════
// POST Handler — Auto Chain Pipeline
// ═══════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    action,
    // Script generation
    topic, duration, aiApiKey, aiProvider,
    // Full pipeline
    characterImageUrl, scenes: requestScenes,
    kieApiKey, falApiKey, videoModel,
  } = body as {
    action?: string;
    topic?: string;
    duration?: number;
    aiApiKey?: string;
    aiProvider?: string;
    characterImageUrl?: string;
    scenes?: Array<{ script: string; framePrompt: string; description: string; label: string }>;
    kieApiKey?: string;
    falApiKey?: string;
    videoModel?: string;
  };

  // ── Action: Generate Script Only ──
  if (action === "generate_script") {
    if (!topic?.trim()) return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    if (!aiApiKey) return NextResponse.json({ error: "AI API key is required" }, { status: 400 });

    try {
      const scenes = await generateScript(topic.trim(), duration || 30, aiApiKey, aiProvider || "deepseek");
      return NextResponse.json({ scenes });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // ── Action: Full Auto Chain Pipeline ──
  if (!characterImageUrl) return NextResponse.json({ error: "Character image URL is required" }, { status: 400 });
  if (!requestScenes || requestScenes.length === 0) return NextResponse.json({ error: "Scenes are required" }, { status: 400 });
  if (!kieApiKey) return NextResponse.json({ error: "KIE API key is required" }, { status: 400 });

  const model = videoModel || "veo3_lite";
  const totalScenes = requestScenes.length;

  // Set up SSE stream
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const sw: SafeWriter = { writer, closed: false };
  const heartbeatStop = { stopped: false };
  startHeartbeat(sw, heartbeatStop);

  // Run pipeline in background
  (async () => {
    try {
      sseSend(sw, { type: "pipeline_started", totalScenes, message: `Auto Chain: ${totalScenes} scenes` });

      // ── STEP 1: Chained Frame Generation ──
      sseSend(sw, { type: "step_change", step: "frames", message: "Generating frames (chained reference)..." });

      const frameUrls: string[] = [];
      let currentRefUrl = characterImageUrl; // Start with character image as reference

      for (let i = 0; i < totalScenes; i++) {
        const scene = requestScenes[i];
        const pct = Math.round(((i) / totalScenes) * 50);

        sseSend(sw, {
          type: "frame_progress",
          sceneIndex: i,
          pct,
          message: `Frame ${i + 1}/${totalScenes}: Generating with ${i === 0 ? "character" : "previous frame"} as reference...`,
        });

        try {
          // Generate frame using current reference (character for scene 1, previous frame for rest)
          const rawFrameUrl = await generateFrameWithRef(scene.framePrompt, currentRefUrl, kieApiKey);
          const kieFrameUrl = await downloadAndReupload(rawFrameUrl, kieApiKey, `chain_frame_${i}`);

          frameUrls.push(kieFrameUrl);
          // Next scene will use this frame as reference (the chain!)
          currentRefUrl = kieFrameUrl;

          sseSend(sw, {
            type: "frame_done",
            sceneIndex: i,
            frameUrl: kieFrameUrl,
            message: `Frame ${i + 1}/${totalScenes} complete!`,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          sseSend(sw, { type: "frame_error", sceneIndex: i, error: msg, message: `Frame ${i + 1} failed: ${msg}` });
          // On frame failure, try to continue with the current reference (don't break the chain completely)
          frameUrls.push("");
        }
      }

      const successfulFrames = frameUrls.filter(Boolean);
      sseSend(sw, { type: "frames_complete", frameUrls, successCount: successfulFrames.length, message: `${successfulFrames.length}/${totalScenes} frames generated` });

      if (successfulFrames.length === 0) {
        sseSend(sw, { type: "error", message: "No frames were generated successfully" });
        return;
      }

      // ── STEP 2: Video Generation ──
      sseSend(sw, { type: "step_change", step: "videos", message: "Generating videos..." });

      const videoUrls: string[] = [];
      for (let i = 0; i < totalScenes; i++) {
        if (!frameUrls[i]) {
          // Skip scenes where frame failed
          videoUrls.push("");
          continue;
        }

        const scene = requestScenes[i];
        const pct = 50 + Math.round((i / totalScenes) * 40);

        sseSend(sw, {
          type: "video_progress",
          sceneIndex: i,
          pct,
          message: `Video ${i + 1}/${totalScenes}: Generating...`,
        });

        try {
          const videoUrl = await generateVideo(frameUrls[i], scene.script, kieApiKey, model);
          videoUrls.push(videoUrl);

          sseSend(sw, {
            type: "video_done",
            sceneIndex: i,
            videoUrl,
            message: `Video ${i + 1}/${totalScenes} complete!`,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          videoUrls.push("");
          sseSend(sw, { type: "video_error", sceneIndex: i, error: msg, message: `Video ${i + 1} failed: ${msg}` });
        }
      }

      const successfulVideos = videoUrls.filter(Boolean);
      sseSend(sw, { type: "videos_complete", videoUrls, successCount: successfulVideos.length, message: `${successfulVideos.length}/${totalScenes} videos generated` });

      if (successfulVideos.length === 0) {
        sseSend(sw, { type: "error", message: "No videos were generated successfully" });
        return;
      }

      // ── STEP 3: Merge ──
      if (successfulVideos.length > 1 && falApiKey) {
        sseSend(sw, { type: "step_change", step: "merge", message: "Merging videos..." });

        try {
          const mergedUrl = await mergeVideos(successfulVideos, falApiKey);
          sseSend(sw, { type: "done", videoUrl: mergedUrl, videoUrls: successfulVideos, frameUrls, message: "Auto Chain complete! Merged video ready." });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          sseSend(sw, { type: "merge_error", error: msg, message: `Merge failed: ${msg}` });
          sseSend(sw, { type: "done", videoUrls: successfulVideos, frameUrls, message: "Videos ready (merge failed)" });
        }
      } else if (successfulVideos.length === 1) {
        sseSend(sw, { type: "done", videoUrl: successfulVideos[0], videoUrls: successfulVideos, frameUrls, message: "Auto Chain complete! Single video ready." });
      } else {
        sseSend(sw, { type: "done", videoUrls: successfulVideos, frameUrls, message: `${successfulVideos.length} videos ready (no merge key)` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sseSend(sw, { type: "error", message: msg });
    } finally {
      heartbeatStop.stopped = true;
      try { await writer.close(); } catch {}
    }
  })();

  return new Response(stream.readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
