import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawPrisma, createTenantScopedClient } from "@virtelon/db";
import { addNote, listActivity, logStatusChange } from "./activity";
import { assignLead } from "./assignment";
import { addContact, listContacts } from "./contacts";

const runId = Math.random().toString(36).slice(2, 8);
let org: { id: string };
let user: { id: string };
let lead: { id: string };

beforeAll(async () => {
  org = await rawPrisma.organization.create({ data: { name: `CRM Test ${runId}`, slug: `crm-test-${runId}` } });
  user = await rawPrisma.user.create({ data: { email: `crm-${runId}@example.com`, name: "Rep" } });
  await rawPrisma.membership.create({ data: { organizationId: org.id, userId: user.id, role: "SALES", joinedAt: new Date() } });

  const source = await rawPrisma.leadSource.create({ data: { organizationId: org.id, type: "manual_entry", config: {} } });
  lead = await rawPrisma.lead.create({
    data: { organizationId: org.id, sourceId: source.id, businessName: "CRM Lead", category: "gym", dedupHash: `h-${runId}` },
  });
});

afterAll(async () => {
  await rawPrisma.organization.delete({ where: { id: org.id } });
  await rawPrisma.user.delete({ where: { id: user.id } });
  await rawPrisma.$disconnect();
});

describe("CRM: activity + notes", () => {
  it("adds a note and lists it newest-first", async () => {
    const db = createTenantScopedClient(org.id);
    await addNote(db, lead.id, user.id, "First note");
    await addNote(db, lead.id, user.id, "Second note");

    const activity = await listActivity(db, lead.id);
    expect(activity[0]?.content).toBe("Second note");
    expect(activity[1]?.content).toBe("First note");
    expect(activity.every((a) => a.type === "note")).toBe(true);
  });

  it("logs a status change with from/to metadata", async () => {
    const db = createTenantScopedClient(org.id);
    await logStatusChange(db, lead.id, user.id, "NEW", "QUALIFIED");

    const activity = await listActivity(db, lead.id);
    const statusEntry = activity.find((a) => a.type === "status_change");
    expect(statusEntry?.content).toBe("NEW → QUALIFIED");
  });
});

describe("CRM: assignment", () => {
  it("assigns a lead and logs the change", async () => {
    const db = createTenantScopedClient(org.id);
    const updated = await assignLead(db, lead.id, user.id, user.id);
    expect(updated.assignedUserId).toBe(user.id);

    const activity = await listActivity(db, lead.id);
    expect(activity.some((a) => a.type === "assignment" && a.content === "Lead assigned")).toBe(true);
  });

  it("unassigns when given null", async () => {
    const db = createTenantScopedClient(org.id);
    const updated = await assignLead(db, lead.id, null, user.id);
    expect(updated.assignedUserId).toBeNull();
  });
});

describe("CRM: contacts", () => {
  it("adds multiple contacts for one lead and lists them", async () => {
    const db = createTenantScopedClient(org.id);
    await addContact(db, lead.id, { name: "Owner Name", role: "Owner", phone: "9876543210" });
    await addContact(db, lead.id, { name: "Manager Name", role: "Manager", email: "manager@example.com" });

    const contacts = await listContacts(db, lead.id);
    expect(contacts).toHaveLength(2);
    expect(contacts.map((c) => c.role)).toEqual(["Owner", "Manager"]);
  });
});
