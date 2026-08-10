export * from "@prisma/client";
export { rawPrisma } from "./client";
export { createTenantScopedClient, type TenantScopedClient } from "./tenant-scope";
