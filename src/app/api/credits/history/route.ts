import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { getTransactionHistory } from "@/lib/credits";

export const dynamic = "force-dynamic";

/**
 * GET /api/credits/history — Get credit transaction history
 * Query: ?page=1&limit=20
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authUser.id;
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);

    const result = await getTransactionHistory(userId, page, limit);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get credit history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit history" },
      { status: 500 }
    );
  }
}
