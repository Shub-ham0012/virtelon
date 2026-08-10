import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawPrisma, createTenantScopedClient } from "@virtelon/db";
import {
  approveOutreachMessage,
  getOrCreateDefaultCampaign,
  listOutreachForLead,
  listOutreachQueue,
  markOutreachSent,
  queueOutreachMessage,
} from "./queue";
import { buildWhatsAppLink } from "./whatsapp-link";

const runId = Math.random().toString(36).slice(2, 8);
let org: { id: string };
let user: { id: string };
let directLead: { id: string };
let campaignLead: { id: string };

beforeAll(async () => {
  org = await rawPrisma.organization.create({ data: { name: `Outreach Test ${runId}`, slug: `outreach-test-${runId}` } });
  user = await rawPrisma.user.create({ data: { email: `outreach-${runId}@example.com`, name: "Rep" } });
  await rawPrisma.membership.create({ data: { organizationId: org.id, userId: user.id, role: "MANAGER", joinedAt: new Date() } });

  const source = await rawPrisma.leadSource.create({ data: { organizationId: org.id, type: "manual_entry", config: {} } });
  directLead = await rawPrisma.lead.create({
    data: { organizationId: org.id, sourceId: source.id, businessName: "Direct Lead", category: "gym", dedupHash: `h-direct-${runId}` },
  });
  campaignLead = await rawPrisma.lead.create({
    data: { organizationId: org.id, sourceId: source.id, businessName: "Campaign Lead", category: "gym", dedupHash: `h-camp-${runId}` },
  });

  const campaign = await rawPrisma.campaign.create({
    data: { organizationId: org.id, name: `Existing Campaign ${runId}`, category: "gym", location: "Pune", serviceLabel: "Web design" },
  });
  await rawPrisma.campaignLead.create({ data: { campaignId: campaign.id, leadId: campaignLead.id } });
});

afterAll(async () => {
  await rawPrisma.organization.delete({ where: { id: org.id } });
  await rawPrisma.user.delete({ where: { id: user.id } });
  await rawPrisma.$disconnect();
});

describe("outreach queue", () => {
  it("attaches a lead with no campaign to a lazily-created default campaign", async () => {
    const db = createTenantScopedClient(org.id);
    const message = await queueOutreachMessage(db, org.id, {
      leadId: directLead.id,
      channel: "whatsapp",
      content: "Hi there",
      generatedBy: "ai",
    });
    expect(message.status).toBe("PENDING_APPROVAL");

    const defaultCampaign = await rawPrisma.campaign.findUnique({ where: { id: message.campaignId } });
    expect(defaultCampaign?.name).toBe("Direct outreach");

    const again = await getOrCreateDefaultCampaign(db, org.id);
    expect(again.id).toBe(defaultCampaign?.id);
  });

  it("reuses a lead's existing campaign instead of the default", async () => {
    const db = createTenantScopedClient(org.id);
    const message = await queueOutreachMessage(db, org.id, {
      leadId: campaignLead.id,
      channel: "whatsapp",
      content: "Hi there",
      generatedBy: "ai",
    });
    const campaign = await rawPrisma.campaign.findUnique({ where: { id: message.campaignId } });
    expect(campaign?.name).toBe(`Existing Campaign ${runId}`);
  });

  it("moves a message through approve → sent", async () => {
    const db = createTenantScopedClient(org.id);
    const message = await queueOutreachMessage(db, org.id, {
      leadId: campaignLead.id,
      channel: "whatsapp",
      content: "Second message",
      generatedBy: "manual",
    });

    const approved = await approveOutreachMessage(db, message.id, user.id);
    expect(approved.status).toBe("QUEUED");
    expect(approved.approvedByUserId).toBe(user.id);

    const sent = await markOutreachSent(db, message.id);
    expect(sent.status).toBe("SENT");
    expect(sent.sentAt).not.toBeNull();

    const lead = await rawPrisma.lead.findUnique({ where: { id: campaignLead.id } });
    expect(lead?.lastContactedAt).not.toBeNull();

    const history = await listOutreachForLead(db, campaignLead.id);
    expect(history.some((m) => m.id === message.id && m.status === "SENT")).toBe(true);
  });

  it("lists only pending/queued messages in the queue view", async () => {
    const db = createTenantScopedClient(org.id);
    const queue = await listOutreachQueue(db);
    expect(queue.every((m) => m.status === "PENDING_APPROVAL" || m.status === "QUEUED")).toBe(true);
  });
});

describe("buildWhatsAppLink", () => {
  it("strips formatting from the phone number and encodes the message", () => {
    const link = buildWhatsAppLink("+91 98765 43210", "Hello there!");
    expect(link).toBe("https://wa.me/919876543210?text=Hello%20there!");
  });
});
