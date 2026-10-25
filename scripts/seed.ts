// Fills an empty production database with the sample catalog.
// Optional: Mom can also start from scratch in the dashboard.
import { getDb } from "../src/lib/db";
import { seedIfEmpty } from "../src/lib/db/seed";

getDb()
  .then((db) => seedIfEmpty(db))
  .then((did) => { console.log(did ? "Sample products added." : "Database already has categories; skipped."); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
