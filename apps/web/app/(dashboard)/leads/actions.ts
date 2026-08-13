"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertPermission, canModifyLead, ForbiddenError } from "@virtelon/core/rbac";
import { getLeadDiscoveryProvider, getOrCreateLeadSource, ingestDiscoveredLeads } from "@virtelon/core/lead-discovery";
import { getWebsiteAuditProvider } from "@virtelon/core/website-audit";
import { getSocialPresenceProvider, researchLead, type ResearchLeadResult } from "@virtelon/core/presence-research";
import { scoreLead, scoreLeads } from "@virtelon/core/lead-scoring";
import { analyzeAndDraftForLead, getAIProvider } from "@virtelon/core/ai";
import { addContact, addNote, assignLead, logStatusChange } from "@virtelon/core/crm";
import { queueOutreachMessage } from "@virtelon/core/outreach";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";

const discoverSchema = z.object({
  category: z.string().min(2, "Enter a category"),
  location: z.string().min(2, "Enter a location"),
  limit: z.coerce.number().int().min(1).max(50),
  minRating: z.coerce.number().min(0).max(5).optional(),
  requireWebsite: z.enum(["any", "yes", "no"]).default("any"),
});

export type DiscoverState = {
  error?: string;
  success?: boolean;
  providerName?: string;
  createdCount?: number;
  updatedCount?: number;
  duplicateCount?: number;
};

export async function discoverLeads(_prev: DiscoverState, formData: FormData): Promise<DiscoverState> {
  const user = await requireSession();

  try {
    assertPermission(user.role, "lead:manage");
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to discover leads." };
    throw error;
  }

  const parsed = discoverSchema.safeParse({
    category: formData.get("category"),
    location: formData.get("location"),
    limit: formData.get("limit"),
    minRating: formData.get("minRating") || undefined,
    requireWebsite: formData.get("requireWebsite") || "any",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { category, location, limit, minRating, requireWebsite } = parsed.data;

  const provider = getLeadDiscoveryProvider();
  const db = tenantDb(user);
  const source = await getOrCreateLeadSource(db, user.organizationId, provider.name);

  let results;
  try {
    results = await provider.search({
      category,
      location,
      limit,
      minRating,
      requireWebsite: requireWebsite === "any" ? undefined : requireWebsite === "yes",
    });
  } catch (error) {
    console.error(`discoverLeads: ${provider.name} search failed for "${category}" in "${location}":`, error);
    return {
      error: `${provider.name === "openstreetmap" ? "OpenStreetMap" : provider.name}'s free search service is temporarily unavailable — this happens occasionally with the free tier under load. Please try again in a minute.`,
    };
  }

  const ingestResult = await ingestDiscoveredLeads(
    db,
    { organizationId: user.organizationId, sourceId: source.id, defaultCountry: "IN" },
    results
  );
  await scoreLeads(db, ingestResult.leadIds);

  revalidatePath("/leads");
  return {
    success: true,
    providerName: provider.name,
    createdCount: ingestResult.createdCount,
    updatedCount: ingestResult.updatedCount,
    duplicateCount: ingestResult.duplicateCount,
  };
}

const statusSchema = z.object({
  leadId: z.string().min(1),
  status: z.enum([
    "NEW",
    "QUALIFIED",
    "CONTACTED",
    "REPLIED",
    "INTERESTED",
    "NOT_INTERESTED",
    "MEETING",
    "PROPOSAL",
    "WON",
    "LOST",
    "OPTED_OUT",
    "DO_NOT_CONTACT",
  ]),
});

export type UpdateStatusState = { error?: string };

export async function updateLeadStatus(_prev: UpdateStatusState, formData: FormData): Promise<UpdateStatusState> {
  const user = await requireSession();

  const parsed = statusSchema.safeParse({ leadId: formData.get("leadId"), status: formData.get("status") });
  if (!parsed.success) return { error: "Invalid input" };

  const db = tenantDb(user);
  const lead = await db.lead.findUnique({ where: { id: parsed.data.leadId } });
  if (!lead) return { error: "Lead not found." };

  // A SALES rep may update the status of their own assigned lead — the
  // whole point of day-to-day CRM use — but not anyone else's.
  if (!canModifyLead(user.role, user.userId, lead)) {
    return { error: "You don't have permission to change this lead's status." };
  }

  if (lead.status !== parsed.data.status) {
    await db.lead.update({ where: { id: parsed.data.leadId }, data: { status: parsed.data.status } });
    await logStatusChange(db, parsed.data.leadId, user.userId, lead.status, parsed.data.status);
  }

  revalidatePath(`/leads/${parsed.data.leadId}`);
  revalidatePath("/leads");
  return {};
}

export type ResearchState = { error?: string; success?: boolean; result?: ResearchLeadResult };

export async function researchLeadAction(_prev: ResearchState, formData: FormData): Promise<ResearchState> {
  const user = await requireSession();

  try {
    assertPermission(user.role, "lead:manage");
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to research leads." };
    throw error;
  }

  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || !leadId) return { error: "Invalid lead." };

  const db = tenantDb(user);
  const result = await researchLead(db, leadId, {
    websiteAudit: getWebsiteAuditProvider(),
    socialPresence: getSocialPresenceProvider(),
  });
  await scoreLead(db, leadId);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { success: true, result };
}

const toneSchema = z.enum(["formal", "friendly", "concise", "professional", "hinglish"]);
const languageSchema = z.enum(["en", "hi", "hinglish"]);

export type GenerateAIState = { error?: string; success?: boolean };

export async function generateAIAction(_prev: GenerateAIState, formData: FormData): Promise<GenerateAIState> {
  const user = await requireSession();

  try {
    assertPermission(user.role, "lead:manage");
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to generate AI content for leads." };
    throw error;
  }

  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || !leadId) return { error: "Invalid lead." };

  const parsedTone = toneSchema.safeParse(formData.get("tone"));
  const parsedLanguage = languageSchema.safeParse(formData.get("language"));
  if (!parsedTone.success || !parsedLanguage.success) return { error: "Invalid tone or language." };

  const db = tenantDb(user);
  const provider = getAIProvider();
  try {
    await analyzeAndDraftForLead(db, provider, leadId, { tone: parsedTone.data, language: parsedLanguage.data });
  } catch {
    return { error: "AI analysis failed — the AI service may be temporarily unavailable. Please try again." };
  }

  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export type NoteState = { error?: string };

export async function addNoteAction(_prev: NoteState, formData: FormData): Promise<NoteState> {
  const user = await requireSession();

  const leadId = formData.get("leadId");
  const content = formData.get("content");
  if (typeof leadId !== "string" || !leadId) return { error: "Invalid lead." };
  if (typeof content !== "string" || !content.trim()) return { error: "Note can't be empty." };

  const db = tenantDb(user);
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { error: "Lead not found." };
  if (!canModifyLead(user.role, user.userId, lead)) {
    return { error: "You don't have permission to add notes to this lead." };
  }

  await addNote(db, leadId, user.userId, content.trim());

  revalidatePath(`/leads/${leadId}`);
  return {};
}

export type AssignState = { error?: string };

export async function assignLeadAction(_prev: AssignState, formData: FormData): Promise<AssignState> {
  const user = await requireSession();

  try {
    assertPermission(user.role, "lead:manage");
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to reassign leads." };
    throw error;
  }

  const leadId = formData.get("leadId");
  const assigneeUserId = formData.get("assigneeUserId");
  if (typeof leadId !== "string" || !leadId) return { error: "Invalid lead." };

  const db = tenantDb(user);
  const nextAssignee = typeof assigneeUserId === "string" && assigneeUserId ? assigneeUserId : null;

  if (nextAssignee) {
    const membership = await db.membership.findFirst({ where: { userId: nextAssignee } });
    if (!membership) return { error: "That person isn't a member of this organization." };
  }

  await assignLead(db, leadId, nextAssignee, user.userId);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return {};
}

export type AddContactState = { error?: string };

export async function addContactAction(_prev: AddContactState, formData: FormData): Promise<AddContactState> {
  const user = await requireSession();

  const leadId = formData.get("leadId");
  if (typeof leadId !== "string" || !leadId) return { error: "Invalid lead." };

  const db = tenantDb(user);
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { error: "Lead not found." };
  if (!canModifyLead(user.role, user.userId, lead)) {
    return { error: "You don't have permission to add contacts to this lead." };
  }

  const name = (formData.get("name") as string) || undefined;
  const role = (formData.get("role") as string) || undefined;
  const email = (formData.get("email") as string) || undefined;
  const phone = (formData.get("phone") as string) || undefined;
  if (!name && !email && !phone) return { error: "Add at least a name, email, or phone." };

  await addContact(db, leadId, { name, role, email, phone });

  revalidatePath(`/leads/${leadId}`);
  return {};
}

const channelSchema = z.enum(["whatsapp", "email", "sms"]);

export type QueueOutreachState = { error?: string; success?: boolean };

export async function queueOutreachAction(_prev: QueueOutreachState, formData: FormData): Promise<QueueOutreachState> {
  const user = await requireSession();

  const leadId = formData.get("leadId");
  const content = formData.get("content");
  const parsedChannel = channelSchema.safeParse(formData.get("channel"));
  if (typeof leadId !== "string" || !leadId) return { error: "Invalid lead." };
  if (typeof content !== "string" || !content.trim()) return { error: "Message can't be empty." };
  if (!parsedChannel.success) return { error: "Invalid channel." };

  const db = tenantDb(user);
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { error: "Lead not found." };
  if (!canModifyLead(user.role, user.userId, lead)) {
    return { error: "You don't have permission to queue outreach for this lead." };
  }

  await queueOutreachMessage(db, user.organizationId, {
    leadId,
    channel: parsedChannel.data,
    content: content.trim(),
    generatedBy: "ai",
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/outreach");
  return { success: true };
}
