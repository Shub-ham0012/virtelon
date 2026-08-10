"use server";

import { revalidatePath } from "next/cache";
import { assertPermission, canAccessLead, ForbiddenError } from "@virtelon/core/rbac";
import { approveOutreachMessage, markOutreachSent } from "@virtelon/core/outreach";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";

export type ApproveOutreachState = { error?: string };

export async function approveOutreachAction(_prev: ApproveOutreachState, formData: FormData): Promise<ApproveOutreachState> {
  const user = await requireSession();

  try {
    assertPermission(user.role, "outreach:approve");
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to approve outreach." };
    throw error;
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Invalid message." };

  const db = tenantDb(user);
  await approveOutreachMessage(db, id, user.userId);

  revalidatePath("/outreach");
  return {};
}

export type MarkSentState = { error?: string };

export async function markSentAction(_prev: MarkSentState, formData: FormData): Promise<MarkSentState> {
  const user = await requireSession();

  try {
    assertPermission(user.role, "outreach:send");
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "You don't have permission to send outreach." };
    throw error;
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Invalid message." };

  const db = tenantDb(user);
  const message = await db.outreachMessage.findUnique({ where: { id }, include: { lead: true } });
  if (!message) return { error: "Message not found." };
  if (!canAccessLead(user.role, user.userId, message.lead)) {
    return { error: "You don't have permission to send outreach for this lead." };
  }

  await markOutreachSent(db, id);

  revalidatePath("/outreach");
  revalidatePath(`/leads/${message.leadId}`);
  revalidatePath("/leads");
  return {};
}
