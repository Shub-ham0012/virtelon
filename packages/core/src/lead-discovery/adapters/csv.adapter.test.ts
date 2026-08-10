import { describe, expect, it } from "vitest";
import { CsvImportAdapter } from "./csv.adapter";

const adapter = new CsvImportAdapter();

function csvFile(content: string) {
  return { buffer: Buffer.from(content, "utf-8"), filename: "leads.csv", mimeType: "text/csv" };
}

describe("CsvImportAdapter", () => {
  it("parses valid rows into DiscoveredLead", async () => {
    const csv = "businessName,category,phone,city\nAcme Coaching,coaching,9876543210,Patna\n";
    const { leads, errors } = await adapter.parse({ file: csvFile(csv) });
    expect(errors).toHaveLength(0);
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ businessName: "Acme Coaching", category: "coaching", city: "Patna", source: "csv_import" });
  });

  it("reports a row error for missing required fields instead of silently dropping it", async () => {
    const csv = "businessName,category\nAcme Coaching,\n";
    const { leads, errors } = await adapter.parse({ file: csvFile(csv) });
    expect(leads).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/category/);
    expect(errors[0]!.row).toBe(2);
  });

  it("applies a column mapping for mismatched headers", async () => {
    const csv = "Business Name,Category\nZenith Gym,gym\n";
    const { leads, errors } = await adapter.parse({
      file: csvFile(csv),
      columnMapping: { "Business Name": "businessName", Category: "category" },
    });
    expect(errors).toHaveLength(0);
    expect(leads[0]).toMatchObject({ businessName: "Zenith Gym", category: "gym" });
  });

  it("returns an error when no file is provided", async () => {
    const { leads, errors } = await adapter.parse({});
    expect(leads).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
});
