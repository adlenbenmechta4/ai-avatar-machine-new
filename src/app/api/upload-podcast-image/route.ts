import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { put } from "@vercel/blob";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const imageData = matches[2];
    const buffer = Buffer.from(imageData, "base64");

    const uniqueName = `podcast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

    const blob = await put(uniqueName, buffer, {
      access: "public",
      contentType: `image/${matches[1]}`,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/upload-podcast-image error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
