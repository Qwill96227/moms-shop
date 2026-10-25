import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getDb } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { markOrderPaid, markOrderExpired } from "@/lib/fulfillment";
import { logger } from "@/lib/logger";
import { sendAlert } from "@/lib/alerts";
import { revalidatePath } from "next/cache";

// Stripe calls this after payment. The signature check proves the request
// really came from Stripe, so nobody can fake a "paid" order.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), sig, secret);
  } catch (err) {
    logger.warn({ err }, "stripe webhook signature failed");
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  try {
    const db = await getDb();
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const r = await markOrderPaid(db, event.data.object);
        if (r.status === "paid" || r.status === "needs_attention") {
          revalidatePath("/", "layout"); // stock changed, refresh cached pages
        }
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await markOrderExpired(db, event.data.object);
        break;
      case "charge.dispute.created":
        await sendAlert(`🚨 A customer opened a dispute on charge ${event.data.object.id}. Check Stripe soon; there's a deadline to respond.`, "error");
        break;
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    // Returning 500 makes Stripe retry for up to 3 days.
    logger.error({ err, eventId: event.id, type: event.type }, "stripe webhook handler failed");
    await sendAlert(`🚨 Stripe webhook failed for ${event.type} (${event.id}). Stripe will retry automatically.`, "error");
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }
}
