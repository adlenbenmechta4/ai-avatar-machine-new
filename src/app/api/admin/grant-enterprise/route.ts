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

    const normalizedEmail = email.toLowerCase().trim();

    // Try to find existing user
    let user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true, plan: true, role: true, creditsUsed: true, creditsLimit: true },
    });

    if (!user) {
      // Create user with enterprise plan
      user = await db.user.create({
        data: {
          email: normalizedEmail,
          name: normalizedEmail.split("@")[0],
          plan: "enterprise",
          role: "admin",
          creditsLimit: 999999,
          creditsUsed: 0,
        },
      });

      await db.creditTransaction.create({
        data: {
          userId: user.id,
          amount: 0,
          type: "admin_grant",
          description: `Admin created and granted enterprise plan with unlimited credits for ${user.email}`,
          metadata: JSON.stringify({
            action: "create_and_grant",
            plan: "enterprise",
            role: "admin",
            creditsLimit: 999999,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        message: `User ${user.email} created with Enterprise + Admin`,
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
    return NextResponse.json({ error: "Failed to update user", details: String(error) }, { status: 500 });
  }
}
