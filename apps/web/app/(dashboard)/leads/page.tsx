import Link from "next/link";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission } from "@virtelon/core/rbac";
import { getLeadDiscoveryProvider } from "@virtelon/core/lead-discovery";
import { ScoreBadge } from "@/components/ui/score-badge";
import { DiscoverForm } from "./discover-form";

const STATUS_STYLES: Record<string, string> = {
  NEW: "text-(--sub)",
  QUALIFIED: "text-(--accent)",
  WON: "text-green-600 dark:text-green-400",
  LOST: "text-(--danger)",
  DO_NOT_CONTACT: "text-(--danger)",
  OPTED_OUT: "text-(--danger)",
};

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="text-sm text-(--sub)">{leads.length} lead(s)</p>
        </div>
        {canManage ? (
          <Link href="/leads/import" className="text-sm text-(--accent)">
            Import from CSV →
          </Link>
        ) : null}
      </div>

      {canManage ? <DiscoverForm providerName={provider.name} /> : null}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--border) text-left text-xs uppercase tracking-wide text-(--sub)">
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Website</th>
              <th className="px-4 py-3">Social</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Discovered</th>
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
                <td className="px-4 py-3 text-(--sub)">{lead.category}</td>
                <td className="px-4 py-3 text-(--sub)">{lead.city ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{lead.rating ?? "—"}</td>
                <td className="px-4 py-3">{lead.website ? "Yes" : "Missing"}</td>
                <td className="px-4 py-3 text-(--sub)">
                  {(() => {
                    const count = Object.keys((lead.socialProfiles as object | null) ?? {}).length;
                    return count > 0 ? `${count} found` : lead.lastEnrichedAt ? "None found" : "—";
                  })()}
                </td>
                <td className={`px-4 py-3 ${STATUS_STYLES[lead.status] ?? ""}`}>{lead.status}</td>
                <td className="px-4 py-3 text-(--sub)">
                  {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(lead.discoveredAt)}
                </td>
              </tr>
            ))}
            {leads.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-(--sub)">
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
