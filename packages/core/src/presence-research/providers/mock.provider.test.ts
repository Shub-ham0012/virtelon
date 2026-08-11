import { describe, expect, it } from "vitest";
import { MockSocialPresenceProvider } from "./mock.provider";

describe("MockSocialPresenceProvider", () => {
  it("never calls the network and never fabricates a result", async () => {
    const provider = new MockSocialPresenceProvider();
    const results = await provider.search({ businessName: "Acme Coaching", location: "Patna", platforms: ["instagram", "facebook", "linkedin"] });

    // No real search happened (no API key configured), so returning a
    // guessed URL would be a fabricated fact, not a search result — the
    // honest behavior is no results, not a plausible-looking fake one.
    expect(results).toEqual([]);
  });

  it("is deterministic for the same input", async () => {
    const provider = new MockSocialPresenceProvider();
    const query = { businessName: "Acme Coaching", location: "Patna", platforms: ["instagram" as const] };
    const first = await provider.search(query);
    const second = await provider.search(query);
    expect(first).toEqual(second);
  });
});
