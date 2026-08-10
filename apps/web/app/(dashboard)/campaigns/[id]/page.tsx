import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission } from "@virtelon/core/rbac";
import { getCampaign, listCampaignLeads } from "@virtelon/core/campaigns";
import { getLeadDiscoveryProvider } from "@virtelon/core/lead-discovery";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Pill } from "@/components/ui/pill";
import { CampaignDiscoverForm } from "./campaign-discover-form";

const MODE_TONE = { AUTOMATED: "teal", APPROVAL_REQUIRED: "accent", MANUAL: "sub" } as const;

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const db = tenantDb(user);

  const campaign = await getCampaign(db, id);
  if (!campaign) notFound();

  const leads = await listCampaignLeads(db, campaign.id);
  const canManage = hasPermission(user.role, "lead:manage");
  const provider = getLeadDiscoveryProvider();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/campaigns" className="text-[12px] text-(--sub) transition-colors hover:text-(--accent)">
          ← Back to campaigns
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <h1 className="font-serif-display text-2xl font-medium">{campaign.name}</h1>
          <Pill tone={MODE_TONE[campaign.mode]}>{campaign.mode.replace(/_/g, " ")}</Pill>
        </div>
        <p className="mt-1 text-[12.5px] text-(--sub)">
          {campaign.category} · {campaign.location} · {campaign.serviceLabel} · target {campaign.dailyLeadTarget}/day · min
          score {campaign.minLeadScore}
        </p>
      </div>

      {campaign.mode === "AUTOMATED" ? (
        <div className="card flex items-center gap-2.5 p-3.5">
          <Pill tone="teal">Scheduled</Pill>
          <p className="text-[12px] text-(--sub)">
            Runs automatically via the background worker (defaults to 9am daily, or the campaign&apos;s own cron if set).
            You can still discover manually any time below.
          </p>
        </div>
      ) : null}

      {canManage ? (
        <CampaignDiscoverForm campaignId={campaign.id} defaultLimit={campaign.dailyLeadTarget} providerName={provider.name} />
      ) : null}

      <div className="card overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-(--border) text-left text-[10px] font-bold tracking-wide text-(--sub) uppercase">
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Website</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--border)">
            {leads.map((lead) => (
              <tr key={lead.id} className="transition-colors hover:bg-(--surface-2)">
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="font-semibold text-(--accent)">
                    {lead.businessName}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <ScoreBadge score={lead.leadScore} />
                </td>
                <td className="px-4 py-3 text-(--sub)">{lead.city ?? "—"}</td>
                <td className="px-4 py-3">{lead.website ? <Pill tone="success">Yes</Pill> : <Pill tone="sub">Missing</Pill>}</td>
                <td className="px-4 py-3">
                  <StatusPill status={lead.status} />
                </td>
              </tr>
            ))}
            {leads.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-(--sub)">
                  No leads in this campaign yet — run discovery above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
