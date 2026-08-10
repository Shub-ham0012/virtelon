import type { TenantScopedClient } from "@virtelon/db";
import type { WebsiteAuditProvider, WebsiteAuditResult } from "../website-audit/WebsiteAuditProvider";
import type { SocialPlatform, SocialPresenceProvider } from "./SocialPresenceProvider";

/** Platforms we actively *search* for when a lead has no website. Kept
 * small and specific to what small local businesses actually use — every
 * extra platform is an extra Google Custom Search call, and that API's
 * free tier is quota-limited (100 queries/day). Reading a business's own
 * site for social links (extractSocialLinks) is free and unrestricted, so
 * that step still checks all five platforms. */
const SEARCH_PLATFORMS: SocialPlatform[] = ["instagram", "facebook", "linkedin"];

export interface StoredSocialProfile {
  url: string;
  confidence: "high" | "low";
  source: string;
  checkedAt: string;
}

export type SocialProfilesJson = Partial<Record<SocialPlatform, StoredSocialProfile>>;

export interface ResearchLeadResult {
  websiteAudit: WebsiteAuditResult | null;
  socialProfiles: SocialProfilesJson;
}

const CONFIDENCE_RANK: Record<StoredSocialProfile["confidence"], number> = { low: 0, high: 1 };

function mergeSocialProfiles(existing: SocialProfilesJson, incoming: SocialProfilesJson): SocialProfilesJson {
  const merged: SocialProfilesJson = { ...existing };
  for (const [platform, profile] of Object.entries(incoming) as [SocialPlatform, StoredSocialProfile][]) {
    const current = merged[platform];
    // Never let a lower-confidence guess overwrite an already-confirmed link.
    if (!current || CONFIDENCE_RANK[profile.confidence] >= CONFIDENCE_RANK[current.confidence]) {
      merged[platform] = profile;
    }
  }
  return merged;
}

/**
 * Researches everything compliant we can find about a lead: audits their
 * website if they have one (and reads the social links they've already
 * published there), then uses an official search API to look for the
 * platforms still missing — never scraping Instagram/Facebook/etc directly.
 * See docs/ARCHITECTURE.md §0.2.
 */
export async function researchLead(
  db: TenantScopedClient,
  leadId: string,
  providers: { websiteAudit: WebsiteAuditProvider; socialPresence: SocialPresenceProvider }
): Promise<ResearchLeadResult> {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  const existingProfiles = (lead.socialProfiles as SocialProfilesJson | null) ?? {};

  let websiteAudit: WebsiteAuditResult | null = null;
  let profilesFromSite: SocialProfilesJson = {};
  const now = new Date().toISOString();

  if (lead.website) {
    websiteAudit = await providers.websiteAudit.audit(lead.website);

    await db.websiteAudit.upsert({
      where: { leadId },
      create: {
        leadId,
        url: websiteAudit.url,
        reachable: websiteAudit.reachable,
        hasHttps: websiteAudit.hasHttps,
        score: websiteAudit.score,
        performanceHints: websiteAudit.performanceHints,
        seoFindings: websiteAudit.seoFindings,
        strengths: websiteAudit.strengths,
        problems: websiteAudit.problems,
        opportunities: websiteAudit.opportunities,
      },
      update: {
        url: websiteAudit.url,
        reachable: websiteAudit.reachable,
        hasHttps: websiteAudit.hasHttps,
        score: websiteAudit.score,
        performanceHints: websiteAudit.performanceHints,
        seoFindings: websiteAudit.seoFindings,
        strengths: websiteAudit.strengths,
        problems: websiteAudit.problems,
        opportunities: websiteAudit.opportunities,
        auditedAt: new Date(),
      },
    });

    profilesFromSite = Object.fromEntries(
      websiteAudit.socialLinksFound.map((link) => [
        link.platform,
        { url: link.url, confidence: "high" as const, source: "website_extraction", checkedAt: now },
      ])
    );
  }

  const stillMissing = SEARCH_PLATFORMS.filter((p) => !existingProfiles[p] && !profilesFromSite[p]);
  let profilesFromSearch: SocialProfilesJson = {};
  if (stillMissing.length > 0) {
    const results = await providers.socialPresence.search({
      businessName: lead.businessName,
      location: [lead.city, lead.state].filter(Boolean).join(", "),
      platforms: stillMissing,
    });
    profilesFromSearch = Object.fromEntries(
      results.map((r) => [r.platform, { url: r.url, confidence: r.confidence, source: r.source, checkedAt: now }])
    );
  }

  const socialProfiles = mergeSocialProfiles(mergeSocialProfiles(existingProfiles, profilesFromSite), profilesFromSearch);

  await db.lead.update({
    where: { id: leadId },
    data: {
      socialProfiles,
      websiteStatus: lead.website ? (websiteAudit?.reachable ? "PRESENT" : "UNREACHABLE") : "MISSING",
      lastEnrichedAt: new Date(),
    },
  });

  const newPlatformCount = Object.keys(profilesFromSite).length + Object.keys(profilesFromSearch).length;
  await db.activity.create({
    data: {
      leadId,
      type: "research",
      content: lead.website
        ? `Researched online presence: website audit scored ${websiteAudit?.score ?? "n/a"}, found ${newPlatformCount} social profile(s).`
        : `Researched online presence: no website — found ${newPlatformCount} social profile(s) via search.`,
      metadata: { websiteAuditScore: websiteAudit?.score ?? null, socialPlatformsFound: Object.keys(socialProfiles) },
    },
  });

  return { websiteAudit, socialProfiles };
}
