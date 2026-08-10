import type { SocialPresenceProvider, SocialPresenceQuery, SocialPresenceResult } from "../SocialPresenceProvider";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20);
}

/** Deterministic, clearly-labeled fake search results — no network call, no
 * API key. Half the requested platforms "find" a low-confidence result so
 * the UI/downstream logic can be exercised without a real search key. */
export class MockSocialPresenceProvider implements SocialPresenceProvider {
  readonly name = "mock";

  async search(query: SocialPresenceQuery): Promise<SocialPresenceResult[]> {
    const handle = slugify(query.businessName);
    return query.platforms
      .filter((_, i) => i % 2 === 0)
      .map((platform) => ({
        platform,
        url: `https://${platform === "x" ? "x.com" : `${platform}.com`}/${handle}`,
        confidence: "low" as const,
        source: this.name,
      }));
  }
}
