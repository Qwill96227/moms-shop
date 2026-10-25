import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { categories, products, variants, type Product, type Variant, type Category } from "./db/schema";

export type ProductWithVariants = Product & { variants: Variant[]; category: Category | null };

export function priceOf(p: Pick<Product, "priceCents">, v?: Pick<Variant, "priceCents"> | null) {
  return v?.priceCents ?? p.priceCents;
}

export function summarize(p: ProductWithVariants) {
  const prices = p.variants.map((v) => priceOf(p, v));
  const min = prices.length ? Math.min(...prices) : p.priceCents;
  const max = prices.length ? Math.max(...prices) : p.priceCents;
  const inStock = p.variants.some((v) => v.stock > 0);
  return { min, max, inStock };
}

async function attach(rows: Product[]): Promise<ProductWithVariants[]> {
  if (!rows.length) return [];
  const db = await getDb();
  const ids = rows.map((r) => r.id);
  const [vs, cats] = await Promise.all([
    db.select().from(variants).where(inArray(variants.productId, ids)).orderBy(asc(variants.sortOrder), asc(variants.id)),
    db.select().from(categories),
  ]);
  return rows.map((r) => ({
    ...r,
    variants: vs.filter((v) => v.productId === r.id),
    category: cats.find((c) => c.id === r.categoryId) ?? null,
  }));
}

export async function listCategories() {
  const db = await getDb();
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function listProducts(opts: { categorySlug?: string; featured?: boolean; includeInactive?: boolean } = {}) {
  const db = await getDb();
  const where = [];
  if (!opts.includeInactive) where.push(eq(products.active, true));
  if (opts.featured) where.push(eq(products.featured, true));
  if (opts.categorySlug) {
    const [cat] = await db.select().from(categories).where(eq(categories.slug, opts.categorySlug)).limit(1);
    if (!cat) return [];
    where.push(eq(products.categoryId, cat.id));
  }
  const rows = await db.select().from(products).where(where.length ? and(...where) : undefined)
    .orderBy(desc(products.featured), desc(products.createdAt));
  return attach(rows);
}

export async function getProductBySlug(slug: string) {
  const db = await getDb();
  const [row] = await db.select().from(products).where(and(eq(products.slug, slug), eq(products.active, true))).limit(1);
  if (!row) return null;
  return (await attach([row]))[0];
}

export async function getProductById(id: number) {
  const db = await getDb();
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!row) return null;
  return (await attach([row]))[0];
}
