import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import { seed } from "@/lib/db/seed";
import type { DB } from "@/lib/db";

/** A fresh in-memory Postgres with migrations and the sample catalog. */
export async function testDb(): Promise<DB> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  await seed(db as unknown as DB);
  return db as unknown as DB;
}

/** Just enough of the Stripe client for createCheckout. */
let sessionSeq = 0;
export function fakeStripe() {
  const calls: unknown[] = [];
  return {
    calls,
    client: {
      checkout: {
        sessions: {
          create: async (params: unknown) => {
            calls.push(params);
            const id = `cs_test_${++sessionSeq}`;
            return { id, url: `https://checkout.stripe.com/c/pay/${id}` };
          },
        },
      },
    } as never,
  };
}
