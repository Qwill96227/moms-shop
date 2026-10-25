import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { testDb, fakeStripe } from "./helpers";
import { cartSchema, createCheckout, CheckoutError, shippingFor } from "@/lib/checkout";
import { markOrderPaid, markOrderExpired } from "@/lib/fulfillment";
import { orders, products, variants } from "@/lib/db/schema";
import type { DB } from "@/lib/db";

let db: DB;
const variantOf = async (slug: string, name: string) => {
  const rows = await db.select({ v: variants }).from(variants).innerJoin(products, eq(products.id, variants.productId)).where(eq(products.slug, slug));
  return rows.map((r) => r.v).find((v) => v.name === name)!;
};
const paidSession = (orderId: number, extra: Partial<Stripe.Checkout.Session> = {}) =>
  ({
    id: `cs_test_${orderId}`, metadata: { orderId: String(orderId) }, client_reference_id: String(orderId), payment_status: "paid",
    amount_total: 5395, shipping_cost: { amount_total: 0 },
    customer_details: { email: "aunt.dee@example.com", name: "Dee Carter", address: null },
    collected_information: { shipping_details: { name: "Dee Carter", address: { line1: "12 Oak St", city: "Baton Rouge", state: "LA", postal_code: "70801", country: "US" } } },
    custom_fields: [{ key: "notes", text: { value: "Gift wrap please" } }],
    ...extra,
  }) as unknown as Stripe.Checkout.Session;

beforeAll(async () => { db = await testDb(); });

describe("cart validation", () => {
  it("rejects empty and absurd carts", () => {
    expect(cartSchema.safeParse({ items: [] }).success).toBe(false);
    expect(cartSchema.safeParse({ items: [{ variantId: 1, quantity: 500 }] }).success).toBe(false);
    expect(cartSchema.safeParse({ items: [{ variantId: "1; drop table", quantity: 1 }] }).success).toBe(false);
  });
});

describe("shipping", () => {
  it("is free over the threshold", () => {
    expect(shippingFor(4999)).toBe(595);
    expect(shippingFor(5000)).toBe(0);
  });
});

describe("checkout → payment → stock", () => {
  it("prices from the database, not the browser, and creates a pending order", async () => {
    const tee = await variantOf("made-with-love-tee", "2XL"); // has a $27 override
    const mug = await variantOf("front-porch-mug", "Standard");
    const stripe = fakeStripe();
    const { orderId, url } = await createCheckout(db, stripe.client, {
      items: [{ variantId: tee.id, quantity: 1 }, { variantId: mug.id, quantity: 1 }, { variantId: mug.id, quantity: 1 }],
    }, "https://shop.test");
    expect(url).toContain("checkout.stripe.com");
    const params = stripe.calls[0] as Stripe.Checkout.SessionCreateParams;
    expect(params.line_items).toHaveLength(2); // duplicate mug lines merged
    expect(params.line_items![0].price_data!.unit_amount).toBe(2700);
    expect(params.line_items![1].quantity).toBe(2);
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(order.status).toBe("pending");
    expect(order.subtotalCents).toBe(2700 + 3200);
    expect(order.shippingCents).toBe(0);
  });

  it("refuses sold-out items with a clear message", async () => {
    const keys = await variantOf("keychain-duo", "Standard");
    await expect(createCheckout(db, fakeStripe().client, { items: [{ variantId: keys.id, quantity: 1 }] }, "https://x"))
      .rejects.toThrow(CheckoutError);
    await expect(createCheckout(db, fakeStripe().client, { items: [{ variantId: keys.id, quantity: 1 }] }, "https://x"))
      .rejects.toThrow(/sold out/);
  });

  it("marks the order paid once, takes stock once, even if Stripe retries", async () => {
    const mug = await variantOf("sunday-morning-mug", "Standard"); // stock 2
    const { orderId } = await createCheckout(db, fakeStripe().client, { items: [{ variantId: mug.id, quantity: 2 }] }, "https://x");
    expect((await markOrderPaid(db, paidSession(orderId))).status).toBe("paid");
    expect((await markOrderPaid(db, paidSession(orderId))).status).toBe("duplicate");
    expect((await variantOf("sunday-morning-mug", "Standard")).stock).toBe(0);
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(order.status).toBe("paid");
    expect(order.customerName).toBe("Dee Carter");
    expect(order.shippingAddress?.city).toBe("Baton Rouge");
    expect(order.note).toBe("Gift wrap please");
  });

  it("flags oversold orders instead of going negative", async () => {
    const bottle = await variantOf("drink-your-water-bottle", "Indigo"); // stock 4
    const a = await createCheckout(db, fakeStripe().client, { items: [{ variantId: bottle.id, quantity: 3 }] }, "https://x");
    const b = await createCheckout(db, fakeStripe().client, { items: [{ variantId: bottle.id, quantity: 3 }] }, "https://x");
    await markOrderPaid(db, paidSession(a.orderId));
    expect((await markOrderPaid(db, paidSession(b.orderId))).status).toBe("needs_attention");
    expect((await variantOf("drink-your-water-bottle", "Indigo")).stock).toBe(1);
  });

  it("cancels abandoned checkouts and never re-opens paid ones", async () => {
    const tote = await variantOf("everyday-tote", "Natural");
    const { orderId } = await createCheckout(db, fakeStripe().client, { items: [{ variantId: tote.id, quantity: 1 }] }, "https://x");
    await markOrderExpired(db, paidSession(orderId));
    expect((await db.select().from(orders).where(eq(orders.id, orderId)))[0].status).toBe("canceled");
    expect((await markOrderPaid(db, paidSession(orderId))).status).toBe("duplicate");
  });

  it("ignores sessions that aren't paid yet", async () => {
    const tote = await variantOf("everyday-tote", "Natural");
    const { orderId } = await createCheckout(db, fakeStripe().client, { items: [{ variantId: tote.id, quantity: 1 }] }, "https://x");
    expect((await markOrderPaid(db, paidSession(orderId, { payment_status: "unpaid" }))).status).toBe("awaiting_payment");
  });
});
