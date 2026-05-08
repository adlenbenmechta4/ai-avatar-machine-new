import { NextRequest } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { db } from "@/lib/db";

// VIP users with unlimited credits (enterprise access)
const VIP_EMAILS = new Set([
  "adlenbenmechta3@gmail.com",
  "hello@fullynutrition.com",
  "novaamz@gmail.com",
  "mecifmouhaned@gmail.com",
  "workdr2026@gmail.com",
]);

// Exported function to dynamically add VIP users at runtime
export function addVipEmail(email: string): void {
  VIP_EMAILS.add(email.toLowerCase().trim());
  console.log(`[VIP] Added runtime VIP: ${email.toLowerCase().trim()}`);
}

// Exported function to get all VIP emails
export function getVipEmails(): Set<string> {
  return new Set(VIP_EMAILS);
}

// Exported function to check if an email is VIP (convenience helper)
export function isVipEmail(email: string): boolean {
  return VIP_EMAILS.has(email.toLowerCase().trim());
}

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
      console.warn("[getAuthUser] No token found in request");
      return null;
    }

    // Verify the Firebase ID token
    const decoded = await verifyIdToken(idToken);

    if (!decoded || !decoded.email) {
      console.warn("[getAuthUser] Token verification returned no email", decoded ? "(has uid)" : "(null decoded)");
      return null;
    }

    const normalizedEmail = decoded.email.toLowerCase().trim();

    // VIP users: grant enterprise access with unlimited credits
    // Also sync to DB for consistency (ensures admin panel user list shows correct role)
    if (VIP_EMAILS.has(normalizedEmail)) {
      console.log("[getAuthUser] VIP user authenticated:", normalizedEmail);

      // Best-effort DB sync: update role & plan in database
      let dbUserId = decoded.uid || decoded.sub || "vip-user";
      try {
        const upsertedUser = await db.user.upsert({
          where: { email: normalizedEmail },
          update: {
            role: "admin",
            plan: "enterprise",
            creditsLimit: 999999,
            updatedAt: new Date(),
          },
          create: {
            name: decoded.name || normalizedEmail.split("@")[0],
            email: normalizedEmail,
            password: "",
            role: "admin",
            plan: "enterprise",
            creditsUsed: 0,
            creditsLimit: 999999,
            subscription: {
              create: { plan: "enterprise", status: "active" },
            },
          },
          select: { id: true },
        });
        dbUserId = upsertedUser.id;
      } catch (dbSyncErr) {
        console.warn("[getAuthUser] VIP DB sync failed:", dbSyncErr);
      }

      return {
        id: dbUserId,
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
      console.warn("[getAuthUser] User not found in DB:", normalizedEmail);
      return null;
    }

    return user;
  } catch (error) {
    console.error("[getAuthUser] Error:", error);
    return null;
  }
}
