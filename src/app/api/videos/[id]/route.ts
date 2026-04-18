import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

// ─── DELETE /api/videos/[id] ─ Delete a video by ID ──────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find the video first to verify ownership
    const video = await db.generatedVideo.findUnique({
      where: { id },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden: you don't own this video" }, { status: 403 });
    }

    // Delete the video from database
    await db.generatedVideo.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Video deleted" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("DELETE /api/videos/[id] error:", msg);
    return NextResponse.json({ error: "Failed to delete video" }, { status: 500 });
  }
}
