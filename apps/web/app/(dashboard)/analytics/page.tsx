import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission } from "@virtelon/core/rbac";
import { AreaChart, type AreaChartPoint } from "@/components/charts/area-chart";
import { Histogram, type HistogramBucket } from "@/components/charts/histogram";
import { DonutChart, type DonutSegment } from "@/components/charts/donut-chart";
import { AnimatedBar } from "@/components/charts/animated-bar";

const TREND_DAYS = 30;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayLabel(key: string): string {
  return new Date(key).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const SCORE_BUCKETS = [
  { label: "0–20", min: 0, max: 20, color: "var(--border)" },
  { label: "21–40", min: 21, max: 40, color: "var(--border)" },
  { label: "41–60", min: 41, max: 60, color: "var(--teal-soft)" },
  { label: "61–80", min: 61, max: 80, color: "var(--accent)" },
  { label: "81–100", min: 81, max: 100, color: "var(--success)" },
];

export default async function AnalyticsPage() {
  const user = await requireSession();
  if (!hasPermission(user.role, "analytics:view")) notFound();

  const db = tenantDb(user);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const trendStart = new Date(todayStart);
  trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));

  const [
    totalLeads,
    trendLeads,
    scoreBucketCounts,
    websiteGroups,
    categoryGroups,
    cityGroups,
    campaigns,
  ] = await Promise.all([
    db.lead.count({}),
    db.lead.findMany({ where: { discoveredAt: { gte: trendStart } }, select: { discoveredAt: true } }),
    Promise.all(SCORE_BUCKETS.map((b) => db.lead.count({ where: { leadScore: { gte: b.min, lte: b.max } } }))),
    db.lead.groupBy({ by: ["websiteStatus"], _count: { _all: true } }),
    db.lead.groupBy({ by: ["category"], _count: { _all: true }, orderBy: { _count: { category: "desc" } }, take: 7 }),
    db.lead.groupBy({
      by: ["city"],
      where: { city: { not: null } },
      _count: { _all: true },
      _avg: { leadScore: true },
      orderBy: { _count: { city: "desc" } },
      take: 6,
    }),
    db.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { campaignLeads: { include: { lead: { select: { status: true, lastContactedAt: true } } } } },
    }),
  ]);

  const dailyCounts = new Map<string, number>();
  for (let i = 0; i < TREND_DAYS; i++) {
    const d = new Date(trendStart);
    d.setDate(d.getDate() + i);
    dailyCounts.set(dayKey(d), 0);
  }
  for (const lead of trendLeads) {
    const key = dayKey(lead.discoveredAt);
    if (dailyCounts.has(key)) dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
  }
  const trendData: AreaChartPoint[] = Array.from(dailyCounts.entries()).map(([key, value]) => ({
    value,
    label: dayLabel(key),
  }));

  const histogramBuckets: HistogramBucket[] = SCORE_BUCKETS.map((b, i) => ({
    label: b.label,
    value: scoreBucketCounts[i] ?? 0,
    color: b.color,
  }));

  const websiteCounts = { PRESENT: 0, UNREACHABLE: 0, MISSING: 0, UNKNOWN: 0 };
  for (const g of websiteGroups) websiteCounts[g.websiteStatus] = g._count._all;
  const noWebsite = websiteCounts.MISSING + websiteCounts.UNKNOWN;
  const websiteSegments: DonutSegment[] = [
    { label: "No website — opportunity", value: noWebsite, color: "var(--accent)" },
    { label: "Has website", value: websiteCounts.PRESENT, color: "var(--success)" },
    { label: "Unreachable", value: websiteCounts.UNREACHABLE, color: "var(--danger)" },
  ].filter((s) => s.value > 0);

  const maxCategory = Math.max(...categoryGroups.map((c) => c._count._all), 1);

  const campaignStats = campaigns.map((c) => {
    const found = c.campaignLeads.length;
    const contacted = c.campaignLeads.filter((cl) => cl.lead.lastContactedAt !== null).length;
    const won = c.campaignLeads.filter((cl) => cl.lead.status === "WON").length;
    return { name: c.name, found, contacted, won };
  });
  const maxFound = Math.max(...campaignStats.map((c) => c.found), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl font-medium">Analytics</h1>
        <p className="mt-1 text-[12.5px] text-(--sub)">How discovery, scoring, and outreach are trending</p>
      </div>

      {totalLeads === 0 ? (
        <div className="card p-6 text-sm text-(--sub)">No leads yet — analytics will fill in once you start discovering.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div className="card reveal p-5 md:col-span-2">
            <div className="mb-3.5 flex items-center justify-between">
              <h3 className="text-[13px] font-bold">Leads discovered</h3>
              <span className="rounded-full border border-(--border) bg-(--surface-2) px-2.5 py-1 text-[10.5px] font-semibold text-(--sub)">
                Last {TREND_DAYS} days · hover to inspect
              </span>
            </div>
            <AreaChart data={trendData} color="var(--teal)" />
          </div>

          <div className="card reveal p-5" style={{ "--reveal-delay": "0.06s" } as React.CSSProperties}>
            <h3 className="mb-3.5 text-[13px] font-bold">Lead score distribution</h3>
            <Histogram buckets={histogramBuckets} />
          </div>

          <div className="card reveal p-5" style={{ "--reveal-delay": "0.12s" } as React.CSSProperties}>
            <h3 className="mb-3.5 text-[13px] font-bold">Website presence</h3>
            {websiteSegments.length === 0 ? (
              <p className="text-sm text-(--sub)">No leads researched yet.</p>
            ) : (
              <div className="flex items-center gap-4.5">
                <DonutChart segments={websiteSegments} centerValue={totalLeads.toLocaleString("en-IN")} centerLabel="leads" />
                <div className="flex flex-1 flex-col gap-2.5">
                  {websiteSegments.map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: s.color }} />
                      <span className="flex-1 text-(--sub)">{s.label}</span>
                      <span className="font-mono-data font-bold">{Math.round((s.value / totalLeads) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {campaignStats.length > 0 ? (
            <div className="card reveal p-5 md:col-span-2" style={{ "--reveal-delay": "0.18s" } as React.CSSProperties}>
              <div className="mb-3.5 flex items-center justify-between">
                <h3 className="text-[13px] font-bold">Campaign performance</h3>
                <span className="rounded-full border border-(--border) bg-(--surface-2) px-2.5 py-1 text-[10.5px] font-semibold text-(--sub)">
                  Found → Contacted → Won
                </span>
              </div>
              <div className="flex flex-col gap-4">
                {campaignStats.map((c) => (
                  <div key={c.name} className="flex flex-col gap-1.5">
                    <div className="mb-0.5 text-xs font-bold">{c.name}</div>
                    {[
                      { label: "Found", value: c.found, max: maxFound, color: "var(--sub)" },
                      { label: "Contacted", value: c.contacted, max: Math.max(...campaignStats.map((s) => s.contacted), 1), color: "var(--teal)" },
                      { label: "Won", value: c.won, max: Math.max(...campaignStats.map((s) => s.won), 1), color: "var(--success)" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-2">
                        <div className="w-16 flex-none text-[10.5px] text-(--sub)">{row.label}</div>
                        <AnimatedBar percent={(row.value / row.max) * 100} color={row.color} height={10} />
                        <div className="w-8.5 flex-none text-right font-mono-data text-[11px] font-bold">{row.value}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {categoryGroups.length > 0 ? (
            <div className="card reveal p-5" style={{ "--reveal-delay": "0.24s" } as React.CSSProperties}>
              <h3 className="mb-3.5 text-[13px] font-bold">Top categories</h3>
              <ol className="flex flex-col gap-2.5">
                {categoryGroups.map((c, i) => (
                  <li key={c.category} className="grid grid-cols-[20px_1fr_auto] items-center gap-2.5">
                    <span className="text-[10px] font-bold text-(--sub)">{String(i + 1).padStart(2, "0")}</span>
                    <div className="flex flex-col gap-1">
                      <div className="text-xs font-semibold">{c.category}</div>
                      <AnimatedBar percent={(c._count._all / maxCategory) * 100} color="linear-gradient(90deg, var(--accent-soft), var(--accent))" height={5} />
                    </div>
                    <span className="font-mono-data text-xs font-bold">{c._count._all}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {cityGroups.length > 0 ? (
            <div className="card reveal p-5" style={{ "--reveal-delay": "0.3s" } as React.CSSProperties}>
              <h3 className="mb-3.5 text-[13px] font-bold">By city</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-(--border) text-left text-[10px] tracking-wide text-(--sub) uppercase">
                    <th className="pb-2 font-semibold">City</th>
                    <th className="pb-2 text-right font-semibold">Leads</th>
                    <th className="pb-2 text-right font-semibold">Avg score</th>
                  </tr>
                </thead>
                <tbody>
                  {cityGroups.map((c) => {
                    const avg = Math.round(c._avg.leadScore ?? 0);
                    return (
                      <tr key={c.city} className="border-b border-(--border) last:border-0">
                        <td className="py-2.5">{c.city}</td>
                        <td className="py-2.5 text-right font-mono-data">{c._count._all}</td>
                        <td className="py-2.5 text-right">
                          <span
                            className={`inline-flex min-w-[34px] items-center justify-center rounded-md px-1.5 py-0.5 font-mono-data font-bold ${
                              avg >= 75 ? "bg-(--success-fill) text-(--success)" : avg >= 50 ? "bg-(--accent-fill) text-(--accent)" : "bg-(--surface-2) text-(--sub)"
                            }`}
                          >
                            {avg}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
