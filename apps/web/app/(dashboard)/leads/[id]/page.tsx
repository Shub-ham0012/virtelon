import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { canAccessLead, canModifyLead, hasPermission } from "@virtelon/core/rbac";
import type { SocialProfilesJson } from "@virtelon/core/presence-research";
import type { ScoreBreakdown } from "@virtelon/core/lead-scoring";
import { getAIProvider } from "@virtelon/core/ai";
import { listActivity, listContacts } from "@virtelon/core/crm";
import { listOutreachForLead } from "@virtelon/core/outreach";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusPill } from "@/components/ui/status-pill";
import { AnimatedBar } from "@/components/charts/animated-bar";
import { StatusForm } from "./status-form";
import { ResearchForm } from "./research-form";
import { PresenceSection } from "./presence-section";
import { AISection } from "./ai-section";
import { AIGenerateForm } from "./ai-generate-form";
import { AssignForm } from "./assign-form";
import { NotesForm } from "./notes-form";
import { ContactForm } from "./contact-form";

const ACTIVITY_LABELS: Record<string, string> = {
  note: "Note",
  status_change: "Status change",
  assignment: "Assignment",
  ai_analysis: "AI analysis",
  research: "Research",
};

const SIGNAL_LABELS: Record<string, string> = {
  websiteOpportunity: "Website opportunity",
  businessQuality: "Business quality",
  onlinePresenceOpportunity: "Online presence opportunity",
  categoryFit: "Category fit",
  contactability: "Contactability",
};

function signalColor(value: number): string {
  if (value >= 75) return "var(--success)";
  if (value >= 45) return "var(--accent)";
  return "var(--warning)";
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold tracking-wide text-(--sub) uppercase">{label}</div>
      <div className="mt-0.5 text-[13px]">{value ?? "—"}</div>
    </div>
  );
}

function SectionCard({
  title,
  children,
  delay,
}: {
  title: string;
  children: React.ReactNode;
  delay?: string;
}) {
  return (
    <div className="card reveal p-5" style={delay ? ({ "--reveal-delay": delay } as React.CSSProperties) : undefined}>
      <div className="mb-3 text-[10.5px] font-semibold tracking-wide text-(--sub) uppercase">{title}</div>
      {children}
    </div>
  );
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const db = tenantDb(user);

  const lead = await db.lead.findUnique({ where: { id }, include: { source: true } });
  if (!lead) notFound();
  if (!canAccessLead(user.role, user.userId, lead)) notFound();

  const websiteAudit = await db.websiteAudit.findUnique({ where: { leadId: lead.id } });
  const latestScore = await db.leadScore.findFirst({ where: { leadId: lead.id }, orderBy: { computedAt: "desc" } });
  const latestAIAnalysis = await db.aIAnalysis.findFirst({ where: { leadId: lead.id }, orderBy: { createdAt: "desc" } });
  const socialProfiles = (lead.socialProfiles as SocialProfilesJson | null) ?? {};
  const contacts = await listContacts(db, lead.id);
  const activity = await listActivity(db, lead.id);
  const outreachHistory = await listOutreachForLead(db, lead.id);

  const canManage = hasPermission(user.role, "lead:manage");
  const canModify = canModifyLead(user.role, user.userId, lead);
  const aiProvider = getAIProvider();
  const members = canManage
    ? (await db.membership.findMany({ include: { user: true } })).map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
      }))
    : [];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl font-medium">{lead.businessName}</h1>
          <p className="mt-1 text-[12.5px] text-(--sub)">
            {lead.category}
            {lead.city ? ` · ${lead.city}${lead.state ? `, ${lead.state}` : ""}` : ""}
          </p>
        </div>
        <ScoreBadge score={lead.leadScore} size="lg" />
      </div>

      <div className="card reveal grid grid-cols-2 gap-4.5 p-5 md:grid-cols-4" style={{ "--reveal-delay": "0.02s" } as React.CSSProperties}>
        <Field label="Phone" value={lead.phone} />
        <Field label="Email" value={lead.email} />
        <Field
          label="Website"
          value={
            lead.website ? (
              <a href={lead.website} target="_blank" rel="noreferrer" className="text-(--accent)">
                {lead.website}
              </a>
            ) : (
              "Missing"
            )
          }
        />
        <Field label="Rating" value={lead.rating ? `${lead.rating} (${lead.reviewCount ?? 0} reviews)` : undefined} />
        <Field label="Address" value={lead.address} />
        <Field label="Business status" value={lead.businessStatus} />
        <Field label="Source" value={lead.source.type.replace(/_/g, " ")} />
        <Field
          label="Discovered"
          value={
            <span className="font-mono-data">
              {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(lead.discoveredAt)}
            </span>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4.5 md:grid-cols-2">
        <div className="card reveal p-5" style={{ "--reveal-delay": "0.06s" } as React.CSSProperties}>
          <div className="mb-3 text-[10.5px] font-semibold tracking-wide text-(--sub) uppercase">Lead score breakdown</div>
          {latestScore ? (
            <div className="flex flex-col gap-2">
              {Object.entries(latestScore.breakdown as ScoreBreakdown).map(([signal, value]) => (
                <div key={signal} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-(--sub)">{SIGNAL_LABELS[signal] ?? signal}</span>
                  <div className="flex w-[55%] items-center gap-2">
                    <AnimatedBar percent={value} color={signalColor(value)} height={5} />
                    <span className="w-6 flex-none text-right font-mono-data font-bold">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-(--sub)">Not scored yet — discovering or researching this lead computes a score automatically.</p>
          )}
        </div>

        <div className="flex flex-col gap-4.5">
          <div className="card reveal p-5" style={{ "--reveal-delay": "0.1s" } as React.CSSProperties}>
            <div className="mb-2.5 text-[10.5px] font-semibold tracking-wide text-(--sub) uppercase">Status</div>
            {canModify ? <StatusForm leadId={lead.id} currentStatus={lead.status} /> : <StatusPill status={lead.status} />}
          </div>
          {canManage ? (
            <div className="card reveal p-5" style={{ "--reveal-delay": "0.14s" } as React.CSSProperties}>
              <div className="mb-2.5 text-[10.5px] font-semibold tracking-wide text-(--sub) uppercase">Assigned to</div>
              <AssignForm leadId={lead.id} members={members} currentAssigneeId={lead.assignedUserId} />
            </div>
          ) : null}
        </div>
      </div>

      <SectionCard title="Contacts" delay="0.18s">
        <div className="mb-3 flex flex-col gap-2">
          {contacts.length === 0 ? (
            <p className="text-sm text-(--sub)">No contacts added yet.</p>
          ) : (
            contacts.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                <span className="font-semibold">{c.name ?? "Unnamed"}</span>
                {c.role ? <span className="text-(--sub)">{c.role}</span> : null}
                {c.phone ? <span className="text-(--sub)">{c.phone}</span> : null}
                {c.email ? <span className="text-(--sub)">{c.email}</span> : null}
              </div>
            ))
          )}
        </div>
        {canModify ? <ContactForm leadId={lead.id} /> : null}
      </SectionCard>

      {canManage ? (
        <SectionCard title="Online presence research" delay="0.22s">
          <ResearchForm leadId={lead.id} hasBeenResearched={lead.lastEnrichedAt !== null} />
        </SectionCard>
      ) : null}

      <PresenceSection website={lead.website} websiteAudit={websiteAudit} socialProfiles={socialProfiles} />

      {canManage ? (
        <SectionCard title="Generate AI analysis & outreach" delay="0.26s">
          <AIGenerateForm leadId={lead.id} hasAnalysis={latestAIAnalysis !== null} />
        </SectionCard>
      ) : null}

      <AISection analysis={latestAIAnalysis} isMock={aiProvider.name === "mock"} leadId={lead.id} canQueue={canModify} />

      {outreachHistory.length > 0 ? (
        <SectionCard title="Outreach history">
          <div className="flex flex-col gap-2">
            {outreachHistory.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-[12.5px]">
                <span className="text-(--sub)">
                  {m.channel} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(m.createdAt)}
                </span>
                <span className="font-semibold">{m.status.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Notes & activity">
        {canModify ? (
          <div className="mb-4">
            <NotesForm leadId={lead.id} />
          </div>
        ) : null}
        <div className="flex flex-col">
          {activity.length === 0 ? (
            <p className="text-sm text-(--sub)">No activity yet.</p>
          ) : (
            activity.map((a, i) => (
              <div key={a.id} className="flex gap-3 pb-4.5 last:pb-0">
                <div className="flex flex-none flex-col items-center">
                  <span className="mt-1 h-2 w-2 rounded-full bg-(--accent)" />
                  {i < activity.length - 1 ? <span className="mt-1 w-px flex-1 bg-(--border)" /> : null}
                </div>
                <div className="min-w-0 pb-0.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-(--sub)">
                    <span className="font-bold text-(--ink)">{ACTIVITY_LABELS[a.type] ?? a.type}</span>
                    <span>· {a.user?.name ?? a.user?.email ?? "System"}</span>
                    <span>· {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(a.createdAt)}</span>
                  </div>
                  {a.content ? <p className="mt-0.5 text-[12.5px]">{a.content}</p> : null}
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
