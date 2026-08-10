import { PrismaClient } from "@prisma/client";

/**
 * The raw, UNSCOPED Prisma client. Only two callers are allowed to touch it
 * directly: platform-admin route handlers (which legitimately need
 * cross-tenant queries) and this package's own seed/test setup. Every
 * tenant-facing code path in packages/core must go through
 * createTenantScopedClient() in ./tenant-scope instead — reaching for this
 * export from inside packages/core is a code-review red flag (see
 * docs/ARCHITECTURE.md §G).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const rawPrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = rawPrisma;
}
