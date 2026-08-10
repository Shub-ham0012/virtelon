export type SocialPlatform = "instagram" | "facebook" | "linkedin" | "youtube" | "x";

export interface SocialPresenceQuery {
  businessName: string;
  location: string;
  platforms: SocialPlatform[];
}

export interface SocialPresenceResult {
  platform: SocialPlatform;
  url: string;
  /** "high" when the result's title/snippet clearly matches the business
   * name; "low" when it's a plausible but unconfirmed search hit. Never
   * presented to the user or AI as a confirmed fact — see
   * docs/ARCHITECTURE.md §0.2. */
  confidence: "high" | "low";
  source: string; // provider name, e.g. "google_custom_search"
}

/**
 * Finds PUBLIC social profile URLs via an official search API. Deliberately
 * does not, and must never, log into or scrape the social platforms
 * themselves — see docs/ARCHITECTURE.md §0.2 and §5/§10 of the product spec.
 */
export interface SocialPresenceProvider {
  readonly name: string;
  search(query: SocialPresenceQuery): Promise<SocialPresenceResult[]>;
}
