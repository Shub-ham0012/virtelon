import { describe, expect, it } from "vitest";
import { MockLeadDiscoveryProvider } from "./mock.provider";

describe("MockLeadDiscoveryProvider", () => {
  const provider = new MockLeadDiscoveryProvider();

  it("returns results clearly labeled as mock data", async () => {
    const results = await provider.search({ category: "coaching", location: "Patna, Bihar", limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    for (const lead of results) {
      expect(lead.source).toBe("mock");
      expect(lead.raw.mock).toBe(true);
    }
  });

  it("respects the requested limit", async () => {
    const results = await provider.search({ category: "gym", location: "Delhi", limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("is deterministic for the same criteria", async () => {
    const a = await provider.search({ category: "salon", location: "Mumbai, Maharashtra", limit: 5 });
    const b = await provider.search({ category: "salon", location: "Mumbai, Maharashtra", limit: 5 });
    expect(a.map((l) => l.externalId)).toEqual(b.map((l) => l.externalId));
  });

  it("honors requireWebsite", async () => {
    const results = await provider.search({
      category: "restaurant",
      location: "Bengaluru, Karnataka",
      limit: 20,
      requireWebsite: true,
    });
    expect(results.every((l) => !!l.website)).toBe(true);
  });

  it("honors minRating", async () => {
    const results = await provider.search({
      category: "clinic",
      location: "Chennai, Tamil Nadu",
      limit: 20,
      minRating: 4.5,
    });
    expect(results.every((l) => (l.rating ?? 0) >= 4.5)).toBe(true);
  });
});
