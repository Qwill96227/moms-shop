import { sql } from "drizzle-orm";
import type { DB } from "./index";
import { categories, products, variants } from "./schema";

const SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];

const sampleCategories = [
  { slug: "tees", name: "T-shirts", blurb: "Soft cotton, pressed to order.", sortOrder: 1 },
  { slug: "mugs", name: "Mugs", blurb: "15 oz ceramic, dishwasher safe.", sortOrder: 2 },
  { slug: "bottles", name: "Water bottles", blurb: "Stainless, keeps cold all day.", sortOrder: 3 },
  { slug: "accessories", name: "Accessories", blurb: "Totes, keychains and small gifts.", sortOrder: 4 },
];

type Sample = {
  slug: string; name: string; category: string; price: number; featured?: boolean;
  description: string; variants: { name: string; stock: number; price?: number }[];
};

const sampleProducts: Sample[] = [
  {
    slug: "made-with-love-tee", name: "Made With Love Tee", category: "tees", price: 2400, featured: true,
    description: "Heavyweight cotton tee with a hand-set heart print. Runs true to size; size up for a roomy fit.",
    variants: SIZES.map((s) => ({ name: s, stock: 6, price: s.includes("2XL") || s.includes("3XL") ? 2700 : undefined })),
  },
  {
    slug: "family-reunion-tee", name: "Family Reunion Tee", category: "tees", price: 2200,
    description: "Your family name and year on the front. Add the name, year and colors in the notes box at checkout and I'll send a proof before pressing. Minimum of one, no maximum.",
    variants: SIZES.map((s) => ({ name: s, stock: 50, price: s.includes("2XL") || s.includes("3XL") ? 2500 : undefined })),
  },
  {
    slug: "front-porch-mug", name: "Front Porch Mug", category: "mugs", price: 1600, featured: true,
    description: "A big 15 oz mug for slow mornings. Print is baked in, so it holds up in the dishwasher.",
    variants: [{ name: "Standard", stock: 12 }],
  },
  {
    slug: "sunday-morning-mug", name: "Sunday Morning Mug", category: "mugs", price: 1600,
    description: "Two-tone ceramic mug with a marigold handle and inside.",
    variants: [{ name: "Standard", stock: 2 }],
  },
  {
    slug: "drink-your-water-bottle", name: "Drink Your Water Bottle", category: "bottles", price: 2800, featured: true,
    description: "20 oz double-wall stainless bottle. Cold for 24 hours, hot for 12. A gentle reminder printed right on it.",
    variants: [{ name: "Hibiscus", stock: 5 }, { name: "Okra green", stock: 5 }, { name: "Indigo", stock: 4 }],
  },
  {
    slug: "custom-name-bottle", name: "Custom Name Bottle", category: "bottles", price: 3200,
    description: "Any name or short phrase, up to 14 letters. Type it in the notes box at checkout.",
    variants: [{ name: "Hibiscus", stock: 20 }, { name: "Okra green", stock: 20 }, { name: "Indigo", stock: 20 }],
  },
  {
    slug: "everyday-tote", name: "Everyday Tote", category: "accessories", price: 1800, featured: true,
    description: "Sturdy 12 oz canvas tote with long handles and an inside pocket for keys.",
    variants: [{ name: "Natural", stock: 10 }],
  },
  {
    slug: "keychain-duo", name: "Keychain Duo", category: "accessories", price: 1000,
    description: "Two printed acrylic keychains: one for you, one to give away.",
    variants: [{ name: "Standard", stock: 0 }],
  },
];

export async function seedIfEmpty(db: DB) {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(categories);
  if (count > 0) return false;
  await seed(db);
  return true;
}

export async function seed(db: DB) {
  const cats = await db.insert(categories).values(sampleCategories).returning();
  const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
  for (const p of sampleProducts) {
    const [row] = await db
      .insert(products)
      .values({
        slug: p.slug, name: p.name, description: p.description, priceCents: p.price,
        categoryId: catId[p.category], featured: !!p.featured, images: [`/products/${p.slug}.svg`],
      })
      .returning();
    await db.insert(variants).values(
      p.variants.map((v, i) => ({
        productId: row.id, name: v.name, stock: v.stock, priceCents: v.price ?? null, sortOrder: i,
        sku: `${p.slug.slice(0, 12).toUpperCase()}-${v.name.replace(/\s+/g, "").toUpperCase()}`,
      })),
    );
  }
}
