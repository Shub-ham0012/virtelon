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
        <h1 className="font-serif-display text-2xl font-medium">Organization</h1>
        <p className="mt-1 text-[12.5px] text-(--sub)">
          Slug: {organization.slug} · Plan: {organization.plan}
        </p>
      </div>
      <div className="card reveal p-5">
        <OrganizationForm name={organization.name} timezone={organization.timezone} readOnly={!canEdit} />
      </div>
    </div>
  );
}
