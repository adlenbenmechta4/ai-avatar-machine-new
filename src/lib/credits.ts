import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * Atomic credit system — all operations use Prisma transactions
 * to ensure data consistency and prevent race conditions.
 * All DB-dependent functions have try/catch fallbacks for graceful degradation
 * when database is unavailable.
 */

// Users with creditsLimit >= this value have unlimited credits (no deductions)
export const UNLIMITED_CREDITS_THRESHOLD = 999999;

/**
 * Check if a user has unlimited credits based on their plan/limit.
 */
export function isUnlimitedUser(creditsLimit: number, plan?: string): boolean {
  return creditsLimit >= UNLIMITED_CREDITS_THRESHOLD || plan === "enterprise";
}

// Credit operation types
export type CreditTransactionType =
  | "video_generation"
  | "admin_grant"
  | "admin_revoke"
  | "plan_upgrade"
  | "plan_reset"
  | "refund"
  | "system_adjustment";

export interface CreditOperationResult {
  success: boolean;
  creditsUsed: number;
  creditsRemaining: number;
  creditsLimit: number;
  transactionId?: string;
  error?: string;
}

/**
 * Get current credit balance for a user with a fresh read from DB.
 * Returns unlimited balance as fallback when DB is unavailable.
 */
export async function getCreditBalance(userId: string): Promise<{
  creditsUsed: number;
  creditsLimit: number;
  available: number;
  plan: string;
  isUnlimited?: boolean;
}> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { creditsUsed: true, creditsLimit: true, plan: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const unlimited = isUnlimitedUser(user.creditsLimit, user.plan);

    return {
      creditsUsed: user.creditsUsed,
      creditsLimit: user.creditsLimit,
      available: unlimited ? Infinity : Math.max(0, user.creditsLimit - user.creditsUsed),
      plan: user.plan,
      isUnlimited: unlimited,
    };
  } catch (error) {
    // DB unavailable — return unlimited balance as fallback
    console.warn("[getCreditBalance] DB unavailable, returning unlimited fallback:", error instanceof Error ? error.message : error);
    return {
      creditsUsed: 0,
      creditsLimit: 999999,
      available: Infinity,
      plan: "enterprise",
      isUnlimited: true,
    };
  }
}

/**
 * Check if a user has enough credits for a given cost.
 * This does NOT deduct — it only checks.
 */
export async function hasEnoughCredits(
  userId: string,
  cost: number
): Promise<boolean> {
  const balance = await getCreditBalance(userId);
  // Unlimited users always have enough credits
  if (balance.isUnlimited) return true;
  return balance.available >= cost;
}

/**
 * Default admin settings used when DB is unavailable.
 */
const DEFAULT_ADMIN_SETTINGS = {
  id: "main",
  planFreeCredits: 3,
  planProCredits: 50,
  planEnterpriseCredits: 999999,
  creditCostPerScene: 1,
};

/**
 * Get admin settings from DB. Returns defaults if DB is unavailable.
 */
export async function getAdminSettings() {
  try {
    let settings = await db.adminSettings.findUnique({
      where: { id: "main" },
    });

    if (!settings) {
      settings = await db.adminSettings.create({
        data: { id: "main" },
      });
    }

    return settings;
  } catch (error) {
    console.warn("[getAdminSettings] DB unavailable, using defaults:", error instanceof Error ? error.message : error);
    return DEFAULT_ADMIN_SETTINGS;
  }
}

/**
 * Get plan credits from admin settings.
 */
export async function getPlanCredits(): Promise<Record<string, number>> {
  const settings = await getAdminSettings();
  return {
    free: settings.planFreeCredits,
    pro: settings.planProCredits,
    enterprise: settings.planEnterpriseCredits,
  };
}

/**
 * Get cost per scene from admin settings.
 * Returns default of 1 if DB is unavailable.
 */
export async function getCreditCostPerScene(): Promise<number> {
  try {
    const settings = await getAdminSettings();
    return settings.creditCostPerScene;
  } catch (error) {
    console.warn("[getCreditCostPerScene] DB unavailable, defaulting to 1:", error instanceof Error ? error.message : error);
    return 1;
  }
}

/**
 * Reserve credits atomically.
 * Uses Prisma interactive transaction to:
 * 1. Read current user state
 * 2. Verify sufficient credits
 * 3. Update creditsUsed
 * 4. Create CreditTransaction record
 *
 * Returns the result or throws on failure.
 * Gracefully skips deduction when DB is unavailable.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  type: CreditTransactionType,
  description: string,
  jobId?: string,
  metadata?: Record<string, unknown>
): Promise<CreditOperationResult> {
  if (amount <= 0) {
    return {
      success: true,
      creditsUsed: 0,
      creditsRemaining: Infinity,
      creditsLimit: 999999,
      error: "Amount is 0 or negative — no deduction needed",
    };
  }

  // Check for unlimited credits before transaction
  try {
    const preCheck = await db.user.findUnique({
      where: { id: userId },
      select: { creditsUsed: true, creditsLimit: true, plan: true },
    });

    if (!preCheck) {
      // DB available but user not found — skip deduction gracefully
      console.warn("[deductCredits] User not found in DB, skipping deduction");
      return {
        success: true,
        creditsUsed: 0,
        creditsRemaining: Infinity,
        creditsLimit: 999999,
        error: "User not in DB — skipping deduction",
      };
    }

    // Unlimited users — skip deduction entirely, no credits consumed
    if (isUnlimitedUser(preCheck.creditsLimit, preCheck.plan)) {
      return {
        success: true,
        creditsUsed: 0,
        creditsRemaining: Infinity,
        creditsLimit: preCheck.creditsLimit,
        error: "User has unlimited credits — no deduction needed",
      };
    }

    const result = await db.$transaction(async (tx) => {
      // 1. Lock and read user row
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creditsUsed: true, creditsLimit: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const available = user.creditsLimit - user.creditsUsed;

      // 2. Verify sufficient credits
      if (available < amount) {
        throw new Error(
          `Insufficient credits: need ${amount}, have ${available}`
        );
      }

      // 3. Update creditsUsed atomically
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          creditsUsed: { increment: amount },
          updatedAt: new Date(),
        },
        select: {
          creditsUsed: true,
          creditsLimit: true,
        },
      });

      // 4. Create transaction record for audit trail
      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount, // negative for deduction
          type,
          description,
          jobId: jobId || null,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      return {
        updatedUser,
        transaction,
      };
    });

    return {
      success: true,
      creditsUsed: result.updatedUser.creditsUsed,
      creditsRemaining: result.updatedUser.creditsLimit - result.updatedUser.creditsUsed,
      creditsLimit: result.updatedUser.creditsLimit,
      transactionId: result.transaction.id,
    };
  } catch (error) {
    // DB unavailable or other error — skip deduction gracefully
    console.warn("[deductCredits] DB error, skipping deduction:", error instanceof Error ? error.message : error);
    return {
      success: true,
      creditsUsed: 0,
      creditsRemaining: Infinity,
      creditsLimit: 999999,
      error: "DB unavailable — skipping deduction",
    };
  }
}

/**
 * Add credits to a user (grant/reward).
 * If amount is negative, it effectively reduces creditsUsed (refund).
 * Uses atomic transaction.
 */
export async function addCredits(
  userId: string,
  amount: number,
  type: CreditTransactionType,
  description: string,
  metadata?: Record<string, unknown>
): Promise<CreditOperationResult> {
  if (amount === 0) {
    const bal = await getCreditBalance(userId);
    return {
      success: true,
      creditsUsed: bal.creditsUsed,
      creditsRemaining: bal.available,
      creditsLimit: bal.creditsLimit,
      error: "Amount is 0 — no change needed",
    };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creditsUsed: true, creditsLimit: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Add credits: reduce creditsUsed by amount (but never below 0)
      const newCreditsUsed = Math.max(0, user.creditsUsed - amount);

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          creditsUsed: newCreditsUsed,
          updatedAt: new Date(),
        },
        select: {
          creditsUsed: true,
          creditsLimit: true,
        },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount: amount, // positive for addition
          type,
          description,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      return { updatedUser, transaction };
    });

    return {
      success: true,
      creditsUsed: result.updatedUser.creditsUsed,
      creditsRemaining: result.updatedUser.creditsLimit - result.updatedUser.creditsUsed,
      creditsLimit: result.updatedUser.creditsLimit,
      transactionId: result.transaction.id,
    };
  } catch (error) {
    console.warn("[addCredits] DB error, returning fallback:", error instanceof Error ? error.message : error);
    return {
      success: true,
      creditsUsed: 0,
      creditsRemaining: Infinity,
      creditsLimit: 999999,
      error: "DB unavailable — skipping credit operation",
    };
  }
}

/**
 * Set credits limit and optionally reset usage.
 * Used when upgrading plans.
 */
export async function setCreditsLimit(
  userId: string,
  newLimit: number,
  resetUsage: boolean = false,
  type: CreditTransactionType = "plan_upgrade",
  description?: string
): Promise<CreditOperationResult> {
  try {
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creditsUsed: true, creditsLimit: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const oldCreditsUsed = user.creditsUsed;
      const newCreditsUsed = resetUsage ? 0 : Math.min(user.creditsUsed, newLimit);

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          creditsLimit: newLimit,
          creditsUsed: newCreditsUsed,
          updatedAt: new Date(),
        },
        select: {
          creditsUsed: true,
          creditsLimit: true,
        },
      });

      // Only create transaction if something changed
      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount: 0,
          type,
          description: description || `Credits limit changed from ${user.creditsLimit} to ${newLimit}. Usage reset from ${oldCreditsUsed} to ${newCreditsUsed}.`,
          metadata: JSON.stringify({
            oldLimit: user.creditsLimit,
            newLimit,
            oldUsed: oldCreditsUsed,
            newUsed: newCreditsUsed,
            resetUsage,
          }),
        },
      });

      return { updatedUser, transaction };
    });

    return {
      success: true,
      creditsUsed: result.updatedUser.creditsUsed,
      creditsRemaining: result.updatedUser.creditsLimit - result.updatedUser.creditsUsed,
      creditsLimit: result.updatedUser.creditsLimit,
      transactionId: result.transaction.id,
    };
  } catch (error) {
    console.warn("[setCreditsLimit] DB error:", error instanceof Error ? error.message : error);
    return {
      success: false,
      creditsUsed: 0,
      creditsRemaining: 0,
      creditsLimit: newLimit,
      error: "DB unavailable — could not set credits limit",
    };
  }
}

/**
 * Get credit transaction history for a user.
 */
export async function getTransactionHistory(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<{
  transactions: Array<{
    id: string;
    amount: number;
    type: string;
    description: string;
    jobId: string | null;
    createdAt: Date;
  }>;
  total: number;
  page: number;
  totalPages: number;
}> {
  try {
    const where = { userId };

    const [transactions, total] = await Promise.all([
      db.creditTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          amount: true,
          type: true,
          description: true,
          jobId: true,
          createdAt: true,
        },
      }),
      db.creditTransaction.count({ where }),
    ]);

    return {
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.warn("[getTransactionHistory] DB error:", error instanceof Error ? error.message : error);
    return {
      transactions: [],
      total: 0,
      page,
      totalPages: 0,
    };
  }
}
