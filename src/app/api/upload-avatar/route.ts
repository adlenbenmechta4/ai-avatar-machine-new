import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const maxDuration = 60;

async function compressAvatar(buffer: Buffer): Promise<Buffer> {
  const img = sharp(buffer);
  const metadata = await img.metadata();
  const maxDim = 1024; // Higher resolution for better quality
  const ratio = Math.min(maxDim / (metadata.width || 1), maxDim / (metadata.height || 1), 1);

  if (ratio < 1) {
    return img
      .resize(Math.round((metadata.width || 1) * ratio), Math.round((metadata.height || 1) * ratio))
      .jpeg({ quality: 92 }) // High quality
      .toBuffer();
  }
  return img.jpeg({ quality: 92 }).toBuffer();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const avatarFile = formData.get("avatar") as File | null;
    const kieApiKey = formData.get("kieApiKey") as string | null;

    if (!avatarFile) {
      return NextResponse.json({ success: false, error: "No avatar file provided" }, { status: 400 });
    }
    if (!kieApiKey || kieApiKey.length < 10) {
      return NextResponse.json({ success: false, error: "Image API key is required" }, { status: 400 });
    }

    if (avatarFile.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "Avatar must be under 5MB" }, { status: 400 });
    }

    const rawBuffer = Buffer.from(await avatarFile.arrayBuffer());
    const compressed = await compressAvatar(rawBuffer);
    const base64 = compressed.toString("base64");

    const fileName = `avatar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;

    const uploadRes = await fetch("https://kieai.redpandaai.co/api/file-base64-upload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${kieApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ base64Data: base64, fileName, uploadPath: "images" }),
    });

    const json = await uploadRes.json();
    if (!json.success) {
      return NextResponse.json({ success: false, error: "Image upload failed: " + (json.msg || "unknown") }, { status: 500 });
    }

    const downloadUrl = json.data?.downloadUrl;
    if (!downloadUrl) {
      return NextResponse.json({ success: false, error: "Upload succeeded but no URL returned" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      avatarUrl: downloadUrl,
      sizeKB: Math.round(compressed.length / 1024),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
