import type { SocialPresenceProvider, SocialPresenceQuery, SocialPresenceResult } from "../SocialPresenceProvider";

/**
 * No GOOGLE_SEARCH_API_KEY configured — rather than fabricate a plausible-
 * looking URL (e.g. guessing "instagram.com/<slugified-name>"), this returns
 * no results. A guessed URL presented as an "unconfirmed" search result is
 * still a fabricated fact, not a real search — see docs/ARCHITECTURE.md §31
 * ("never a fake result presented as real"). Real links from the business's
 * own website (extractSocialLinks, always free) are unaffected by this —
 * this mock only stands in for the paid/keyed search step.
 */
export class MockSocialPresenceProvider implements SocialPresenceProvider {
  readonly name = "mock";

  async search(_query: SocialPresenceQuery): Promise<SocialPresenceResult[]> {
    return [];
  }
}
