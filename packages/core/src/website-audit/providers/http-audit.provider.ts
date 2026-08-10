import * as cheerio from "cheerio";
import type { WebsiteAuditProvider, WebsiteAuditResult } from "../WebsiteAuditProvider";
import { extractSocialLinks } from "../../presence-research/extract-social-links";

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "VirtelonPlatformAuditBot/1.0 (+https://virtelon.com; lightweight on-demand website check)";

function hasVisibleContactInfo($: cheerio.CheerioAPI): boolean {
  const bodyText = $("body").text();
  const hasEmailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(bodyText);
  const hasPhonePattern = /(\+?\d[\d\s\-()]{7,}\d)/.test(bodyText);
  const hasMailtoOrTel = $('a[href^="mailto:"], a[href^="tel:"]').length > 0;
  return hasMailtoOrTel || hasEmailPattern || hasPhonePattern;
}

/**
 * Real, lightweight audit — a single HTTP fetch + HTML parse. Deliberately
 * NOT a full Lighthouse run (no headless browser, no JS execution, no
 * multi-page crawl) — see docs/ARCHITECTURE.md §7 and §0.2. Every score
 * component is a simple rule, listed in `seoFindings`/`performanceHints`, so
 * nothing here is an unexplained black-box number.
 */
export class HttpWebsiteAuditProvider implements WebsiteAuditProvider {
  readonly name = "http_lightweight";

  async audit(url: string): Promise<WebsiteAuditResult> {
    const startedAt = Date.now();
    let response: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      response = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT },
      });
      clearTimeout(timeout);
    } catch {
      return {
        url,
        reachable: false,
        hasHttps: null,
        score: null,
        strengths: [],
        problems: ["Website did not respond (unreachable, timed out, or DNS failure)."],
        opportunities: ["Confirm the domain is live — an unreachable site is effectively invisible to customers."],
        performanceHints: { responseTimeMs: null },
        seoFindings: { hasTitle: false, hasMetaDescription: false, hasViewportMeta: false },
        socialLinksFound: [],
      };
    }

    const responseTimeMs = Date.now() - startedAt;
    const finalUrl = new URL(response.url || url);
    const hasHttps = finalUrl.protocol === "https:";

    if (!response.ok) {
      return {
        url,
        reachable: false,
        hasHttps,
        score: null,
        strengths: [],
        problems: [`Website responded with an error status (HTTP ${response.status}).`],
        opportunities: ["Fix the server error so the site is actually visible to visitors."],
        performanceHints: { responseTimeMs },
        seoFindings: { hasTitle: false, hasMetaDescription: false, hasViewportMeta: false },
        socialLinksFound: [],
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const hasTitle = $("title").text().trim().length > 0;
    const hasMetaDescription = ($('meta[name="description"]').attr("content") ?? "").trim().length > 0;
    const hasViewportMeta = $('meta[name="viewport"]').length > 0;
    const socialLinksFound = extractSocialLinks(html);
    const hasContactInfo = hasVisibleContactInfo($);

    const strengths: string[] = [];
    const problems: string[] = [];
    const opportunities: string[] = [];
    let score = 0;

    if (hasHttps) {
      score += 15;
      strengths.push("Uses HTTPS.");
    } else {
      problems.push("Not using HTTPS — browsers flag this as \"Not Secure.\"");
    }

    if (hasTitle) {
      score += 15;
      strengths.push("Has a page title.");
    } else {
      problems.push("Missing a page title.");
    }

    if (hasMetaDescription) {
      score += 15;
      strengths.push("Has a meta description.");
    } else {
      problems.push("Missing a meta description (affects how the site appears in search results).");
      opportunities.push("Add a meta description summarizing the business for better search visibility.");
    }

    if (hasViewportMeta) {
      score += 15;
      strengths.push("Has a mobile viewport tag.");
    } else {
      problems.push("Missing a mobile viewport tag — likely renders poorly on phones.");
      opportunities.push("Make the site mobile-friendly — most local customers will find it on a phone.");
    }

    if (responseTimeMs < 1500) {
      score += 15;
      strengths.push("Loads quickly.");
    } else if (responseTimeMs < 3000) {
      score += 7;
    } else {
      problems.push("Slow to respond.");
    }

    if (socialLinksFound.length > 0) {
      score += 10;
      strengths.push(`Links to ${socialLinksFound.length} social profile(s).`);
    } else {
      opportunities.push("No social media links found on the site — consider linking Instagram/Facebook if active there.");
    }

    if (hasContactInfo) {
      score += 15;
      strengths.push("Contact information is visible.");
    } else {
      problems.push("No visible phone, email, or contact link found.");
      opportunities.push("Add a clear phone number or contact form — missing contact info costs inquiries.");
    }

    return {
      url,
      reachable: true,
      hasHttps,
      score,
      strengths,
      problems,
      opportunities,
      performanceHints: { responseTimeMs },
      seoFindings: { hasTitle, hasMetaDescription, hasViewportMeta },
      socialLinksFound,
    };
  }
}
