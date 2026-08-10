"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertPermission, ForbiddenError } from "@virtelon/core/rbac";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";

const updateSchema = z.object({
  name: z.string().min(2, "Organization name is required"),
  timezone: z.string().min(1),
});

export type UpdateOrgState = { error?: string; success?: boolean };

export async function updateOrganization(_prev: UpdateOrgState, formData: FormData): Promise<UpdateOrgState> {
  const user = await requireSession();

  try {
    assertPermission(user.role, "organization:manage");
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to change organization settings." };
    throw error;
  }

  const parsed = updateSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const db = tenantDb(user);
  await db.organization.update({
    where: { id: user.organizationId },
    data: { name: parsed.data.name, timezone: parsed.data.timezone },
  });

  revalidatePath("/settings/organization");
  return { success: true };
}
