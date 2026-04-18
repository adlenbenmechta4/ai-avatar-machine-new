import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

// ─── GET /api/videos ─ List all videos for authenticated user ────────────────
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all videos for this user, newest first
    const videos = await db.generatedVideo.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ videos });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("GET /api/videos error:", msg);
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}

// ─── POST /api/videos ─ Save video metadata ──────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, videoUrl, thumbnailUrl, duration, scenesCount, provider } = body;

    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    const video = await db.generatedVideo.create({
      data: {
        userId: user.id,
        title: title || "My AI Video",
        videoUrl,
        thumbnailUrl: thumbnailUrl || null,
        duration: duration || null,
        scenesCount: scenesCount || 1,
        provider: provider || "kie",
      },
    });

    return NextResponse.json({ video }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/videos error:", msg);
    return NextResponse.json({ error: "Failed to save video" }, { status: 500 });
  }
}
