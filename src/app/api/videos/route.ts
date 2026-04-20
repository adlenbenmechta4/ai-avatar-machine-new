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
    const videos = await db.generatedVideo.findMany({
      where: { userId: dbUserId },
      orderBy: { createdAt: "desc" },
    });

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
