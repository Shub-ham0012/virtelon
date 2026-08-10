import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { canAccessLead, canModifyLead, hasPermission } from "@virtelon/core/rbac";
import type { SocialProfilesJson } from "@virtelon/core/presence-research";
import type { ScoreBreakdown } from "@virtelon/core/lead-scoring";
import { getAIProvider } from "@virtelon/core/ai";
import { listActivity, listContacts } from "@virtelon/core/crm";
import { listOutreachForLead } from "@virtelon/core/outreach";
import { ScoreBadge, scoreColorClass } from "@/components/ui/score-badge";
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
};

const SIGNAL_LABELS: Record<string, string> = {
  websiteOpportunity: "Website opportunity",
  businessQuality: "Business quality",
  onlinePresenceOpportunity: "Online presence opportunity",
  categoryFit: "Category fit",
  contactability: "Contactability",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-(--sub)">{label}</div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const db = tenantDb(user);

  const lead = await db.lead.findUnique({ where: { id } });
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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{lead.businessName}</h1>
        <p className="text-sm text-(--sub)">{lead.category}</p>
      </div>

      <div className="card grid grid-cols-2 gap-4 p-6">
        <Field label="Phone" value={lead.phone} />
        <Field label="Email" value={lead.email} />
        <Field
          label="Website"
          value={lead.website ? <a href={lead.website} target="_blank" rel="noreferrer" className="text-(--accent)">{lead.website}</a> : "Missing"}
        />
        <Field label="Rating" value={lead.rating ? `${lead.rating} (${lead.reviewCount ?? 0} reviews)` : undefined} />
        <Field label="Address" value={lead.address} />
        <Field label="City / State" value={[lead.city, lead.state].filter(Boolean).join(", ")} />
        <Field label="Business status" value={lead.businessStatus} />
        <Field
          label="Discovered"
          value={new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(lead.discoveredAt)}
        />
      </div>

      <div className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-(--sub)">Lead score</div>
          <ScoreBadge score={lead.leadScore} size="lg" />
        </div>
        {latestScore ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {Object.entries(latestScore.breakdown as ScoreBreakdown).map(([signal, value]) => (
              <div key={signal} className="flex items-center justify-between">
                <span className="text-(--sub)">{SIGNAL_LABELS[signal] ?? signal}</span>
                <span className={`tabular-nums font-medium ${scoreColorClass(value)}`}>{value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-(--sub)">Not scored yet — discovering or researching this lead computes a score automatically.</p>
        )}
      </div>

      <div className="card p-6">
        <div className="mb-3 text-xs uppercase tracking-wide text-(--sub)">Status</div>
        {canModify ? (
          <StatusForm leadId={lead.id} currentStatus={lead.status} />
        ) : (
          <p className="text-sm">{lead.status.replace(/_/g, " ")}</p>
        )}
      </div>

      {canManage ? (
        <div className="card p-6">
          <div className="mb-3 text-xs uppercase tracking-wide text-(--sub)">Assigned to</div>
          <AssignForm leadId={lead.id} members={members} currentAssigneeId={lead.assignedUserId} />
        </div>
      ) : null}

      <div className="card p-6">
        <div className="mb-3 text-xs uppercase tracking-wide text-(--sub)">Contacts</div>
        <div className="mb-3 space-y-2">
          {contacts.length === 0 ? (
            <p className="text-sm text-(--sub)">No contacts added yet.</p>
          ) : (
            contacts.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{c.name ?? "Unnamed"}</span>
                {c.role ? <span className="text-(--sub)">{c.role}</span> : null}
                {c.phone ? <span className="text-(--sub)">{c.phone}</span> : null}
                {c.email ? <span className="text-(--sub)">{c.email}</span> : null}
              </div>
            ))
          )}
        </div>
        {canModify ? <ContactForm leadId={lead.id} /> : null}
      </div>

      {canManage ? (
        <div className="card p-6">
          <div className="mb-3 text-xs uppercase tracking-wide text-(--sub)">Online presence research</div>
          <ResearchForm leadId={lead.id} hasBeenResearched={lead.lastEnrichedAt !== null} />
        </div>
      ) : null}

      <PresenceSection website={lead.website} websiteAudit={websiteAudit} socialProfiles={socialProfiles} />

      {canManage ? (
        <div className="card p-6">
          <div className="mb-3 text-xs uppercase tracking-wide text-(--sub)">Generate AI analysis &amp; outreach</div>
          <AIGenerateForm leadId={lead.id} hasAnalysis={latestAIAnalysis !== null} />
        </div>
      ) : null}

      <AISection analysis={latestAIAnalysis} isMock={aiProvider.name === "mock"} leadId={lead.id} canQueue={canModify} />

      {outreachHistory.length > 0 ? (
        <div className="card p-6">
          <div className="mb-3 text-xs uppercase tracking-wide text-(--sub)">Outreach history</div>
          <div className="space-y-2">
            {outreachHistory.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-(--sub)">
                  {m.channel} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(m.createdAt)}
                </span>
                <span className="font-medium">{m.status.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card p-6">
        <div className="mb-3 text-xs uppercase tracking-wide text-(--sub)">Notes &amp; activity</div>
        {canModify ? (
          <div className="mb-4">
            <NotesForm leadId={lead.id} />
          </div>
        ) : null}
        <div className="space-y-3">
          {activity.length === 0 ? (
            <p className="text-sm text-(--sub)">No activity yet.</p>
          ) : (
            activity.map((a) => (
              <div key={a.id} className="border-l-2 border-(--border) pl-3 text-sm">
                <div className="flex items-center gap-2 text-xs text-(--sub)">
                  <span className="font-medium text-(--ink)">{ACTIVITY_LABELS[a.type] ?? a.type}</span>
                  <span>{a.user?.name ?? a.user?.email ?? "System"}</span>
                  <span>·</span>
                  <span>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(a.createdAt)}</span>
                </div>
                {a.content ? <p className="mt-1">{a.content}</p> : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
