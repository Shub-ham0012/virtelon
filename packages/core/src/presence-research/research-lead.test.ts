import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawPrisma, createTenantScopedClient } from "@virtelon/db";
import { researchLead } from "./research-lead";
import type { WebsiteAuditProvider, WebsiteAuditResult } from "../website-audit/WebsiteAuditProvider";
import type { SocialPresenceProvider, SocialPresenceQuery, SocialPresenceResult } from "./SocialPresenceProvider";

/** Integration test — runs against a real Postgres database (DATABASE_URL).
 * Providers are hand-written stubs (not the real HTTP/network providers) so
 * the test is deterministic and offline, while still exercising the real
 * database persistence + merge logic. */

const runId = Math.random().toString(36).slice(2, 8);
let org: { id: string };
let source: { id: string };

function stubWebsiteAudit(overrides: Partial<WebsiteAuditResult> = {}): WebsiteAuditProvider {
  return {
    name: "stub",
    async audit(url: string): Promise<WebsiteAuditResult> {
      return {
        url,
        reachable: true,
        hasHttps: true,
        score: 65,
        strengths: [],
        problems: [],
        opportunities: [],
        performanceHints: { responseTimeMs: 200 },
        seoFindings: { hasTitle: true, hasMetaDescription: false, hasViewportMeta: true },
        socialLinksFound: [],
        ...overrides,
      };
    },
  };
}

function stubSocialSearch(results: SocialPresenceResult[]): SocialPresenceProvider {
  return {
    name: "stub",
    async search(_query: SocialPresenceQuery) {
      return results;
    },
  };
}

beforeAll(async () => {
  org = await rawPrisma.organization.create({ data: { name: `Research Test ${runId}`, slug: `research-test-${runId}` } });
  source = await rawPrisma.leadSource.create({ data: { organizationId: org.id, type: "manual_entry", config: {} } });
});

afterAll(async () => {
  await rawPrisma.organization.delete({ where: { id: org.id } });
  await rawPrisma.$disconnect();
});

describe("researchLead", () => {
  it("audits the website and stores social links found on it", async () => {
    const db = createTenantScopedClient(org.id);
    const lead = await rawPrisma.lead.create({
      data: {
        organizationId: org.id,
        sourceId: source.id,
        businessName: "Site Lead",
        category: "coaching",
        website: "https://example.com",
        dedupHash: `hash-site-${runId}`,
      },
    });

    const result = await researchLead(db, lead.id, {
      websiteAudit: stubWebsiteAudit({
        socialLinksFound: [{ platform: "instagram", url: "https://instagram.com/siteLead" }],
      }),
      socialPresence: stubSocialSearch([]),
    });

    expect(result.websiteAudit?.score).toBe(65);
    expect(result.socialProfiles.instagram).toMatchObject({ url: "https://instagram.com/siteLead", confidence: "high", source: "website_extraction" });

    const stored = await rawPrisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(stored.websiteStatus).toBe("PRESENT");
    expect(stored.lastEnrichedAt).toBeTruthy();

    const audit = await rawPrisma.websiteAudit.findUnique({ where: { leadId: lead.id } });
    expect(audit?.score).toBe(65);

    const activity = await rawPrisma.activity.findFirst({ where: { leadId: lead.id, type: "research" } });
    expect(activity).toBeTruthy();
  });

  it("searches for social profiles and marks the lead MISSING when there's no website", async () => {
    const db = createTenantScopedClient(org.id);
    const lead = await rawPrisma.lead.create({
      data: {
        organizationId: org.id,
        sourceId: source.id,
        businessName: "No Website Lead",
        category: "salon",
        dedupHash: `hash-nosite-${runId}`,
      },
    });

    const result = await researchLead(db, lead.id, {
      websiteAudit: stubWebsiteAudit(),
      socialPresence: stubSocialSearch([
        { platform: "instagram", url: "https://instagram.com/noWebsiteLead", confidence: "low", source: "stub" },
      ]),
    });

    expect(result.websiteAudit).toBeNull();
    expect(result.socialProfiles.instagram?.confidence).toBe("low");

    const stored = await rawPrisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(stored.websiteStatus).toBe("MISSING");

    const audit = await rawPrisma.websiteAudit.findUnique({ where: { leadId: lead.id } });
    expect(audit).toBeNull();
  });

  it("never lets a lower-confidence search result overwrite an already-confirmed profile", async () => {
    const db = createTenantScopedClient(org.id);
    const lead = await rawPrisma.lead.create({
      data: {
        organizationId: org.id,
        sourceId: source.id,
        businessName: "Confirmed Lead",
        category: "gym",
        dedupHash: `hash-confirmed-${runId}`,
        socialProfiles: {
          instagram: { url: "https://instagram.com/confirmed", confidence: "high", source: "website_extraction", checkedAt: new Date().toISOString() },
        },
      },
    });

    const result = await researchLead(db, lead.id, {
      websiteAudit: stubWebsiteAudit(),
      socialPresence: stubSocialSearch([
        { platform: "instagram", url: "https://instagram.com/wrong-guess", confidence: "low", source: "stub" },
      ]),
    });

    // instagram was already known — it must not have been re-searched or overwritten
    expect(result.socialProfiles.instagram?.url).toBe("https://instagram.com/confirmed");
    expect(result.socialProfiles.instagram?.confidence).toBe("high");
  });
});
