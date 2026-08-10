import type {
  SocialPlatform,
  SocialPresenceProvider,
  SocialPresenceQuery,
  SocialPresenceResult,
} from "../SocialPresenceProvider";

const PLATFORM_SITE: Record<SocialPlatform, string> = {
  instagram: "instagram.com",
  facebook: "facebook.com",
  linkedin: "linkedin.com",
  youtube: "youtube.com",
  x: "x.com",
};

interface CustomSearchItem {
  title?: string;
  link?: string;
  snippet?: string;
}

interface CustomSearchResponse {
  items?: CustomSearchItem[];
  error?: { message?: string };
}

function nameAppearsIn(businessName: string, text: string | undefined): boolean {
  if (!text) return false;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const nameWords = normalize(businessName).split(" ").filter((w) => w.length > 2);
  if (nameWords.length === 0) return false;
  const haystack = normalize(text);
  return nameWords.every((w) => haystack.includes(w));
}

/**
 * Uses the official Google Custom Search JSON API to find public profile
 * URLs — never logs into or scrapes the social platforms directly. Requires
 * GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID (a Programmable Search
 * Engine configured to search the whole web). See docs/ARCHITECTURE.md §0.2.
 */
export class GoogleCustomSearchProvider implements SocialPresenceProvider {
  readonly name = "google_custom_search";

  constructor(
    private readonly apiKey: string,
    private readonly engineId: string
  ) {}

  async search(query: SocialPresenceQuery): Promise<SocialPresenceResult[]> {
    const platformResults = await Promise.allSettled(
      query.platforms.map((platform) => this.searchPlatform(query.businessName, query.location, platform))
    );

    return platformResults
      .filter((r): r is PromiseFulfilledResult<SocialPresenceResult | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((r): r is SocialPresenceResult => r !== null);
  }

  private async searchPlatform(
    businessName: string,
    location: string,
    platform: SocialPlatform
  ): Promise<SocialPresenceResult | null> {
    const site = PLATFORM_SITE[platform];
    const q = `site:${site} "${businessName}" ${location}`;
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("cx", this.engineId);
    url.searchParams.set("q", q);
    url.searchParams.set("num", "3");

    const response = await fetch(url.toString());
    const data = (await response.json()) as CustomSearchResponse;
    if (!response.ok) {
      throw new Error(`Google Custom Search failed for ${platform}: ${data.error?.message ?? response.statusText}`);
    }

    const items = data.items ?? [];
    if (items.length === 0) return null;

    // Prefer the first result whose title/snippet clearly names the
    // business; fall back to the top result at low confidence otherwise.
    const strongMatch = items.find((item) => nameAppearsIn(businessName, item.title) || nameAppearsIn(businessName, item.snippet));
    const best = strongMatch ?? items[0];
    if (!best?.link) return null;

    return {
      platform,
      url: best.link,
      confidence: strongMatch ? "high" : "low",
      source: this.name,
    };
  }
}
