import { parse } from "csv-parse/sync";
import type { DiscoveredLead } from "../LeadDiscoveryProvider";
import type { ImportInput, ImportRowError, LeadImportAdapter } from "../LeadImportAdapter";

/** Columns a row must resolve to (after applying columnMapping) at minimum. */
const REQUIRED_FIELDS = ["businessName", "category"] as const;

function hashRow(values: Record<string, string>): string {
  return Object.entries(values)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("|");
}

export class CsvImportAdapter implements LeadImportAdapter {
  readonly name = "csv_import";

  async parse(input: ImportInput): Promise<{ leads: DiscoveredLead[]; errors: ImportRowError[] }> {
    if (!input.file) {
      return { leads: [], errors: [{ row: 0, message: "No file provided" }] };
    }

    let records: Record<string, string>[];
    try {
      records = parse(input.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
    } catch (error) {
      return { leads: [], errors: [{ row: 0, message: `Could not parse CSV: ${(error as Error).message}` }] };
    }

    const mapping = input.columnMapping ?? {};
    const leads: DiscoveredLead[] = [];
    const errors: ImportRowError[] = [];

    records.forEach((record, index) => {
      const rowNumber = index + 2; // +1 for 0-index, +1 for the header row
      const resolved: Record<string, string> = {};
      for (const [csvColumn, field] of Object.entries(mapping)) {
        if (record[csvColumn] !== undefined) resolved[field] = record[csvColumn];
      }
      // Columns already named exactly like our fields pass through untouched
      // (mapping is only needed to rename mismatched headers).
      for (const [key, value] of Object.entries(record)) {
        if (resolved[key] === undefined) resolved[key] = value;
      }

      const missing = REQUIRED_FIELDS.filter((f) => !resolved[f]?.trim());
      if (missing.length > 0) {
        errors.push({ row: rowNumber, message: `Missing required field(s): ${missing.join(", ")}` });
        return;
      }

      leads.push({
        externalId: `csv-${hashRow(resolved)}`,
        source: "csv_import",
        businessName: resolved.businessName!,
        category: resolved.category!,
        phone: resolved.phone,
        website: resolved.website,
        address: resolved.address,
        city: resolved.city,
        state: resolved.state,
        country: resolved.country,
        rating: resolved.rating ? Number(resolved.rating) : undefined,
        raw: resolved,
      });
    });

    return { leads, errors };
  }
}
