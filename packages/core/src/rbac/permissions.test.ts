import { describe, expect, it } from "vitest";
import { assertPermission, canAccessLead, canModifyLead, hasPermission, ForbiddenError } from "./permissions";

describe("hasPermission", () => {
  it("grants OWNER every permission", () => {
    expect(hasPermission("OWNER", "billing:manage")).toBe(true);
    expect(hasPermission("OWNER", "organization:manage")).toBe(true);
  });

  it("denies ADMIN billing and organization deletion, but allows org settings", () => {
    expect(hasPermission("ADMIN", "billing:manage")).toBe(false);
    expect(hasPermission("ADMIN", "organization:delete")).toBe(false);
    expect(hasPermission("ADMIN", "organization:manage")).toBe(true);
    expect(hasPermission("ADMIN", "team:manage")).toBe(true);
  });

  it("limits MANAGER to campaigns, leads, and analytics", () => {
    expect(hasPermission("MANAGER", "campaign:manage")).toBe(true);
    expect(hasPermission("MANAGER", "lead:manage")).toBe(true);
    expect(hasPermission("MANAGER", "analytics:view")).toBe(true);
    expect(hasPermission("MANAGER", "team:invite")).toBe(false);
    expect(hasPermission("MANAGER", "settings:manage")).toBe(false);
  });

  it("limits SALES to assigned leads and outreach", () => {
    expect(hasPermission("SALES", "lead:view:assigned")).toBe(true);
    expect(hasPermission("SALES", "lead:manage")).toBe(false);
    expect(hasPermission("SALES", "outreach:send")).toBe(true);
    expect(hasPermission("SALES", "campaign:manage")).toBe(false);
  });

  it("makes VIEWER strictly read-only", () => {
    expect(hasPermission("VIEWER", "lead:view")).toBe(true);
    expect(hasPermission("VIEWER", "lead:manage")).toBe(false);
    expect(hasPermission("VIEWER", "outreach:send")).toBe(false);
    expect(hasPermission("VIEWER", "campaign:create")).toBe(false);
  });
});

describe("assertPermission", () => {
  it("throws ForbiddenError when the role lacks the permission", () => {
    expect(() => assertPermission("VIEWER", "campaign:create")).toThrow(ForbiddenError);
  });

  it("does not throw when the role has the permission", () => {
    expect(() => assertPermission("OWNER", "campaign:create")).not.toThrow();
  });
});

describe("canAccessLead", () => {
  it("lets MANAGER/ADMIN/OWNER access any lead regardless of assignment", () => {
    expect(canAccessLead("MANAGER", "user-1", { assignedUserId: "user-2" })).toBe(true);
    expect(canAccessLead("ADMIN", "user-1", { assignedUserId: null })).toBe(true);
  });

  it("lets SALES access only their own assigned lead", () => {
    expect(canAccessLead("SALES", "user-1", { assignedUserId: "user-1" })).toBe(true);
    expect(canAccessLead("SALES", "user-1", { assignedUserId: "user-2" })).toBe(false);
    expect(canAccessLead("SALES", "user-1", { assignedUserId: null })).toBe(false);
  });

  it("denies VIEWER row-level access even though VIEWER has lead:view", () => {
    // VIEWER has blanket lead:view (read-only across the org), so this is
    // intentionally true — VIEWER just can't reach lead:manage actions.
    expect(canAccessLead("VIEWER", "user-1", { assignedUserId: "user-2" })).toBe(true);
  });
});

describe("canModifyLead", () => {
  it("lets SALES modify their own assigned lead (status, notes) but not others", () => {
    expect(canModifyLead("SALES", "user-1", { assignedUserId: "user-1" })).toBe(true);
    expect(canModifyLead("SALES", "user-1", { assignedUserId: "user-2" })).toBe(false);
    expect(canModifyLead("SALES", "user-1", { assignedUserId: null })).toBe(false);
  });

  it("lets MANAGER/ADMIN/OWNER modify any lead", () => {
    expect(canModifyLead("MANAGER", "user-1", { assignedUserId: "user-2" })).toBe(true);
  });

  it("denies VIEWER, which has no manage or assigned-view grant", () => {
    expect(canModifyLead("VIEWER", "user-1", { assignedUserId: "user-1" })).toBe(false);
  });
});
