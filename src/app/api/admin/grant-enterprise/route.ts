import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, plan, creditsLimit, creditsUsed, role } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Try to find existing user
    let user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true, plan: true, role: true, creditsUsed: true, creditsLimit: true },
    });

    if (!user) {
      // Create user with specified plan
      user = await db.user.create({
        data: {
          email: normalizedEmail,
          name: normalizedEmail.split("@")[0],
          plan: plan || "enterprise",
          role: role || "admin",
          creditsLimit: creditsLimit || 999999,
          creditsUsed: creditsUsed || 0,
        },
      });

      return NextResponse.json({
        success: true,
        message: `User ${user.email} created with ${user.plan} plan`,
        isNew: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          role: user.role,
          creditsLimit: user.creditsLimit,
          creditsUsed: user.creditsUsed,
        },
      });
    }

    // Update existing user
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (plan) updateData.plan = plan;
    if (creditsLimit) updateData.creditsLimit = creditsLimit;
    if (creditsUsed !== undefined) updateData.creditsUsed = creditsUsed;
    if (role) updateData.role = role;

    const updated = await db.user.update({
      where: { id: user.id },
      data: updateData,
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
      details: String(error) 
    }, { status: 500 });
  }
}
