import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

const DEFAULT_KIE_API_KEY = "e80261e40f242ed38ce14f4beb6e6f15";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { base64, fileName = "character.png" } = body;

    if (!base64 || typeof base64 !== "string") {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 });
    }

    // Extract base64 data (remove data:image/...;base64, prefix)
    const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ error: "Invalid base64 image format" }, { status: 400 });
    }

    const extension = matches[1] === "jpeg" ? "jpg" : matches[1];
    const uniqueName = `podcast-char-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

    // Upload via kie.ai file upload API (same as avatar upload)
    const uploadRes = await fetch("https://kieai.redpandaai.co/api/file-base64-upload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DEFAULT_KIE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base64Data: matches[2],
        fileName: uniqueName,
        uploadPath: "podcast",
      }),
    });

    const json = await uploadRes.json() as Record<string, unknown>;

    if (!json.success) {
      throw new Error("Upload failed: " + (json.msg || "unknown error"));
    }

    const downloadUrl = (json.data as Record<string, unknown>)?.downloadUrl as string;
    if (!downloadUrl) {
      throw new Error("Upload succeeded but no URL returned");
    }

    return NextResponse.json({ url: downloadUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/upload-podcast-image error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
