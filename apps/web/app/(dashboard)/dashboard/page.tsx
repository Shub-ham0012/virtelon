import Link from "next/link";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { CountUp } from "@/components/charts/count-up";
import { Sparkline } from "@/components/charts/sparkline";
import { Funnel } from "@/components/charts/funnel";
import { AnimatedBar } from "@/components/charts/animated-bar";
import { Button } from "@/components/ui/button";

const SPARKLINE_DAYS = 13;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const user = await requireSession();
  const db = tenantDb(user);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sparklineStart = new Date(todayStart);
  sparklineStart.setDate(sparklineStart.getDate() - (SPARKLINE_DAYS - 1));

  const [
    totalLeads,
    todaysLeads,
    highPriorityLeads,
    withWebsite,
    pendingOutreach,
    sentToday,
    researched,
    scored70,
    contacted,
    replied,
    won,
    hotUncontacted,
    doNotContactCount,
    recentLeads,
  ] = await Promise.all([
    db.lead.count({}),
    db.lead.count({ where: { discoveredAt: { gte: todayStart } } }),
    db.lead.count({ where: { leadScore: { gte: 75 } } }),
    db.lead.count({ where: { website: { not: null } } }),
    db.outreachMessage.count({ where: { status: { in: ["PENDING_APPROVAL", "QUEUED"] } } }),
    db.outreachMessage.count({ where: { status: "SENT", sentAt: { gte: todayStart } } }),
    db.lead.count({ where: { lastEnrichedAt: { not: null } } }),
    db.lead.count({ where: { leadScore: { gte: 70 } } }),
    db.lead.count({ where: { lastContactedAt: { not: null } } }),
    db.lead.count({ where: { status: { in: ["REPLIED", "INTERESTED", "MEETING", "PROPOSAL", "WON"] } } }),
    db.lead.count({ where: { status: "WON" } }),
    db.lead.findMany({
      where: { leadScore: { gte: 85 }, lastContactedAt: null },
      orderBy: { leadScore: "desc" },
      take: 3,
      select: { businessName: true, city: true },
    }),
    db.lead.count({ where: { status: { in: ["DO_NOT_CONTACT", "OPTED_OUT"] } } }),
    db.lead.findMany({
      where: { discoveredAt: { gte: sparklineStart } },
      select: { discoveredAt: true },
    }),
  ]);

  const dailyCounts = new Map<string, number>();
  for (let i = 0; i < SPARKLINE_DAYS; i++) {
    const d = new Date(sparklineStart);
    d.setDate(d.getDate() + i);
    dailyCounts.set(dayKey(d), 0);
  }
  for (const lead of recentLeads) {
    const key = dayKey(lead.discoveredAt);
    if (dailyCounts.has(key)) dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
  }
  const sparklineData = Array.from(dailyCounts.values());

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const [leadsThisWeek, leadsPrevWeek] = await Promise.all([
    db.lead.count({ where: { discoveredAt: { gte: sevenDaysAgo } } }),
    db.lead.count({ where: { discoveredAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
  ]);
  const weekDelta = leadsPrevWeek > 0 ? Math.round(((leadsThisWeek - leadsPrevWeek) / leadsPrevWeek) * 100) : null;

  const funnelStages = [
    { name: "Discovered", count: totalLeads },
    { name: "Researched", count: researched },
    { name: "Scored 70+", count: scored70 },
    { name: "Contacted", count: contacted },
    { name: "Replied", count: replied },
    { name: "Won", count: won },
  ];

  const attentionItems = [
    hotUncontacted.length > 0
      ? {
          tone: "danger" as const,
          title: `${hotUncontacted.length} lead${hotUncontacted.length === 1 ? "" : "s"} scored 85+ still uncontacted`,
          meta: hotUncontacted.map((l) => `${l.businessName}${l.city ? `, ${l.city}` : ""}`).join(" · "),
        }
      : null,
    pendingOutreach > 0
      ? {
          tone: "warning" as const,
          title: `${pendingOutreach} outreach message${pendingOutreach === 1 ? "" : "s"} waiting on you`,
          meta: "Drafts and approvals in the outreach queue",
        }
      : null,
    doNotContactCount > 0
      ? {
          tone: "info" as const,
          title: `${doNotContactCount} lead${doNotContactCount === 1 ? "" : "s"} marked Do Not Contact / Opted Out`,
          meta: "Worth reviewing your campaign filters",
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  const waterfallSteps = [
    { label: "Queued", count: pendingOutreach + sentToday, color: "var(--sub)" },
    { label: "Sent today", count: sentToday, color: "var(--teal)" },
    { label: "Replied", count: replied, color: "var(--success)" },
    { label: "Won", count: won, color: "var(--success)" },
  ];
  const waterfallMax = Math.max(...waterfallSteps.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-serif-display text-2xl font-medium">Good to see you, {user.name ?? user.email}</h1>
          <p className="mt-1 text-[12.5px] text-(--sub)">{user.organizationSlug} · updated just now</p>
        </div>
        <Link href="/leads">
          <Button variant="primary">Discover leads</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <div className="card reveal relative flex flex-col gap-2 overflow-hidden p-5" style={{ "--reveal-delay": "0.02s" } as React.CSSProperties}>
          <div className="text-[10.5px] font-semibold tracking-wide text-(--sub) uppercase">Total leads</div>
          <CountUp value={totalLeads} className="font-mono-data text-[42px] leading-none font-medium" />
          {weekDelta !== null ? (
            <div className={`text-xs font-semibold ${weekDelta >= 0 ? "text-(--success)" : "text-(--danger)"}`}>
              {weekDelta >= 0 ? "▲" : "▼"} {Math.abs(weekDelta)}% vs last 7 days
            </div>
          ) : (
            <div className="text-xs text-(--sub)">Just getting started</div>
          )}
          <Sparkline data={sparklineData.length > 1 ? sparklineData : [0, 1]} className="absolute right-3.5 bottom-3.5 opacity-90" />
        </div>
        <div className="card reveal flex flex-col justify-between gap-2 p-4.5" style={{ "--reveal-delay": "0.08s" } as React.CSSProperties}>
          <div className="text-[10.5px] font-semibold tracking-wide text-(--sub) uppercase">Discovered today</div>
          <div className="font-mono-data text-[27px] font-semibold">{todaysLeads}</div>
          <div className="text-[11.5px] text-(--sub)">since midnight</div>
        </div>
        <div className="card reveal flex flex-col justify-between gap-2 p-4.5" style={{ "--reveal-delay": "0.14s" } as React.CSSProperties}>
          <div className="text-[10.5px] font-semibold tracking-wide text-(--sub) uppercase">High priority (75+)</div>
          <div className="font-mono-data text-[27px] font-semibold">{highPriorityLeads}</div>
          <div className="text-[11.5px] text-(--sub)">worth calling first</div>
        </div>
        <div className="card reveal flex flex-col justify-between gap-2 p-4.5" style={{ "--reveal-delay": "0.2s" } as React.CSSProperties}>
          <div className="text-[10.5px] font-semibold tracking-wide text-(--sub) uppercase">Have a website</div>
          <div className="font-mono-data text-[27px] font-semibold">
            {totalLeads > 0 ? Math.round((withWebsite / totalLeads) * 100) : 0}%
          </div>
          <div className="text-[11.5px] text-(--sub)">
            {withWebsite} of {totalLeads} — the rest is your pitch
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3.5 flex items-baseline justify-between">
          <h2 className="font-serif-display text-[19px] font-medium">Pipeline</h2>
          <p className="text-xs text-(--sub)">Where all {totalLeads.toLocaleString("en-IN")} leads stand right now</p>
        </div>
        <Funnel stages={funnelStages} />
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="card reveal p-5" style={{ "--reveal-delay": "0.3s" } as React.CSSProperties}>
          <h3 className="mb-3 text-[13px] font-bold">Needs your attention</h3>
          {attentionItems.length === 0 ? (
            <p className="text-sm text-(--sub)">Nothing urgent — you&apos;re caught up.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {attentionItems.map((item, i) => (
                <li key={i} className="-m-1.5 flex items-start gap-2.5 rounded-md p-1.5 transition-colors hover:bg-(--surface-2)">
                  <span
                    className="mt-0.5 min-h-[30px] w-[3px] flex-none rounded-full"
                    style={{
                      background:
                        item.tone === "danger" ? "var(--danger)" : item.tone === "warning" ? "var(--warning)" : "var(--teal)",
                    }}
                  />
                  <div>
                    <div className="text-[12.5px] font-semibold">{item.title}</div>
                    <div className="text-[11px] text-(--sub)">{item.meta}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card reveal p-5" style={{ "--reveal-delay": "0.36s" } as React.CSSProperties}>
          <h3 className="mb-3 text-[13px] font-bold">Outreach this week</h3>
          <div className="flex flex-col gap-2.5">
            {waterfallSteps.map((step) => (
              <div key={step.label} className="flex items-center gap-2.5">
                <div className="w-[66px] flex-none text-[11px] text-(--sub)">{step.label}</div>
                <AnimatedBar percent={(step.count / waterfallMax) * 100} color={step.color} height={16} />
                <div className="w-[30px] flex-none text-right font-mono-data text-xs font-bold">{step.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {totalLeads === 0 ? (
        <div className="card p-4 text-sm text-(--sub)">
          No leads yet — head to the Leads page to run a discovery search or import a CSV.
        </div>
      ) : null}
    </div>
  );
}
