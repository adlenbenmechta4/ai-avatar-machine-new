import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { getVipEmails, isVipEmail } from "@/lib/auth-server";
import crypto from "crypto";

// ══════════════════════════════════════════════════════════════════════════════
// SECURITY CONFIGURATION — 7 Layers of Protection
// ══════════════════════════════════════════════════════════════════════════════

// Layer 1: VIP whitelist — only these emails can use this endpoint
// Additional grant-specific emails beyond the VIP list (e.g. partner accounts)
const GRANT_EXTRA_EMAILS = new Set([
  "hello@holystrips.com",
]);

// Combined admin check: VIP emails from auth-server.ts + extra grant-specific emails
function isGrantAdmin(email: string): boolean {
  return isVipEmail(email) || GRANT_EXTRA_EMAILS.has(email.toLowerCase().trim());
}

// Layer 2: HMAC secret for request signing (server-only, never exposed to client)
const HMAC_SECRET = process.env.GRANT_HMAC_SECRET || "avm_secure_grant_2024_xK9mZ";

// Layer 3: Rate limiting (in-memory per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 requests per minute

// Layer 4: Timestamp freshness (prevent replay attacks)
const MAX_REQUEST_AGE_MS = 30_000; // 30 seconds

// ══════════════════════════════════════════════════════════════════════════════
// SECURITY FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

function verifyHmac(payload: string, signature: string): boolean {
  try {
    const expected = crypto
      .createHmac("sha256", HMAC_SECRET)
      .update(payload)
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim().replace(/[^a-z0-9@._+-]/g, "");
}

function isValidEmail(email: string): boolean {
  const re = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  return re.test(email);
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VIP Runtime Storage — persists grants without database
// ══════════════════════════════════════════════════════════════════════════════

// Runtime VIP grants (survives within same serverless warm instance)
const runtimeGrants = new Map<string, { plan: string; credits: number; grantedAt: string; grantedBy: string }>();

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  const requestStartTime = Date.now();

  // ── Layer 3: Rate Limiting ──
  if (!checkRateLimit(clientIp)) {
    console.warn(`[SECURE-GRANT] Rate limit exceeded for IP: ${clientIp}`);
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    // ── Parse body ──
    const body = await request.json();
    const { targetEmail, credits, plan, signature, timestamp } = body;
    const idToken = body.idToken || request.headers.get("Authorization")?.replace("Bearer ", "") || "";

    // ── Layer 4: Timestamp freshness check ──
    if (!timestamp || typeof timestamp !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid timestamp" },
        { status: 400 }
      );
    }

    const requestAge = Date.now() - timestamp;
    if (requestAge > MAX_REQUEST_AGE_MS || requestAge < -5000) {
      console.warn(
        `[SECURE-GRANT] Expired/replayed request: age=${requestAge}ms, ip=${clientIp}`
      );
      return NextResponse.json(
        { error: "Request expired. Please try again." },
        { status: 400 }
      );
    }

    // ── Layer 5: HMAC signature verification ──
    if (!signature || typeof signature !== "string") {
      return NextResponse.json(
        { error: "Missing request signature" },
        { status: 400 }
      );
    }

    const sigPayload = `${targetEmail}:${credits}:${plan}:${timestamp}`;
    if (!verifyHmac(sigPayload, signature)) {
      console.warn(
        `[SECURE-GRANT] Invalid HMAC signature, ip=${clientIp}, email=${targetEmail}`
      );
      return NextResponse.json(
        { error: "Invalid request signature. Access denied." },
        { status: 403 }
      );
    }

    // ── Layer 1: Firebase token verification ──
    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = await verifyIdToken(idToken);
    } catch {
      console.warn(`[SECURE-GRANT] Invalid Firebase token, ip=${clientIp}`);
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 }
      );
    }

    if (!decoded || !decoded.email) {
      return NextResponse.json(
        { error: "Token does not contain email" },
        { status: 401 }
      );
    }

    // ── Layer 2: VIP admin email whitelist check ──
    const adminEmail = decoded.email.toLowerCase().trim();
    if (!isGrantAdmin(adminEmail)) {
      console.error(
        `[SECURE-GRANT] UNAUTHORIZED ACCESS ATTEMPT: email=${adminEmail}, ip=${clientIp}, target=${targetEmail}`
      );
      return NextResponse.json(
        { error: "Access denied. You do not have permission for this action." },
        { status: 403 }
      );
    }

    // ── Layer 6: Input validation ──
    if (!targetEmail || typeof targetEmail !== "string") {
      return NextResponse.json(
        { error: "Target email is required" },
        { status: 400 }
      );
    }

    const cleanEmail = sanitizeEmail(targetEmail);
    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json(
        { error: "Invalid target email format" },
        { status: 400 }
      );
    }

    if (!credits || typeof credits !== "number" || credits < 0 || credits > 9999999) {
      return NextResponse.json(
        { error: "Credits must be a number between 0 and 9,999,999" },
        { status: 400 }
      );
    }

    const validPlans = ["free", "pro", "enterprise"];
    const selectedPlan = plan && validPlans.includes(plan) ? plan : "enterprise";

    // ── Layer 7: Audit logging ──
    console.log(
      `[SECURE-GRANT] GRANT EXECUTED: admin=${adminEmail}, target=${cleanEmail}, credits=${credits}, plan=${selectedPlan}, ip=${clientIp}, duration=${Date.now() - requestStartTime}ms`
    );

    // ── Execute Grant: Store in runtime + dynamically add to VIP system ──
    // This works even without a database
    runtimeGrants.set(cleanEmail, {
      plan: selectedPlan,
      credits,
      grantedAt: new Date().toISOString(),
      grantedBy: adminEmail,
    });

    // Dynamically add to VIP system for immediate effect
    try {
      const { addVipEmail } = await import("@/lib/auth-server");
      addVipEmail(cleanEmail);
    } catch (importErr) {
      console.warn("[SECURE-GRANT] Could not add to VIP runtime:", importErr);
    }

    // Also try DB grant as best-effort (won't block the operation)
    let dbSync = false;
    try {
      const grantResult = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || "https://my-project-github.vercel.app"}/api/admin/grant-enterprise`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cleanEmail,
            plan: selectedPlan,
            creditsLimit: credits,
            creditsUsed: 0,
            role: "user",
          }),
        }
      );
      dbSync = grantResult.ok;
    } catch {
      dbSync = false;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully granted ${credits} credits to ${cleanEmail} (${selectedPlan} plan). VIP access is active immediately.`,
      target: cleanEmail,
      credits,
      plan: selectedPlan,
      grantedBy: adminEmail,
      timestamp: new Date().toISOString(),
      dbSync,
      runtimeActive: true,
    });
  } catch (error) {
    console.error("[SECURE-GRANT] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── GET: Return grant info ──
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/admin/secure-grant",
    method: "POST",
    version: "2.0",
    activeGrants: Object.fromEntries(runtimeGrants),
  });
}
