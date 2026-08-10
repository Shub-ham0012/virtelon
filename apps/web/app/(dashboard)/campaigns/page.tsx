import Link from "next/link";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission } from "@virtelon/core/rbac";
import { listCampaigns } from "@virtelon/core/campaigns";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { AnimatedBar } from "@/components/charts/animated-bar";

const MODE_TONE = { AUTOMATED: "teal", APPROVAL_REQUIRED: "accent", MANUAL: "sub" } as const;

export default async function CampaignsPage() {
  const user = await requireSession();
  const canCreate = hasPermission(user.role, "campaign:create");
  const db = tenantDb(user);
  const campaigns = await listCampaigns(db);

  const leadCounts = await Promise.all(campaigns.map((c) => db.campaignLead.count({ where: { campaignId: c.id } })));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl font-medium">Campaigns</h1>
          <p className="mt-1 text-[12.5px] text-(--sub)">
            {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"} · grouped discovery, scoring, and outreach
          </p>
        </div>
        {canCreate ? (
          <Link href="/campaigns/new">
            <Button variant="primary">New campaign</Button>
          </Link>
        ) : null}
      </div>

      {campaigns.length === 0 ? (
        <div className="card p-6 text-sm text-(--sub)">
          No campaigns yet. A campaign groups leads by category + location and its own daily target — create one to
          start organizing your discovery.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {campaigns.map((c, i) => {
            const count = leadCounts[i] ?? 0;
            const progress = c.dailyLeadTarget > 0 ? Math.min(100, Math.round((count / c.dailyLeadTarget) * 100)) : 0;
            return (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="card card-hover reveal flex flex-col gap-3 p-5"
                style={{ "--reveal-delay": `${i * 0.06}s` } as React.CSSProperties}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div>
                    <div className="text-[14.5px] font-bold">{c.name}</div>
                    <div className="mt-0.5 text-[11.5px] text-(--sub)">
                      {c.category} · {c.location}
                    </div>
                  </div>
                  <Pill tone={MODE_TONE[c.mode]}>{c.mode.replace(/_/g, " ")}</Pill>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] text-(--sub)">
                    <span>
                      {count} of {c.dailyLeadTarget} target
                    </span>
                    <span className="font-mono-data">{progress}%</span>
                  </div>
                  <AnimatedBar percent={progress} color="linear-gradient(90deg, var(--teal-soft), var(--teal))" height={6} />
                </div>
                <div className="flex items-center justify-between border-t border-(--border) pt-2.5">
                  <span className="text-[11px] text-(--sub)">{c.isActive ? "Active" : "Paused"}</span>
                  <Pill tone="sub">{count} leads</Pill>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
