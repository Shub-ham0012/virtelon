"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { rawPrisma, type Role } from "@virtelon/db";
import { assertPermission, canManageRole, ForbiddenError } from "@virtelon/core/rbac";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { signInviteToken } from "@/lib/invite-token";

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "SALES", "VIEWER"]),
});

export type InviteState = { error?: string; inviteUrl?: string };

export async function inviteTeamMember(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const user = await requireSession();

  try {
    assertPermission(user.role, "team:invite");
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to invite teammates." };
    throw error;
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const targetRole = parsed.data.role as Role;

  if (!canManageRole(user.role, targetRole)) {
    return { error: `You can't grant the ${targetRole} role.` };
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const existingUser = await rawPrisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    return { error: "This person already has an account — multi-organization membership isn't supported yet." };
  }

  const newUser = await rawPrisma.user.create({
    data: { email: normalizedEmail },
  });

  const db = tenantDb(user);
  const membership = await db.membership.create({
    // organizationId is redundant here — the tenant-scoped client always
    // overwrites it — but Prisma's generated types still require it at
    // compile time, and the extension can't change that.
    data: { organizationId: user.organizationId, userId: newUser.id, role: targetRole },
  });

  const token = await signInviteToken(membership.id);
  const inviteUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}/accept-invite?token=${token}`;

  revalidatePath("/team");
  return { inviteUrl };
}
