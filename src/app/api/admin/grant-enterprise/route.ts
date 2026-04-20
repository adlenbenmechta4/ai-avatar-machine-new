import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true, plan: true, role: true, creditsUsed: true, creditsLimit: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update to enterprise with unlimited credits
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        plan: "enterprise",
        creditsLimit: 999999,
        creditsUsed: 0,
        role: "admin",
        updatedAt: new Date(),
      },
    });

    // Log the change
    await db.creditTransaction.create({
      data: {
        userId: user.id,
        amount: 0,
        type: "admin_grant",
        description: `Admin granted enterprise plan with unlimited credits to ${user.email}`,
        metadata: JSON.stringify({
          previousPlan: user.plan,
          previousRole: user.role,
          previousCreditsLimit: user.creditsLimit,
          newPlan: "enterprise",
          newRole: "admin",
          newCreditsLimit: 999999,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `User ${user.email} updated to Enterprise + Admin`,
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
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
