import type { TenantScopedClient } from "@virtelon/db";
import type { DiscoveredLead } from "./LeadDiscoveryProvider";
import { normalizeDiscoveredLead } from "./normalize";
import { computeDedupHash } from "./dedup";

export interface IngestResult {
  createdCount: number;
  duplicateCount: number;
  updatedCount: number;
  leadIds: string[];
}

export interface IngestContext {
  organizationId: string; // redundant with `db`'s own scope, but Prisma's generated
  // create types still require it explicitly — see docs/ARCHITECTURE.md §D note
  // on the tenant-scoped client, and packages/db/src/tenant-scope.ts.
  sourceId: string;
  defaultCountry?: string;
}

/**
 * The single funnel every discovery/import path calls. This — not the
 * provider interfaces themselves — is the actual enforcement point for
 * "provider-agnostic core logic": a new LeadDiscoveryProvider or
 * LeadImportAdapter only ever needs to produce DiscoveredLead[] correctly;
 * everything downstream (normalize, dedup, persist, source attribution) is
 * written exactly once, here.
 */
export async function ingestDiscoveredLeads(
  db: TenantScopedClient,
  ctx: IngestContext,
  leads: DiscoveredLead[]
): Promise<IngestResult> {
  let createdCount = 0;
  let duplicateCount = 0;
  let updatedCount = 0;
  const leadIds: string[] = [];

  for (const raw of leads) {
    const normalized = normalizeDiscoveredLead(raw, ctx.defaultCountry);
    const dedupHash = computeDedupHash(normalized);

    // externalId is the precise key (the provider's own stable id) — checked first.
    const existingByExternalId = await db.lead.findFirst({
      where: { sourceId: ctx.sourceId, externalId: normalized.externalId },
    });
    if (existingByExternalId) {
      await db.lead.update({
        where: { id: existingByExternalId.id },
        data: {
          rating: normalized.rating,
          reviewCount: normalized.reviewCount,
          businessStatus: normalized.businessStatus,
          website: normalized.website ?? existingByExternalId.website,
          // Backfill city/state if the stored value is missing — a common
          // gap for OSM records with no addr:city tag (see normalize.ts's
          // location-based fallback), so re-discovering an already-known
          // business is also a chance to fix an unhelpfully blank city.
          city: existingByExternalId.city ?? normalized.city,
          state: existingByExternalId.state ?? normalized.state,
          lastEnrichedAt: new Date(),
        },
      });
      updatedCount += 1;
      leadIds.push(existingByExternalId.id);
      continue;
    }

    // Fallback: the same real business, discovered via a different source/run.
    const existingByHash = await db.lead.findFirst({ where: { dedupHash } });
    if (existingByHash) {
      duplicateCount += 1;
      leadIds.push(existingByHash.id);
      continue;
    }

    const created = await db.lead.create({
      data: {
        organizationId: ctx.organizationId,
        sourceId: ctx.sourceId,
        externalId: normalized.externalId,
        dedupHash,
        businessName: normalized.businessName,
        category: normalized.category,
        phone: normalized.phone,
        phoneE164: normalized.phoneE164,
        website: normalized.website,
        address: normalized.address,
        city: normalized.city,
        state: normalized.state,
        country: normalized.country,
        latitude: normalized.latitude,
        longitude: normalized.longitude,
        rating: normalized.rating,
        reviewCount: normalized.reviewCount,
        businessStatus: normalized.businessStatus,
      },
    });
    createdCount += 1;
    leadIds.push(created.id);
  }

  return { createdCount, duplicateCount, updatedCount, leadIds };
}
