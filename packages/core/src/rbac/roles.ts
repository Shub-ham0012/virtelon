import type { Role } from "@virtelon/db";

export const ROLE_HIERARCHY: Role[] = ["VIEWER", "SALES", "MANAGER", "ADMIN", "OWNER"];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  SALES: "Sales",
  VIEWER: "Viewer",
};

/** Whether `actor` is allowed to assign/change `target`'s role. Only OWNER
 * and ADMIN manage roles, and nobody but OWNER can create/modify another OWNER
 * (prevents an ADMIN from silently promoting themselves to full ownership). */
export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") return targetRole !== "OWNER";
  return false;
}
