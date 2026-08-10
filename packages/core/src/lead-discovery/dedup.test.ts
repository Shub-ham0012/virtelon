import { describe, expect, it } from "vitest";
import { computeDedupHash } from "./dedup";
import { normalizeDiscoveredLead } from "./normalize";
import type { DiscoveredLead } from "./LeadDiscoveryProvider";

function normalized(overrides: Partial<DiscoveredLead> = {}) {
  return normalizeDiscoveredLead({
    externalId: "x",
    source: "mock",
    businessName: "Acme Coaching",
    category: "coaching",
    phone: "9876543210",
    city: "Patna",
    raw: {},
    ...overrides,
  }, "IN");
}

describe("computeDedupHash", () => {
  it("is stable for the same business name + phone + city", () => {
    expect(computeDedupHash(normalized())).toBe(computeDedupHash(normalized()));
  });

  it("is unaffected by case differences (normalization already handled that)", () => {
    const a = computeDedupHash(normalized({ businessName: "Acme Coaching" }));
    const b = computeDedupHash(normalized({ businessName: "acme coaching" }));
    expect(a).toBe(b);
  });

  it("differs when the phone number differs", () => {
    const a = computeDedupHash(normalized({ phone: "9876543210" }));
    const b = computeDedupHash(normalized({ phone: "9123456780" }));
    expect(a).not.toBe(b);
  });

  it("differs when the business name differs", () => {
    const a = computeDedupHash(normalized({ businessName: "Acme Coaching" }));
    const b = computeDedupHash(normalized({ businessName: "Zenith Coaching" }));
    expect(a).not.toBe(b);
  });
});
