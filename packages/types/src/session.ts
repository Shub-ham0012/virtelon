import type { Role } from "@virtelon/db";

/** Identity claims carried on every authenticated session. */
export interface SessionUser {
  userId: string;
  email: string;
  name: string | null;
  isPlatformAdmin: boolean;
  organizationId: string;
  organizationSlug: string;
  role: Role;
}
