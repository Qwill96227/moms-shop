"use client";

import Link from "next/link";
import { useCart } from "./cart-provider";

export function Header({ storeName }: { storeName: string }) {
  const { count, ready } = useCart();
  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-display text-3xl font-extrabold leading-none tracking-tight sm:text-4xl">
          {storeName}
        </Link>
        <nav className="flex items-center gap-1 text-base font-bold sm:gap-3">
          <Link href="/shop" className="rounded-full px-3 py-2 hover:bg-shell">Shop</Link>
          <Link href="/about" className="hidden rounded-full px-3 py-2 hover:bg-shell sm:inline-block">About</Link>
          <Link href="/cart" className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-paper" aria-label={`Bag, ${count} items`}>
            Bag
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-marigold px-1 text-sm text-ink">
              {ready ? count : 0}
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
