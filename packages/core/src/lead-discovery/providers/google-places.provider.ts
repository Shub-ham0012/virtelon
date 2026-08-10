import type { DiscoveredLead, LeadDiscoveryProvider, LeadSearchCriteria } from "../LeadDiscoveryProvider";

interface GooglePlaceResult {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  internationalPhoneNumber?: string;
  businessStatus?: string;
  addressComponents?: { longText?: string; types?: string[] }[];
}

interface GooglePlacesSearchResponse {
  places?: GooglePlaceResult[];
  error?: { message?: string; status?: string };
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.internationalPhoneNumber",
  "places.businessStatus",
  "places.addressComponents",
].join(",");

function componentByType(place: GooglePlaceResult, type: string): string | undefined {
  return place.addressComponents?.find((c) => c.types?.includes(type))?.longText;
}

/**
 * Official, ToS-compliant Google Places API (New) Text Search — no scraping,
 * no headless browsing, no bypassing rate limits or access controls (see
 * docs/ARCHITECTURE.md §5). Requires GOOGLE_PLACES_API_KEY.
 *
 * Note: Text Search caps at 20 results per request; a `limit` above 20
 * currently returns at most 20 (documented, not silently truncated without
 * explanation) — full pagination is a follow-up once real usage needs it.
 */
export class GooglePlacesProvider implements LeadDiscoveryProvider {
  readonly name = "google_places";

  constructor(private readonly apiKey: string) {}

  async search(criteria: LeadSearchCriteria): Promise<DiscoveredLead[]> {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `${criteria.category} in ${criteria.location}`,
        maxResultCount: Math.min(criteria.limit, 20),
      }),
    });

    const data = (await response.json()) as GooglePlacesSearchResponse;
    if (!response.ok) {
      throw new Error(`Google Places search failed: ${data.error?.message ?? response.statusText}`);
    }

    const places = data.places ?? [];

    return places
      .filter((place) => {
        if (criteria.minRating !== undefined && (place.rating ?? 0) < criteria.minRating) return false;
        if (criteria.maxRating !== undefined && (place.rating ?? 5) > criteria.maxRating) return false;
        if (criteria.requireWebsite && !place.websiteUri) return false;
        return true;
      })
      .map((place): DiscoveredLead => ({
        externalId: place.id,
        source: "google_places",
        businessName: place.displayName?.text ?? "Unknown business",
        category: criteria.category,
        phone: place.internationalPhoneNumber,
        website: place.websiteUri,
        address: place.formattedAddress,
        city: componentByType(place, "locality"),
        state: componentByType(place, "administrative_area_level_1"),
        country: componentByType(place, "country"),
        latitude: place.location?.latitude,
        longitude: place.location?.longitude,
        rating: place.rating,
        reviewCount: place.userRatingCount,
        businessStatus: place.businessStatus,
        raw: place as unknown as Record<string, unknown>,
      }));
  }
}
