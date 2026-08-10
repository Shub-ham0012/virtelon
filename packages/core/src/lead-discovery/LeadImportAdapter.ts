import type { DiscoveredLead } from "./LeadDiscoveryProvider";

/**
 * Batch/file-based sources (CSV upload, manual entry, future API imports)
 * don't fit a criteria-driven search() call, so they get a sibling interface
 * instead of being forced through LeadDiscoveryProvider. Both interfaces
 * produce the SAME DiscoveredLead[] shape and both feed the SAME ingestion
 * pipeline (./ingest.ts) — that's what keeps core dedup/normalize/persist
 * logic from ever having to branch on where a lead came from.
 */
export interface ImportInput {
  file?: { buffer: Buffer; filename: string; mimeType: string };
  rows?: Record<string, string>[]; // e.g. rows already parsed from a manual-entry form
  columnMapping?: Record<string, string>; // user-confirmed CSV column -> DiscoveredLead field
  defaultCountry?: string; // ISO 3166-1 alpha-2, used to resolve phone numbers without a country code
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface LeadImportAdapter {
  readonly name: string;
  parse(input: ImportInput): Promise<{ leads: DiscoveredLead[]; errors: ImportRowError[] }>;
}
