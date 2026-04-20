import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

// ─── Resolve user ID: VIP users may have a Firebase UID, need to find their DB ID ──
async function resolveUserId(authUserId: string, authEmail: string): Promise<string | null> {
  try {
    const dbUser = await db.user.findUnique({
      where: { email: authEmail },
      select: { id: true },
    });
    if (dbUser) return dbUser.id;

    const byId = await db.user.findUnique({
      where: { id: authUserId },
      select: { id: true },
    });
    if (byId) return byId.id;

    return null;
  } catch {
    return authUserId;
  }
}

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

    // Resolve the correct DB user ID for ownership check
    const dbUserId = await resolveUserId(user.id, user.email);

    if (video.userId !== dbUserId && video.userId !== user.id) {
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
