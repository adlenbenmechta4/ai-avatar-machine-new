import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── API Keys ──────────────────────────────────────────────────────────────
const DEFAULT_KIE_API_KEY = "e80261e40f242ed38ce14f4beb6e6f15";
const DEFAULT_FAL_API_KEY = "9bf7d3b9-a407-4b19-979d-f438ebf738e2:5dbedfec1d01434a997480bd5dab5803";

// ─── Poll kie.ai VEO3 video result ─────────────────────────────────────────
async function pollKieVideo(taskId: string, apiKey: string): Promise<string> {
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
    await sleep(3000);
  }
  throw new Error("Video generation timed out after 9 minutes");
}

// ─── Generate a single video from character image ──────────────────────────
async function generateCharacterVideo(
  characterImageUrl: string,
  dialogueText: string,
  apiKey: string
): Promise<string> {
  const submitRes = await fetch("https://api.kie.ai/api/v1/veo/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: `realistic arm movements, the woman/man says exactly with direct clear energy: "${dialogueText}"`,
      imageUrls: [characterImageUrl],
      model: "veo3_fast",
      generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
      aspect_ratio: "9:16",
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

  console.log(`[Podcast] VEO3 task ${taskId} submitted, polling...`);
  const videoUrl = await pollKieVideo(taskId, apiKey);
  console.log(`[Podcast] Video ready: ${videoUrl.slice(0, 80)}...`);
  return videoUrl;
}

// ─── Merge videos using fal.ai ffmpeg ──────────────────────────────────────
async function mergeVideosWithFal(videoUrls: string[], falApiKey: string): Promise<string> {
  // Step 1: Submit merge request
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

  console.log(`[Podcast] Merge request ${requestId} submitted, polling...`);

  // Step 2: Poll for result
  for (let i = 0; i < 120; i++) {
    await sleep(3000);

    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/ffmpeg-api/merge-videos/requests/${requestId}/status`,
      { headers: { Authorization: `Key ${falApiKey}` } }
    );
    const statusJson = await statusRes.json() as Record<string, unknown>;
    const status = statusJson.status as string;

    if (status === "COMPLETED") {
      // Fetch result
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

      console.log(`[Podcast] Merged video ready: ${mergedUrl.slice(0, 80)}...`);
      return mergedUrl;
    }

    if (status === "FAILED") {
      throw new Error("Video merge failed: " + JSON.stringify(statusJson).slice(0, 200));
    }
  }

  throw new Error("Video merge timed out after 6 minutes");
}

// ─── POST /api/generate-podcast ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      return NextResponse.json(
        { error: "Both character images are required" },
        { status: 400 }
      );
    }

    const totalDialogues1 = char1Dialogues.filter((d: string) => d && d.trim()).length;
    const totalDialogues2 = char2Dialogues.filter((d: string) => d && d.trim()).length;

    if (totalDialogues1 === 0 && totalDialogues2 === 0) {
      return NextResponse.json(
        { error: "At least one dialogue line is required for each character" },
        { status: 400 }
      );
    }

    const kieKey = (kieApiKey && kieApiKey.length >= 10) ? kieApiKey : (process.env.KIE_API_KEY || DEFAULT_KIE_API_KEY);
    const falKey = (falApiKey && falApiKey.length >= 10) ? falApiKey : (process.env.FAL_API_KEY || DEFAULT_FAL_API_KEY);

    // ─── Build the alternating sequence ───
    // Char1 dialogue 1, Char2 dialogue 1, Char1 dialogue 2, Char2 dialogue 2...
    const sequence: Array<{ character: 1 | 2; text: string }> = [];
    const maxRounds = Math.max(totalDialogues1, totalDialogues2);

    for (let i = 0; i < maxRounds; i++) {
      if (i < totalDialogues1) {
        sequence.push({ character: 1, text: char1Dialogues[i].trim() });
      }
      if (i < totalDialogues2) {
        sequence.push({ character: 2, text: char2Dialogues[i].trim() });
      }
    }

    const totalVideos = sequence.length;
    console.log(`[Podcast] Starting generation: ${totalVideos} videos, ${maxRounds} rounds`);

    // ─── Generate videos sequentially ───
    const videoUrls: string[] = [];
    const errors: Array<{ index: number; character: number; text: string; error: string }> = [];

    for (let i = 0; i < sequence.length; i++) {
      const item = sequence[i];
      const imageUrl = item.character === 1 ? char1ImageUrl : char2ImageUrl;

      console.log(`[Podcast] Video ${i + 1}/${totalVideos}: Character ${item.character} - "${item.text.slice(0, 50)}..."`);

      try {
        const videoUrl = await generateCharacterVideo(imageUrl, item.text, kieKey);
        videoUrls.push(videoUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Podcast] Video ${i + 1} failed:`, msg);
        errors.push({
          index: i + 1,
          character: item.character,
          text: item.text,
          error: msg,
        });
      }
    }

    if (videoUrls.length === 0) {
      return NextResponse.json({
        success: false,
        error: "All video generations failed",
        errors,
      });
    }

    // ─── Merge videos ───
    let mergedVideoUrl: string | null = null;

    if (videoUrls.length >= 2) {
      try {
        console.log(`[Podcast] Merging ${videoUrls.length} videos...`);
        mergedVideoUrl = await mergeVideosWithFal(videoUrls, falKey);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[Podcast] Merge failed:", msg);
        // Return individual videos if merge fails
      }
    } else if (videoUrls.length === 1) {
      mergedVideoUrl = videoUrls[0];
    }

    return NextResponse.json({
      success: true,
      mergedVideoUrl,
      individualVideos: videoUrls,
      totalGenerated: videoUrls.length,
      totalRequested: totalVideos,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/generate-podcast error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
