import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { OfferingForm } from "../offering-form";
import { updateOffering } from "../actions";

export default async function EditOfferingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSession();
  const db = tenantDb(user);
  const offering = await db.serviceOffering.findUnique({ where: { id } });
  if (!offering) notFound();

  const boundUpdate = updateOffering.bind(null, id);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/settings/offerings" className="text-[12px] text-(--sub) transition-colors hover:text-(--accent)">
          ← Back to services
        </Link>
        <h1 className="mt-2 font-serif-display text-2xl font-medium">{offering.name}</h1>
      </div>
      <div className="card reveal p-5">
        <OfferingForm
          action={boundUpdate}
          defaultValues={{
            name: offering.name,
            description: offering.description,
            targetIndustries: offering.targetIndustries,
            targetBusinessTypes: offering.targetBusinessTypes,
            painPoints: offering.painPoints,
            pitchAngles: offering.pitchAngles,
            portfolioUrls: offering.portfolioUrls,
            idealCustomerProfile: offering.idealCustomerProfile,
            priceRange: offering.priceRange,
          }}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
