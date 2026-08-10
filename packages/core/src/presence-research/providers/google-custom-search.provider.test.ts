import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleCustomSearchProvider } from "./google-custom-search.provider";

describe("GoogleCustomSearchProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks a result high-confidence when the business name appears in the title", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          items: [{ title: "Acme Coaching Institute (@acmecoaching) • Instagram", link: "https://instagram.com/acmecoaching" }],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GoogleCustomSearchProvider("test-key", "test-cx");
    const results = await provider.search({ businessName: "Acme Coaching Institute", location: "Patna", platforms: ["instagram"] });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ platform: "instagram", confidence: "high", url: "https://instagram.com/acmecoaching" });
  });

  it("falls back to low confidence when the name doesn't clearly match", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ items: [{ title: "Some Other Business", link: "https://instagram.com/somethingelse" }] }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GoogleCustomSearchProvider("test-key", "test-cx");
    const results = await provider.search({ businessName: "Acme Coaching Institute", location: "Patna", platforms: ["instagram"] });

    expect(results[0]?.confidence).toBe("low");
  });

  it("returns nothing for a platform with no search results", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GoogleCustomSearchProvider("test-key", "test-cx");
    const results = await provider.search({ businessName: "Acme", location: "Patna", platforms: ["facebook"] });

    expect(results).toHaveLength(0);
  });

  it("queries each requested platform independently and doesn't let one failure block the others", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("facebook.com")) return new Response("fail", { status: 500 });
      return new Response(JSON.stringify({ items: [{ title: "Acme", link: "https://instagram.com/acme" }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GoogleCustomSearchProvider("test-key", "test-cx");
    const results = await provider.search({ businessName: "Acme", location: "Patna", platforms: ["instagram", "facebook"] });

    expect(results).toHaveLength(1);
    expect(results[0]?.platform).toBe("instagram");
  });
});
