import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { rawPrisma } from "@virtelon/db";
import type { SessionUser } from "@virtelon/types";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await rawPrisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: {
            memberships: {
              orderBy: { joinedAt: "asc" },
              take: 1,
              include: { organization: true },
            },
          },
        });
        if (!user || !user.passwordHash) return null;

        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid) return null;

        const membership = user.memberships[0];
        if (!membership || !membership.joinedAt) return null; // no active org membership yet (e.g. pending invite)

        const sessionUser: SessionUser = {
          userId: user.id,
          email: user.email,
          name: user.name,
          isPlatformAdmin: user.isPlatformAdmin,
          organizationId: membership.organizationId,
          organizationSlug: membership.organization.slug,
          role: membership.role,
        };

        return { id: user.id, ...sessionUser };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const su = user as unknown as SessionUser & { id: string };
        token.userId = su.userId;
        token.email = su.email;
        token.name = su.name;
        token.isPlatformAdmin = su.isPlatformAdmin;
        token.organizationId = su.organizationId;
        token.organizationSlug = su.organizationSlug;
        token.role = su.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        userId: token.userId as string,
        email: token.email as string,
        name: (token.name as string | null) ?? null,
        isPlatformAdmin: token.isPlatformAdmin as boolean,
        organizationId: token.organizationId as string,
        organizationSlug: token.organizationSlug as string,
        role: token.role as SessionUser["role"],
      };
      return session;
    },
  },
});
