// Usage: npm run admin:create -- you@example.com "Your Name" helper
// Prompts for the password so it never lands in shell history.
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";
import { getDb } from "../src/lib/db";
import { adminUsers } from "../src/lib/db/schema";

async function main() {
  const [email, name, role = "helper"] = process.argv.slice(2);
  if (!email || !name || !["owner", "helper"].includes(role)) {
    console.log('Usage: npm run admin:create -- email "Name" [owner|helper]');
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question("Password (12+ characters): ");
  rl.close();
  if (password.length < 12) throw new Error("Password must be at least 12 characters");
  const db = await getDb();
  await db.insert(adminUsers).values({
    email: email.toLowerCase(), name, role: role as "owner" | "helper", passwordHash: await bcrypt.hash(password, 12),
  }).onConflictDoUpdate({ target: adminUsers.email, set: { name, role: role as "owner" | "helper", passwordHash: await bcrypt.hash(password, 12) } });
  console.log(`Saved ${email} as ${role}.`);
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
