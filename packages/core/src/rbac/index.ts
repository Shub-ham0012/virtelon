export {
  type Permission,
  hasPermission,
  assertPermission,
  canAccessLead,
  canModifyLead,
  ForbiddenError,
} from "./permissions";
export { ROLE_HIERARCHY, ROLE_LABELS, canManageRole } from "./roles";
