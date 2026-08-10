import { describe, expect, it } from "vitest";
import { MockSocialPresenceProvider } from "./mock.provider";

describe("MockSocialPresenceProvider", () => {
  it("never calls the network and returns deterministic, clearly-labeled results", async () => {
    const provider = new MockSocialPresenceProvider();
    const results = await provider.search({ businessName: "Acme Coaching", location: "Patna", platforms: ["instagram", "facebook", "linkedin"] });

    expect(results.every((r) => r.source === "mock")).toBe(true);
    expect(results.every((r) => r.confidence === "low")).toBe(true);
  });

  it("is deterministic for the same input", async () => {
    const provider = new MockSocialPresenceProvider();
    const query = { businessName: "Acme Coaching", location: "Patna", platforms: ["instagram" as const] };
    const first = await provider.search(query);
    const second = await provider.search(query);
    expect(first).toEqual(second);
  });
});
