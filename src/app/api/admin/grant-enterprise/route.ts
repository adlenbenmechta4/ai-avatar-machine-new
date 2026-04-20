import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, plan, creditsLimit, creditsUsed, role } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find or create user
    let user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true, plan: true, role: true, creditsUsed: true, creditsLimit: true },
    });

    const newPlan = plan || "enterprise";
    const newCreditsLimit = creditsLimit || 999999;
    const newCreditsUsed = creditsUsed !== undefined ? creditsUsed : 0;
    const newRole = role || "admin";

    if (!user) {
      user = await db.user.create({
        data: {
          email: normalizedEmail,
          name: normalizedEmail.split("@")[0],
          plan: newPlan,
          role: newRole,
          creditsLimit: newCreditsLimit,
          creditsUsed: newCreditsUsed,
        },
      });

      return NextResponse.json({
        success: true,
        message: `User ${user.email} created`,
        isNew: true,
        user,
      });
    }

    // Update existing user
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        plan: newPlan,
        creditsLimit: newCreditsLimit,
        creditsUsed: newCreditsUsed,
        role: newRole,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `User ${user.email} updated`,
      isNew: false,
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        plan: updated.plan,
        role: updated.role,
        creditsLimit: updated.creditsLimit,
        creditsUsed: updated.creditsUsed,
      },
    });
  } catch (error) {
    console.error("Grant enterprise error:", error);
    return NextResponse.json({
      error: "Failed to update user",
      details: String(error),
    }, { status: 500 });
  }
}
