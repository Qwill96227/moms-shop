import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { signSession, verifySession } from "@/lib/auth";

describe("admin sessions", () => {
  it("round-trips a signed session", async () => {
    const token = await signSession({ userId: 7, name: "Mom", role: "owner" });
    expect(await verifySession(token)).toEqual({ userId: 7, name: "Mom", role: "owner" });
  });
  it("rejects tampered or foreign tokens", async () => {
    const token = await signSession({ userId: 7, name: "Mom", role: "helper" });
    const [h, , s] = token.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: "7", role: "owner" })).toString("base64url")}.${s}`;
    expect(await verifySession(forged)).toBeNull();
    const other = await new SignJWT({ role: "owner" }).setProtectedHeader({ alg: "HS256" }).setSubject("1")
      .sign(crypto.getRandomValues(new Uint8Array(32)));
    expect(await verifySession(other)).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });
});
