import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const DEFAULT_KIE_API_KEY = "e80261e40f242ed38ce14f4beb6e6f15";

// POST: Submit video generation to kie.ai → returns { taskId }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, dialogueText, apiKey } = body;

    if (!imageUrl || !dialogueText) {
      return NextResponse.json({ error: "imageUrl and dialogueText are required" }, { status: 400 });
    }

    const kieKey = (apiKey && typeof apiKey === "string" && apiKey.length >= 10)
      ? apiKey
      : (process.env.KIE_API_KEY || DEFAULT_KIE_API_KEY);

    const videoPrompt = `realistic arm movements, the woman/man says exactly with direct clear energy: "${dialogueText}"`;

    const res = await fetch("https://api.kie.ai/api/v1/veo/generate", {
      method: "POST",
      headers: { Authorization: `Bearer ${kieKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: videoPrompt,
        imageUrls: [imageUrl],
        model: "veo3_lite",
        generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
        aspect_ratio: "9:16",
        enableTranslation: true,
      }),
    });

    const json = await res.json();

    if (json.code !== 200) {
      return NextResponse.json({ error: "Submit failed: " + (json.msg || JSON.stringify(json)) }, { status: 500 });
    }

    const taskId = json.data?.taskId;
    if (!taskId) {
      return NextResponse.json({ error: "No taskId returned" }, { status: 500 });
    }

    return NextResponse.json({ taskId, message: "Video generation submitted" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET: Check video status → returns { status, videoUrl?, error? }
export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get("taskId");
    const apiKey = req.nextUrl.searchParams.get("apiKey");

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const kieKey = (apiKey && apiKey.length >= 10)
      ? apiKey
      : (process.env.KIE_API_KEY || DEFAULT_KIE_API_KEY);

    const res = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${kieKey}` },
    });

    const json = await res.json();
    const d = json.data;
    const statusStr = String(d?.status || d?.state || "").toLowerCase();
    const successFlag = d?.successFlag;
    const errorMsg = d?.errorMessage || d?.error || d?.failMsg || d?.message || "";

    // Detect failure
    const isFailed =
      successFlag === 2 || successFlag === 3 ||
      statusStr === "failed" || statusStr === "fail" || statusStr === "failure" ||
      statusStr === "error" || statusStr === "rejected" || statusStr === "cancelled" ||
      (json.code !== 200 && json.code !== 0 && statusStr.includes("fail"));

    if (isFailed) {
      return NextResponse.json({ status: "failed", error: errorMsg || "Video generation failed" });
    }

    // Detect success
    if (json.code === 200 && (successFlag === 1 || statusStr === "success")) {
      let resp = d.response || d.result || d;
      if (typeof resp === "string") { try { resp = JSON.parse(resp); } catch {} }
      let videoUrl = resp?.resultUrls?.[0] || resp?.originUrls?.[0] || resp?.url || d.resultUrls?.[0] || d.videoUrl || d.video_url;
      if (!videoUrl && typeof resp?.resultUrls === "string") { try { videoUrl = JSON.parse(resp.resultUrls)[0]; } catch {} }

      if (videoUrl) {
        return NextResponse.json({ status: "completed", videoUrl });
      }
      return NextResponse.json({ status: "failed", error: "Video ready but no URL found" });
    }

    // Still processing
    return NextResponse.json({ status: "processing" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ status: "error", error: msg }, { status: 500 });
  }
}
