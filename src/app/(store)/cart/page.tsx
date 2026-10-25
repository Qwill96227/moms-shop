"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart-provider";
import { formatCents } from "@/lib/money";

const FLAT = Number(process.env.NEXT_PUBLIC_SHIPPING_FLAT_CENTS ?? 595);
const FREE_OVER = Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_OVER_CENTS ?? 5000);

export default function CartPage() {
  const { items, ready, subtotalCents, setQuantity, remove } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shipping = subtotalCents >= FREE_OVER ? 0 : FLAT;

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout couldn't start. Try again in a minute.");
      window.location.assign(data.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!ready) return <div className="mx-auto max-w-3xl px-4 pt-10" aria-busy />;

  if (!items.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-16 text-center">
        <h1 className="text-5xl font-extrabold">Your bag is empty</h1>
        <p className="mt-3 text-lg text-ink-soft">Find something you like and it will wait here for you.</p>
        <Link href="/shop" className="btn btn-primary mt-8">Start shopping</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-10">
      <h1 className="text-5xl font-extrabold">Your bag</h1>
      <ul className="mt-8 divide-y-2 divide-ink/10 border-y-2 border-ink/10">
        {items.map((i) => (
          <li key={i.variantId} className="flex gap-4 py-5">
            <Link href={`/product/${i.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-md bg-shell sm:size-28">
              {i.image && <Image src={i.image} alt="" fill sizes="112px" className="object-cover" />}
            </Link>
            <div className="flex flex-1 flex-col">
              <div className="flex justify-between gap-3">
                <div>
                  <Link href={`/product/${i.slug}`} className="text-lg font-bold leading-tight hover:underline">{i.productName}</Link>
                  {i.variantName !== "Standard" && <p className="text-ink-soft">{i.variantName}</p>}
                </div>
                <p className="font-display font-bold">{formatCents(i.priceCents * i.quantity)}</p>
              </div>
              <div className="mt-auto flex items-center gap-4 pt-3">
                <div className="flex items-center rounded-full border-2 border-ink">
                  <button type="button" className="size-10 text-xl font-bold" aria-label={`One fewer ${i.productName}`} onClick={() => setQuantity(i.variantId, i.quantity - 1)} disabled={i.quantity <= 1}>−</button>
                  <span className="w-8 text-center font-bold" aria-live="polite">{i.quantity}</span>
                  <button type="button" className="size-10 text-xl font-bold disabled:opacity-30" aria-label={`One more ${i.productName}`} onClick={() => setQuantity(i.variantId, i.quantity + 1)} disabled={i.quantity >= i.maxQuantity}>+</button>
                </div>
                <button type="button" className="text-ink-soft underline underline-offset-4" onClick={() => remove(i.variantId)}>Remove</button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <dl className="mt-6 space-y-2 text-lg [&_dd]:font-display">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatCents(subtotalCents)}</dd></div>
        <div className="flex justify-between"><dt>Shipping</dt><dd>{shipping === 0 ? "Free" : formatCents(shipping)}</dd></div>
        {shipping > 0 && (
          <p className="text-base text-okra">Add {formatCents(FREE_OVER - subtotalCents)} more for free shipping.</p>
        )}
        <div className="flex justify-between border-t-2 border-ink pt-3 text-xl font-bold"><dt>Total</dt><dd>{formatCents(subtotalCents + shipping)}</dd></div>
      </dl>

      {error && <p role="alert" className="mt-4 rounded-md bg-hibiscus/10 p-4 font-bold text-hibiscus-dark">{error}</p>}

      <button type="button" className="btn btn-primary mt-6 w-full" onClick={checkout} disabled={busy}>
        {busy ? "Opening secure checkout…" : "Check out"}
      </button>
      <p className="mt-3 text-center text-sm text-ink-soft">You&apos;ll pay on Stripe&apos;s secure page. Cards, Apple Pay and Google Pay accepted.</p>
    </div>
  );
}
