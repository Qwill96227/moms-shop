import Image from "next/image";
import Link from "next/link";
import { summarize, type ProductWithVariants } from "@/lib/catalog";
import { formatCents } from "@/lib/money";

export function ProductCard({ product }: { product: ProductWithVariants }) {
  const { min, max, inStock } = summarize(product);
  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-md bg-shell">
        {product.images[0] && (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
        {!inStock && (
          <span className="absolute left-3 top-3 rounded-full bg-paper px-3 py-1 text-sm font-bold">Sold out</span>
        )}
      </div>
      <h3 className="mt-3 text-lg font-bold leading-tight group-hover:underline group-hover:underline-offset-4">{product.name}</h3>
      <p className="font-display text-ink-soft">{min === max ? formatCents(min) : `${formatCents(min)} – ${formatCents(max)}`}</p>
    </Link>
  );
}
