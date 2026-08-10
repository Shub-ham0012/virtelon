import type { TenantScopedClient } from "@virtelon/db";

/** Reassigns a lead (or unassigns, when `assigneeUserId` is null) and logs
 * the change as an Activity so the timeline shows who assigned what, when. */
export async function assignLead(
  db: TenantScopedClient,
  leadId: string,
  assigneeUserId: string | null,
  actorUserId: string
) {
  const lead = await db.lead.update({ where: { id: leadId }, data: { assignedUserId: assigneeUserId } });
  await db.activity.create({
    data: {
      leadId,
      userId: actorUserId,
      type: "assignment",
      content: assigneeUserId ? "Lead assigned" : "Lead unassigned",
      metadata: { assignedUserId: assigneeUserId },
    },
  });
  return lead;
}
