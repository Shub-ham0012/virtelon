import * as cheerio from "cheerio";

export interface SocialLink {
  platform: "instagram" | "facebook" | "linkedin" | "youtube" | "x";
  url: string;
}

const PLATFORM_HOSTS: { platform: SocialLink["platform"]; hosts: string[] }[] = [
  { platform: "instagram", hosts: ["instagram.com"] },
  { platform: "facebook", hosts: ["facebook.com", "fb.com"] },
  { platform: "linkedin", hosts: ["linkedin.com"] },
  { platform: "youtube", hosts: ["youtube.com", "youtu.be"] },
  { platform: "x", hosts: ["twitter.com", "x.com"] },
];

/**
 * Reads outbound links already published on a business's own website —
 * compliant by construction, since it's their own public page, not the
 * social platforms themselves (see docs/ARCHITECTURE.md §0.2).
 */
export function extractSocialLinks(html: string): SocialLink[] {
  const $ = cheerio.load(html);
  const found = new Map<string, SocialLink>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    let parsed: URL;
    try {
      parsed = new URL(href, "https://placeholder.invalid");
    } catch {
      return;
    }
    if (parsed.hostname === "placeholder.invalid") return; // relative link, can't be a social profile

    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const match = PLATFORM_HOSTS.find((p) => p.hosts.includes(hostname));
    if (!match) return;

    // Skip generic share/login/plugin links, not an actual profile page
    if (/\/(sharer|share|login|dialog|intent|plugins)\b/i.test(parsed.pathname)) return;
    if (parsed.pathname === "/" || parsed.pathname === "") return;

    if (!found.has(match.platform)) {
      found.set(match.platform, { platform: match.platform, url: parsed.toString() });
    }
  });

  return [...found.values()];
}
