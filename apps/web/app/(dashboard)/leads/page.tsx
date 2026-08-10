import Link from "next/link";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission } from "@virtelon/core/rbac";
import { getLeadDiscoveryProvider } from "@virtelon/core/lead-discovery";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Pill } from "@/components/ui/pill";
import { DiscoverForm } from "./discover-form";

export default async function LeadsPage() {
  const user = await requireSession();
  const db = tenantDb(user);

  const leads = await db.lead.findMany({
    orderBy: [{ leadScore: { sort: "desc", nulls: "last" } }, { discoveredAt: "desc" }],
    take: 100,
  });

  const canManage = hasPermission(user.role, "lead:manage");
  const provider = getLeadDiscoveryProvider();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl font-medium">Leads</h1>
          <p className="mt-1 text-[12.5px] text-(--sub)">
            {leads.length} lead{leads.length === 1 ? "" : "s"} · discovery via {provider.name}
          </p>
        </div>
        {canManage ? (
          <Link href="/leads/import" className="text-[12.5px] font-semibold text-(--accent)">
            Import from CSV →
          </Link>
        ) : null}
      </div>

      {canManage ? <DiscoverForm providerName={provider.name} /> : null}

      <div className="card overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-(--border) text-left text-[10px] font-bold tracking-wide text-(--sub) uppercase">
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Website</th>
              <th className="px-4 py-3">Social</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Discovered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--border)">
            {leads.map((lead) => {
              const socialCount = Object.keys((lead.socialProfiles as object | null) ?? {}).length;
              return (
                <tr key={lead.id} className="transition-colors hover:bg-(--surface-2)">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-semibold text-(--accent)">
                      {lead.businessName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={lead.leadScore} />
                  </td>
                  <td className="px-4 py-3 text-(--sub)">{lead.category}</td>
                  <td className="px-4 py-3 text-(--sub)">{lead.city ?? "—"}</td>
                  <td className="px-4 py-3">
                    {lead.website ? <Pill tone="success">Yes</Pill> : <Pill tone="sub">Missing</Pill>}
                  </td>
                  <td className="px-4 py-3 text-(--sub)">
                    {socialCount > 0 ? `${socialCount} found` : lead.lastEnrichedAt ? "None found" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={lead.status} />
                  </td>
                  <td className="px-4 py-3 font-mono-data text-(--sub)">
                    {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(lead.discoveredAt)}
                  </td>
                </tr>
              );
            })}
            {leads.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-(--sub)">
                  No leads yet — run a discovery search above{canManage ? " or import a CSV" : ""} to get started.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
