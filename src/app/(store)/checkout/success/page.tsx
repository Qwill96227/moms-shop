import Link from "next/link";
import type { Metadata } from "next";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { ClearCart } from "@/components/clear-cart";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Success({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  let firstName: string | undefined;
  let email: string | undefined;
  let orderId: string | undefined;
  if (session_id && /^cs_[A-Za-z0-9_]+$/.test(session_id) && stripeConfigured()) {
    try {
      const s = await getStripe().checkout.sessions.retrieve(session_id);
      firstName = s.customer_details?.name?.split(" ")[0];
      email = s.customer_details?.email ?? undefined;
      orderId = s.metadata?.orderId;
    } catch { /* show the generic thank-you */ }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-16 text-center">
      <ClearCart />
      <div className="stitch mx-auto mb-8 size-24 rounded-md bg-marigold text-ink" aria-hidden />
      <h1 className="text-5xl font-extrabold">Thank you{firstName ? `, ${firstName}` : ""}.</h1>
      <p className="mt-4 text-lg">
        Your order{orderId ? ` #${orderId}` : ""} is in. {email ? `A receipt is on its way to ${email}.` : "A receipt is on its way to your email."}
      </p>
      <p className="mt-2 text-lg text-ink-soft">I&apos;ll start on it soon and email you tracking when it ships.</p>
      <Link href="/shop" className="btn btn-ghost mt-8">Keep shopping</Link>
    </div>
  );
}
