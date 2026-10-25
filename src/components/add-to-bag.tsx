"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "./cart-provider";
import { formatCents } from "@/lib/money";

type Option = { id: number; name: string; stock: number; priceCents: number };

export function AddToBag({ slug, productName, image, options }: {
  slug: string; productName: string; image?: string; options: Option[];
}) {
  const { add } = useCart();
  const firstAvailable = options.find((o) => o.stock > 0) ?? options[0];
  const [selected, setSelected] = useState<number | undefined>(options.length === 1 ? firstAvailable?.id : undefined);
  const [added, setAdded] = useState(false);
  const choice = options.find((o) => o.id === selected);
  const showPicker = options.length > 1;
  const soldOut = options.every((o) => o.stock <= 0);

  function onAdd() {
    if (!choice) return;
    add({
      variantId: choice.id, slug, productName, variantName: choice.name, priceCents: choice.priceCents,
      image, quantity: 1, maxQuantity: Math.min(choice.stock, 20),
    });
    setAdded(true);
  }

  return (
    <div className="mt-4">
      <p className="font-display text-2xl font-bold">{formatCents((choice ?? firstAvailable)?.priceCents ?? 0)}</p>

      {showPicker && (
        <fieldset className="mt-6">
          <legend className="label">Choose one</legend>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => {
              const out = o.stock <= 0;
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={out}
                  aria-pressed={selected === o.id}
                  onClick={() => { setSelected(o.id); setAdded(false); }}
                  className={`min-h-12 min-w-14 rounded-lg border-2 px-4 font-bold transition-colors ${
                    selected === o.id ? "border-ink bg-ink text-paper" : "border-ink/30 hover:border-ink"
                  } ${out ? "cursor-not-allowed line-through opacity-40" : ""}`}
                >
                  {o.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {choice && choice.stock > 0 && choice.stock <= 3 && (
        <p className="mt-3 font-bold text-hibiscus-dark">Only {choice.stock} left</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary min-w-56" disabled={!choice || soldOut || choice.stock <= 0} onClick={onAdd}>
          {soldOut ? "Sold out" : !choice ? "Choose an option" : "Add to bag"}
        </button>
        {added && (
          <p role="status" className="font-bold">
            Added. <Link href="/cart" className="underline underline-offset-4">View bag</Link>
          </p>
        )}
      </div>
    </div>
  );
}
