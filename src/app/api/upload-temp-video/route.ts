import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("video") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("video/")) {
      return NextResponse.json({ error: "File must be a video" }, { status: 400 });
    }

    // Validate file size (max 200MB)
    const MAX_SIZE = 200 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Video file too large (max 200MB)" }, { status: 400 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.armsleeves_READ_WRITE_TOKEN || "";

    const fileName = `edited-video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
    const blob = await put(fileName, file, {
      access: "public",
      contentType: file.type || "video/mp4",
      token,
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Upload temp video error:", msg);
    return NextResponse.json({ error: "Failed to upload video: " + msg }, { status: 500 });
  }
}
