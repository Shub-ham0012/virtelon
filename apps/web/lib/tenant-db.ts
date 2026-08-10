import { createTenantScopedClient } from "@virtelon/db";
import type { SessionUser } from "@virtelon/types";

/** Every tenant-facing server action/route gets its database access through
 * this — never `rawPrisma` directly (see docs/ARCHITECTURE.md §G). */
export function tenantDb(user: SessionUser) {
  return createTenantScopedClient(user.organizationId);
}
