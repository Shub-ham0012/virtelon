import type { TenantScopedClient } from "@virtelon/db";

/**
 * Every discovery/import run needs a LeadSource row to attribute leads to.
 * One row per (org, type) is reused across runs — a fresh LeadImportBatch is
 * created per CSV upload, but they all point at the same "csv_import" source.
 */
export async function getOrCreateLeadSource(
  db: TenantScopedClient,
  organizationId: string,
  type: string,
  config: Record<string, unknown> = {}
) {
  const existing = await db.leadSource.findFirst({ where: { type } });
  if (existing) return existing;
  return db.leadSource.create({ data: { organizationId, type, config } });
}
