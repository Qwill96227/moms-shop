import Image from "next/image";
import Link from "next/link";
import { listCategories, listProducts } from "@/lib/catalog";
import { site } from "@/lib/site";
import { ProductCard } from "@/components/product-card";

export const revalidate = 300; // caching layer: page is rebuilt at most every 5 min, or right after Mom edits a product

const blockColors = ["bg-marigold text-ink", "bg-okra text-paper", "bg-hibiscus text-paper", "bg-denim text-paper"];

export default async function Home() {
  const [featured, cats] = await Promise.all([listProducts({ featured: true }), listCategories()]);
  const art = featured.slice(0, 3);

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 md:grid-cols-[1.05fr_1fr] md:pt-16">
        <div>
          <h1 className="text-[2.9rem] font-extrabold leading-[0.95] sm:text-6xl lg:text-7xl">
            Made one at a time, for the people you love.
          </h1>
          <p className="mt-6 max-w-md text-lg text-ink-soft">{site.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/shop" className="btn btn-primary">Shop everything</Link>
            <Link href="/about" className="btn btn-ghost">Meet the maker</Link>
          </div>
        </div>

        <div className="quilt-in grid aspect-square grid-cols-6 grid-rows-6 gap-1.5 rounded-lg bg-ink p-1.5" aria-label="A patchwork of featured items">
          <Piece className="col-span-4 row-span-4 bg-shell" product={art[0]} />
          <div className="stitch col-span-2 row-span-2 rounded-md bg-marigold text-ink" />
          <Piece className="col-span-2 row-span-2 bg-shell" product={art[1]} />
          <div className="stitch col-span-2 row-span-2 rounded-md bg-hibiscus text-paper" />
          <Piece className="col-span-2 row-span-2 bg-shell" product={art[2]} />
          <div className="stitch col-span-2 row-span-2 rounded-md bg-okra text-paper" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4" aria-labelledby="cats">
        <h2 id="cats" className="text-3xl font-extrabold sm:text-4xl">Shop by kind</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {cats.map((c, i) => (
            <Link
              key={c.id}
              href={`/shop?category=${c.slug}`}
              className={`stitch flex min-h-40 flex-col justify-end rounded-md p-5 transition-transform hover:-translate-y-0.5 ${blockColors[i % blockColors.length]}`}
            >
              <span className="font-display text-2xl font-extrabold leading-tight">{c.name}</span>
              <span className="mt-1 text-sm opacity-85">{c.blurb}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-4" aria-labelledby="featured">
        <div className="flex items-end justify-between gap-4">
          <h2 id="featured" className="text-3xl font-extrabold sm:text-4xl">Favorites right now</h2>
          <Link href="/shop" className="font-bold underline underline-offset-4">See all</Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
          {featured.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      <section className="mx-auto mt-24 grid max-w-6xl items-center gap-10 px-4 md:grid-cols-[0.8fr_1fr]">
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg">
          <Image src={site.maker.photo} alt="" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
        </div>
        <div>
          <h2 className="text-4xl font-extrabold sm:text-5xl">{site.maker.heading}</h2>
          {site.maker.story.map((p) => (
            <p key={p.slice(0, 20)} className="mt-5 max-w-prose text-lg">{p}</p>
          ))}
          <div className="mt-8 rounded-md border-2 border-ink p-5">
            <h3 className="text-xl font-extrabold">Ordering for a reunion, church event or team?</h3>
            <p className="mt-1 text-ink-soft">I do custom runs of shirts, mugs and bottles. Tell me what you need and I&apos;ll send a quote.</p>
            <a href={`mailto:${site.contactEmail}?subject=Custom%20order`} className="btn btn-primary mt-4">Ask about a custom order</a>
          </div>
        </div>
      </section>
    </>
  );
}

function Piece({ className, product }: { className: string; product?: { slug: string; name: string; images: string[] } }) {
  if (!product?.images[0]) return <div className={`rounded-md ${className}`} />;
  return (
    <Link href={`/product/${product.slug}`} className={`relative overflow-hidden rounded-md ${className}`}>
      <Image src={product.images[0]} alt={product.name} fill priority sizes="(min-width: 768px) 30vw, 60vw" className="object-cover" />
    </Link>
  );
}
