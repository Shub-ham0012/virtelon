import Link from "next/link";
import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission } from "@virtelon/core/rbac";
import { ImportForm } from "./import-form";

export default async function LeadImportPage() {
  const user = await requireSession();

  if (!hasPermission(user.role, "lead:manage")) {
    return <p className="text-sm text-(--danger)">You don't have permission to import leads.</p>;
  }

  const db = tenantDb(user);
  const batches = await db.leadImportBatch.findMany({ orderBy: { createdAt: "desc" }, take: 20 });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/leads" className="text-sm text-(--accent)">
          ← Back to leads
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Import leads from CSV</h1>
      </div>

      <div className="card p-6">
        <ImportForm />
      </div>

      {batches.length > 0 ? (
        <div className="card divide-y divide-(--border)">
          {batches.map((batch) => (
            <div key={batch.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <div className="font-medium">{batch.fileName ?? "Untitled import"}</div>
                <div className="text-xs text-(--sub)">
                  {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(batch.createdAt)}
                </div>
              </div>
              <div className="text-right text-xs text-(--sub)">
                <div>{batch.status}</div>
                <div>
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
