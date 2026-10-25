import path from "node:path";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { logger } from "../logger";

export type DB = PostgresJsDatabase<typeof schema>;

const g = globalThis as unknown as { __db?: Promise<DB> };

/**
 * Databases & storage layer.
 * - Production: Postgres (Neon, Supabase, RDS...) via DATABASE_URL, pooled.
 * - Local dev with no DATABASE_URL: an embedded Postgres (PGlite) in .data/,
 *   migrated and filled with sample products automatically.
 */
export function getDb(): Promise<DB> {
  if (!g.__db) g.__db = connect();
  return g.__db;
}

export function setDbForTesting(db: DB) {
  g.__db = Promise.resolve(db);
}

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    const client = postgres(url, {
      max: Number(process.env.DB_POOL_MAX ?? 5), // small per instance; serverless scales out
      idle_timeout: 20,
      prepare: false, // works behind pgbouncer / Neon pooler
    });
    return drizzle(client, { schema });
  }
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables.");
  }
  logger.info("DATABASE_URL not set, using embedded dev database in .data/");
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // During `next build` use a throwaway in-memory copy, so parallel build
  // workers never fight over the same files.
  const building = process.env.NEXT_PHASE === "phase-production-build";
  let dataDir: string | undefined;
  if (!building) {
    dataDir = path.join(process.cwd(), ".data", "pglite");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dataDir, { recursive: true });
  }
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const { seedIfEmpty } = await import("./seed");
  await seedIfEmpty(db as unknown as DB);
  return db as unknown as DB;
}

export { schema };
