import Link from "next/link";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission } from "@virtelon/core/rbac";
import { getLeadDiscoveryProvider } from "@virtelon/core/lead-discovery";
import { ScoreBadge } from "@/components/ui/score-badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Pill } from "@/components/ui/pill";
import { DiscoverForm } from "./discover-form";

const PAGE_SIZE = 50;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const user = await requireSession();
  const db = tenantDb(user);

  const [leads, totalCount] = await Promise.all([
    db.lead.findMany({
      // Most-recently-discovered first — after running a search, the leads
      // it just found must be reachable regardless of score, otherwise a
      // fresh low-scoring batch (no website/social data yet) is silently
      // buried under older higher-scored leads with no way to page to it.
      orderBy: [{ discoveredAt: "desc" }, { leadScore: { sort: "desc", nulls: "last" } }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.lead.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const canManage = hasPermission(user.role, "lead:manage");
  const provider = getLeadDiscoveryProvider();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl font-medium">Leads</h1>
          <p className="mt-1 text-[12.5px] text-(--sub)">
            {totalCount} lead{totalCount === 1 ? "" : "s"} · discovery via {provider.name}
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

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-[12.5px] text-(--sub)">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-3">
            {page > 1 ? (
              <Link href={`/leads?page=${page - 1}`} className="font-semibold text-(--accent)">
                ← Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link href={`/leads?page=${page + 1}`} className="font-semibold text-(--accent)">
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
