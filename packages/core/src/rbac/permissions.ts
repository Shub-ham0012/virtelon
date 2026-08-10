import type { Role } from "@virtelon/db";

/**
 * Every permission the platform checks, namespaced by module. Kept as a
 * closed string union (not a free string) so a typo in a route handler is a
 * compile error, not a silent authorization bypass.
 */
export type Permission =
  | "organization:manage" // rename, branding
  | "organization:delete" // irreversible — OWNER only
  | "billing:manage" // plan changes, ownership transfer
  | "team:invite"
  | "team:manage" // change roles, remove members
  | "campaign:create"
  | "campaign:manage"
  | "campaign:view"
  | "lead:view"
  | "lead:manage" // edit, assign, change status
  | "lead:view:assigned" // SALES: only leads assigned to them — combined with lead:manage/view via canAccessLead()
  | "outreach:approve"
  | "outreach:send"
  | "outreach:view"
  | "analytics:view"
  | "settings:manage" // AI, lead sources, scoring rules, follow-up rules, offerings, messaging
  | "integration:manage";

const ALL_PERMISSIONS: Permission[] = [
  "organization:manage",
  "organization:delete",
  "billing:manage",
  "team:invite",
  "team:manage",
  "campaign:create",
  "campaign:manage",
  "campaign:view",
  "lead:view",
  "lead:manage",
  "lead:view:assigned",
  "outreach:approve",
  "outreach:send",
  "outreach:view",
  "analytics:view",
  "settings:manage",
  "integration:manage",
];

/**
 * Role → permission matrix (docs/ARCHITECTURE.md / product spec §18):
 *  OWNER   — everything
 *  ADMIN   — everything except billing and organization deletion/ownership
 *  MANAGER — campaigns, leads, analytics — no team/settings/billing
 *  SALES   — assigned leads + outreach only
 *  VIEWER  — read-only everywhere
 */
const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  OWNER: new Set(ALL_PERMISSIONS),
  ADMIN: new Set(ALL_PERMISSIONS.filter((p) => p !== "billing:manage" && p !== "organization:delete")),
  MANAGER: new Set<Permission>([
    "campaign:create",
    "campaign:manage",
    "campaign:view",
    "lead:view",
    "lead:manage",
    "outreach:approve",
    "outreach:send",
    "outreach:view",
    "analytics:view",
  ]),
  SALES: new Set<Permission>(["lead:view:assigned", "outreach:send", "outreach:view", "campaign:view"]),
  VIEWER: new Set<Permission>(["campaign:view", "lead:view", "outreach:view", "analytics:view"]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export class ForbiddenError extends Error {
  constructor(role: Role, permission: Permission) {
    super(`Role ${role} lacks permission "${permission}"`);
    this.name = "ForbiddenError";
  }
}

export function assertPermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(role, permission);
  }
}

/**
 * Row-level check layered on top of RBAC for leads: a SALES user only has
 * `lead:view:assigned`, which is not "true" access to `lead:view`/`lead:manage`
 * — it means "view/act on this lead if and only if it's assigned to them."
 * MANAGER/ADMIN/OWNER hold the blanket `lead:view`/`lead:manage` permission
 * and can access any lead in the org regardless of assignment.
 */
export function canAccessLead(role: Role, userId: string, lead: { assignedUserId: string | null }): boolean {
  if (hasPermission(role, "lead:manage") || hasPermission(role, "lead:view")) return true;
  return hasPermission(role, "lead:view:assigned") && lead.assignedUserId === userId;
}

/**
 * Day-to-day CRM actions (status changes, notes) on a SALES rep's own
 * assigned lead — narrower than `lead:manage`, which also covers actions
 * SALES should never do (reassigning to someone else, bulk edits). MANAGER+
 * can modify any lead via the blanket `lead:manage` grant; SALES can modify
 * only the lead currently assigned to them.
 */
export function canModifyLead(role: Role, userId: string, lead: { assignedUserId: string | null }): boolean {
  if (hasPermission(role, "lead:manage")) return true;
  return hasPermission(role, "lead:view:assigned") && lead.assignedUserId === userId;
}
