"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission, ForbiddenError } from "@virtelon/core/rbac";
import { createCampaign, getCampaign, runCampaignDiscovery } from "@virtelon/core/campaigns";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";

const campaignSchema = z.object({
  name: z.string().min(2, "Name is required"),
  category: z.string().min(2, "Category is required"),
  location: z.string().min(2, "Location is required"),
  serviceId: z.string().optional(),
  serviceLabel: z.string().min(1, "Service label is required"),
  dailyLeadTarget: z.coerce.number().int().min(1).max(500),
  minLeadScore: z.coerce.number().int().min(0).max(100),
  messageTone: z.enum(["formal", "friendly", "concise", "professional", "hinglish"]),
  language: z.enum(["en", "hi", "hinglish"]),
  mode: z.enum(["MANUAL", "APPROVAL_REQUIRED", "AUTOMATED"]),
});

export type CampaignFormState = { error?: string };

export async function createCampaignAction(_prev: CampaignFormState, formData: FormData): Promise<CampaignFormState> {
  const user = await requireSession();

  try {
    assertPermission(user.role, "campaign:create");
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to create campaigns." };
    throw error;
  }

  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    location: formData.get("location"),
    serviceId: formData.get("serviceId") || undefined,
    serviceLabel: formData.get("serviceLabel"),
    dailyLeadTarget: formData.get("dailyLeadTarget"),
    minLeadScore: formData.get("minLeadScore"),
    messageTone: formData.get("messageTone"),
    language: formData.get("language"),
    mode: formData.get("mode"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const db = tenantDb(user);
  const campaign = await createCampaign(db, user.organizationId, {
    ...parsed.data,
    serviceId: parsed.data.serviceId ?? null,
  });

  revalidatePath("/campaigns");
  redirect(`/campaigns/${campaign.id}`);
}

const discoverForCampaignSchema = z.object({
  campaignId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50),
});

export type CampaignDiscoverState = {
  error?: string;
  success?: boolean;
  providerName?: string;
  createdCount?: number;
  updatedCount?: number;
  duplicateCount?: number;
  attachedCount?: number;
};

export async function discoverForCampaignAction(
  _prev: CampaignDiscoverState,
  formData: FormData
): Promise<CampaignDiscoverState> {
  const user = await requireSession();

  try {
    assertPermission(user.role, "lead:manage");
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to discover leads." };
    throw error;
  }

  const parsed = discoverForCampaignSchema.safeParse({
    campaignId: formData.get("campaignId"),
    limit: formData.get("limit"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const db = tenantDb(user);
  const campaign = await getCampaign(db, parsed.data.campaignId);
  if (!campaign) return { error: "Campaign not found." };

  let result;
  try {
    result = await runCampaignDiscovery(db, user.organizationId, campaign, parsed.data.limit);
  } catch {
    return { error: "The free lead search service is temporarily unavailable — this happens occasionally under load. Please try again in a minute." };
  }

  revalidatePath(`/campaigns/${campaign.id}`);
  return { success: true, ...result };
}
