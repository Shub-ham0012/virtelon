import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission } from "@virtelon/core/rbac";
import { OrganizationForm } from "./organization-form";

export default async function OrganizationSettingsPage() {
  const user = await requireSession();
  const db = tenantDb(user);
  const organization = await db.organization.findFirst({
    where: { id: user.organizationId },
  });

  if (!organization) {
    return <p className="text-sm text-(--danger)">Organization not found.</p>;
  }

  const canEdit = hasPermission(user.role, "organization:manage");

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Organization</h1>
        <p className="text-sm text-(--sub)">Slug: {organization.slug} · Plan: {organization.plan}</p>
      </div>
      <div className="card p-6">
        <OrganizationForm name={organization.name} timezone={organization.timezone} readOnly={!canEdit} />
      </div>
    </div>
  );
}
