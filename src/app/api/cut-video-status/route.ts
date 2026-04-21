import { NextRequest, NextResponse } from "next/server";

const VIDOPI_API_KEY = "83c7d079-8722-4e7f-9baf-c7130a4f1161";
const VIDOPI_BASE = "https://api.vidopi.com";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "Missing required parameter: taskId" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${VIDOPI_BASE}/task-status/${encodeURIComponent(taskId)}`,
      {
        method: "GET",
        headers: {
          "X-API-Key": VIDOPI_API_KEY,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || data.message || "Failed to get task status" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
