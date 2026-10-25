import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { cartSchema, createCheckout, CheckoutError } from "@/lib/checkout";
import { limit } from "@/lib/rate-limit";
import { clientIp, siteOrigin } from "@/lib/request";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  const ip = await clientIp();
  const rl = await limit("checkout", ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = cartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: body?.items?.length === 0 ? "Your bag is empty." : "Your bag couldn't be read. Refresh the page and try again." }, { status: 400 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Checkout isn't switched on yet. Add your Stripe key to start taking payments." }, { status: 503 });
  }

  try {
    const { url, orderId } = await createCheckout(await getDb(), getStripe(), parsed.data, await siteOrigin());
    logger.info({ orderId }, "checkout started");
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof CheckoutError) return NextResponse.json({ error: err.message }, { status: err.status });
    logger.error({ err }, "checkout failed");
    return NextResponse.json({ error: "Checkout couldn't start. Try again in a minute." }, { status: 500 });
  }
}
