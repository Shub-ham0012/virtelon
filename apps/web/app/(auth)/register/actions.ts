"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { rawPrisma } from "@virtelon/db";
import { signIn } from "@/lib/auth";

const registerSchema = z.object({
  name: z.string().min(1, "Your name is required"),
  organizationName: z.string().min(2, "Organization name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type RegisterState = { error?: string };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "organization";
  let candidate = root;
  let suffix = 1;
  while (await rawPrisma.organization.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${root}-${suffix}`;
  }
  return candidate;
}

export async function registerOrganization(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    organizationName: formData.get("organizationName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, organizationName, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await rawPrisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const slug = await uniqueSlug(organizationName);

  await rawPrisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: normalizedEmail, name, passwordHash },
    });
    const organization = await tx.organization.create({
      data: { name: organizationName, slug },
    });
    await tx.membership.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: "OWNER",
        joinedAt: new Date(),
      },
    });
  });

  await signIn("credentials", { email: normalizedEmail, password, redirectTo: "/dashboard" });
  return {};
}
