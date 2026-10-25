import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { site } from "@/lib/site";
import { logout } from "../actions";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const links = [
    ...(session.role === "owner" ? [{ href: "/admin", label: "Today" }] : []),
    { href: "/admin/orders", label: "Orders" },
    ...(session.role === "owner"
      ? [{ href: "/admin/products", label: "Products" }, { href: "/admin/categories", label: "Categories" }]
      : []),
  ];
  return (
    <div className="min-h-dvh bg-shell/60">
      <header className="bg-ink text-paper">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="font-display text-2xl font-extrabold">{site.name} <span className="font-body text-base font-normal text-paper/70">dashboard</span></Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-paper/70">Hi, {session.name.split(" ")[0]}</span>
            <Link href="/" className="underline underline-offset-4">View store</Link>
            <form action={logout}><button className="underline underline-offset-4">Sign out</button></form>
          </div>
        </div>
        <AdminNav links={links} />
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
