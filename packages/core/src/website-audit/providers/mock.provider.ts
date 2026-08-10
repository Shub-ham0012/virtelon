import type { WebsiteAuditProvider, WebsiteAuditResult } from "../WebsiteAuditProvider";

/** Deterministic, clearly-labeled fake audit — no network call. Used in tests
 * and anywhere a real fetch isn't appropriate. */
export class MockWebsiteAuditProvider implements WebsiteAuditProvider {
  readonly name = "mock";

  async audit(url: string): Promise<WebsiteAuditResult> {
    return {
      url,
      reachable: true,
      hasHttps: true,
      score: 72,
      strengths: ["Uses HTTPS.", "Has a page title.", "Loads quickly."],
      problems: ["Missing a meta description.", "No visible phone, email, or contact link found."],
      opportunities: ["Add a meta description.", "Add a clear phone number or contact form."],
      performanceHints: { responseTimeMs: 420 },
      seoFindings: { hasTitle: true, hasMetaDescription: false, hasViewportMeta: true },
      socialLinksFound: [],
    };
  }
}
