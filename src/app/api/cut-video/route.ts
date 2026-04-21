import { NextRequest, NextResponse } from "next/server";

const VIDOPI_API_KEY = "83c7d079-8722-4e7f-9baf-c7130a4f1161";
const VIDOPI_BASE = "https://api.vidopi.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { public_link, start_time, end_time } = body;

    if (!public_link || start_time === undefined || end_time === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: public_link, start_time, end_time" },
        { status: 400 }
      );
    }

    if (start_time >= end_time) {
      return NextResponse.json(
        { error: "start_time must be less than end_time" },
        { status: 400 }
      );
    }

    const response = await fetch(`${VIDOPI_BASE}/cut-video/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": VIDOPI_API_KEY,
      },
      body: JSON.stringify({ public_link, start_time, end_time }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || data.message || "Failed to start cut task" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
