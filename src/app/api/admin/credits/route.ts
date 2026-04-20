import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { addCredits, setCreditsLimit } from "@/lib/credits";
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
 * GET /api/admin/credits — Get credit summary for all users
 * Query: ?userId=xxx (optional: get specific user's details)
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const url = new URL(request.url);
    const targetUserId = url.searchParams.get("userId");

    if (targetUserId) {
      // Get specific user's credit details
      const user = await db.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
          creditsUsed: true,
          creditsLimit: true,
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
              id: true,
              amount: true,
              type: true,
              description: true,
              jobId: true,
              createdAt: true,
            },
          },
        },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json({
        user: {
          ...user,
          available: user.creditsLimit - user.creditsUsed,
        },
      });
    }

    // Get overall credit summary
    const [totalUsers, totalCreditsUsed, totalCreditsAvailable, recentTransactions] = await Promise.all([
      db.user.count(),
      db.user.aggregate({ _sum: { creditsUsed: true } }),
      db.user.aggregate({
        _sum: { creditsUsed: true },
      }),
      db.creditTransaction.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
      }),
    ]);

    const allUsers = await db.user.findMany({
      select: {
        creditsUsed: true,
        creditsLimit: true,
      },
    });

    const totalAvailable = allUsers.reduce((sum, u) => sum + Math.max(0, u.creditsLimit - u.creditsUsed), 0);

    return NextResponse.json({
      summary: {
        totalUsers,
        totalCreditsUsed: totalCreditsUsed._sum.creditsUsed || 0,
        totalCreditsAvailable: totalAvailable,
        recentTransactions,
      },
    });
  } catch (error) {
    console.error("Admin credits GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/credits — Grant or revoke credits from a user
 * Body: { userId, amount, description }
 * amount > 0 = grant credits, amount < 0 = revoke credits
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const body = await request.json();
    const { userId, amount, description } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (!amount || typeof amount !== "number" || amount === 0) {
      return NextResponse.json(
        { error: "amount must be a non-zero number" },
        { status: 400 }
      );
    }

    // Check target user exists
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (amount > 0) {
      // Grant credits
      const result = await addCredits(
        userId,
        amount,
        "admin_grant",
        description || `Admin granted ${amount} credit(s) to user ${targetUser.email}`,
        {
          adminId: admin.userId,
          amount,
          targetEmail: targetUser.email,
        }
      );

      return NextResponse.json({
        ...result,
        message: `Successfully granted ${amount} credit(s) to ${targetUser.email}`,
      });
    } else {
      // Revoke credits (deduct)
      const absAmount = Math.abs(amount);

      // Check if user has enough available credits
      const currentBalance = await db.user.findUnique({
        where: { id: userId },
        select: { creditsUsed: true, creditsLimit: true },
      });

      if (!currentBalance) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const available = currentBalance.creditsLimit - currentBalance.creditsUsed;
      const actualRevoke = Math.min(absAmount, available);

      if (actualRevoke <= 0) {
        return NextResponse.json(
          { error: "User has no available credits to revoke" },
          { status: 400 }
        );
      }

      const result = await addCredits(
        userId,
        actualRevoke,
        "admin_revoke",
        description || `Admin revoked ${actualRevoke} credit(s) from user ${targetUser.email}`,
        {
          adminId: admin.userId,
          amount: actualRevoke,
          targetEmail: targetUser.email,
          requested: absAmount,
          actual: actualRevoke,
        }
      );

      return NextResponse.json({
        ...result,
        message: `Successfully revoked ${actualRevoke} credit(s) from ${targetUser.email}`,
      });
    }
  } catch (error) {
    console.error("Admin credits POST error:", error);
    return NextResponse.json(
      { error: "Failed to process credit operation" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/credits — Set credits limit for a user
 * Body: { userId, creditsLimit, resetUsage }
 */
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const body = await request.json();
    const { userId, creditsLimit, resetUsage } = body;

    if (!userId || creditsLimit === undefined) {
      return NextResponse.json(
        { error: "userId and creditsLimit are required" },
        { status: 400 }
      );
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const result = await setCreditsLimit(
      userId,
      creditsLimit,
      resetUsage === true,
      "system_adjustment",
      `Admin set credits limit to ${creditsLimit} for user ${targetUser.email}${resetUsage ? " (usage reset)" : ""}`
    );

    return NextResponse.json({
      ...result,
      message: `Successfully updated credits limit for ${targetUser.email}`,
    });
  } catch (error) {
    console.error("Admin credits PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update credits limit" },
      { status: 500 }
    );
  }
}
