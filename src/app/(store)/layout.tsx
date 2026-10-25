import Link from "next/link";
import { site } from "@/lib/site";
import { formatCents } from "@/lib/money";
import { Header } from "@/components/header";
import { PatchworkBand } from "@/components/patchwork-band";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header storeName={site.name} />
      <main id="main">{children}</main>
      <footer className="mt-24 bg-ink text-paper">
        <PatchworkBand />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-3">
          <div>
            <p className="font-display text-4xl font-extrabold">{site.name}</p>
            <p className="mt-2 max-w-xs text-paper/75">{site.tagline}</p>
          </div>
          <div>
            <h2 className="text-lg font-bold">Shipping</h2>
            <p className="mt-2 text-paper/75">
              {formatCents(site.shipping.flatCents)} flat in the US. Free on orders over {formatCents(site.shipping.freeOverCents)}.
              Made-to-order items ship in 5–10 business days.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold">Questions</h2>
            <p className="mt-2 text-paper/75">
              Email <a className="underline underline-offset-4" href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
              Custom and bulk orders are welcome.
            </p>
            <nav className="mt-4 flex gap-4 text-sm text-paper/60">
              <Link href="/shop">Shop</Link>
              <Link href="/about">About</Link>
              <Link href="/admin">Shop owner sign in</Link>
            </nav>
          </div>
        </div>
      </footer>
    </>
  );
}
