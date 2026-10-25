import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ordersWithItems } from "@/lib/admin-queries";
import { formatCents } from "@/lib/money";
import type { Order } from "@/lib/db/schema";
import { OrderForm } from "./order-form";

const tabs: { key: string; label: string; status?: Order["status"][] }[] = [
  { key: "pack", label: "To pack", status: ["paid", "needs_attention"] },
  { key: "shipped", label: "Shipped", status: ["shipped"] },
  { key: "delivered", label: "Delivered", status: ["delivered"] },
  { key: "canceled", label: "Canceled", status: ["canceled"] },
  { key: "all", label: "All" },
];

export default async function Orders({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin("helper");
  const { tab = "pack" } = await searchParams;
  const current = tabs.find((t) => t.key === tab) ?? tabs[0];
  const list = await ordersWithItems(current.status, 200);
  const emailOn = Boolean(process.env.RESEND_API_KEY);

  return (
    <div>
      <h1 className="text-4xl font-extrabold">Orders</h1>
      <nav className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-2">
        {tabs.map((t) => (
          <Link key={t.key} href={`/admin/orders?tab=${t.key}`} aria-current={t.key === current.key ? "page" : undefined}
            className={`shrink-0 rounded-full border-2 border-ink px-4 py-1.5 font-bold ${t.key === current.key ? "bg-ink text-paper" : "bg-paper"}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <p className="mt-6 rounded-lg bg-paper p-8 text-ink-soft">
          {current.key === "pack" ? "No orders waiting. When someone pays, their order lands here." : "No orders here yet."}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {list.map((o) => {
            const a = o.shippingAddress;
            return (
              <li key={o.id} className="rounded-lg bg-paper p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xl font-extrabold">#{o.id} · {o.customerName ?? "Customer"}</h2>
                  <p className="text-ink-soft">
                    {(o.paidAt ?? o.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}
                  </p>
                </div>
                {o.status === "needs_attention" && (
                  <p className="mt-2 rounded-md bg-hibiscus/10 p-3 font-bold text-hibiscus-dark">Needs a look. Check stock before packing.</p>
                )}
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <ul className="space-y-1">
                    {o.items.map((i) => (
                      <li key={i.id}><strong>{i.quantity} ×</strong> {i.productName}{i.variantName === "Standard" ? "" : ` (${i.variantName})`} <span className="text-ink-soft">· {formatCents(i.unitPriceCents)}</span></li>
                    ))}
                    <li className="pt-1 font-bold">Total {formatCents(o.totalCents)}</li>
                  </ul>
                  <div className="text-ink-soft">
                    {a && <address className="not-italic">{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state} {a.postal_code}</address>}
                    {o.email && <p><a className="underline" href={`mailto:${o.email}`}>{o.email}</a></p>}
                  </div>
                </div>
                {o.note && <p className="mt-3 whitespace-pre-line rounded-md bg-shell p-3"><strong>Notes:</strong> {o.note}</p>}
                <OrderForm id={o.id} status={o.status} trackingNumber={o.trackingNumber ?? ""} emailOn={emailOn && Boolean(o.email)} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
