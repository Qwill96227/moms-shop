import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "./db";
import { orders, orderItems, type Order, type OrderItem } from "./db/schema";

export type OrderWithItems = Order & { items: OrderItem[] };
export const SOLD = ["paid", "shipped", "delivered", "needs_attention"] as const;

export async function ordersWithItems(status?: Order["status"][], take = 100): Promise<OrderWithItems[]> {
  const db = await getDb();
  const rows = await db.select().from(orders)
    .where(status?.length ? inArray(orders.status, status) : inArray(orders.status, [...SOLD, "canceled"]))
    .orderBy(desc(orders.createdAt)).limit(take);
  if (!rows.length) return [];
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((r) => r.id)));
  return rows.map((r) => ({ ...r, items: items.filter((i) => i.orderId === r.id) }));
}

export async function salesSummary(days = 30) {
  const db = await getDb();
  const since = new Date(Date.now() - days * 864e5);
  const [row] = await db
    .select({ revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`, count: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(inArray(orders.status, [...SOLD]), gte(orders.paidAt, since)));
  const [toPack] = await db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, "paid"));
  return { revenueCents: row.revenue, orderCount: row.count, toPack: toPack.count };
}
