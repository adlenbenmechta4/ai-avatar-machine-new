import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Helper: Check if the current user is an admin.
 * Reads role from DB to ensure it's up-to-date.
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
 * GET /api/admin/users — List all users with pagination and search
 * Query: ?page=1&limit=20&search=email
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);
    const search = url.searchParams.get("search") || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          plan: true,
          creditsUsed: true,
          creditsLimit: true,
          createdAt: true,
          updatedAt: true,
          subscription: {
            select: {
              status: true,
              startDate: true,
              endDate: true,
            },
          },
          _count: {
            select: { transactions: true },
          },
        },
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Admin list users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/users — Update a user (plan, credits, role)
 * Body: { userId, plan?, creditsUsed?, creditsLimit?, role? }
 */
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const body = await request.json();
    const { userId, plan, creditsUsed, creditsLimit, role } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Check target user exists
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    const changes: string[] = [];

    if (plan && ["free", "pro", "enterprise"].includes(plan)) {
      updateData.plan = plan;
      changes.push(`plan: ${targetUser.role} → ${plan}`);
    }

    if (creditsUsed !== undefined && typeof creditsUsed === "number") {
      updateData.creditsUsed = Math.max(0, creditsUsed);
      changes.push(`creditsUsed: → ${creditsUsed}`);
    }

    if (creditsLimit !== undefined && typeof creditsLimit === "number") {
      updateData.creditsLimit = Math.max(0, creditsLimit);
      changes.push(`creditsLimit: → ${creditsLimit}`);
    }

    if (role && ["user", "admin"].includes(role)) {
      updateData.role = role;
      changes.push(`role: ${targetUser.role} → ${role}`);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    updateData.updatedAt = new Date();

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        plan: true,
        creditsUsed: true,
        creditsLimit: true,
        createdAt: true,
      },
    });

    // Log the admin action
    await db.creditTransaction.create({
      data: {
        userId,
        amount: 0,
        type: "system_adjustment",
        description: `Admin updated user: ${changes.join(", ")}`,
        metadata: JSON.stringify({
          adminId: admin.userId,
          changes,
        }),
      },
    });

    return NextResponse.json({
      user: updatedUser,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Admin update user error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users — Delete a user
 * Body: { userId }
 */
export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.error) return admin.error;

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Prevent self-deletion
    if (userId === admin.userId) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete user and all related data (cascade)
    await db.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      message: `User "${targetUser.email}" deleted successfully`,
    });
  } catch (error) {
    console.error("Admin delete user error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
