import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { getCreditBalance, deductCredits, addCredits, getCreditCostPerScene } from "@/lib/credits";

export const dynamic = "force-dynamic";

/**
 * GET /api/credits — Get current credit balance
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authUser.id;

    const balance = await getCreditBalance(userId);
    const costPerScene = await getCreditCostPerScene();

    return NextResponse.json({
      ...balance,
      costPerScene,
    });
  } catch (error) {
    console.error("Get credits error:", error);
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/credits — Deduct credits for a video generation
 * Body: { cost: number, jobId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authUser.id;
    const body = await request.json();
    const { cost, jobId } = body;

    if (!cost || typeof cost !== "number" || cost <= 0) {
      return NextResponse.json(
        { error: "Valid cost (positive number) is required" },
        { status: 400 }
      );
    }

    const result = await deductCredits(
      userId,
      cost,
      "video_generation",
      `Video generation: ${cost} credit(s) deducted`,
      jobId || undefined,
      { cost, timestamp: new Date().toISOString() }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to deduct credits" },
        { status: 402 } // 402 Payment Required
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Deduct credits error:", msg);

    if (msg.includes("Insufficient credits")) {
      return NextResponse.json(
        { error: msg, code: "INSUFFICIENT_CREDITS" },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process credit deduction" },
      { status: 500 }
    );
  }
}
