import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiAIProvider } from "./gemini.provider";
import type { OutreachGenerationInput } from "../AIProvider";

function geminiResponse(text: string) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] }),
    text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
  } as Response;
}

const BASE_INPUT: OutreachGenerationInput = {
  lead: { businessName: "Acme Dental", category: "Dentist", city: "Pune", website: null, websiteAudited: false },
  tenantServices: [{ id: "svc-1", name: "Website Design", description: "d", targetIndustries: [], painPoints: [], pitchAngles: [] }],
  tone: "friendly",
  language: "en",
  campaignObjective: "get a reply",
};

describe("GeminiAIProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates outreach text via plain-text mode", async () => {
    fetchMock.mockResolvedValueOnce(geminiResponse("Hi Acme Dental, ..."));
    const provider = new GeminiAIProvider("key");

    const result = await provider.generateOutreach(BASE_INPUT);

    expect(result).toBe("Hi Acme Dental, ...");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("gemini-flash-latest:generateContent");
    expect(JSON.parse(init.body).generationConfig).toBeUndefined(); // no JSON mode for plain text
  });

  it("parses and validates a lead analysis, accepting a real service id", async () => {
    fetchMock.mockResolvedValueOnce(
      geminiResponse(
        JSON.stringify({
          score: 80,
          priority: "high",
          reasoning: ["no website"],
          painPoints: ["invisible online"],
          opportunities: ["build a site"],
          recommendedServiceId: "svc-1",
          recommendedService: "Website Design",
          recommendedPitchAngle: "get found on Google",
        })
      )
    );
    const provider = new GeminiAIProvider("key");

    const result = await provider.analyzeLead(BASE_INPUT);

    expect(result.score).toBe(80);
    expect(result.recommendedServiceId).toBe("svc-1");
  });

  it("nulls out a hallucinated service id not present in the catalog", async () => {
    fetchMock.mockResolvedValueOnce(
      geminiResponse(
        JSON.stringify({
          score: 50,
          priority: "medium",
          reasoning: ["ok presence"],
          painPoints: [],
          opportunities: [],
          recommendedServiceId: "svc-made-up",
          recommendedService: "Something",
          recommendedPitchAngle: null,
        })
      )
    );
    const provider = new GeminiAIProvider("key");

    const result = await provider.analyzeLead(BASE_INPUT);

    expect(result.recommendedServiceId).toBeNull();
  });

  it("throws a clear error when the model returns unparseable JSON", async () => {
    fetchMock.mockResolvedValueOnce(geminiResponse("not json at all"));
    const provider = new GeminiAIProvider("key");

    await expect(provider.analyzeLead(BASE_INPUT)).rejects.toThrow("did not return valid JSON");
  });

  it("throws when the request is blocked", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ promptFeedback: { blockReason: "SAFETY" } }),
    } as Response);
    const provider = new GeminiAIProvider("key");

    await expect(provider.generateOutreach(BASE_INPUT)).rejects.toThrow("blocked");
  });

  it("throws with the response body on a non-ok HTTP status", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => JSON.stringify({ error: { message: "model no longer available" } }),
    } as Response);
    const provider = new GeminiAIProvider("key");

    await expect(provider.generateOutreach(BASE_INPUT)).rejects.toThrow("model no longer available");
  });
});
