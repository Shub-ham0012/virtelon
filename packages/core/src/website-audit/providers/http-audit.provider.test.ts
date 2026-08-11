import { createServer, type Server } from "node:http";
import dns from "node:dns/promises";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpWebsiteAuditProvider } from "./http-audit.provider";

/** Spins up a real local HTTP server so the audit provider's fetch + HTML
 * parsing logic runs against genuine responses, without depending on the
 * internet being reachable in CI/sandboxed environments. */
let server: Server;
let baseUrl: string;

const GOOD_PAGE = `<!doctype html>
<html><head>
  <title>Acme Coaching Institute</title>
  <meta name="description" content="Coaching for competitive exams in Patna.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head><body>
  <p>Call us: +91 98765 43210</p>
  <a href="https://instagram.com/acmecoaching">Instagram</a>
</body></html>`;

const BARE_PAGE = `<!doctype html><html><head></head><body><p>Nothing here.</p></body></html>`;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/good") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(GOOD_PAGE);
    } else if (req.url === "/bare") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(BARE_PAGE);
    } else if (req.url === "/error") {
      res.writeHead(500);
      res.end("server error");
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "object" && address) baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("HttpWebsiteAuditProvider", () => {
  // These tests exercise HTML-parsing/scoring, not the SSRF safety check —
  // the safety check would otherwise (correctly) block our own 127.0.0.1
  // test server, so it's stubbed to report a public address for these cases.
  // The real fetch below still hits the real local server; only the DNS
  // lookup the safety check uses is faked.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dnsLookupSpy: any;

  beforeEach(() => {
    dnsLookupSpy = vi.spyOn(dns, "lookup").mockResolvedValue([{ address: "203.0.113.10", family: 4 }] as never);
  });
  afterEach(() => {
    dnsLookupSpy.mockRestore();
  });

  it("scores a well-formed page highly and extracts its social link", async () => {
    const provider = new HttpWebsiteAuditProvider();
    const result = await provider.audit(`${baseUrl}/good`);

    expect(result.reachable).toBe(true);
    expect(result.seoFindings.hasTitle).toBe(true);
    expect(result.seoFindings.hasMetaDescription).toBe(true);
    expect(result.seoFindings.hasViewportMeta).toBe(true);
    expect(result.socialLinksFound).toContainEqual({ platform: "instagram", url: "https://instagram.com/acmecoaching" });
    // The local test server is plain HTTP (no TLS), so the only expected
    // problem is the HTTPS one — everything else about this fixture is fine.
    expect(result.hasHttps).toBe(false);
    expect(result.problems).toEqual(["Not using HTTPS — browsers flag this as \"Not Secure.\""]);
    expect(result.score).toBe(85);
  });

  it("flags problems and lowers the score for a bare page", async () => {
    const provider = new HttpWebsiteAuditProvider();
    const result = await provider.audit(`${baseUrl}/bare`);

    expect(result.reachable).toBe(true);
    expect(result.seoFindings.hasMetaDescription).toBe(false);
    expect(result.problems.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(70);
  });

  it("marks an error-status page as unreachable with no score", async () => {
    const provider = new HttpWebsiteAuditProvider();
    const result = await provider.audit(`${baseUrl}/error`);

    expect(result.reachable).toBe(false);
    expect(result.score).toBeNull();
  });

  it("marks a connection failure as unreachable rather than throwing", async () => {
    const provider = new HttpWebsiteAuditProvider();
    const result = await provider.audit(`${baseUrl.replace(/:\d+$/, ":1")}`); // nothing listens here

    expect(result.reachable).toBe(false);
    expect(result.score).toBeNull();
    expect(result.problems[0]).toMatch(/did not respond/i);
  });
});

describe("HttpWebsiteAuditProvider — SSRF protection", () => {
  // No dns.lookup stub here — these exercise the real safety check, which
  // must block anything that resolves to a private/internal/loopback
  // address (lead.website is free-text set via CSV import, fully
  // attacker-controlled by anyone with lead:manage).
  it("refuses to fetch a loopback address", async () => {
    const provider = new HttpWebsiteAuditProvider();
    const result = await provider.audit(`${baseUrl}/good`); // baseUrl is 127.0.0.1

    expect(result.reachable).toBe(false);
    expect(result.score).toBeNull();
    expect(result.problems[0]).toMatch(/private\/internal/i);
  });

  it("refuses to fetch the cloud metadata / link-local address", async () => {
    const provider = new HttpWebsiteAuditProvider();
    const result = await provider.audit("http://169.254.169.254/latest/meta-data/");

    expect(result.reachable).toBe(false);
    expect(result.score).toBeNull();
  });

  it("refuses a non-http(s) protocol", async () => {
    const provider = new HttpWebsiteAuditProvider();
    const result = await provider.audit("file:///etc/passwd");

    expect(result.reachable).toBe(false);
    expect(result.score).toBeNull();
  });

  it("refuses a malformed URL rather than throwing", async () => {
    const provider = new HttpWebsiteAuditProvider();
    const result = await provider.audit("not a url");

    expect(result.reachable).toBe(false);
    expect(result.score).toBeNull();
  });
});
