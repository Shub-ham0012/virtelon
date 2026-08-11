import dns from "node:dns/promises";
import * as cheerio from "cheerio";
import type { WebsiteAuditProvider, WebsiteAuditResult } from "../WebsiteAuditProvider";
import { extractSocialLinks } from "../../presence-research/extract-social-links";

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "VirtelonPlatformAuditBot/1.0 (+https://virtelon.com; lightweight on-demand website check)";

const UNREACHABLE_RESULT_BASE = {
  hasHttps: null,
  score: null,
  strengths: [],
  problems: [] as string[],
  opportunities: [] as string[],
  performanceHints: { responseTimeMs: null },
  seoFindings: { hasTitle: false, hasMetaDescription: false, hasViewportMeta: false },
  socialLinksFound: [],
};

/**
 * `lead.website` is free-text set by CSV import or discovery — fully
 * attacker-controlled by anyone with lead:manage. Without this check, an
 * authenticated user could point it at an internal service or the cloud
 * metadata endpoint (169.254.169.254) and use this server as an SSRF proxy,
 * reading the response back through the audit result. Resolves the hostname
 * (not just string-matches it) so DNS rebinding can't bypass the check.
 */
async function isSafePublicHttpUrl(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return false;

  let addresses: string[];
  try {
    const results = await dns.lookup(hostname, { all: true, verbatim: true });
    addresses = results.map((r) => r.address);
  } catch {
    return false; // DNS failure — treat as unreachable rather than risk an unresolved fetch
  }
  if (addresses.length === 0) return false;

  return addresses.every((addr) => !isPrivateOrReservedIp(addr));
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (ip.includes(":")) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true; // loopback
    if (normalized.startsWith("fe80:") || normalized.startsWith("fec0:")) return true; // link-local
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local (fc00::/7)
    if (normalized.startsWith("::ffff:")) return isPrivateOrReservedIp(normalized.replace("::ffff:", "")); // IPv4-mapped
    return false;
  }

  const octets = ip.split(".").map(Number);
  if (octets.length !== 4 || octets.some((o) => Number.isNaN(o))) return true; // malformed — fail closed
  const [a, b] = octets;

  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata (169.254.169.254)
  if (a === 172 && b! >= 16 && b! <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 0) return true; // "this network"
  if (a === 100 && b! >= 64 && b! <= 127) return true; // 100.64.0.0/10 (CGNAT)
  return false;
}

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
    if (!(await isSafePublicHttpUrl(url))) {
      return {
        url,
        ...UNREACHABLE_RESULT_BASE,
        reachable: false,
        problems: ["Website address is not a reachable public site (invalid, or resolves to a private/internal address)."],
      };
    }

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
