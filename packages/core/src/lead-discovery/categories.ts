export interface SupportedCategory {
  /** Sent to the discovery provider — must match a key OpenStreetMapProvider
   * maps to a real OSM tag (see CATEGORY_TAGS in openstreetmap.provider.ts),
   * so picking one of these always takes the fast, reliable indexed search
   * path instead of the slow name-based fallback. */
  value: string;
  label: string;
}

/**
 * Curated list of categories known to have a fast, reliable OSM tag mapping
 * — offered as a dropdown in the discovery/campaign forms so users aren't
 * guessing at free text that might fall into OpenStreetMap's much slower
 * (and, under load, unreliable) name-search fallback. "Other" in the UI
 * still allows free text for categories not listed here, or when a richer
 * provider (e.g. Google Places, which has no such fast/slow split) is
 * configured.
 */
export const SUPPORTED_CATEGORIES: SupportedCategory[] = [
  { value: "doctor", label: "Doctors & Physicians" },
  { value: "dentist", label: "Dentists" },
  { value: "clinic", label: "Clinics" },
  { value: "hospital", label: "Hospitals" },
  { value: "pharmacy", label: "Pharmacies" },
  { value: "restaurant", label: "Restaurants" },
  { value: "cafe", label: "Cafes" },
  { value: "hotel", label: "Hotels" },
  { value: "gym", label: "Gyms & Fitness Centers" },
  { value: "salon", label: "Salons & Spas" },
  { value: "real estate", label: "Real Estate Agents" },
  { value: "school", label: "Schools" },
  { value: "coaching institute", label: "Coaching / Tuition Institutes" },
  { value: "bakery", label: "Bakeries" },
  { value: "supermarket", label: "Supermarkets & Grocery Stores" },
  { value: "bank", label: "Banks" },
  { value: "lawyer", label: "Lawyers" },
];
