import { describe, expect, it } from "vitest";
import { formatCents, parseDollars, slugify } from "@/lib/money";

describe("money", () => {
  it("formats cents as dollars", () => {
    expect(formatCents(2400)).toBe("$24.00");
    expect(formatCents(5)).toBe("$0.05");
  });
  it("parses what Mom types into the price box", () => {
    expect(parseDollars("24")).toBe(2400);
    expect(parseDollars("$24.5")).toBe(2450);
    expect(parseDollars(" 24.99 ")).toBe(2499);
    expect(parseDollars("24.999")).toBeNull();
    expect(parseDollars("-3")).toBeNull();
    expect(parseDollars("abc")).toBeNull();
  });
  it("makes clean links from names", () => {
    expect(slugify("Mom's Front Porch Mug!")).toBe("moms-front-porch-mug");
    expect(slugify("  Café  Tee ")).toBe("cafe-tee");
  });
});
