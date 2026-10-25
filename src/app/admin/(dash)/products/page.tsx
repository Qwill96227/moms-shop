import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listProducts, summarize } from "@/lib/catalog";
import { formatCents } from "@/lib/money";
import { ActiveToggle } from "./active-toggle";

export default async function Products({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin("owner");
  const { saved } = await searchParams;
  const items = await listProducts({ includeInactive: true });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold">Products</h1>
        <Link href="/admin/products/new" className="btn btn-primary">Add a product</Link>
      </div>
      {saved && <p role="status" className="mt-4 rounded-md bg-okra/10 p-3 font-bold text-okra">Saved. It&apos;s live in the store.</p>}
      <ul className="mt-6 space-y-3">
        {items.map((p) => {
          const { min } = summarize(p);
          const stock = p.variants.reduce((s, v) => s + v.stock, 0);
          return (
            <li key={p.id} className={`flex items-center gap-4 rounded-lg bg-paper p-3 ${p.active ? "" : "opacity-60"}`}>
              <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-shell">
                {p.images[0] && <Image src={p.images[0]} alt="" fill sizes="64px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/products/${p.id}`} className="block truncate text-lg font-bold hover:underline">{p.name}</Link>
                <p className="text-ink-soft">
                  {formatCents(min)} · {p.category?.name ?? "No category"} ·{" "}
                  <span className={stock === 0 ? "font-bold text-hibiscus-dark" : ""}>{stock === 0 ? "sold out" : `${stock} in stock`}</span>
                  {p.featured && " · on home page"}
                </p>
              </div>
              <ActiveToggle id={p.id} active={p.active} />
              <Link href={`/admin/products/${p.id}`} className="btn btn-ghost hidden sm:inline-flex">Edit</Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
