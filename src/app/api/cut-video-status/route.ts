import { NextRequest, NextResponse } from "next/server";

const VIDOPI_API_KEY = "83c7d079-8722-4e7f-9baf-c7130a4f1161";
const VIDOPI_BASE = "https://api.vidopi.com";

export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "Missing required parameter: taskId" },
        { status: 400 }
      );
    }

    // Poll vidopi API for task status
    const response = await fetch(`${VIDOPI_BASE}/cut-video/${taskId}/`, {
      method: "GET",
      headers: {
        "X-API-Key": VIDOPI_API_KEY,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || data.message || "Failed to check task status" },
        { status: response.status }
      );
    }

    // Map vidopi status to our expected format
    const status = data.status?.toLowerCase() || "processing";
    const resultUrl = data.result_url || data.output_url || data.video_url || data.url || null;

    return NextResponse.json({
      status: status === "completed" || status === "done" || status === "finished"
        ? "completed"
        : status === "failed" || status === "error"
          ? "failed"
          : "processing",
      result: resultUrl,
      error: data.error || data.detail || null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
