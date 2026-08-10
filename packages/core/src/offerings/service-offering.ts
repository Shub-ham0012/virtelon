import type { TenantScopedClient } from "@virtelon/db";

export interface ServiceOfferingInput {
  name: string;
  description: string;
  targetIndustries: string[];
  targetBusinessTypes: string[];
  painPoints: string[];
  idealCustomerProfile?: string | null;
  priceRange?: string | null;
  pitchAngles: string[];
  portfolioUrls: string[];
}

export async function listServiceOfferings(db: TenantScopedClient, opts?: { activeOnly?: boolean }) {
  return db.serviceOffering.findMany({
    where: opts?.activeOnly ? { isActive: true } : {},
    orderBy: { createdAt: "desc" },
  });
}

export async function createServiceOffering(
  db: TenantScopedClient,
  organizationId: string,
  input: ServiceOfferingInput
) {
  return db.serviceOffering.create({ data: { organizationId, ...input } });
}

export async function updateServiceOffering(db: TenantScopedClient, id: string, input: ServiceOfferingInput) {
  return db.serviceOffering.update({ where: { id }, data: input });
}

export async function setServiceOfferingActive(db: TenantScopedClient, id: string, isActive: boolean) {
  return db.serviceOffering.update({ where: { id }, data: { isActive } });
}
