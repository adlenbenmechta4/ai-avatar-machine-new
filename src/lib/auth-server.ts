import { NextRequest } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { db } from "@/lib/db";

// VIP users with unlimited credits (enterprise access)
const VIP_EMAILS = new Set([
  "adlenbenmechta3@gmail.com",
]);

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  creditsUsed: number;
  creditsLimit: number;
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Try Authorization header first
    let idToken = request.headers.get("Authorization")?.replace("Bearer ", "");

    // Fallback: check for token in custom header (for client-side calls)
    if (!idToken) {
      idToken = request.headers.get("X-Firebase-Id-Token") || "";
    }

    // Fallback: check body for POST requests
    if (!idToken) {
      try {
        const body = await request.json();
        if (body?.idToken) {
          idToken = body.idToken;
        }
      } catch {
        // Not JSON body or already consumed
      }
    }

    if (!idToken) {
      return null;
    }

    // Verify the Firebase ID token
    const decoded = await verifyIdToken(idToken);

    if (!decoded || !decoded.email) {
      return null;
    }

    const normalizedEmail = decoded.email.toLowerCase().trim();

    // VIP users: grant enterprise access with unlimited credits without DB dependency
    if (VIP_EMAILS.has(normalizedEmail)) {
      return {
        id: decoded.uid || decoded.sub || "vip-user",
        name: decoded.name || decoded.email?.split("@")[0] || "VIP User",
        email: normalizedEmail,
        role: "admin",
        plan: "enterprise",
        creditsUsed: 0,
        creditsLimit: 999999,
      };
    }

    // Find user in database
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        creditsUsed: true,
        creditsLimit: true,
      },
    });

    if (!user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error("getAuthUser error:", error);
    return null;
  }
}
