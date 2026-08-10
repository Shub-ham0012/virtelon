import Link from "next/link";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission } from "@virtelon/core/rbac";
import { listCampaigns } from "@virtelon/core/campaigns";
import { Button } from "@/components/ui/button";

export default async function CampaignsPage() {
  const user = await requireSession();
  const canCreate = hasPermission(user.role, "campaign:create");
  const db = tenantDb(user);
  const campaigns = await listCampaigns(db);

  const leadCounts = await Promise.all(campaigns.map((c) => db.campaignLead.count({ where: { campaignId: c.id } })));

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Campaigns</h1>
          <p className="text-sm text-(--sub)">{campaigns.length} campaign(s)</p>
        </div>
        {canCreate ? (
          <Link href="/campaigns/new">
            <Button>New campaign</Button>
          </Link>
        ) : null}
      </div>

      {campaigns.length === 0 ? (
        <div className="card p-4 text-sm text-(--sub)">
          No campaigns yet. A campaign groups leads by category + location and its own daily target — create one to
          start organizing your discovery.
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c, i) => (
            <Link key={c.id} href={`/campaigns/${c.id}`} className="card block p-4 hover:bg-(--bg)">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-(--sub)">
                    {c.category} · {c.location} · {leadCounts[i]} lead(s)
                  </div>
                </div>
                <div className="text-right text-xs text-(--sub)">
                  <div>{c.mode.replace(/_/g, " ")}</div>
                  <div>{c.isActive ? "Active" : "Paused"}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
