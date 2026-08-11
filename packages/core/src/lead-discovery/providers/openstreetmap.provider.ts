import type { DiscoveredLead, LeadDiscoveryProvider, LeadSearchCriteria } from "../LeadDiscoveryProvider";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// The public overpass-api.de instance frequently returns 504s when under
// load (a known, documented characteristic of the free instance — not a bug
// in this integration). Two other public instances mirror the same data, so
// on a 5xx/network failure we retry the same instance once, then fail over
// to the next mirror, rather than surfacing a transient outage as a hard
// error to the user.
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];
const USER_AGENT = "VirtelonPlatform-LeadDiscovery/1.0 (+https://virtelon.com)";
const FETCH_TIMEOUT_MS = 20_000;
const SEARCH_RADIUS_METERS = 8_000;

// Best-effort category -> OSM tag mapping. OSM's tagging vocabulary doesn't
// cleanly cover every business category (there is no dedicated tag for
// "coaching institute", a very common Indian small-business category) — see
// docs/ARCHITECTURE.md §0.3. Categories not listed here fall back to a
// name-based text search instead of failing outright.
const CATEGORY_TAGS: Record<string, string[]> = {
  doctor: ["amenity=doctors", "healthcare=doctor"],
  doctors: ["amenity=doctors", "healthcare=doctor"],
  physician: ["amenity=doctors", "healthcare=doctor"],
  clinic: ["amenity=clinic", "healthcare=clinic"],
  dentist: ["amenity=dentist"],
  hospital: ["amenity=hospital"],
  pharmacy: ["amenity=pharmacy"],
  restaurant: ["amenity=restaurant"],
  cafe: ["amenity=cafe"],
  hotel: ["tourism=hotel"],
  gym: ["leisure=fitness_centre"],
  fitness: ["leisure=fitness_centre"],
  salon: ["shop=hairdresser", "shop=beauty"],
  spa: ["shop=beauty", "leisure=spa"],
  "real estate": ["office=estate_agent"],
  "real-estate": ["office=estate_agent"],
  school: ["amenity=school"],
  bakery: ["shop=bakery"],
  supermarket: ["shop=supermarket"],
  grocery: ["shop=supermarket", "shop=convenience"],
  bank: ["amenity=bank"],
  lawyer: ["office=lawyer"],
};

interface NominatimResult {
  lat: string;
  lon: string;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

interface GeocodedArea {
  lat: number;
  lon: number;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tries each Overpass mirror in turn; within a mirror, retries once on a
 * 5xx response or network/timeout error before moving to the next mirror.
 * Only throws once every mirror has been exhausted.
 */
async function fetchFromOverpass(query: string): Promise<Response> {
  let lastError: unknown;

  for (const url of OVERPASS_URLS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain", "User-Agent": USER_AGENT },
          body: query,
        });
        if (response.ok) return response;
        if (response.status < 500) return response; // client-side error — retrying won't help
        lastError = new Error(`OpenStreetMap search failed: ${response.status} ${response.statusText}`);
      } catch (error) {
        lastError = error;
      }
      if (attempt === 0) await sleep(1000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenStreetMap search failed after retries");
}

function tagToFilter(tag: string): string {
  const [key, value] = tag.split("=");
  return `"${key}"="${value}"`;
}

// Escapes both regex metacharacters (this value is used as an Overpass QL
// regex literal) and the double-quote that delimits the surrounding string —
// without the quote, a category like `x"]; [out:csv(::id)]; way(1); out;`
// would close the string early and let arbitrary Overpass QL be appended.
function escapeOverpassRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&");
}

/**
 * Free, no-API-key lead discovery using OpenStreetMap data — Nominatim for
 * geocoding the location, Overpass for the business search. No billing
 * account, no signup, no cost at any volume, and both are official
 * OpenStreetMap Foundation services (not a scraper of a third party).
 *
 * The honest tradeoff for "free": OSM has no concept of star ratings or
 * review counts (the scoring engine already treats a null rating as
 * neutral, not bad — see lead-scoring/scoring-engine.ts), phone numbers are
 * missing on many listings, and category coverage is uneven, especially for
 * categories common in Indian small business with no dedicated OSM tag.
 * This is the default provider when no GOOGLE_PLACES_API_KEY is configured
 * — see provider-factory.ts and docs/ARCHITECTURE.md §0.3.
 */
export class OpenStreetMapProvider implements LeadDiscoveryProvider {
  readonly name = "openstreetmap";

  async search(criteria: LeadSearchCriteria): Promise<DiscoveredLead[]> {
    const area = await this.geocodeArea(criteria.location);
    if (!area) return [];

    const query = this.buildOverpassQuery(area, criteria.category);
    const response = await fetchFromOverpass(query);
    if (!response.ok) {
      throw new Error(`OpenStreetMap search failed: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as OverpassResponse;

    return data.elements
      .filter((el) => el.tags?.name)
      .filter((el) => {
        if (!criteria.requireWebsite) return true;
        return Boolean(el.tags?.website || el.tags?.["contact:website"]);
      })
      .slice(0, criteria.limit)
      .map((el) => this.toDiscoveredLead(el, criteria.category));
  }

  private async geocodeArea(location: string): Promise<GeocodedArea | null> {
    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("q", location);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    // Nominatim has no documented public mirror (self-hosting is the
    // scale-up path — see docs/ARCHITECTURE.md §0.3), so on a 5xx/network
    // hiccup we retry the same endpoint once rather than silently reporting
    // "location not found" for what's actually a transient outage.
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetchWithTimeout(url.toString(), { headers: { "User-Agent": USER_AGENT } });
        if (response.ok) {
          const results = (await response.json()) as NominatimResult[];
          const first = results[0];
          return first ? { lat: Number(first.lat), lon: Number(first.lon) } : null;
        }
        if (response.status < 500) return null; // e.g. 400 — genuinely bad query, not transient
        lastError = new Error(`Nominatim geocoding failed: ${response.status} ${response.statusText}`);
      } catch (error) {
        lastError = error;
      }
      if (attempt === 0) await sleep(1000);
    }

    throw lastError instanceof Error ? lastError : new Error("Nominatim geocoding failed after retry");
  }

  private buildOverpassQuery(area: GeocodedArea, category: string): string {
    const around = `around:${SEARCH_RADIUS_METERS},${area.lat},${area.lon}`;
    const tags = CATEGORY_TAGS[category.trim().toLowerCase()] ?? [];

    const clauses =
      tags.length > 0
        ? tags.map((tag) => `node[${tagToFilter(tag)}](${around});\n  way[${tagToFilter(tag)}](${around});`).join("\n  ")
        : `node["name"~"${escapeOverpassRegex(category)}",i](${around});\n  way["name"~"${escapeOverpassRegex(category)}",i](${around});`;

    return `[out:json][timeout:25];
(
  ${clauses}
);
out center 50;`;
  }

  private toDiscoveredLead(el: OverpassElement, category: string): DiscoveredLead {
    const tags = el.tags!;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const address = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");

    return {
      externalId: `osm-${el.type}-${el.id}`,
      source: "openstreetmap",
      businessName: tags.name!,
      category,
      phone: tags.phone ?? tags["contact:phone"],
      website: tags.website ?? tags["contact:website"],
      address: address || undefined,
      city: tags["addr:city"],
      state: tags["addr:state"],
      country: tags["addr:country"],
      latitude: lat,
      longitude: lon,
      // OSM has no rating/review concept — left undefined rather than
      // guessed, so lead scoring treats this honestly as "unknown," not "bad."
      rating: undefined,
      reviewCount: undefined,
      businessStatus: "OPERATIONAL",
      raw: tags,
    };
  }
}
