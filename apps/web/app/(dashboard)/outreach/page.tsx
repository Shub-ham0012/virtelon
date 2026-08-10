import Link from "next/link";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission } from "@virtelon/core/rbac";
import { listOutreachQueue, buildWhatsAppLink } from "@virtelon/core/outreach";
import { Pill } from "@/components/ui/pill";
import { ApproveForm, MarkSentForm } from "./row-actions";

export default async function OutreachPage() {
  const user = await requireSession();
  const db = tenantDb(user);

  const queue = await listOutreachQueue(db);
  const canApprove = hasPermission(user.role, "outreach:approve");
  const canSend = hasPermission(user.role, "outreach:send");

  const pendingCount = queue.filter((m) => m.status === "PENDING_APPROVAL").length;
  const queuedCount = queue.filter((m) => m.status === "QUEUED").length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [sentToday, repliedThisWeek] = await Promise.all([
    db.outreachMessage.count({ where: { status: "SENT", sentAt: { gte: todayStart } } }),
    db.lead.count({ where: { status: { in: ["REPLIED", "INTERESTED", "MEETING", "PROPOSAL", "WON"] } } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl font-medium">Outreach queue</h1>
        <p className="mt-1 max-w-2xl text-[12.5px] text-(--sub)">
          AI-drafted messages, always approved and sent by a human — nothing here is ever sent automatically. &quot;Mark
          sent&quot; opens WhatsApp with the message pre-filled; you review and hit send yourself.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <div className="card reveal p-4">
          <div className="text-[10.5px] font-semibold tracking-wide text-(--sub) uppercase">Pending approval</div>
          <div className="mt-1 font-mono-data text-[21px] font-semibold">{pendingCount}</div>
        </div>
        <div className="card reveal p-4" style={{ "--reveal-delay": "0.05s" } as React.CSSProperties}>
          <div className="text-[10.5px] font-semibold tracking-wide text-(--sub) uppercase">Queued to send</div>
          <div className="mt-1 font-mono-data text-[21px] font-semibold">{queuedCount}</div>
        </div>
        <div className="card reveal p-4" style={{ "--reveal-delay": "0.1s" } as React.CSSProperties}>
          <div className="text-[10.5px] font-semibold tracking-wide text-(--sub) uppercase">Sent today</div>
          <div className="mt-1 font-mono-data text-[21px] font-semibold">{sentToday}</div>
        </div>
        <div className="card reveal p-4" style={{ "--reveal-delay": "0.15s" } as React.CSSProperties}>
          <div className="text-[10.5px] font-semibold tracking-wide text-(--sub) uppercase">Replied overall</div>
          <div className="mt-1 font-mono-data text-[21px] font-semibold text-(--success)">{repliedThisWeek}</div>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="card p-6 text-sm text-(--sub)">
          Nothing queued. Generate an AI draft on a lead&apos;s page, then &quot;Queue for outreach&quot; to see it here.
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {queue.map((message, i) => {
            const waLink = message.lead.phoneE164 ? buildWhatsAppLink(message.lead.phoneE164, message.content) : null;
            return (
              <div
                key={message.id}
                className="card card-hover reveal flex flex-col gap-3 p-4.5"
                style={{ "--reveal-delay": `${Math.min(i, 5) * 0.05}s` } as React.CSSProperties}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link href={`/leads/${message.leadId}`} className="text-[13.5px] font-bold text-(--accent)">
                      {message.lead.businessName}
                    </Link>
                    <div className="mt-0.5 text-[11px] text-(--sub)">
                      {message.channel} · AI draft{message.lead.phone ? ` · ${message.lead.phone}` : ""}
                    </div>
                  </div>
                  <Pill tone={message.status === "PENDING_APPROVAL" ? "warning" : "teal"}>{message.status.replace(/_/g, " ")}</Pill>
                </div>

                <div className="rounded-lg border border-(--border) bg-(--surface-2) p-3.5 text-[13px] whitespace-pre-wrap">
                  {message.content}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {message.status === "PENDING_APPROVAL" && canApprove ? <ApproveForm id={message.id} /> : null}
                  {message.status === "QUEUED" ? (
                    <>
                      {waLink ? (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3.5 py-2 text-[12.5px] font-semibold text-[#06210F] transition hover:brightness-105"
                        >
                          Open in WhatsApp
                        </a>
                      ) : (
                        <span className="text-xs text-(--danger)">No phone number on file — can&apos;t build a WhatsApp link.</span>
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
