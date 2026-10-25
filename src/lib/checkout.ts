import { z } from "zod";
import { inArray, eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { DB } from "./db";
import { orders, orderItems, products, variants, type Product, type Variant } from "./db/schema";
import { site } from "./site";

export const cartSchema = z.object({
  items: z
    .array(z.object({ variantId: z.number().int().positive(), quantity: z.number().int().min(1).max(20) }))
    .min(1, "Your bag is empty.")
    .max(30),
});
export type CartInput = z.infer<typeof cartSchema>;

export type PricedLine = {
  productId: number; variantId: number; productName: string; variantName: string;
  unitPriceCents: number; quantity: number; image?: string;
};

export class CheckoutError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Prices a cart from the database. Never trusts prices sent by the browser. */
export function priceCart(
  items: CartInput["items"],
  rows: { product: Product; variant: Variant }[],
): PricedLine[] {
  // Merge duplicate lines for the same variant.
  const qty = new Map<number, number>();
  for (const i of items) qty.set(i.variantId, (qty.get(i.variantId) ?? 0) + i.quantity);

  return [...qty.entries()].map(([variantId, quantity]) => {
    const row = rows.find((r) => r.variant.id === variantId);
    if (!row || !row.product.active) throw new CheckoutError("Something in your bag is no longer available. Remove it and try again.", 409);
    const label = `${row.product.name}${row.variant.name === "Standard" ? "" : ` (${row.variant.name})`}`;
    if (row.variant.stock < quantity) {
      throw new CheckoutError(
        row.variant.stock === 0
          ? `${label} just sold out. Remove it to continue.`
          : `Only ${row.variant.stock} left of ${label}. Lower the quantity to continue.`,
        409,
      );
    }
    return {
      productId: row.product.id, variantId, productName: row.product.name, variantName: row.variant.name,
      unitPriceCents: row.variant.priceCents ?? row.product.priceCents, quantity, image: row.product.images[0],
    };
  });
}

export function shippingFor(subtotalCents: number) {
  return subtotalCents >= site.shipping.freeOverCents ? 0 : site.shipping.flatCents;
}

export async function loadCartRows(db: DB, variantIds: number[]) {
  if (!variantIds.length) return [];
  return db
    .select({ product: products, variant: variants })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(inArray(variants.id, variantIds));
}

/**
 * Creates a pending order and a Stripe Checkout session for it.
 * Stripe hosts the card form, so card numbers never touch this server.
 */
export async function createCheckout(db: DB, stripe: Stripe, input: CartInput, origin: string) {
  const rows = await loadCartRows(db, input.items.map((i) => i.variantId));
  const lines = priceCart(input.items, rows);
  const subtotal = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const shipping = shippingFor(subtotal);

  const order = await db.transaction(async (tx) => {
    const [o] = await tx.insert(orders).values({ subtotalCents: subtotal, shippingCents: shipping, totalCents: subtotal + shipping }).returning();
    await tx.insert(orderItems).values(lines.map(({ image: _image, ...l }) => ({ orderId: o.id, ...l })));
    return o;
  });

  const abs = (u?: string) => (u && !u.endsWith(".svg") ? (u.startsWith("http") ? u : `${origin}${u}`) : undefined);

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: String(order.id),
      metadata: { orderId: String(order.id) },
      payment_intent_data: { metadata: { orderId: String(order.id) } },
      line_items: lines.map((l) => {
        const img = abs(l.image);
        return {
          quantity: l.quantity,
          price_data: {
            currency: "usd",
            unit_amount: l.unitPriceCents,
            product_data: {
              name: l.variantName === "Standard" ? l.productName : `${l.productName} (${l.variantName})`,
              ...(img ? { images: [img] } : {}),
              metadata: { productId: String(l.productId), variantId: String(l.variantId) },
            },
          },
        };
      }),
      shipping_address_collection: { allowed_countries: [...site.shipping.countries] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: shipping === 0 ? "Free shipping" : "Standard shipping",
            fixed_amount: { amount: shipping, currency: "usd" },
            delivery_estimate: { minimum: { unit: "business_day", value: 5 }, maximum: { unit: "business_day", value: 10 } },
          },
        },
      ],
      custom_fields: [
        {
          key: "notes",
          label: { type: "custom", custom: "Notes for Mom (names, colors, dates)" },
          type: "text",
          optional: true,
          text: { maximum_length: 255 },
        },
      ],
      phone_number_collection: { enabled: true },
      automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === "true" },
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
    },
    { idempotencyKey: `order-${order.id}` },
  );

  await db.update(orders).set({ stripeSessionId: session.id }).where(eq(orders.id, order.id));
  return { url: session.url!, orderId: order.id };
}
