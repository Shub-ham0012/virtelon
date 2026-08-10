import { normalizePhone } from "../lib/phone";
import type { DiscoveredLead } from "./LeadDiscoveryProvider";

export interface NormalizedLead extends DiscoveredLead {
  phoneE164: string | null;
}

function normalizeBusinessName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeWebsite(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString();
  } catch {
    return undefined; // unparseable — dropped rather than stored as a broken value
  }
}

function titleCase(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/\w\S*/g, (w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase()) : undefined;
}

/**
 * Normalizes a raw DiscoveredLead from ANY provider/adapter into a
 * consistent shape before dedup/persist. Every discovery path (search-based
 * or import-based) runs through this exact function — see ./ingest.ts.
 */
export function normalizeDiscoveredLead(lead: DiscoveredLead, defaultCountry?: string): NormalizedLead {
  return {
    ...lead,
    businessName: normalizeBusinessName(lead.businessName),
    category: lead.category.trim().toLowerCase(),
    website: normalizeWebsite(lead.website),
    city: titleCase(lead.city),
    state: titleCase(lead.state),
    country: lead.country?.trim().toUpperCase(),
    phoneE164: normalizePhone(lead.phone, defaultCountry),
  };
}
