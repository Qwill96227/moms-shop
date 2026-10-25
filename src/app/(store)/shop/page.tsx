import Link from "next/link";
import type { Metadata } from "next";
import { listCategories, listProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";

export const metadata: Metadata = { title: "Shop" };

export default async function Shop({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const [cats, items] = await Promise.all([listCategories(), listProducts({ categorySlug: category })]);
  const current = cats.find((c) => c.slug === category);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <h1 className="text-5xl font-extrabold sm:text-6xl">{current?.name ?? "Everything"}</h1>
      {current && <p className="mt-2 text-lg text-ink-soft">{current.blurb}</p>}

      <nav className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2" aria-label="Filter by kind">
        <Pill href="/shop" active={!current}>Everything</Pill>
        {cats.map((c) => (
          <Pill key={c.id} href={`/shop?category=${c.slug}`} active={current?.id === c.id}>{c.name}</Pill>
        ))}
      </nav>

      {items.length ? (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <div className="mt-10 rounded-md border-2 border-dashed border-ink/30 p-10 text-center">
          <p className="text-lg">Nothing here yet. New pieces are on the way.</p>
          <Link href="/shop" className="btn btn-ghost mt-4">See everything</Link>
        </div>
      )}
    </div>
  );
}

function Pill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full border-2 border-ink px-4 py-2 font-bold ${active ? "bg-ink text-paper" : "hover:bg-shell"}`}
    >
      {children}
    </Link>
  );
}
