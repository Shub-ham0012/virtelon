import type { DiscoveredLead, LeadDiscoveryProvider, LeadSearchCriteria } from "../LeadDiscoveryProvider";

const NAME_PATTERNS: Record<string, string[]> = {
  default: ["{loc} {cat}", "{cat} Hub {loc}", "The {loc} {cat} Co.", "{loc} Prime {cat}", "Elite {cat} {loc}"],
  coaching: ["{loc} Coaching Institute", "Bright Minds {loc}", "{loc} Career Academy"],
  restaurant: ["{loc} Kitchen", "Spice Route {loc}", "{loc} Dine"],
  gym: ["{loc} Fitness Studio", "PowerHouse Gym {loc}", "{loc} CrossFit"],
  salon: ["{loc} Salon & Spa", "Glow Studio {loc}", "{loc} Beauty Lounge"],
};

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function seededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state * 1103515245 + 12345) >>> 0;
    return state / 0xffffffff;
  };
}

/**
 * Deterministic, clearly-labeled fake data — no network calls, no API key.
 * Every result carries `source: "mock"` and `raw.mock: true` so it's never
 * confusable with real data anywhere downstream (UI, exports, AI prompts).
 * Exists so Phases 2-4 can be built and tested end-to-end before a Google
 * Places (or other) API key is provisioned — see docs/ARCHITECTURE.md §E.
 */
export class MockLeadDiscoveryProvider implements LeadDiscoveryProvider {
  readonly name = "mock";

  async search(criteria: LeadSearchCriteria): Promise<DiscoveredLead[]> {
    const patterns = NAME_PATTERNS[criteria.category.toLowerCase()] ?? NAME_PATTERNS.default!;
    const rng = seededRandom(hashString(`${criteria.category}:${criteria.location}:${criteria.limit}`));
    const count = Math.min(criteria.limit, 50);
    const results: DiscoveredLead[] = [];

    for (let i = 0; i < count; i++) {
      const pattern = patterns[i % patterns.length]!;
      const businessName = pattern
        .replace("{loc}", criteria.location.split(",")[0]!.trim())
        .replace("{cat}", capitalize(criteria.category));
      const rating = Math.round((3 + rng() * 2) * 10) / 10; // 3.0–5.0
      const reviewCount = Math.floor(rng() * 400);
      const hasWebsite = rng() > 0.45; // mirrors the real-world signal this product exists to find gaps in

      if (criteria.minRating !== undefined && rating < criteria.minRating) continue;
      if (criteria.maxRating !== undefined && rating > criteria.maxRating) continue;
      if (criteria.requireWebsite && !hasWebsite) continue;

      results.push({
        externalId: `mock-${hashString(businessName + i)}`,
        source: "mock",
        businessName,
        category: criteria.category,
        phone: `+91${9000000000 + Math.floor(rng() * 99999999)}`,
        website: hasWebsite ? `https://www.${slugify(businessName)}.example.com` : undefined,
        address: `${Math.floor(rng() * 200) + 1}, Main Road`,
        city: criteria.location.split(",")[0]!.trim(),
        state: criteria.location.split(",")[1]?.trim(),
        country: "IN",
        latitude: 25.5 + rng(),
        longitude: 85.1 + rng(),
        rating,
        reviewCount,
        businessStatus: "OPERATIONAL",
        raw: { mock: true, generatedAt: new Date().toISOString() },
      });
    }

    return results;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
