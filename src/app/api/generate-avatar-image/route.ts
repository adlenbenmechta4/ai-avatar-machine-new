import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Poll for image generation result ────────────────────────────────────────
async function pollImageResult(taskId: string, apiKey: string): Promise<string> {
  const url = `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`;

  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const json = await res.json();

      if (json.code === 200) {
        const d = json.data;
        if (d?.state === "success") {
          let result;
          if (typeof d.resultJson === "string") {
            try {
              result = JSON.parse(d.resultJson);
            } catch {
              result = d.resultJson;
            }
          } else {
            result = d.resultJson;
          }
          const imageUrl = result?.resultUrls?.[0] || result?.result_url || result?.url;
          if (imageUrl) return imageUrl;
          throw new Error("Image ready but no URL found in resultJson");
        }
        if (d?.state === "fail") {
          throw new Error("Image generation failed: " + (d?.failMsg || "unknown error"));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Image generation failed") || msg.includes("no URL")) throw err;
      console.warn(`[Avatar Image Poll ${i}] ${msg}`);
    }
    await sleep(3000);
  }
  throw new Error("Avatar image generation timed out after 6 minutes");
}

// ─── POST /api/generate-avatar-image ────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { prompt, referenceImageUrl, apiKey, aspectRatio } = body;

    if (!prompt || prompt.trim().length < 5) {
      return NextResponse.json({ error: "Please provide a detailed prompt (at least 5 characters)" }, { status: 400 });
    }

    if (!apiKey || apiKey.length < 10) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    // Validate aspect ratio (default to 9:16)
    const imageAspectRatio = aspectRatio === "16:9" ? "16:9" : "9:16";

    // Build the image generation prompt
    const imgPrompt = prompt.trim();

    const hasReference = referenceImageUrl && referenceImageUrl.trim();

    // Use nano-banana-2 for text-to-image (no reference), nano-banana-edit for image editing (with reference)
    const requestBody: Record<string, unknown> = hasReference
      ? {
          model: "google/nano-banana-edit",
          input: {
            prompt: imgPrompt,
            image_urls: [referenceImageUrl.trim()],
            image_size: imageAspectRatio,
            output_format: "png",
            strength: 0.65,
          },
        }
      : {
          model: "nano-banana-2",
          input: {
            prompt: imgPrompt,
            image_size: imageAspectRatio,
          },
        };

    const submitRes = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const submitJson = await submitRes.json();

    if (submitJson.code !== 200) {
      return NextResponse.json(
        { error: "Failed to submit avatar generation: " + (submitJson.msg || JSON.stringify(submitJson)) },
        { status: 500 }
      );
    }

    const taskId = submitJson.data?.taskId;
    if (!taskId) {
      return NextResponse.json({ error: "No taskId returned from API" }, { status: 500 });
    }

    // Poll for result
    const imageUrl = await pollImageResult(taskId, apiKey);

    return NextResponse.json({
      success: true,
      imageUrl,
      prompt: imgPrompt,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/generate-avatar-image error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
