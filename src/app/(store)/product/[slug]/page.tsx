import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug, listProducts, priceOf } from "@/lib/catalog";
import { AddToBag } from "@/components/add-to-bag";

export const revalidate = 300;

// Pre-build every product page at deploy; new ones are built on first visit.
export async function generateStaticParams() {
  return (await listProducts()).map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return {};
  return { title: p.name, description: p.description.slice(0, 160), openGraph: { images: p.images.filter((i) => !i.endsWith(".svg")) } };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const options = product.variants.map((v) => ({
    id: v.id, name: v.name, stock: v.stock, priceCents: priceOf(product, v),
  }));

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-8 md:grid-cols-2 md:pt-12">
      <div className="space-y-3">
        {product.images.map((src, i) => (
          <div key={src} className="relative aspect-square overflow-hidden rounded-md bg-shell">
            <Image src={src} alt={i === 0 ? product.name : ""} fill priority={i === 0} sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>
        ))}
      </div>
      <div className="md:sticky md:top-24 md:self-start">
        {product.category && (
          <Link href={`/shop?category=${product.category.slug}`} className="font-bold text-okra underline-offset-4 hover:underline">
            {product.category.name}
          </Link>
        )}
        <h1 className="mt-1 text-4xl font-extrabold leading-tight sm:text-5xl">{product.name}</h1>
        <AddToBag
          slug={product.slug}
          productName={product.name}
          image={product.images[0]}
          options={options}
        />
        <div className="mt-8 max-w-prose whitespace-pre-line text-lg">{product.description}</div>
      </div>
    </div>
  );
}
