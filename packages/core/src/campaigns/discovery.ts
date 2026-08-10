import type { Campaign, TenantScopedClient } from "@virtelon/db";
import { getLeadDiscoveryProvider, getOrCreateLeadSource, ingestDiscoveredLeads } from "../lead-discovery";
import { scoreLeads } from "../lead-scoring";
import { addLeadsToCampaign } from "./campaign";

export interface CampaignDiscoveryResult {
  providerName: string;
  createdCount: number;
  updatedCount: number;
  duplicateCount: number;
  attachedCount: number;
}

/**
 * The one place discovery-for-a-campaign happens — used by both the manual
 * "Discover" button (apps/web) and the worker's scheduled run for AUTOMATED
 * campaigns (apps/worker), so the two paths can never drift.
 */
export async function runCampaignDiscovery(
  db: TenantScopedClient,
  organizationId: string,
  campaign: Campaign,
  limit: number = campaign.dailyLeadTarget
): Promise<CampaignDiscoveryResult> {
  const provider = getLeadDiscoveryProvider();
  const source = await getOrCreateLeadSource(db, organizationId, provider.name);

  const results = await provider.search({ category: campaign.category, location: campaign.location, limit });

  const ingestResult = await ingestDiscoveredLeads(
    db,
    { organizationId, sourceId: source.id, defaultCountry: "IN" },
    results
  );
  await scoreLeads(db, ingestResult.leadIds);
  const attachedCount = await addLeadsToCampaign(db, campaign.id, ingestResult.leadIds);

  return {
    providerName: provider.name,
    createdCount: ingestResult.createdCount,
    updatedCount: ingestResult.updatedCount,
    duplicateCount: ingestResult.duplicateCount,
    attachedCount,
  };
}
