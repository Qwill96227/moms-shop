"use server";

import { z } from "zod";
import { and, eq, ne, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { categories, orders, products, variants } from "@/lib/db/schema";
import { checkCredentials, endSession, requireAdmin, startSession } from "@/lib/auth";
import { limit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { parseDollars, slugify } from "@/lib/money";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/alerts";
import { site } from "@/lib/site";

export type FormState = { error?: string; ok?: string; email?: string } | undefined;

/* ---------- sign in / out ---------- */

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const ip = await clientIp();
  const rl = await limit("login", ip);
  const email = String(form.get("email") ?? "");
  if (!rl.ok) return { email, error: `Too many tries. Wait ${Math.ceil(rl.retryAfterSec / 60)} minutes and try again.` };
  const password = String(form.get("password") ?? "");
  const user = await checkCredentials(email, password);
  if (!user) {
    logger.warn({ ip }, "failed admin login");
    return { email, error: "That email and password don't match. Check them and try again." };
  }
  await startSession(user);
  logger.info({ userId: user.id }, "admin signed in");
  redirect(user.role === "owner" ? "/admin" : "/admin/orders");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

async function guard(role: "owner" | "helper") {
  const s = await requireAdmin(role);
  const rl = await limit("adminWrite", `u${s.userId}`);
  if (!rl.ok) throw new Error("Slow down a little and try again.");
  return s;
}

/* ---------- products ---------- */

const productSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(2, "Give the product a name.").max(120),
  description: z.string().trim().max(4000),
  categoryId: z.number().int().positive().nullable(),
  price: z.string(),
  featured: z.boolean(),
  active: z.boolean(),
  images: z.array(z.string().max(500).refine((u) => u.startsWith("/") || u.startsWith("https://"), "Bad image link")).max(8),
  variants: z
    .array(z.object({
      id: z.number().int().positive().optional(),
      name: z.string().trim().min(1, "Every option needs a name, like M or Black.").max(60),
      stock: z.number().int().min(0).max(100000),
      price: z.string().optional(),
      sku: z.string().trim().max(60).optional(),
    }))
    .min(1, "Add at least one option. Use \"Standard\" if there's only one kind."),
});

export async function saveProduct(_: FormState, form: FormData): Promise<FormState> {
  await guard("owner");
  let input: z.infer<typeof productSchema>;
  try {
    input = productSchema.parse(JSON.parse(String(form.get("payload") ?? "{}")));
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : undefined;
    return { error: msg ?? "Some fields couldn't be read. Check the form and save again." };
  }
  const priceCents = parseDollars(input.price);
  if (priceCents === null || priceCents < 50) return { error: "Enter a price like 24 or 24.99 (at least $0.50)." };
  const variantRows: (z.infer<typeof productSchema>["variants"][number] & { priceCents: number | null })[] = [];
  for (const v of input.variants) {
    const vp = v.price?.trim() ? parseDollars(v.price) : null;
    if (v.price?.trim() && (vp === null || vp < 50)) return { error: `The price for "${v.name}" should look like 27 or 27.50.` };
    variantRows.push({ ...v, priceCents: vp });
  }

  const db = await getDb();
  let slug = slugify(input.name) || "item";
  const clash = await db.select({ id: products.id }).from(products)
    .where(input.id ? and(eq(products.slug, slug), ne(products.id, input.id)) : eq(products.slug, slug)).limit(1);
  if (clash.length) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const id = await db.transaction(async (tx) => {
    const values = {
      name: input.name, description: input.description, categoryId: input.categoryId, priceCents,
      featured: input.featured, active: input.active, images: input.images, updatedAt: new Date(),
    };
    let pid = input.id;
    if (pid) {
      const [existing] = await tx.select({ slug: products.slug, name: products.name }).from(products).where(eq(products.id, pid));
      if (!existing) throw new Error("not found");
      // Keep the old link working unless the name changed.
      await tx.update(products).set({ ...values, slug: existing.name === input.name ? existing.slug : slug }).where(eq(products.id, pid));
    } else {
      const [row] = await tx.insert(products).values({ ...values, slug }).returning({ id: products.id });
      pid = row.id;
    }
    const keepIds = variantRows.filter((v) => v.id).map((v) => v.id!);
    await tx.delete(variants).where(keepIds.length ? and(eq(variants.productId, pid), notInArray(variants.id, keepIds)) : eq(variants.productId, pid));
    for (const [i, v] of variantRows.entries()) {
      const row = { name: v.name, stock: v.stock, priceCents: v.priceCents, sku: v.sku || null, sortOrder: i };
      if (v.id) await tx.update(variants).set(row).where(and(eq(variants.id, v.id), eq(variants.productId, pid)));
      else await tx.insert(variants).values({ ...row, productId: pid });
    }
    return pid;
  });

  revalidatePath("/", "layout");
  redirect(`/admin/products?saved=${id}`);
}

export async function toggleProductActive(id: number, active: boolean) {
  await guard("owner");
  const db = await getDb();
  await db.update(products).set({ active, updatedAt: new Date() }).where(eq(products.id, id));
  revalidatePath("/", "layout");
}

/* ---------- categories ---------- */

export async function saveCategory(_: FormState, form: FormData): Promise<FormState> {
  await guard("owner");
  const parsed = z.object({
    id: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(2, "Give the category a name.").max(40),
    blurb: z.string().trim().max(120),
  }).safeParse({ id: form.get("id") || undefined, name: form.get("name"), blurb: form.get("blurb") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await getDb();
  const { id, name, blurb } = parsed.data;
  if (id) {
    await db.update(categories).set({ name, blurb }).where(eq(categories.id, id));
  } else {
    const slug = slugify(name);
    const exists = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug));
    if (exists.length) return { error: `There's already a category called ${name}.` };
    const all = await db.select({ id: categories.id }).from(categories);
    await db.insert(categories).values({ name, blurb, slug, sortOrder: all.length + 1 });
  }
  revalidatePath("/", "layout");
  return { ok: id ? "Category saved." : `Added ${name}.` };
}

/* ---------- orders ---------- */

const orderUpdate = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(["paid", "shipped", "delivered", "canceled", "needs_attention"]),
  trackingNumber: z.string().trim().max(80).optional(),
  notify: z.boolean(),
});

export async function updateOrder(_: FormState, form: FormData): Promise<FormState> {
  await guard("helper");
  const parsed = orderUpdate.safeParse({
    id: form.get("id"), status: form.get("status"),
    trackingNumber: form.get("trackingNumber") || undefined, notify: form.get("notify") === "on",
  });
  if (!parsed.success) return { error: "That update couldn't be saved. Refresh and try again." };
  const { id, status, trackingNumber, notify } = parsed.data;
  const db = await getDb();
  const [order] = await db.update(orders).set({ status, ...(trackingNumber !== undefined ? { trackingNumber } : {}) })
    .where(and(eq(orders.id, id), ne(orders.status, "pending"))).returning();
  if (!order) return { error: "That order isn't paid yet, so it can't be updated." };

  let emailed = false;
  if (notify && status === "shipped" && order.email) {
    const first = order.customerName?.split(" ")[0] ?? "there";
    emailed = await sendEmail(
      order.email,
      `Your ${site.name} order #${order.id} shipped`,
      `Hi ${first},\n\nYour order is on its way!${order.trackingNumber ? `\n\nTracking number: ${order.trackingNumber}` : ""}\n\nThank you for supporting my shop.\n\n${site.name}`,
    );
  }
  revalidatePath("/admin", "layout");
  return { ok: `Order #${id} marked ${status.replace("_", " ")}${emailed ? " and the customer was emailed" : ""}.` };
}
