import Link from "next/link";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission } from "@virtelon/core/rbac";
import { Pill } from "@/components/ui/pill";
import { ImportForm } from "./import-form";

const BATCH_STATUS_TONE = { PENDING: "sub", PROCESSING: "accent", COMPLETED: "success", FAILED: "danger" } as const;

export default async function LeadImportPage() {
  const user = await requireSession();

  if (!hasPermission(user.role, "lead:manage")) {
    return <p className="text-sm text-(--danger)">You don&apos;t have permission to import leads.</p>;
  }

  const db = tenantDb(user);
  const batches = await db.leadImportBatch.findMany({ orderBy: { createdAt: "desc" }, take: 20 });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/leads" className="text-[12px] text-(--sub) transition-colors hover:text-(--accent)">
          ← Back to leads
        </Link>
        <h1 className="mt-2 font-serif-display text-2xl font-medium">Import leads from CSV</h1>
      </div>

      <div className="card reveal p-5">
        <ImportForm />
      </div>

      {batches.length > 0 ? (
        <div className="card reveal divide-y divide-(--border)" style={{ "--reveal-delay": "0.08s" } as React.CSSProperties}>
          {batches.map((batch) => (
            <div key={batch.id} className="flex items-center justify-between gap-3 px-4.5 py-3.5 text-[12.5px]">
              <div>
                <div className="font-semibold">{batch.fileName ?? "Untitled import"}</div>
                <div className="mt-0.5 font-mono-data text-[11px] text-(--sub)">
                  {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(batch.createdAt)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Pill tone={BATCH_STATUS_TONE[batch.status] ?? "sub"}>{batch.status}</Pill>
                <div className="text-[11px] text-(--sub)">
                  {batch.importedCount} imported · {batch.duplicateCount} duplicate · {batch.errorCount} errors
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
