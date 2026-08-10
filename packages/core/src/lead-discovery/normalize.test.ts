import { describe, expect, it } from "vitest";
import { normalizeDiscoveredLead } from "./normalize";
import type { DiscoveredLead } from "./LeadDiscoveryProvider";

function baseLead(overrides: Partial<DiscoveredLead> = {}): DiscoveredLead {
  return {
    externalId: "ext-1",
    source: "mock",
    businessName: "  Acme   Coaching  ",
    category: "  Coaching Institute ",
    raw: {},
    ...overrides,
  };
}

describe("normalizeDiscoveredLead", () => {
  it("trims and collapses whitespace in the business name", () => {
    const result = normalizeDiscoveredLead(baseLead());
    expect(result.businessName).toBe("Acme Coaching");
  });

  it("lowercases the category", () => {
    const result = normalizeDiscoveredLead(baseLead());
    expect(result.category).toBe("coaching institute");
  });

  it("adds https:// and lowercases the hostname of a bare website", () => {
    const result = normalizeDiscoveredLead(baseLead({ website: "WWW.Example.com/Page" }));
    expect(result.website).toBe("https://www.example.com/Page");
  });

  it("drops an unparseable website rather than storing garbage", () => {
    const result = normalizeDiscoveredLead(baseLead({ website: "://not a url" }));
    expect(result.website).toBeUndefined();
  });

  it("normalizes the phone to E.164 using the default country", () => {
    const result = normalizeDiscoveredLead(baseLead({ phone: "9876543210" }), "IN");
    expect(result.phoneE164).toBe("+919876543210");
  });

  it("leaves phoneE164 null when the phone can't be parsed", () => {
    const result = normalizeDiscoveredLead(baseLead({ phone: "not a phone" }), "IN");
    expect(result.phoneE164).toBeNull();
  });

  it("title-cases city and state", () => {
    const result = normalizeDiscoveredLead(baseLead({ city: "patna", state: "bihar" }));
    expect(result.city).toBe("Patna");
    expect(result.state).toBe("Bihar");
  });
});
