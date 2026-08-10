import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";

export default async function DashboardPage() {
  const user = await requireSession();
  const db = tenantDb(user);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totalLeads, todaysLeads, highPriorityLeads, withWebsite] = await Promise.all([
    db.lead.count({}),
    db.lead.count({ where: { discoveredAt: { gte: todayStart } } }),
    db.lead.count({ where: { leadScore: { gte: 75 } } }),
    db.lead.count({ where: { website: { not: null } } }),
  ]);

  const metrics = [
    { label: "Total leads", value: totalLeads },
    { label: "Discovered today", value: todaysLeads },
    { label: "High priority (75+)", value: highPriorityLeads },
    { label: "Have a website", value: totalLeads > 0 ? `${withWebsite}/${totalLeads}` : "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Welcome, {user.name ?? user.email}</h1>
        <p className="text-sm text-(--sub)">
          Every lead you discover or import is automatically checked (website + online presence) and scored —
          AI-written outreach messages land in the next phase.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="card p-4">
            <div className="text-xs text-(--sub)">{metric.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{metric.value}</div>
          </div>
        ))}
      </div>

      {totalLeads === 0 ? (
        <div className="card p-4 text-sm text-(--sub)">
          No leads yet — head to the Leads page to run a discovery search or import a CSV.
        </div>
      ) : null}
    </div>
  );
}
