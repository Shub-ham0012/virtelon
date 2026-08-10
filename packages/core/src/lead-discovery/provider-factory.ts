import { env } from "@virtelon/config";
import type { LeadDiscoveryProvider } from "./LeadDiscoveryProvider";
import { GooglePlacesProvider } from "./providers/google-places.provider";
import { OpenStreetMapProvider } from "./providers/openstreetmap.provider";

/**
 * Google Places when a paid key is configured (better data: ratings, review
 * counts, more complete phone/website coverage). OpenStreetMap otherwise —
 * real business data, genuinely free at any volume, no signup or billing
 * account required — never a fake/mock result presented as real by default
 * (see docs/ARCHITECTURE.md §31, §0.3). Callers can check `.name` to know
 * which one they got and surface that honestly in the UI.
 */
export function getLeadDiscoveryProvider(): LeadDiscoveryProvider {
  if (env.GOOGLE_PLACES_API_KEY) {
    return new GooglePlacesProvider(env.GOOGLE_PLACES_API_KEY);
  }
  return new OpenStreetMapProvider();
}
