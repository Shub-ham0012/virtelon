import Link from "next/link";
import { OfferingForm } from "../offering-form";
import { createOffering } from "../actions";

export default function NewOfferingPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/settings/offerings" className="text-[12px] text-(--sub) transition-colors hover:text-(--accent)">
          ← Back to services
        </Link>
        <h1 className="mt-2 font-serif-display text-2xl font-medium">New service</h1>
      </div>
      <div className="card reveal p-5">
        <OfferingForm action={createOffering} submitLabel="Create service" />
      </div>
    </div>
  );
}
