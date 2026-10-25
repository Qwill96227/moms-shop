import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { adminUsers } from "./db/schema";

/**
 * Auth & permissions layer.
 * Admins sign in with email + password (bcrypt). The session is a signed,
 * httpOnly, SameSite=Lax cookie that expires in 7 days.
 * Roles: "owner" can do everything; "helper" can see and ship orders only.
 */
export type Role = "owner" | "helper";
export type Session = { userId: number; name: string; role: Role };

const COOKIE = "shop_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be at least 32 characters");
    return new TextEncoder().encode("dev-only-secret-change-me-dev-only-secret");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(session: Session) {
  return new SignJWT({ name: session.name, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(session.userId))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const role = payload.role;
    if (role !== "owner" && role !== "helper") return null;
    return { userId: Number(payload.sub), name: String(payload.name ?? ""), role };
  } catch {
    return null;
  }
}

export async function getSession() {
  const jar = await cookies();
  return verifySession(jar.get(COOKIE)?.value);
}

export async function requireAdmin(role: Role = "helper"): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  if (role === "owner" && s.role !== "owner") redirect("/admin/orders");
  return s;
}

/**
 * First sign-in: if no admin exists yet and ADMIN_EMAIL / ADMIN_PASSWORD are
 * set, that account is created as the owner. After that the env vars are ignored.
 */
async function bootstrapOwner() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const db = await getDb();
  const existing = await db.select({ id: adminUsers.id }).from(adminUsers).limit(1);
  if (existing.length) return;
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  await db.insert(adminUsers).values({
    email, name: process.env.ADMIN_NAME ?? "Mom", role: "owner", passwordHash: await hashPassword(password),
  }).onConflictDoNothing();
}

export async function checkCredentials(email: string, password: string) {
  await bootstrapOwner();
  const db = await getDb();
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email.toLowerCase().trim())).limit(1);
  // Compare against a dummy hash when the user doesn't exist so timing doesn't leak which emails are real.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? "$2b$12$/HTrygy1f78O6KVblZA4B.Y8HHPkFVUtMuJv97RcC5Lwa7LI71IyG");
  return ok && user ? user : null;
}

export async function startSession(user: { id: number; name: string; role: Role }) {
  const token = await signSession({ userId: user.id, name: user.name, role: user.role });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
