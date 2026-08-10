import Link from "next/link";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission } from "@virtelon/core/rbac";
import { listServiceOfferings } from "@virtelon/core/offerings";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { toggleOfferingActiveAction } from "./actions";

export default async function OfferingsPage() {
  const user = await requireSession();
  const canManage = hasPermission(user.role, "settings:manage");
  const db = tenantDb(user);
  const offerings = await listServiceOfferings(db);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl font-medium">Services</h1>
          <p className="mt-1 text-[12.5px] text-(--sub)">
            What you sell — the AI uses this catalog to decide what to pitch to each lead, and why.
          </p>
        </div>
        {canManage ? (
          <Link href="/settings/offerings/new">
            <Button variant="primary">New service</Button>
          </Link>
        ) : null}
      </div>

      {offerings.length === 0 ? (
        <div className="card p-6 text-sm text-(--sub)">
          No services configured yet — AI analysis still works, but won&apos;t recommend a specific service until you add
          one.
        </div>
      ) : (
        <div className="card reveal divide-y divide-(--border)">
          {offerings.map((o) => (
            <div key={o.id} className="flex items-start justify-between gap-4 p-4.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/settings/offerings/${o.id}`} className="text-[13px] font-semibold text-(--accent)">
                    {o.name}
                  </Link>
                  {!o.isActive ? <Pill tone="danger">Inactive</Pill> : <Pill tone="success">Active</Pill>}
                </div>
                <p className="mt-0.5 text-[12.5px] text-(--sub)">{o.description}</p>
              </div>
              {canManage ? (
                <form action={toggleOfferingActiveAction} className="flex-none">
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="isActive" value={String(o.isActive)} />
                  <Button type="submit" variant="secondary" className="text-xs">
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
