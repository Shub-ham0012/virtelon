/**
 * Deliberately a lightweight audit — reachability, HTTPS, basic on-page SEO
 * signals, response time, and links the business already publishes to its
 * own social profiles. This is NOT a claim of a full Lighthouse/security
 * audit (see docs/ARCHITECTURE.md §7).
 */
export interface WebsiteAuditResult {
  url: string;
  reachable: boolean;
  hasHttps: boolean | null;
  score: number | null; // 0-100, null if not reachable
  strengths: string[];
  problems: string[];
  opportunities: string[];
  performanceHints: { responseTimeMs: number | null };
  seoFindings: { hasTitle: boolean; hasMetaDescription: boolean; hasViewportMeta: boolean };
  socialLinksFound: { platform: string; url: string }[];
}

export interface WebsiteAuditProvider {
  readonly name: string;
  audit(url: string): Promise<WebsiteAuditResult>;
}
