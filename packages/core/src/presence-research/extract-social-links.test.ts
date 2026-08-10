import { describe, expect, it } from "vitest";
import { extractSocialLinks } from "./extract-social-links";

describe("extractSocialLinks", () => {
  it("finds links to known platforms in page HTML", () => {
    const html = `
      <html><body>
        <footer>
          <a href="https://www.instagram.com/acmecoaching/">Instagram</a>
          <a href="https://facebook.com/acmecoaching">Facebook</a>
          <a href="/about">About</a>
        </footer>
      </body></html>`;
    const links = extractSocialLinks(html);
    expect(links).toContainEqual({ platform: "instagram", url: "https://www.instagram.com/acmecoaching/" });
    expect(links).toContainEqual({ platform: "facebook", url: "https://facebook.com/acmecoaching" });
    expect(links).toHaveLength(2);
  });

  it("ignores generic share/login/plugin links, not real profiles", () => {
    const html = `
      <a href="https://www.facebook.com/sharer/sharer.php?u=https://example.com">Share</a>
      <a href="https://www.facebook.com/login.php">Login</a>
      <a href="https://www.facebook.com/">Facebook home</a>
    `;
    expect(extractSocialLinks(html)).toHaveLength(0);
  });

  it("dedupes multiple links to the same platform, keeping the first", () => {
    const html = `
      <a href="https://instagram.com/first">One</a>
      <a href="https://instagram.com/second">Two</a>
    `;
    const links = extractSocialLinks(html);
    expect(links).toHaveLength(1);
    expect(links[0]?.url).toBe("https://instagram.com/first");
  });

  it("returns nothing for a page with no social links", () => {
    const html = `<a href="/contact">Contact</a><a href="https://example.com">Example</a>`;
    expect(extractSocialLinks(html)).toHaveLength(0);
  });

  it("handles malformed href attributes without throwing", () => {
    const html = `<a href="javascript:void(0)">bad</a><a>no href</a>`;
    expect(() => extractSocialLinks(html)).not.toThrow();
    expect(extractSocialLinks(html)).toHaveLength(0);
  });
});
