import { and, eq, gte, sql } from "drizzle-orm";
import type Stripe from "stripe";
import type { DB } from "./db";
import { orders, orderItems, variants, products } from "./db/schema";
import { formatCents } from "./money";
import { site } from "./site";
import { logger } from "./logger";
import { sendAlert, emailOwner } from "./alerts";

/**
 * Called by the Stripe webhook when a payment succeeds.
 * Idempotent: Stripe may deliver the same event more than once, and only the
 * first delivery moves the order from "pending" to "paid" and takes stock.
 */
export async function markOrderPaid(db: DB, session: Stripe.Checkout.Session) {
  const orderId = Number(session.metadata?.orderId ?? session.client_reference_id);
  if (!orderId) {
    logger.error({ sessionId: session.id }, "checkout session has no orderId");
    return { status: "ignored" as const };
  }
  if (session.payment_status !== "paid") return { status: "awaiting_payment" as const };

  const shippingDetails =
    session.collected_information?.shipping_details ??
    (session as unknown as { shipping_details?: Stripe.Checkout.Session.CollectedInformation.ShippingDetails }).shipping_details;
  const notes = session.custom_fields?.find((f) => f.key === "notes")?.text?.value ?? null;

  const result = await db.transaction(async (tx) => {
    const [order] = await tx
      .update(orders)
      .set({
        status: "paid",
        paidAt: new Date(),
        email: session.customer_details?.email ?? null,
        customerName: shippingDetails?.name ?? session.customer_details?.name ?? null,
        shippingAddress: shippingDetails?.address ?? session.customer_details?.address ?? null,
        shippingCents: session.shipping_cost?.amount_total ?? undefined,
        totalCents: session.amount_total ?? undefined,
        note: notes,
      })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
      .returning();
    if (!order) return null; // already handled

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const problems: string[] = [];
    const lowStock: string[] = [];
    for (const item of items) {
      if (!item.variantId) continue;
      // Only decrement if there's enough, so stock never goes negative.
      const [v] = await tx
        .update(variants)
        .set({ stock: sql`${variants.stock} - ${item.quantity}` })
        .where(and(eq(variants.id, item.variantId), gte(variants.stock, item.quantity)))
        .returning();
      if (!v) problems.push(`${item.productName} (${item.variantName}) oversold by up to ${item.quantity}`);
      else if (v.stock <= site.lowStockThreshold) lowStock.push(`${item.productName} (${item.variantName}): ${v.stock} left`);
    }
    if (problems.length) {
      await tx.update(orders).set({ status: "needs_attention", note: [notes, ...problems].filter(Boolean).join("\n") }).where(eq(orders.id, orderId));
    }
    return { order, items, problems, lowStock };
  });

  if (!result) return { status: "duplicate" as const };

  const { order, items, problems, lowStock } = result;
  const total = formatCents(session.amount_total ?? order.totalCents);
  const lines = items.map((i) => `• ${i.quantity} × ${i.productName}${i.variantName === "Standard" ? "" : ` (${i.variantName})`}`).join("\n");
  await Promise.all([
    sendAlert(`🛍️ New order #${orderId}: ${total}\n${lines}`),
    emailOwner(
      `New order #${orderId} (${total})`,
      `${order.customerName ?? "A customer"} just ordered:\n\n${lines}\n\n${notes ? `Notes: ${notes}\n\n` : ""}Open your dashboard to pack it: ${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/admin/orders`,
    ),
    problems.length ? sendAlert(`⚠️ Order #${orderId} needs attention: ${problems.join("; ")}`, "warn") : null,
    lowStock.length ? sendAlert(`📦 Running low: ${lowStock.join("; ")}`, "warn") : null,
  ]);
  logger.info({ orderId, total: session.amount_total }, "order paid");
  return { status: problems.length ? ("needs_attention" as const) : ("paid" as const) };
}

export async function markOrderExpired(db: DB, session: Stripe.Checkout.Session) {
  const orderId = Number(session.metadata?.orderId ?? session.client_reference_id);
  if (!orderId) return;
  await db.update(orders).set({ status: "canceled" }).where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
}

export async function lowStockVariants(db: DB) {
  return db
    .select({ id: variants.id, name: variants.name, stock: variants.stock, productName: products.name, productId: products.id })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(and(eq(products.active, true), sql`${variants.stock} <= ${site.lowStockThreshold}`))
    .orderBy(variants.stock);
}
