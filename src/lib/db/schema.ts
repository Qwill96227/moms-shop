import {
  pgTable, pgEnum, serial, integer, text, boolean, timestamp, jsonb, uniqueIndex, index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("admin_role", ["owner", "helper"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending", // checkout started, not paid yet
  "paid", // Stripe confirmed payment, ready to make/pack
  "shipped",
  "delivered",
  "canceled",
  "needs_attention", // paid, but something needs a human (e.g. oversold)
]);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  blurb: text("blurb").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    priceCents: integer("price_cents").notNull(),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    featured: boolean("featured").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("products_category_idx").on(t.categoryId), index("products_active_idx").on(t.active)],
);

// Every product has at least one variant. Tees use them for size/color,
// a mug just has one called "Standard".
export const variants = pgTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku"),
    stock: integer("stock").notNull().default(0),
    priceCents: integer("price_cents"), // null = use product price
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("variants_product_idx").on(t.productId)],
);

export type ShippingAddress = {
  line1?: string | null; line2?: string | null; city?: string | null;
  state?: string | null; postal_code?: string | null; country?: string | null;
};

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    stripeSessionId: text("stripe_session_id").unique(),
    status: orderStatusEnum("status").notNull().default("pending"),
    email: text("email"),
    customerName: text("customer_name"),
    shippingAddress: jsonb("shipping_address").$type<ShippingAddress>(),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    trackingNumber: text("tracking_number"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [index("orders_status_idx").on(t.status), index("orders_created_idx").on(t.createdAt)],
);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  variantId: integer("variant_id").references(() => variants.id, { onDelete: "set null" }),
  // Snapshot so old orders still read correctly after products change.
  productName: text("product_name").notNull(),
  variantName: text("variant_name").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull(),
});

export const adminUsers = pgTable(
  "admin_users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("helper"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("admin_users_email_idx").on(t.email)],
);

export type Product = typeof products.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
