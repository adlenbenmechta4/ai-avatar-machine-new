import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { db } from "@/lib/db";
import { getVipEmails } from "@/lib/auth-server";

// VIP users with unlimited credits (enterprise access)
// Source of truth: src/lib/auth-server.ts — imported here to avoid duplication
const VIP_EMAILS = getVipEmails();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ error: "No ID token provided" }, { status: 401 });
    }

    // Verify the Firebase ID token
    let decoded;
    try {
      decoded = await verifyIdToken(idToken);
    } catch (verifyError) {
      console.error("Token verification failed:", verifyError);
      return NextResponse.json(
        { error: "Token verification failed: " + (verifyError instanceof Error ? verifyError.message : "Unknown error") },
        { status: 401 }
      );
    }

    if (!decoded) {
      return NextResponse.json({ error: "Invalid token: no decoded data" }, { status: 401 });
    }

    const userEmail = (decoded.email || "").toLowerCase().trim();
    if (!userEmail) {
      return NextResponse.json({ error: "Invalid token: no email in token" }, { status: 401 });
    }

    const userName = decoded.name || decoded.firebase?.name || userEmail.split("@")[0];

    // VIP users: sync to database for consistency, then return enterprise access
    if (VIP_EMAILS.has(userEmail)) {
      // Best-effort DB sync: ensure the user record has admin role & enterprise plan
      // This keeps the DB in sync with the VIP list (important for admin panel user list, etc.)
      let dbUserId = decoded.uid || decoded.sub || "vip-user";
      try {
        const upsertedUser = await db.user.upsert({
          where: { email: userEmail },
          update: {
            role: "admin",
            plan: "enterprise",
            creditsLimit: 999999,
            updatedAt: new Date(),
          },
          create: {
            name: userName,
            email: userEmail,
            password: "",
            role: "admin",
            plan: "enterprise",
            creditsUsed: 0,
            creditsLimit: 999999,
            subscription: {
              create: {
                plan: "enterprise",
                status: "active",
              },
            },
          },
          select: { id: true },
        });
        dbUserId = upsertedUser.id;
      } catch (dbSyncErr) {
        // DB sync failed — still return VIP data (graceful degradation)
        console.warn("[session] VIP DB sync failed:", dbSyncErr);
      }

      return NextResponse.json({
        user: {
          id: dbUserId,
          name: userName,
          email: userEmail,
          role: "admin",
          plan: "enterprise",
          creditsUsed: 0,
          creditsLimit: 999999,
        },
      });
    }

    // Find or create user in our database
    try {
      let user = await db.user.findUnique({
        where: { email: userEmail },
        include: { subscription: true },
      });

      if (!user) {
        // Auto-create user from Firebase auth info
        const userCount = await db.user.count();
        const isFirstUser = userCount === 0;

        user = await db.user.create({
          data: {
            name: userName,
            email: userEmail,
            password: "", // Firebase users don't need local password
            role: isFirstUser ? "admin" : "user",
            plan: "free",
            creditsUsed: 0,
            creditsLimit: isFirstUser ? 999999 : 3,
            subscription: {
              create: {
                plan: isFirstUser ? "enterprise" : "free",
                status: "active",
              },
            },
          },
          include: { subscription: true },
        });
      }

      // Return user data
      return NextResponse.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          plan: user.plan,
          creditsUsed: user.creditsUsed,
          creditsLimit: user.creditsLimit,
        },
      });
    } catch (dbError) {
      // DB not available — return free plan user from Firebase data
      console.warn("[session] DB unavailable, returning Firebase-based user:", dbError);
      return NextResponse.json({
        user: {
          id: decoded.uid || decoded.sub || "fb-user",
          name: userName,
          email: userEmail,
          role: "user",
          plan: "free",
          creditsUsed: 0,
          creditsLimit: 3,
        },
      });
    }
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json(
      { error: "Session verification failed" },
      { status: 500 }
    );
  }
}
