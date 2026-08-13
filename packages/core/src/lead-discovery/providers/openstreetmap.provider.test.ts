import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenStreetMapProvider } from "./openstreetmap.provider";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    json: async () => body,
  } as Response;
}

const NOMINATIM_RESULT = [{ lat: "18.5204", lon: "73.8567" }];

function overpassElement(overrides: Partial<{ tags: Record<string, string>; lat: number; lon: number }> = {}) {
  return {
    type: "node",
    id: 12345,
    lat: overrides.lat ?? 18.52,
    lon: overrides.lon ?? 73.85,
    tags: { name: "Test Business", ...overrides.tags },
  };
}

describe("OpenStreetMapProvider", () => {
  const provider = new OpenStreetMapProvider();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("geocodes the location then queries Overpass, normalizing results", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(NOMINATIM_RESULT))
      .mockResolvedValueOnce(
        jsonResponse({
          elements: [
            overpassElement({
              tags: { name: "City Clinic", phone: "+91 98765 43210", website: "https://cityclinic.example.com" },
            }),
          ],
        })
      );

    const results = await provider.search({ category: "doctors", location: "Pune", limit: 20 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      source: "openstreetmap",
      businessName: "City Clinic",
      phone: "+91 98765 43210",
      website: "https://cityclinic.example.com",
      rating: undefined,
      reviewCount: undefined,
    });
    expect(results[0]!.externalId).toBe("osm-node-12345");
  });

  it("uses the known tag mapping for a recognized category", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(NOMINATIM_RESULT)).mockResolvedValueOnce(jsonResponse({ elements: [] }));

    await provider.search({ category: "doctors", location: "Pune", limit: 20 });

    const overpassBody = fetchMock.mock.calls[1]![1].body as string;
    expect(overpassBody).toContain(`"amenity"="doctors"`);
  });

  it("falls back to a name-based search for an unrecognized category", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(NOMINATIM_RESULT)).mockResolvedValueOnce(jsonResponse({ elements: [] }));

    await provider.search({ category: "pet grooming", location: "Patna", limit: 20 });

    const overpassBody = fetchMock.mock.calls[1]![1].body as string;
    expect(overpassBody).toContain(`"name"~"pet grooming"`);
  });

  it("maps coaching/tuition categories to the real OSM tag instead of the slow name search", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(NOMINATIM_RESULT)).mockResolvedValueOnce(jsonResponse({ elements: [] }));

    await provider.search({ category: "Coaching Institute", location: "Patna", limit: 20 });

    const overpassBody = fetchMock.mock.calls[1]![1].body as string;
    expect(overpassBody).toContain(`"office"="educational_institution"`);
    expect(overpassBody).not.toContain("name"); // never falls into the regex path
  });

  it("escapes double-quotes in the category so it can't break out of the Overpass QL string", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(NOMINATIM_RESULT)).mockResolvedValueOnce(jsonResponse({ elements: [] }));

    const injected = 'x"]; [out:csv(::id)]; way(1); out; //';
    await provider.search({ category: injected, location: "Patna", limit: 20 });

    const overpassBody = fetchMock.mock.calls[1]![1].body as string;
    expect(overpassBody).not.toContain('x"];'); // the raw unescaped breakout sequence must not appear
    expect(overpassBody).toContain('x\\"'); // the quote is escaped instead
  });

  it("returns an empty list when the location can't be geocoded", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const results = await provider.search({ category: "doctors", location: "Nowhereville", limit: 20 });

    expect(results).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1); // never reaches Overpass
  });

  it("filters out elements without a website when requireWebsite is set", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(NOMINATIM_RESULT)).mockResolvedValueOnce(
      jsonResponse({
        elements: [
          overpassElement({ tags: { name: "Has Website", website: "https://example.com" } }),
          overpassElement({ tags: { name: "No Website" } }),
        ],
      })
    );

    const results = await provider.search({ category: "doctors", location: "Pune", limit: 20, requireWebsite: true });

    expect(results).toHaveLength(1);
    expect(results[0]!.businessName).toBe("Has Website");
  });

  it("respects the requested limit even when Overpass returns more", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(NOMINATIM_RESULT)).mockResolvedValueOnce(
      jsonResponse({
        elements: [1, 2, 3].map((n) => overpassElement({ tags: { name: `Business ${n}` } })),
      })
    );

    const results = await provider.search({ category: "doctors", location: "Pune", limit: 2 });

    expect(results).toHaveLength(2);
  });

  it("skips elements with no name tag", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(NOMINATIM_RESULT)).mockResolvedValueOnce(
      jsonResponse({ elements: [{ type: "node", id: 1, lat: 1, lon: 1, tags: {} }] })
    );

    const results = await provider.search({ category: "doctors", location: "Pune", limit: 20 });

    expect(results).toEqual([]);
  });

  it("retries once after a short delay when Overpass fails, and succeeds on the second pass", async () => {
    vi.useFakeTimers();
    try {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(NOMINATIM_RESULT)) // nominatim
        .mockResolvedValueOnce(jsonResponse({}, false)) // pass 1 — 500
        .mockResolvedValueOnce(jsonResponse({ elements: [] })); // pass 2 — succeeds

      const promise = provider.search({ category: "doctors", location: "Pune", limit: 20 });
      await vi.runAllTimersAsync();
      const results = await promise;

      expect(results).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws once both passes fail", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockResolvedValueOnce(jsonResponse(NOMINATIM_RESULT)); // nominatim
      fetchMock.mockResolvedValue(jsonResponse({}, false)); // every Overpass attempt fails

      const promise = provider.search({ category: "doctors", location: "Pune", limit: 20 });
      const assertion = expect(promise).rejects.toThrow("OpenStreetMap search failed");
      await vi.runAllTimersAsync();
      await assertion;

      expect(fetchMock).toHaveBeenCalledTimes(1 + 2); // nominatim + 2 passes over the one mirror
    } finally {
      vi.useRealTimers();
    }
  });
});
