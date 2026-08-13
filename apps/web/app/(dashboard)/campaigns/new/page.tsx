import Link from "next/link";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { listServiceOfferings } from "@virtelon/core/offerings";
import { getLeadDiscoveryProvider } from "@virtelon/core/lead-discovery";
import { CampaignForm } from "../campaign-form";

export default async function NewCampaignPage() {
  const user = await requireSession();
  const db = tenantDb(user);
  const services = await listServiceOfferings(db, { activeOnly: true });
  const provider = getLeadDiscoveryProvider();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/campaigns" className="text-[12px] text-(--sub) transition-colors hover:text-(--accent)">
          ← Back to campaigns
        </Link>
        <h1 className="mt-2 font-serif-display text-2xl font-medium">New campaign</h1>
      </div>
      <div className="card reveal p-5">
        <CampaignForm services={services.map((s) => ({ id: s.id, name: s.name }))} providerName={provider.name} />
      </div>
    </div>
  );
}
