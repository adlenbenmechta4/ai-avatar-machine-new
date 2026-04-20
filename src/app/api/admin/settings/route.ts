import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Helper: Check if the current user is an admin.
 */
async function requireAdmin(request: NextRequest) {
  const authUser = await getAuthUser(request);

  if (!authUser) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), authUser: null };
  }

  // Trust the role from getAuthUser — VIP users already get admin role without DB
  if (authUser.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 }), authUser: null };
  }

  return { error: null, authUser, userId: authUser.id };
}

/**
 * GET /api/admin/settings — Get all admin settings
 * Sensitive fields (secret keys) are masked
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    let settings = await db.adminSettings.findUnique({
      where: { id: "main" },
    });

    if (!settings) {
      settings = await db.adminSettings.create({
        data: { id: "main" },
      });
    }

    // Mask sensitive fields
    const masked = {
      ...settings,
      stripeSecretKey: settings.stripeSecretKey
        ? settings.stripeSecretKey.slice(0, 8) + "..." + settings.stripeSecretKey.slice(-4)
        : null,
      stripeWebhookSecret: settings.stripeWebhookSecret
        ? settings.stripeWebhookSecret.slice(0, 8) + "..." + settings.stripeWebhookSecret.slice(-4)
        : null,
    };

    return NextResponse.json(masked);
  } catch (error) {
    console.error("Admin get settings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings — Update admin settings
 * Body: { siteName?, stripePublicKey?, stripeSecretKey?, stripeWebhookSecret?,
 *         planFreeCredits?, planProCredits?, planEnterpriseCredits?,
 *         planFreePrice?, planProPrice?, planEnterprisePrice?,
 *         creditCostPerScene?, enableRegistration?, enableStripePayment? }
 */
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const body = await request.json();

    // Build update data with validation
    const updateData: Record<string, unknown> = {};

    // String fields
    const stringFields = [
      "siteName",
      "stripePublicKey",
      "stripeSecretKey",
      "stripeWebhookSecret",
      "planFreePrice",
      "planProPrice",
      "planEnterprisePrice",
    ];

    for (const field of stringFields) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== "string") {
          return NextResponse.json(
            { error: `${field} must be a string` },
            { status: 400 }
          );
        }
        updateData[field] = body[field].trim() || null;
      }
    }

    // Integer fields
    const intFields = [
      "planFreeCredits",
      "planProCredits",
      "planEnterpriseCredits",
      "creditCostPerScene",
    ];

    for (const field of intFields) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== "number" || body[field] < 0) {
          return NextResponse.json(
            { error: `${field} must be a non-negative number` },
            { status: 400 }
          );
        }
        updateData[field] = body[field];
      }
    }

    // Boolean fields
    const boolFields = ["enableRegistration", "enableStripePayment"];

    for (const field of boolFields) {
      if (body[field] !== undefined) {
        updateData[field] = Boolean(body[field]);
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    updateData.updatedAt = new Date();

    // Upsert settings
    const settings = await db.adminSettings.upsert({
      where: { id: "main" },
      update: updateData,
      create: { id: "main", ...updateData },
    });

    // Mask sensitive fields in response
    const masked = {
      ...settings,
      stripeSecretKey: settings.stripeSecretKey
        ? settings.stripeSecretKey.slice(0, 8) + "..." + settings.stripeSecretKey.slice(-4)
        : null,
      stripeWebhookSecret: settings.stripeWebhookSecret
        ? settings.stripeWebhookSecret.slice(0, 8) + "..." + settings.stripeWebhookSecret.slice(-4)
        : null,
    };

    return NextResponse.json({
      settings: masked,
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("Admin update settings error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
