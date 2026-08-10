"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission, ForbiddenError } from "@virtelon/core/rbac";
import { createServiceOffering, setServiceOfferingActive, updateServiceOffering } from "@virtelon/core/offerings";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";

function linesToArray(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function optionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

const offeringSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().min(2, "Description is required"),
});

export type OfferingFormState = { error?: string };

function readOfferingInput(formData: FormData) {
  return {
    targetIndustries: linesToArray(formData.get("targetIndustries")),
    targetBusinessTypes: linesToArray(formData.get("targetBusinessTypes")),
    painPoints: linesToArray(formData.get("painPoints")),
    pitchAngles: linesToArray(formData.get("pitchAngles")),
    portfolioUrls: linesToArray(formData.get("portfolioUrls")),
    idealCustomerProfile: optionalString(formData.get("idealCustomerProfile")),
    priceRange: optionalString(formData.get("priceRange")),
  };
}

export async function createOffering(_prev: OfferingFormState, formData: FormData): Promise<OfferingFormState> {
  const user = await requireSession();

  try {
    assertPermission(user.role, "settings:manage");
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to manage services." };
    throw error;
  }

  const parsed = offeringSchema.safeParse({ name: formData.get("name"), description: formData.get("description") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const db = tenantDb(user);
  const offering = await createServiceOffering(db, user.organizationId, { ...parsed.data, ...readOfferingInput(formData) });

  revalidatePath("/settings/offerings");
  redirect(`/settings/offerings/${offering.id}`);
}

export async function updateOffering(
  id: string,
  _prev: OfferingFormState,
  formData: FormData
): Promise<OfferingFormState> {
  const user = await requireSession();

  try {
    assertPermission(user.role, "settings:manage");
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to manage services." };
    throw error;
  }

  const parsed = offeringSchema.safeParse({ name: formData.get("name"), description: formData.get("description") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const db = tenantDb(user);
  await updateServiceOffering(db, id, { ...parsed.data, ...readOfferingInput(formData) });

  revalidatePath("/settings/offerings");
  revalidatePath(`/settings/offerings/${id}`);
  return {};
}

export async function toggleOfferingActiveAction(formData: FormData): Promise<void> {
  const user = await requireSession();
  assertPermission(user.role, "settings:manage");

  const id = formData.get("id");
  const wasActive = formData.get("isActive") === "true";
  if (typeof id !== "string" || !id) return;

  const db = tenantDb(user);
  await setServiceOfferingActive(db, id, !wasActive);

  revalidatePath("/settings/offerings");
}
