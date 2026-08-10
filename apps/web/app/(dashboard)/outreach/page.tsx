import Link from "next/link";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission } from "@virtelon/core/rbac";
import { listOutreachQueue, buildWhatsAppLink } from "@virtelon/core/outreach";
import { ApproveForm, MarkSentForm } from "./row-actions";

export default async function OutreachPage() {
  const user = await requireSession();
  const db = tenantDb(user);

  const queue = await listOutreachQueue(db);
  const canApprove = hasPermission(user.role, "outreach:approve");
  const canSend = hasPermission(user.role, "outreach:send");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Outreach queue</h1>
        <p className="text-sm text-(--sub)">
          AI-drafted messages waiting for approval, then a human send. Nothing here is ever sent automatically —
          "Mark sent" opens WhatsApp with the message pre-filled; you review and hit send yourself.
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="card p-6 text-sm text-(--sub)">
          Nothing queued. Generate an AI draft on a lead's page, then "Queue for outreach" to see it here.
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((message) => {
            const waLink = message.lead.phoneE164 ? buildWhatsAppLink(message.lead.phoneE164, message.content) : null;
            return (
              <div key={message.id} className="card space-y-3 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link href={`/leads/${message.leadId}`} className="font-medium text-(--accent)">
                      {message.lead.businessName}
                    </Link>
                    <div className="text-xs text-(--sub)">
                      {message.channel} · {message.status.replace(/_/g, " ")}
                      {message.lead.phone ? ` · ${message.lead.phone}` : ""}
                    </div>
                  </div>
                </div>

                <div className="whitespace-pre-wrap rounded-lg border border-(--border) bg-(--bg) p-3 text-sm">
                  {message.content}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {message.status === "PENDING_APPROVAL" && canApprove ? <ApproveForm id={message.id} /> : null}
                  {message.status === "QUEUED" ? (
                    <>
                      {waLink ? (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium btn-primary"
                        >
                          Open in WhatsApp
                        </a>
                      ) : (
                        <span className="text-xs text-(--danger)">No phone number on file — can't build a WhatsApp link.</span>
                      )}
                      {canSend ? <MarkSentForm id={message.id} /> : null}
                    </>
                  ) : null}
                  {message.status === "PENDING_APPROVAL" && !canApprove ? (
                    <span className="text-xs text-(--sub)">Waiting for a manager to approve.</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
