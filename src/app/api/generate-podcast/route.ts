import { NextRequest } from "next/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── API Keys ──────────────────────────────────────────────────────────────
const DEFAULT_KIE_API_KEY = "e80261e40f242ed38ce14f4beb6e6f15";
const DEFAULT_FAL_API_KEY = "9bf7d3b9-a407-4b19-979d-f438ebf738e2:5dbedfec1d01434a997480bd5dab5803";

// ─── SSE Helper ────────────────────────────────────────────────────────────
function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ─── Poll kie.ai VEO3 video result ─────────────────────────────────────────
async function pollKieVideo(
  taskId: string,
  apiKey: string,
  send: (data: Record<string, unknown>) => void,
  videoIndex: number,
  totalVideos: number
): Promise<string> {
  const url = `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`;

  for (let i = 0; i < 180; i++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const pollText = await res.text();
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(pollText);
      } catch {
        await sleep(3000);
        continue;
      }

      if (json.code === 200) {
        const d = json.data as Record<string, unknown>;
        const response = d?.response as Record<string, unknown> | undefined;
        const successFlag = d?.successFlag as number | undefined;

        if (successFlag === 1 && response?.resultUrls) {
          const urls = response.resultUrls as string[];
          if (urls.length > 0) return urls[0];
        }
        if (successFlag === 2 || successFlag === 3) {
          throw new Error("Video generation failed: " + (d?.errorMessage || "unknown error"));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Video generation failed")) throw err;
    }

    // Send progress ping
    const elapsed = (i + 1) * 3;
    send({
      type: "progress",
      step: 1,
      pct: Math.min(Math.round((elapsed / 120) * 100), 95),
      message: `Generating video ${videoIndex}/${totalVideos}... (${elapsed}s elapsed)`,
    });

    await sleep(3000);
  }
  throw new Error("Video generation timed out");
}

// ─── Generate a single video from character image ──────────────────────────
async function generateCharacterVideo(
  characterImageUrl: string,
  dialogueText: string,
  apiKey: string,
  send: (data: Record<string, unknown>) => void,
  videoIndex: number,
  totalVideos: number
): Promise<string> {
  send({
    type: "progress",
    step: 1,
    pct: 0,
    message: `Starting video ${videoIndex}/${totalVideos}: Character speaking...`,
  });

  const submitRes = await fetch("https://api.kie.ai/api/v1/veo/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: `realistic arm movements, the woman/man says exactly with direct clear energy: "${dialogueText}"`,
      imageUrls: [characterImageUrl],
      model: "veo3_lite",
      generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
      aspect_ratio: "9:16",
      enableTranslation: true,
    }),
  });

  const submitText = await submitRes.text();
  let submitJson: Record<string, unknown>;
  try {
    submitJson = JSON.parse(submitText);
  } catch {
    throw new Error("kie.ai VEO3 API returned non-JSON: " + submitText.slice(0, 200));
  }

  if (submitJson.code !== 200) {
    throw new Error(
      "Failed to submit video task: " + (submitJson.msg || submitText.slice(0, 200))
    );
  }

  const taskId = (submitJson.data as Record<string, unknown>)?.taskId as string;
  if (!taskId) {
    throw new Error("No taskId returned from VEO3 API");
  }

  send({
    type: "progress",
    step: 1,
    pct: 10,
    message: `Video ${videoIndex}/${totalVideos}: submitted to AI (task ${taskId.slice(0, 8)}...)`,
  });

  const videoUrl = await pollKieVideo(taskId, apiKey, send, videoIndex, totalVideos);

  send({
    type: "progress",
    step: 1,
    pct: 100,
    message: `Video ${videoIndex}/${totalVideos} completed!`,
  });

  return videoUrl;
}

// ─── Merge videos using fal.ai ffmpeg ──────────────────────────────────────
async function mergeVideosWithFal(
  videoUrls: string[],
  falApiKey: string,
  send: (data: Record<string, unknown>) => void
): Promise<string> {
  send({
    type: "progress",
    step: 2,
    pct: 0,
    message: `Merging ${videoUrls.length} videos together...`,
  });

  const submitRes = await fetch("https://queue.fal.run/fal-ai/ffmpeg-api/merge-videos", {
    method: "POST",
    headers: {
      Authorization: `Key ${falApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      video_urls: videoUrls,
      target_fps: 30,
      resolution: "portrait_16_9",
    }),
  });

  const submitJson = await submitRes.json() as Record<string, unknown>;
  const requestId = submitJson.request_id as string;

  if (!requestId) {
    throw new Error("Failed to submit merge request: " + JSON.stringify(submitJson).slice(0, 200));
  }

  send({
    type: "progress",
    step: 2,
    pct: 15,
    message: `Merge job queued (${requestId.slice(0, 8)}...), processing...`,
  });

  // Poll for result
  for (let i = 0; i < 120; i++) {
    await sleep(3000);

    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/ffmpeg-api/merge-videos/requests/${requestId}/status`,
      { headers: { Authorization: `Key ${falApiKey}` } }
    );
    const statusJson = await statusRes.json() as Record<string, unknown>;
    const status = statusJson.status as string;

    const pct = Math.min(15 + Math.round(((i + 1) / 60) * 85), 95);
    send({
      type: "progress",
      step: 2,
      pct,
      message: `Merging videos... (${(i + 1) * 3}s elapsed)`,
    });

    if (status === "COMPLETED") {
      const resultRes = await fetch(
        `https://queue.fal.run/fal-ai/ffmpeg-api/merge-videos/requests/${requestId}`,
        { headers: { Authorization: `Key ${falApiKey}` } }
      );
      const resultJson = await resultRes.json() as Record<string, unknown>;
      const video = resultJson.video as Record<string, unknown>;
      const mergedUrl = video?.url as string;

      if (!mergedUrl) {
        throw new Error("Merge completed but no video URL returned");
      }

      send({
        type: "progress",
        step: 2,
        pct: 100,
        message: `Merge complete! Final podcast video ready.`,
      });

      return mergedUrl;
    }

    if (status === "FAILED") {
      throw new Error("Video merge failed: " + JSON.stringify(statusJson).slice(0, 200));
    }
  }

  throw new Error("Video merge timed out");
}

// ─── POST /api/generate-podcast (SSE Streaming) ────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    char1ImageUrl,
    char2ImageUrl,
    char1Dialogues = [],
    char2Dialogues = [],
    kieApiKey,
    falApiKey,
  } = body;

  if (!char1ImageUrl || !char2ImageUrl) {
    return new Response(JSON.stringify({ error: "Both character images are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const totalDialogues1 = char1Dialogues.filter((d: string) => d && d.trim()).length;
  const totalDialogues2 = char2Dialogues.filter((d: string) => d && d.trim()).length;

  if (totalDialogues1 === 0 && totalDialogues2 === 0) {
    return new Response(JSON.stringify({ error: "At least one dialogue line is required for each character" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const kieKey = (kieApiKey && kieApiKey.length >= 10) ? kieApiKey : (process.env.KIE_API_KEY || DEFAULT_KIE_API_KEY);
  const falKey = (falApiKey && falApiKey.length >= 10) ? falApiKey : (process.env.FAL_API_KEY || DEFAULT_FAL_API_KEY);

  // Build alternating sequence
  const sequence: Array<{ character: 1 | 2; text: string }> = [];
  const maxRounds = Math.max(totalDialogues1, totalDialogues2);

  for (let i = 0; i < maxRounds; i++) {
    if (i < totalDialogues1) sequence.push({ character: 1, text: char1Dialogues[i].trim() });
    if (i < totalDialogues2) sequence.push({ character: 2, text: char2Dialogues[i].trim() });
  }

  const totalVideos = sequence.length;

  // ─── SSE Stream ──────────────────────────────────────────────────────
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseEvent(data)));
      };

      try {
        // Pipeline started
        send({
          type: "started",
          message: `Pipeline started: ${totalVideos} videos to generate, then merge.`,
        });

        // ─── Step 1: Generate Videos ───────────────────────────────────
        const videoUrls: string[] = [];
        const errors: Array<{ index: number; character: number; text: string; error: string }> = [];

        for (let i = 0; i < sequence.length; i++) {
          const item = sequence[i];
          const imageUrl = item.character === 1 ? char1ImageUrl : char2ImageUrl;

          send({
            type: "progress",
            step: 1,
            pct: Math.round((i / sequence.length) * 100),
            message: `Video ${i + 1}/${totalVideos}: Character ${item.character} speaking...`,
          });

          try {
            const videoUrl = await generateCharacterVideo(imageUrl, item.text, kieKey, send, i + 1, totalVideos);
            videoUrls.push(videoUrl);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push({ index: i + 1, character: item.character, text: item.text, error: msg });
            send({
              type: "video_error",
              index: i + 1,
              character: item.character,
              error: msg,
            });
          }
        }

        if (videoUrls.length === 0) {
          send({
            type: "error",
            message: "All video generations failed",
            errors,
          });
          controller.close();
          return;
        }

        // ─── Step 2: Merge Videos ─────────────────────────────────────
        let mergedVideoUrl: string | null = null;

        if (videoUrls.length >= 2) {
          try {
            mergedVideoUrl = await mergeVideosWithFal(videoUrls, falKey, send);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            send({ type: "merge_error", error: msg });
            // Continue with individual videos
          }
        } else if (videoUrls.length === 1) {
          mergedVideoUrl = videoUrls[0];
          send({
            type: "progress",
            step: 2,
            pct: 100,
            message: "Only one video generated, skipping merge.",
          });
        }

        // ─── Done ─────────────────────────────────────────────────────
        send({
          type: "progress",
          step: 3,
          pct: 100,
          message: "Podcast complete!",
        });

        send({
          type: "done",
          mergedVideoUrl,
          individualVideos: videoUrls,
          totalGenerated: videoUrls.length,
          totalRequested: totalVideos,
          errors: errors.length > 0 ? errors : undefined,
        });

      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        send({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
