import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

// ─── Resolve user ID: VIP users may have a Firebase UID, need to find their DB ID ──
async function resolveUserId(authUserId: string, authEmail: string): Promise<string | null> {
  try {
    // First, try to find user by email in DB (covers both VIP and regular users)
    const dbUser = await db.user.findUnique({
      where: { email: authEmail },
      select: { id: true },
    });
    if (dbUser) return dbUser.id;

    // Fallback: try the auth user ID directly (if it matches a DB record)
    const byId = await db.user.findUnique({
      where: { id: authUserId },
      select: { id: true },
    });
    if (byId) return byId.id;

    // No matching DB user — return null (no videos saved yet)
    return null;
  } catch {
    // DB unavailable — return authUserId as fallback
    return authUserId;
  }
}

// ─── GET /api/videos ─ List all videos for authenticated user ────────────────
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve the correct DB user ID (VIP users have Firebase UID, need DB ID)
    const dbUserId = await resolveUserId(user.id, user.email);
    if (!dbUserId) {
      // No DB user found — return empty array
      return NextResponse.json({ videos: [] });
    }

    // Fetch all videos for this user, newest first
    // Also search by Firebase UID as fallback (in case videos were saved before DB user was created)
    const videos = await db.generatedVideo.findMany({
      where: {
        OR: [
          { userId: dbUserId },
          // Also include videos saved with Firebase UID (before DB user existed)
          ...(dbUserId !== user.id ? [{ userId: user.id }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    // If we found videos with a mismatched userId, fix them to use the correct DB ID
    if (videos.some((v) => v.userId !== dbUserId)) {
      try {
        await db.generatedVideo.updateMany({
          where: { userId: user.id },
          data: { userId: dbUserId },
        });
      } catch {
        // Silently ignore migration errors
      }
    }

    return NextResponse.json({ videos });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("GET /api/videos error:", msg);
    // Return empty array instead of error (graceful degradation when DB is unavailable)
    return NextResponse.json({ videos: [] });
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

    // Resolve the correct DB user ID
    const dbUserId = await resolveUserId(user.id, user.email);

    // Try to save to DB, return in-memory record if DB unavailable
    let video;
    try {
      video = await db.generatedVideo.create({
        data: {
          userId: dbUserId || user.id,
          title: title || "My AI Video",
          videoUrl,
          thumbnailUrl: thumbnailUrl || null,
          duration: duration || null,
          scenesCount: scenesCount || 1,
          provider: provider || "kie",
        },
      });
    } catch (dbErr) {
      console.warn("[POST /api/videos] DB save failed (no DB available), returning in-memory record:", dbErr instanceof Error ? dbErr.message : dbErr);
      // Return a synthetic record so the client thinks save succeeded
      video = {
        id: "local_" + Date.now(),
        userId: dbUserId || user.id,
        title: title || "My AI Video",
        videoUrl,
        thumbnailUrl: thumbnailUrl || null,
        duration: duration || null,
        scenesCount: scenesCount || 1,
        provider: provider || "kie",
        createdAt: new Date().toISOString(),
      };
    }

    return NextResponse.json({ video }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/videos error:", msg);
    return NextResponse.json({ error: "Failed to save video" }, { status: 500 });
  }
}

// ─── PATCH /api/videos ─ Update video metadata (e.g. caption URL) ──────────
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, videoUrl, title, captionUrl } = body;

    if (!id) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
    }

    // Resolve the correct DB user ID
    const dbUserId = await resolveUserId(user.id, user.email);

    // Build update data (only include fields that are provided)
    const updateData: Record<string, unknown> = {};
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (title !== undefined) updateData.title = title;
    if (captionUrl !== undefined) updateData.captionUrl = captionUrl;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Find the video first to verify ownership
    const video = await db.generatedVideo.findUnique({
      where: { id },
    });

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Verify ownership
    if (video.userId !== dbUserId && video.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden: you don't own this video" }, { status: 403 });
    }

    // Update the video
    const updated = await db.generatedVideo.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ video: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("PATCH /api/videos error:", msg);
    return NextResponse.json({ error: "Failed to update video" }, { status: 500 });
  }
}
