import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission } from "@virtelon/core/rbac";
import { getCampaign, listCampaignLeads } from "@virtelon/core/campaigns";
import { getLeadDiscoveryProvider } from "@virtelon/core/lead-discovery";
import { ScoreBadge } from "@/components/ui/score-badge";
import { CampaignDiscoverForm } from "./campaign-discover-form";

const STATUS_STYLES: Record<string, string> = {
  NEW: "text-(--sub)",
  QUALIFIED: "text-(--accent)",
  WON: "text-green-600 dark:text-green-400",
  LOST: "text-(--danger)",
  DO_NOT_CONTACT: "text-(--danger)",
  OPTED_OUT: "text-(--danger)",
};

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
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/campaigns" className="text-sm text-(--accent)">
          ← Back to campaigns
        </Link>
        <h1 className="mt-2 text-xl font-semibold">{campaign.name}</h1>
        <p className="text-sm text-(--sub)">
          {campaign.category} · {campaign.location} · {campaign.serviceLabel} · target {campaign.dailyLeadTarget}/day ·
          min score {campaign.minLeadScore}
        </p>
        {campaign.mode === "AUTOMATED" ? (
          <p className="mt-1 text-xs text-(--sub)">
            "Automated" mode runs this campaign's discovery on a schedule via the background worker (defaults to
            9am daily, or the campaign's own cron if set) — as long as the worker process is running. You can still
            click "Discover" below to run it manually any time.
          </p>
        ) : null}
      </div>

      {canManage ? (
        <CampaignDiscoverForm campaignId={campaign.id} defaultLimit={campaign.dailyLeadTarget} providerName={provider.name} />
      ) : null}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--border) text-left text-xs uppercase tracking-wide text-(--sub)">
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Website</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--border)">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-(--bg)">
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="font-medium text-(--accent)">
                    {lead.businessName}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <ScoreBadge score={lead.leadScore} />
                </td>
                <td className="px-4 py-3 text-(--sub)">{lead.city ?? "—"}</td>
                <td className="px-4 py-3">{lead.website ? "Yes" : "Missing"}</td>
                <td className={`px-4 py-3 ${STATUS_STYLES[lead.status] ?? ""}`}>{lead.status}</td>
              </tr>
            ))}
            {leads.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-(--sub)">
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
