import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawPrisma, createTenantScopedClient } from "@virtelon/db";
import { createServiceOffering, listServiceOfferings, setServiceOfferingActive, updateServiceOffering } from "./service-offering";
import { toAISummary } from "./to-ai-summary";

const runId = Math.random().toString(36).slice(2, 8);
let org: { id: string };

beforeAll(async () => {
  org = await rawPrisma.organization.create({ data: { name: `Offerings Test ${runId}`, slug: `offerings-test-${runId}` } });
});

afterAll(async () => {
  await rawPrisma.organization.delete({ where: { id: org.id } });
  await rawPrisma.$disconnect();
});

const input = {
  name: "Website Development",
  description: "Custom websites",
  targetIndustries: ["coaching"],
  targetBusinessTypes: ["local service"],
  painPoints: ["no website"],
  pitchAngles: ["missed leads"],
  portfolioUrls: ["https://example.com/portfolio"],
};

describe("ServiceOffering CRUD", () => {
  it("creates and lists an offering scoped to the tenant", async () => {
    const db = createTenantScopedClient(org.id);
    await createServiceOffering(db, org.id, input);

    const offerings = await listServiceOfferings(db);
    expect(offerings).toHaveLength(1);
    expect(offerings[0]?.name).toBe("Website Development");
  });

  it("updates an offering", async () => {
    const db = createTenantScopedClient(org.id);
    const [offering] = await listServiceOfferings(db);
    await updateServiceOffering(db, offering!.id, { ...input, name: "Website Development & SEO" });

    const [updated] = await listServiceOfferings(db);
    expect(updated?.name).toBe("Website Development & SEO");
  });

  it("deactivating an offering excludes it from activeOnly listings", async () => {
    const db = createTenantScopedClient(org.id);
    const [offering] = await listServiceOfferings(db);
    await setServiceOfferingActive(db, offering!.id, false);

    const activeOnly = await listServiceOfferings(db, { activeOnly: true });
    expect(activeOnly).toHaveLength(0);

    const all = await listServiceOfferings(db);
    expect(all).toHaveLength(1);
  });

  it("projects to an AI-safe summary without price or portfolio data", () => {
    const summary = toAISummary({
      id: "svc-1",
      name: "X",
      description: "Y",
      targetIndustries: ["a"],
      painPoints: ["b"],
      pitchAngles: ["c"],
    });
    expect(summary).not.toHaveProperty("priceRange");
    expect(summary).not.toHaveProperty("portfolioUrls");
    expect(summary.id).toBe("svc-1");
  });
});
