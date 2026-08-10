import type { TenantScopedClient } from "@virtelon/db";

export async function listActivity(db: TenantScopedClient, leadId: string) {
  return db.activity.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });
}

export async function addNote(db: TenantScopedClient, leadId: string, userId: string, content: string) {
  return db.activity.create({ data: { leadId, userId, type: "note", content } });
}

export async function logStatusChange(
  db: TenantScopedClient,
  leadId: string,
  userId: string,
  from: string,
  to: string
) {
  return db.activity.create({
    data: { leadId, userId, type: "status_change", content: `${from} → ${to}`, metadata: { from, to } },
  });
}
