export interface LeadSearchCriteria {
  category: string;
  location: string; // free-text, resolved to geo by the provider
  minRating?: number;
  maxRating?: number;
  requireWebsite?: boolean;
  limit: number;
}

export interface DiscoveredLead {
  externalId: string; // provider's stable identifier
  source: string; // provider name, e.g. "google_places" | "mock"
  businessName: string;
  category: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  businessStatus?: string;
  raw: Record<string, unknown>; // original provider payload, retained for debugging/audit
}

export interface LeadDiscoveryProvider {
  readonly name: string;
  search(criteria: LeadSearchCriteria): Promise<DiscoveredLead[]>;
}
