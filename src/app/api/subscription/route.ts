import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { getAdminSettings, setCreditsLimit } from "@/lib/credits";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authUser.id;

    const subscription = await db.subscription.findUnique({
      where: { userId },
    });

    return NextResponse.json(subscription);
  } catch (error) {
    console.error("Get subscription error:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authUser.id;
    const body = await request.json();
    const { plan } = body;

    if (!plan || !["free", "pro", "enterprise"].includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan. Must be free, pro, or enterprise" },
        { status: 400 }
      );
    }

    const currentPlan = authUser.plan;

    // Prevent downgrading (mock — in production, Stripe handles this)
    const planOrder = ["free", "pro", "enterprise"];
    if (planOrder.indexOf(plan) < planOrder.indexOf(currentPlan) && plan !== "free") {
      return NextResponse.json(
        { error: "Cannot downgrade plan. Contact support for assistance." },
        { status: 400 }
      );
    }

    // Get plan credits from admin settings (dynamic, configurable by admin)
    const settings = await getAdminSettings();
    const planCredits: Record<string, number> = {
      free: settings.planFreeCredits,
      pro: settings.planProCredits,
      enterprise: settings.planEnterpriseCredits,
    };

    const newCreditsLimit = planCredits[plan] || settings.planFreeCredits;

    // Use atomic credit system to set limit
    const creditResult = await setCreditsLimit(
      userId,
      newCreditsLimit,
      plan !== "free",
      "plan_upgrade",
      `Plan upgraded from "${currentPlan}" to "${plan}". Credits limit set to ${newCreditsLimit}.`
    );

    // Update or create subscription
    const existingSub = await db.subscription.findUnique({
      where: { userId },
    });

    if (existingSub) {
      await db.subscription.update({
        where: { userId },
        data: {
          plan,
          status: "active",
          endDate: plan === "free" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    } else {
      await db.subscription.create({
        data: {
          userId,
          plan,
          status: "active",
          endDate: plan === "free" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }

    return NextResponse.json({
      id: userId,
      plan,
      creditsUsed: creditResult.creditsUsed,
      creditsLimit: creditResult.creditsLimit,
    });
  } catch (error) {
    console.error("Update subscription error:", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}
