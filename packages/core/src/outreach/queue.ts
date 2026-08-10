import type { TenantScopedClient } from "@virtelon/db";

/**
 * Every OutreachMessage requires a campaignId (see schema), but leads found
 * via the plain /leads discovery flow aren't attached to any campaign. This
 * lazily creates (once per org) a catch-all "Direct outreach" campaign so
 * those leads have somewhere to attach without forcing the user through
 * campaign setup just to send one message.
 */
export async function getOrCreateDefaultCampaign(db: TenantScopedClient, organizationId: string) {
  const existing = await db.campaign.findFirst({ where: { name: "Direct outreach" } });
  if (existing) return existing;
  return db.campaign.create({
    data: {
      organizationId,
      name: "Direct outreach",
      category: "general",
      location: "",
      serviceLabel: "General outreach",
      mode: "MANUAL",
    },
  });
}

async function resolveCampaignForLead(db: TenantScopedClient, organizationId: string, leadId: string) {
  const campaignLead = await db.campaignLead.findFirst({ where: { leadId } });
  if (campaignLead) return campaignLead.campaignId;
  const fallback = await getOrCreateDefaultCampaign(db, organizationId);
  return fallback.id;
}

export interface QueueOutreachInput {
  leadId: string;
  contactId?: string | null;
  channel: "whatsapp" | "email" | "sms";
  content: string;
  generatedBy: "ai" | "manual";
}

/** Creates a message awaiting human approval — never sent automatically. */
export async function queueOutreachMessage(db: TenantScopedClient, organizationId: string, input: QueueOutreachInput) {
  const campaignId = await resolveCampaignForLead(db, organizationId, input.leadId);
  return db.outreachMessage.create({
    data: {
      leadId: input.leadId,
      contactId: input.contactId ?? undefined,
      campaignId,
      channel: input.channel,
      content: input.content,
      generatedBy: input.generatedBy,
      status: "PENDING_APPROVAL",
    },
  });
}

export async function approveOutreachMessage(db: TenantScopedClient, id: string, userId: string) {
  return db.outreachMessage.update({
    where: { id },
    data: { status: "QUEUED", approvedByUserId: userId, approvedAt: new Date() },
  });
}

/**
 * There is no automated send path (no paid WhatsApp Business API account,
 * and unofficial WhatsApp Web automation is explicitly out of scope). The
 * rep opens the WhatsApp click-to-chat link, sends the message themselves,
 * then marks it sent here so it's tracked in the CRM.
 */
export async function markOutreachSent(db: TenantScopedClient, id: string) {
  const message = await db.outreachMessage.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date() },
  });
  await db.lead.update({ where: { id: message.leadId }, data: { lastContactedAt: new Date() } });
  return message;
}

export async function listOutreachQueue(db: TenantScopedClient) {
  return db.outreachMessage.findMany({
    where: { status: { in: ["PENDING_APPROVAL", "QUEUED"] } },
    include: { lead: true, contact: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function listOutreachForLead(db: TenantScopedClient, leadId: string) {
  return db.outreachMessage.findMany({ where: { leadId }, orderBy: { createdAt: "desc" } });
}
