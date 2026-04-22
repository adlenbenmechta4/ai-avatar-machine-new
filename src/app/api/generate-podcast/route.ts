import { NextRequest, NextResponse } from "next/server";
import { createJob, updateJob, updateScene, setJobDone, setJobError, addJobLog } from "@/lib/job-store";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── API Keys ──────────────────────────────────────────────────────────────
const DEFAULT_KIE_API_KEY = "e80261e40f242ed38ce14f4beb6e6f15";
const DEFAULT_FAL_API_KEY = "9bf7d3b9-a407-4b19-979d-f438ebf738e2:5dbedfec1d01434a997480bd5dab5803";

// ─── SSE Helper (error-safe: never throws, keeps pipeline alive when client disconnects) ──
let sseWriterDead = false;
function sse(writer: WritableStreamDefaultWriter<Uint8Array> | null, event: Record<string, unknown>) {
  if (!writer || sseWriterDead) return;
  try {
    writer.write(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
  } catch {
    sseWriterDead = true; // Mark as dead so we stop trying
    console.warn("[SSE] Writer is closed/broken, stopping SSE output (pipeline continues in background)");
  }
}

// ─── Heartbeat: keeps SSE alive during long operations ─────────────────────
async function startHeartbeat(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  stopSignal: { stopped: boolean }
) {
  while (!stopSignal.stopped) {
    await sleep(8000);
    if (!stopSignal.stopped) {
      if (sseWriterDead) {
        stopSignal.stopped = true;
        break;
      }
      try {
        sse(writer, { type: "ping", t: Date.now() });
      } catch {
        stopSignal.stopped = true;
      }
    }
  }
}

// ─── Kie.ai Video Polling (same as AI Avatar Machine) ─────────────────────
async function pollKieVideo(
  jobId: string,
  sceneIndex: number,
  taskId: string,
  apiKey: string,
  writer: WritableStreamDefaultWriter<Uint8Array> | null
): Promise<string> {
  const url = `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`;
  for (let i = 0; i < 180; i++) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      const json = await res.json();

      // Check failure even when code !== 200
      const d = json.data;
      const statusStr = String(d?.status || d?.state || "").toLowerCase();
      const successFlag = d?.successFlag;
      const errorMsg = d?.errorMessage || d?.error || d?.failMsg || d?.message || "";

      // Detect failure statuses
      const isFailed =
        successFlag === 2 || successFlag === 3 ||
        statusStr === "failed" || statusStr === "fail" || statusStr === "failure" ||
        statusStr === "error" || statusStr === "rejected" || statusStr === "cancelled" ||
        (json.code !== 200 && json.code !== 0 && statusStr.includes("fail"));

      if (isFailed) {
        console.error(`[Podcast Video Poll] FAILURE detected for taskId=${taskId}:`, JSON.stringify(d).slice(0, 500));
        throw new Error("Video gen failed: " + (errorMsg || "unknown error") + ` [status=${statusStr}, flag=${successFlag}]`);
      }

      if (json.code === 200) {
        if (successFlag === 1 || statusStr === "success") {
          let resp = d.response || d.result || d;
          if (typeof resp === "string") { try { resp = JSON.parse(resp); } catch {} }
          let videoUrl = resp?.resultUrls?.[0] || resp?.originUrls?.[0] || resp?.url || d.resultUrls?.[0] || d.videoUrl || d.video_url;
          if (!videoUrl && typeof resp?.resultUrls === "string") { try { videoUrl = JSON.parse(resp.resultUrls)[0]; } catch {} }
          if (videoUrl) return videoUrl;
          throw new Error("Video ready but no URL: " + JSON.stringify(d).slice(0, 300));
        }
      }

      // Send progress every ~30 seconds to keep connection alive
      if (i % 6 === 0 && i > 0) {
        const elapsed = Math.round((i * 5) / 60);
        const pct = Math.min(90, 15 + Math.round(i * 0.5));
        const statusText = statusStr || "waiting";
        addJobLog(jobId, `Video ${sceneIndex + 1}: still processing... [${elapsed}m elapsed] (${statusText})`);
        updateScene(jobId, sceneIndex, { videoProgress: pct });
        if (writer) {
          try { sse(writer, { type: "progress", step: 1, pct, message: `Video ${sceneIndex + 1}: processing... [${elapsed}m] (${statusText})` }); } catch {}
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Video gen failed") || msg.includes("no URL")) throw err;
      console.warn(`[Podcast Video Poll ${i}] ${msg}`);
    }
    await sleep(5000);
  }
  throw new Error("Video generation timed out after 15 minutes");
}

// ─── Generate Character Video (with auto-retry, same as AI Avatar Machine) ─
async function generateCharacterVideo(
  jobId: string,
  sceneIndex: number,
  characterImageUrl: string,
  dialogueText: string,
  apiKey: string,
  writer: WritableStreamDefaultWriter<Uint8Array> | null,
  videoIndex: number,
  totalVideos: number
): Promise<string> {
  const MAX_RETRIES = 10;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        const retryDelay = Math.min(30000, 10000 * attempt); // 20s, 30s, 40s... up to 300s
        addJobLog(jobId, `Video ${videoIndex}: FAILURE detected! Retrying... (attempt ${attempt}/${MAX_RETRIES}), waiting ${Math.round(retryDelay / 1000)}s...`);
        updateScene(jobId, sceneIndex, { videoProgress: 0, error: "" });
        if (writer) {
          try { sse(writer, { type: "video_retry", index: videoIndex, attempt, maxRetries: MAX_RETRIES, message: `Video ${videoIndex}: Retrying (${attempt}/${MAX_RETRIES})...` }); } catch {}
        }
        await sleep(retryDelay);
      }

      const videoPrompt =
        `realistic arm movements, the woman/man says exactly with direct clear energy: "${dialogueText}"`;

      addJobLog(jobId, `Video ${videoIndex}/${totalVideos}: submitting to AI video engine${attempt > 1 ? ` (attempt ${attempt})` : ""}...`);
      updateScene(jobId, sceneIndex, { videoProgress: 5 });

      const res = await fetch("https://api.kie.ai/api/v1/veo/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: videoPrompt,
          imageUrls: [characterImageUrl],
          model: "veo3_lite",
          generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
          aspect_ratio: "9:16",
          enableTranslation: true,
        }),
      });
      const json = await res.json();
      updateScene(jobId, sceneIndex, { videoProgress: 10 });

      if (json.code !== 200) throw new Error("Video submit failed: " + (json.msg || JSON.stringify(json)));
      const taskId = json.data?.taskId;
      if (!taskId) throw new Error("No taskId for video generation");

      updateScene(jobId, sceneIndex, { videoProgress: 15 });
      addJobLog(jobId, `Video ${videoIndex}/${totalVideos}: task submitted (${taskId.slice(0, 8)}...), waiting (5-15 min)...`);

      const videoUrl = await pollKieVideo(jobId, sceneIndex, taskId, apiKey, writer);
      updateScene(jobId, sceneIndex, { videoProgress: 100, videoDone: true, videoUrl });
      addJobLog(jobId, `Video ${videoIndex}/${totalVideos}: complete!${attempt > 1 ? ` (succeeded on attempt ${attempt})` : ""}`);
      if (writer && attempt > 1) {
        try { sse(writer, { type: "video_retry_success", index: videoIndex, attempt, message: `Video ${videoIndex}: Succeeded on attempt ${attempt}!` }); } catch {}
      }
      return videoUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addJobLog(jobId, `Video ${videoIndex} attempt ${attempt} failed: ${msg}`);
      if (writer) {
        try { sse(writer, { type: "video_retry_failed", index: videoIndex, attempt, maxRetries: MAX_RETRIES, error: msg, message: `Video ${videoIndex} attempt ${attempt} failed, retrying...` }); } catch {}
      }
      if (attempt === MAX_RETRIES) {
        throw new Error(`Video ${videoIndex} failed after ${MAX_RETRIES} attempts: ${msg}`);
      }
      updateScene(jobId, sceneIndex, { videoProgress: 0 });
    }
  }
  throw new Error(`Video ${videoIndex}: unexpected exit from retry loop`);
}

// ─── Safe JSON parse ───────────────────────────────────────────────────────
async function safeJsonParse(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text || text.trim().length === 0) {
    throw new Error(`Empty response from ${res.url} (status ${res.status})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${res.url}: ${text.slice(0, 200)}`);
  }
}

// ─── Merge Videos (same as AI Avatar Machine) ──────────────────────────────
async function mergeVideos(
  jobId: string,
  videoUrls: string[],
  falApiKey: string,
  writer: WritableStreamDefaultWriter<Uint8Array> | null
): Promise<string> {
  addJobLog(jobId, "Merge: submitting videos to merger...");
  updateJob(jobId, { step: 2, mergeProgress: 5 });

  let json: Record<string, unknown> | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("https://queue.fal.run/fal-ai/ffmpeg-api/merge-videos", {
        method: "POST",
        headers: { Authorization: `Key ${falApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ video_urls: videoUrls }),
      });
      json = await safeJsonParse(res);
      break;
    } catch (mergeErr) {
      const msg = mergeErr instanceof Error ? mergeErr.message : String(mergeErr);
      console.warn(`[Podcast Merge] Submit attempt ${attempt} failed: ${msg}`);
      if (attempt === 3) throw new Error("Merge submit failed after 3 attempts: " + msg);
      await sleep(2000);
    }
  }

  if (!json) throw new Error("Merge submit failed: no response");

  // Check for direct synchronous result
  if (json.video && typeof json.video === "object" && (json.video as Record<string, unknown>).url) {
    const url = (json.video as Record<string, unknown>).url as string;
    updateJob(jobId, { mergeProgress: 100 });
    addJobLog(jobId, "Merge: complete!");
    if (writer) try { sse(writer, { type: "progress", step: 2, pct: 100, message: "Merge complete!" }); } catch {}
    return url;
  }
  if (json.url && typeof json.url === "string") {
    updateJob(jobId, { mergeProgress: 100 });
    addJobLog(jobId, "Merge: complete!");
    if (writer) try { sse(writer, { type: "progress", step: 2, pct: 100, message: "Merge complete!" }); } catch {}
    return json.url as string;
  }

  // Async result — poll for status (same URL pattern as AI Avatar Machine)
  const requestId = json.request_id as string | undefined;
  if (!requestId) {
    throw new Error("Merge failed: no direct URL and no request_id: " + JSON.stringify(json).slice(0, 300));
  }

  const responseUrl = `https://queue.fal.run/fal-ai/ffmpeg-api/requests/${requestId}`;
  const statusUrl = `https://queue.fal.run/fal-ai/ffmpeg-api/requests/${requestId}/status`;
  updateJob(jobId, { mergeProgress: 20 });
  addJobLog(jobId, "Merge: processing, polling status...");

  for (let i = 0; i < 90; i++) {
    await sleep(3000);

    try {
      const statusRes = await fetch(statusUrl, {
        method: "GET",
        headers: { Authorization: `Key ${falApiKey}` },
      });
      const statusJson = await safeJsonParse(statusRes);
      const status = statusJson.status as string | undefined;

      if (status === "COMPLETED") {
        updateJob(jobId, { mergeProgress: 80 });
        addJobLog(jobId, "Merge: fetching result...");

        const resultRes = await fetch(responseUrl, {
          method: "GET",
          headers: { Authorization: `Key ${falApiKey}` },
        });
        const resultJson = await safeJsonParse(resultRes);
        updateJob(jobId, { mergeProgress: 100 });

        const videoObj = resultJson.video as Record<string, unknown> | undefined;
        if (videoObj?.url) {
          addJobLog(jobId, "Merge: complete!");
          if (writer) try { sse(writer, { type: "progress", step: 2, pct: 100, message: "Merge complete!" }); } catch {}
          return videoObj.url as string;
        }
        if (typeof resultJson.url === "string") {
          addJobLog(jobId, "Merge: complete!");
          if (writer) try { sse(writer, { type: "progress", step: 2, pct: 100, message: "Merge complete!" }); } catch {}
          return resultJson.url as string;
        }
        throw new Error("Merge done but no URL: " + JSON.stringify(resultJson).slice(0, 300));
      }

      if (status === "FAILED") {
        throw new Error("Video merge failed: " + ((statusJson.error as string) || "unknown error"));
      }

      // Periodic log
      if (i % 10 === 0 && i > 0) {
        addJobLog(jobId, `Merge: still processing... [${i * 3}s elapsed]`);
        updateJob(jobId, { mergeProgress: Math.min(75, 20 + i) });
        const pct = Math.min(95, 20 + Math.round(((i + 1) / 60) * 75));
        if (writer) {
          try { sse(writer, { type: "progress", step: 2, pct, message: `Merging videos... [${i * 3}s elapsed]` }); } catch {}
        }
      }
    } catch (pollErr) {
      const pollMsg = pollErr instanceof Error ? pollErr.message : String(pollErr);
      if (pollMsg.includes("Merge failed") || pollMsg.includes("no URL")) throw pollErr;
      console.warn(`[Podcast Merge] Poll ${i + 1} error:`, pollMsg);
    }
  }

  throw new Error("Video merge timed out after 4.5 minutes");
}

// ─── Pipeline Runner (same architecture as AI Avatar Machine) ──────────────
async function runPodcastPipelineSSE(
  char1ImageUrl: string,
  char2ImageUrl: string,
  sequence: Array<{ character: 1 | 2; text: string }>,
  kieApiKey: string,
  falApiKey: string,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  jobId: string,
) {
  sseWriterDead = false; // Reset for each new pipeline run
  const heartbeatStop = { stopped: false };
  startHeartbeat(writer, heartbeatStop);

  try {
    createJob(jobId, sequence.length, "kie");
    addJobLog(jobId, "Podcast pipeline started");
    sse(writer, { type: "started", jobId, message: `Pipeline started: ${sequence.length} videos to generate` });

    // ══ STEP 1: Videos ══
    sse(writer, { type: "progress", step: 1, pct: 0, message: `Generating ${sequence.length} character videos...` });
    addJobLog(jobId, `Generating ${sequence.length} videos (5-15 min per video)...`);

    const videoUrls: string[] = [];
    const errors: Array<{ index: number; character: number; text: string; error: string }> = [];

    for (let i = 0; i < sequence.length; i++) {
      const item = sequence[i];
      const imageUrl = item.character === 1 ? char1ImageUrl : char2ImageUrl;

      sse(writer, { type: "progress", step: 1, pct: Math.round((i / sequence.length) * 90), message: `Creating video ${i + 1}/${sequence.length}: Character ${item.character} speaking...` });
      updateJob(jobId, { step: 1, message: `Video ${i + 1}/${sequence.length}: Character ${item.character}...` });

      try {
        const videoUrl = await generateCharacterVideo(jobId, i, imageUrl, item.text, kieApiKey, writer, i + 1, sequence.length);
        videoUrls.push(videoUrl);
        sse(writer, { type: "progress", step: 1, pct: Math.round(((i + 1) / sequence.length) * 90), message: `Video ${i + 1}/${sequence.length} complete!` });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ index: i + 1, character: item.character, text: item.text, error: msg });
        addJobLog(jobId, `ERROR: Video ${i + 1} failed: ${msg}`);
        updateScene(jobId, i, { error: msg });
        sse(writer, { type: "video_error", index: i + 1, character: item.character, error: msg });
      }
    }

    if (videoUrls.length === 0) {
      sse(writer, { type: "error", message: "All video generations failed" });
      setJobError(jobId, "All video generations failed");
      heartbeatStop.stopped = true;
      return;
    }

    addJobLog(jobId, `${videoUrls.length}/${sequence.length} videos generated successfully`);

    // ══ STEP 2: Merge ══
    let mergedVideoUrl: string | null = null;

    if (videoUrls.length >= 2) {
      try {
        sse(writer, { type: "progress", step: 2, pct: 0, message: `Merging ${videoUrls.length} videos...` });
        updateJob(jobId, { step: 2, message: "Merging videos..." });
        mergedVideoUrl = await mergeVideos(jobId, videoUrls, falApiKey, writer);
        addJobLog(jobId, "Merge complete!");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        addJobLog(jobId, `ERROR: Merge failed: ${msg}`);
        sse(writer, { type: "merge_error", error: msg });
        setJobError(jobId, "Merge failed but individual videos are available");
      }
    } else if (videoUrls.length === 1) {
      mergedVideoUrl = videoUrls[0];
      addJobLog(jobId, "Single video generated, no merge needed");
    }

    // ══ Done ══
    addJobLog(jobId, "Podcast pipeline complete!");
    if (mergedVideoUrl) {
      sse(writer, {
        type: "done",
        videoUrl: mergedVideoUrl,
        frameUrls: [char1ImageUrl, char2ImageUrl],
        videoUrls,
        individualVideos: videoUrls,
        totalGenerated: videoUrls.length,
        totalRequested: sequence.length,
        errors: errors.length > 0 ? errors : undefined,
      });
      setJobDone(jobId, mergedVideoUrl, [char1ImageUrl, char2ImageUrl], videoUrls);
    } else {
      // Merge failed but we have individual videos
      sse(writer, {
        type: "done",
        videoUrl: videoUrls[0], // first video as fallback
        mergedVideoUrl: null,
        frameUrls: [char1ImageUrl, char2ImageUrl],
        videoUrls,
        individualVideos: videoUrls,
        totalGenerated: videoUrls.length,
        totalRequested: sequence.length,
        errors: errors.length > 0 ? errors : undefined,
      });
      setJobDone(jobId, videoUrls[0], [char1ImageUrl, char2ImageUrl], videoUrls);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Podcast Pipeline ${jobId}] Failed:`, msg);
    addJobLog(jobId, `ERROR: ${msg}`);
    sse(writer, { type: "error", message: msg });
    setJobError(jobId, msg);
  } finally {
    heartbeatStop.stopped = true;
    try { writer.close(); } catch {}
  }
}

// ─── Generate Job ID ───────────────────────────────────────────────────────
function generateJobId(): string {
  return "pod_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 9);
}

// ─── POST /api/generate-podcast (SSE Streaming — same architecture as AI Avatar Machine) ──
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      const rawText = await req.text();
      if (!rawText || rawText.trim().length === 0) {
        return NextResponse.json({ error: "Empty request body" }, { status: 400 });
      }
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const {
      char1ImageUrl,
      char2ImageUrl,
      char1Dialogues = [],
      char2Dialogues = [],
      kieApiKey,
      falApiKey,
    } = body;

    if (!char1ImageUrl || !char2ImageUrl) {
      return NextResponse.json({ error: "Both character images are required" }, { status: 400 });
    }

    const totalDialogues1 = (char1Dialogues as string[]).filter((d: string) => d && d.trim()).length;
    const totalDialogues2 = (char2Dialogues as string[]).filter((d: string) => d && d.trim()).length;

    if (totalDialogues1 === 0 && totalDialogues2 === 0) {
      return NextResponse.json({ error: "At least one dialogue line is required for each character" }, { status: 400 });
    }

    const kieKey = (kieApiKey && typeof kieApiKey === "string" && kieApiKey.length >= 10) ? kieApiKey : (process.env.KIE_API_KEY || DEFAULT_KIE_API_KEY);
    const falKey = (falApiKey && typeof falApiKey === "string" && falApiKey.length >= 10) ? falApiKey : (process.env.FAL_API_KEY || DEFAULT_FAL_API_KEY);

    // Build alternating sequence
    const sequence: Array<{ character: 1 | 2; text: string }> = [];
    const maxRounds = Math.max(totalDialogues1, totalDialogues2);

    for (let i = 0; i < maxRounds; i++) {
      if (i < totalDialogues1) sequence.push({ character: 1, text: ((char1Dialogues as string[])[i] || "").trim() });
      if (i < totalDialogues2) sequence.push({ character: 2, text: ((char2Dialogues as string[])[i] || "").trim() });
    }

    // Use TransformStream (same as AI Avatar Machine)
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const jobId = generateJobId();

    // Run pipeline in background (don't await)
    runPodcastPipelineSSE(
      char1ImageUrl as string,
      char2ImageUrl as string,
      sequence,
      kieKey,
      falKey,
      writer,
      jobId,
    );

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store, no-transform, must-revalidate",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
