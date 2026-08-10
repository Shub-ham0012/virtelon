import type { TenantScopedClient } from "@virtelon/db";

export interface ContactInput {
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

export async function addContact(db: TenantScopedClient, leadId: string, input: ContactInput) {
  return db.contact.create({ data: { leadId, ...input } });
}

export async function listContacts(db: TenantScopedClient, leadId: string) {
  return db.contact.findMany({ where: { leadId }, orderBy: { createdAt: "asc" } });
}
