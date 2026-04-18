import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  // ─── ?grant-admin=email@example.com ─ Grant admin access ─────
  const grantEmail = url.searchParams.get("grant-admin");
  if (grantEmail) {
    try {
      const user = await db.user.findUnique({ where: { email: grantEmail.toLowerCase() } });
      if (!user) {
        return NextResponse.json({ success: false, error: `User "${grantEmail}" not found` }, { status: 404 });
      }
      const updated = await db.user.update({
        where: { id: user.id },
        data: {
          role: "admin",
          plan: "enterprise",
          creditsUsed: 0,
          creditsLimit: 999999,
        },
      });
      // Also update subscription
      await db.subscription.upsert({
        where: { userId: user.id },
        update: { plan: "enterprise", status: "active" },
        create: { userId: user.id, plan: "enterprise", status: "active" },
      });
      return NextResponse.json({ success: true, user: updated });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
  }

  // ─── Default: DB setup / check tables ────────────────────────
  const results: string[] = [];
  try {
    const tables = await db.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    const tableNames = tables.map(t => t.tablename);
    results.push(`Tables: [${tableNames.join(", ")}]`);

    if (!tableNames.includes("GeneratedVideo")) {
      await db.$executeRawUnsafe(`
        CREATE TABLE "GeneratedVideo" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "title" TEXT NOT NULL DEFAULT 'My AI Video',
          "videoUrl" TEXT NOT NULL,
          "thumbnailUrl" TEXT,
          "duration" TEXT,
          "scenesCount" INTEGER NOT NULL DEFAULT 1,
          "provider" TEXT NOT NULL DEFAULT 'kie',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "GeneratedVideo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
      results.push("Created GeneratedVideo table ✓");
      await db.$executeRawUnsafe(`CREATE INDEX "GeneratedVideo_userId_idx" ON "GeneratedVideo"("userId");`);
      results.push("Created index ✓");
    } else {
      results.push("GeneratedVideo table OK ✓");
    }

    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
