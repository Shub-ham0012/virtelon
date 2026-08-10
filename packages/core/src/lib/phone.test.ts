import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("parses a number with an explicit country code to E.164", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
  });

  it("resolves a bare national number using the default country", () => {
    expect(normalizePhone("9876543210", "IN")).toBe("+919876543210");
  });

  it("returns null for garbage input", () => {
    expect(normalizePhone("not a phone number")).toBeNull();
  });

  it("returns null for empty/missing input", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  it("returns null when no country can be inferred and none is supplied", () => {
    expect(normalizePhone("9876543210")).toBeNull();
  });
});
