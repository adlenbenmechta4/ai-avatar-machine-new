import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const DEFAULT_FAL_API_KEY = "9bf7d3b9-a407-4b19-979d-f438ebf738e2:5dbedfec1d01434a997480bd5dab5803";

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

// POST: Submit merge to fal.ai → returns { requestId } or { videoUrl } (sync)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoUrls, apiKey } = body;

    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length < 2) {
      return NextResponse.json({ error: "At least 2 video URLs required" }, { status: 400 });
    }

    const falKey = (apiKey && typeof apiKey === "string" && apiKey.length >= 10)
      ? apiKey
      : (process.env.FAL_API_KEY || DEFAULT_FAL_API_KEY);

    const res = await fetch("https://queue.fal.run/fal-ai/ffmpeg-api/merge-videos", {
      method: "POST",
      headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ video_urls: videoUrls }),
    });

    const json = await safeJsonParse(res);

    // Check for direct synchronous result
    if (json.video && typeof json.video === "object" && (json.video as Record<string, unknown>).url) {
      return NextResponse.json({ status: "completed", videoUrl: (json.video as Record<string, unknown>).url as string });
    }
    if (json.url && typeof json.url === "string") {
      return NextResponse.json({ status: "completed", videoUrl: json.url as string });
    }

    // Async result
    const requestId = json.request_id as string | undefined;
    if (!requestId) {
      return NextResponse.json({ error: "No direct URL and no request_id: " + JSON.stringify(json).slice(0, 300) }, { status: 500 });
    }

    return NextResponse.json({ status: "submitted", requestId });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET: Check merge status → returns { status, videoUrl?, error? }
export async function GET(req: NextRequest) {
  try {
    const requestId = req.nextUrl.searchParams.get("requestId");
    const apiKey = req.nextUrl.searchParams.get("apiKey");

    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }

    const falKey = (apiKey && apiKey && apiKey.length >= 10)
      ? apiKey
      : (process.env.FAL_API_KEY || DEFAULT_FAL_API_KEY);

    const statusUrl = `https://queue.fal.run/fal-ai/ffmpeg-api/requests/${requestId}/status`;
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${falKey}` },
    });
    const statusJson = await safeJsonParse(statusRes);
    const status = statusJson.status as string | undefined;

    if (status === "COMPLETED") {
      const responseUrl = `https://queue.fal.run/fal-ai/ffmpeg-api/requests/${requestId}`;
      const resultRes = await fetch(responseUrl, {
        headers: { Authorization: `Key ${falKey}` },
      });
      const resultJson = await safeJsonParse(resultRes);

      const videoObj = resultJson.video as Record<string, unknown> | undefined;
      if (videoObj?.url) {
        return NextResponse.json({ status: "completed", videoUrl: videoObj.url as string });
      }
      if (typeof resultJson.url === "string") {
        return NextResponse.json({ status: "completed", videoUrl: resultJson.url as string });
      }
      return NextResponse.json({ status: "failed", error: "Merge done but no URL" });
    }

    if (status === "FAILED") {
      return NextResponse.json({ status: "failed", error: (statusJson.error as string) || "Merge failed" });
    }

    return NextResponse.json({ status: "processing" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ status: "error", error: msg }, { status: 500 });
  }
}
