import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { lowStockVariants } from "@/lib/fulfillment";
import { ordersWithItems, salesSummary } from "@/lib/admin-queries";
import { formatCents } from "@/lib/money";
import { stripeConfigured } from "@/lib/stripe";

export default async function Today() {
  const session = await requireAdmin("owner");
  const [summary, low, toPack] = await Promise.all([
    salesSummary(30), lowStockVariants(await getDb()), ordersWithItems(["paid", "needs_attention"], 6),
  ]);
  const hour = new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" });
  const greeting = Number(hour) < 12 ? "Good morning" : Number(hour) < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-10">
      <h1 className="text-4xl font-extrabold">{greeting}, {session.name.split(" ")[0]}.</h1>

      {!stripeConfigured() && (
        <p className="rounded-md border-2 border-marigold bg-marigold/15 p-4 font-bold">
          Payments aren&apos;t switched on yet. Add the Stripe keys (see the setup guide) and customers can check out.
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Orders to pack" value={String(summary.toPack)} href="/admin/orders" tone="bg-marigold" />
        <Stat label="Sales, last 30 days" value={formatCents(summary.revenueCents)} tone="bg-paper" />
        <Stat label="Orders, last 30 days" value={String(summary.orderCount)} tone="bg-paper" />
      </section>

      <section>
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-extrabold">Ready to pack</h2>
          <Link href="/admin/orders" className="font-bold underline underline-offset-4">All orders</Link>
        </div>
        {toPack.length ? (
          <ul className="mt-4 divide-y divide-ink/10 rounded-lg bg-paper">
            {toPack.map((o) => (
              <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
                <div>
                  <p className="font-bold">#{o.id} · {o.customerName ?? o.email ?? "Customer"}</p>
                  <p className="text-ink-soft">{o.items.map((i) => `${i.quantity} × ${i.productName}${i.variantName === "Standard" ? "" : ` (${i.variantName})`}`).join(", ")}</p>
                  {o.status === "needs_attention" && <p className="font-bold text-hibiscus-dark">Needs a look: {o.note}</p>}
                </div>
                <p className="font-bold">{formatCents(o.totalCents)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg bg-paper p-6 text-ink-soft">Nothing to pack. New paid orders show up here.</p>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-extrabold">Running low</h2>
        {low.length ? (
          <ul className="mt-4 divide-y divide-ink/10 rounded-lg bg-paper">
            {low.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 p-4">
                <span>{v.productName}{v.name === "Standard" ? "" : ` (${v.name})`}</span>
                <span className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-0.5 text-sm font-bold ${v.stock === 0 ? "bg-hibiscus text-paper" : "bg-marigold"}`}>
                    {v.stock === 0 ? "Sold out" : `${v.stock} left`}
                  </span>
                  <Link href={`/admin/products/${v.productId}`} className="font-bold underline underline-offset-4">Restock</Link>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg bg-paper p-6 text-ink-soft">Everything is well stocked.</p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, href, tone }: { label: string; value: string; href?: string; tone: string }) {
  const body = (
    <div className={`stitch rounded-lg p-6 ${tone}`}>
      <p className="font-display text-4xl font-extrabold">{value}</p>
      <p className="mt-1 font-bold">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
