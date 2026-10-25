import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Point an uptime monitor (UptimeRobot, Better Stack) at /api/health.
export async function GET() {
  const started = Date.now();
  const checks: Record<string, "ok" | "missing" | "down"> = {
    stripe: stripeConfigured() ? "ok" : "missing",
    webhook: process.env.STRIPE_WEBHOOK_SECRET ? "ok" : "missing",
  };
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    checks.database = "ok";
  } catch {
    checks.database = "down";
  }
  const healthy = checks.database === "ok";
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, latencyMs: Date.now() - started, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev" },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
