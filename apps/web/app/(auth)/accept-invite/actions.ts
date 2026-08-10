"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { rawPrisma } from "@virtelon/db";
import { signIn } from "@/lib/auth";
import { verifyInviteToken } from "@/lib/invite-token";

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1, "Your name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type AcceptInviteState = { error?: string };

export async function acceptInvite(_prev: AcceptInviteState, formData: FormData): Promise<AcceptInviteState> {
  const parsed = acceptSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const verified = await verifyInviteToken(parsed.data.token);
  if (!verified) {
    return { error: "This invite link is invalid or has expired." };
  }

  const membership = await rawPrisma.membership.findUnique({
    where: { id: verified.membershipId },
    include: { user: true },
  });
  if (!membership) {
    return { error: "This invite link is invalid or has expired." };
  }
  if (membership.joinedAt) {
    return { error: "This invite has already been accepted. Please sign in instead." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await rawPrisma.$transaction([
    rawPrisma.user.update({
      where: { id: membership.userId },
      data: { name: parsed.data.name, passwordHash },
    }),
    rawPrisma.membership.update({
      where: { id: membership.id },
      data: { joinedAt: new Date() },
    }),
  ]);

  try {
    await signIn("credentials", {
      email: membership.user.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Your account was created — please sign in." };
    }
    throw error;
  }

  return {};
}
