import Link from "next/link";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission } from "@virtelon/core/rbac";
import { listServiceOfferings } from "@virtelon/core/offerings";
import { Button } from "@/components/ui/button";
import { toggleOfferingActiveAction } from "./actions";

export default async function OfferingsPage() {
  const user = await requireSession();
  const canManage = hasPermission(user.role, "settings:manage");
  const db = tenantDb(user);
  const offerings = await listServiceOfferings(db);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Services</h1>
          <p className="text-sm text-(--sub)">
            What you sell — the AI uses this catalog to decide what to pitch to each lead, and why.
          </p>
        </div>
        {canManage ? (
          <Link href="/settings/offerings/new">
            <Button>New service</Button>
          </Link>
        ) : null}
      </div>

      {offerings.length === 0 ? (
        <div className="card p-4 text-sm text-(--sub)">
          No services configured yet — AI analysis still works, but won't recommend a specific service until you add
          one.
        </div>
      ) : (
        <div className="space-y-3">
          {offerings.map((o) => (
            <div key={o.id} className="card flex items-start justify-between gap-4 p-4">
              <div>
                <Link href={`/settings/offerings/${o.id}`} className="font-medium text-(--accent)">
                  {o.name}
                </Link>
                <p className="text-sm text-(--sub)">{o.description}</p>
                {!o.isActive ? <span className="text-xs text-(--danger)">Inactive — excluded from AI analysis</span> : null}
              </div>
              {canManage ? (
                <form action={toggleOfferingActiveAction}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="isActive" value={String(o.isActive)} />
                  <Button type="submit" variant="secondary">
                    {o.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
