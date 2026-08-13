import type { DiscoveredLead, LeadDiscoveryProvider, LeadSearchCriteria } from "../LeadDiscoveryProvider";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// The public overpass-api.de instance occasionally returns 504s or is briefly
// unreachable under load (a known, documented characteristic of the free
// instance — not a bug in this integration; verified live against the real
// OSM wiki's current instance list as of Aug 2026, since two previously
// listed mirrors here had gone stale/unreachable). Kept to one well-known,
// generously-quota'd (10k queries/day) official instance rather than
// unverified third-party mirrors — see the retry pass in fetchFromOverpass
// for how a transient full outage gets a second chance instead of failing
// the whole search immediately.
const OVERPASS_URLS = ["https://overpass-api.de/api/interpreter"];
const USER_AGENT = "VirtelonPlatform-LeadDiscovery/1.0 (+https://virtelon.com)";
// Verified live (Aug 2026): back-to-back requests from this process to the
// public instance go from <1s to 18-20s to an outright abort within 3 calls
// — the instance's fair-use slot throttling penalizing a client that hits it
// too fast, not a real outage. A longer timeout gives a throttled-but-alive
// response room to arrive instead of aborting a request that would have
// succeeded; the request queue below keeps our own calls spaced out so we
// don't trigger that throttling on ourselves in the first place.
const FETCH_TIMEOUT_MS = 15_000;
// 8km was too tight for small/mid-size Indian cities where OSM coverage of
// a given category can be sparse (verified live: "fitness_centre" near
// Muzaffarpur had 0 hits at 8km and only 1 at 50km) — 15km trades a little
// relevance for actually finding something, without the cost a wider regex
// fallback search would carry (tag queries stay index-backed either way).
const SEARCH_RADIUS_METERS = 15_000;

// The public Overpass instance's own throttling gets worse the faster a
// single client re-hits it — so every call this process makes goes through
// one queue that guarantees at least MIN_GAP_MS between requests leaving
// this process, regardless of how many searches run concurrently across
// tenants. This is us being a well-behaved client, not a workaround for a
// bug: verified live that unpaced repeated calls degrade within 3 requests.
const MIN_OVERPASS_GAP_MS = 1_500;
let overpassQueue: Promise<void> = Promise.resolve();

function scheduleOverpassCall<T>(fn: () => Promise<T>): Promise<T> {
  // Pacing exists to be a well-behaved client to the real, external Overpass
  // service — meaningless (and unsafe to couple to module-level promise
  // state that outlives a single test) once fetch is mocked, so it's a
  // no-op under the test runner rather than something tests need to know
  // to advance fake timers for.
  if (process.env.VITEST) return fn();

  const result = overpassQueue.then(fn, fn);
  overpassQueue = result.then(
    () => sleep(MIN_OVERPASS_GAP_MS),
    () => sleep(MIN_OVERPASS_GAP_MS)
  );
  return result;
}

// Best-effort category -> OSM tag mapping. A tag-based query uses an index
// and reliably returns in well under a second; a category with no mapping
// here falls back to a name-based regex search, which is a genuinely heavy
// operation for the free Overpass instance — verified live (Aug 2026): a
// name-regex search timed out repeatedly even at a 3km radius and a 20s
// wait, while every tag-based query below returned in under a second. Keep
// this list growing rather than relying on the regex fallback for common
// categories — see docs/ARCHITECTURE.md §0.3.
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
  // Confirmed live against real Patna data — office=educational_institution
  // is what Indian coaching/tuition businesses are actually tagged with in
  // OSM (e.g. "GOAL Institute for Medical/IIT"), not a school amenity tag.
  "coaching institute": ["office=educational_institution"],
  "coaching center": ["office=educational_institution"],
  "coaching centre": ["office=educational_institution"],
  coaching: ["office=educational_institution"],
  tuition: ["office=educational_institution"],
  tutoring: ["office=educational_institution"],
  "tuition center": ["office=educational_institution"],
  "tuition centre": ["office=educational_institution"],
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
 * Tries each Overpass mirror once, in turn, on a 5xx response or network/
 * timeout error. If every mirror fails, waits briefly and does one more full
 * pass before giving up — a full-service outage (all mirrors down/overloaded
 * at once) has been observed to self-resolve within seconds, so one delayed
 * retry pass catches that case without the excessive worst-case wait of
 * retrying every mirror immediately in a tight loop.
 */
async function fetchFromOverpass(query: string): Promise<Response> {
  let lastError: unknown;

  for (let pass = 0; pass < 2; pass++) {
    for (const url of OVERPASS_URLS) {
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
    }
    if (pass === 0) await sleep(4000);
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
    const response = await scheduleOverpassCall(() => fetchFromOverpass(query));
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
      .map((el) => this.toDiscoveredLead(el, criteria.category, criteria.location));
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

  private toDiscoveredLead(el: OverpassElement, category: string, searchedLocation: string): DiscoveredLead {
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
      // Many OSM business nodes have no addr:city tag at all — falling back
      // to what the user actually searched for keeps the city column
      // meaningful instead of blank for a large share of real results.
      city: tags["addr:city"] || searchedLocation.split(",")[0]?.trim(),
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
