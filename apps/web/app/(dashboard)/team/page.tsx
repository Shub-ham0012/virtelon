import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission, ROLE_LABELS } from "@virtelon/core/rbac";
import { InviteForm } from "./invite-form";

export default async function TeamPage() {
  const user = await requireSession();
  const db = tenantDb(user);
  const memberships = await db.membership.findMany({
    where: {},
    include: { user: true },
    orderBy: { invitedAt: "asc" },
  });

  const canInvite = hasPermission(user.role, "team:invite");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Team</h1>
        <p className="text-sm text-(--sub)">{memberships.length} member(s)</p>
      </div>

      <div className="card divide-y divide-(--border)">
        {memberships.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-medium">{m.user.name ?? m.user.email}</div>
              <div className="text-xs text-(--sub)">{m.user.email}</div>
            </div>
            <div className="text-right">
              <div className="text-sm">{ROLE_LABELS[m.role]}</div>
              <div className="text-xs text-(--sub)">{m.joinedAt ? "Active" : "Invite pending"}</div>
            </div>
          </div>
        ))}
      </div>

      {canInvite ? (
        <div className="card p-6">
          <h2 className="mb-4 text-sm font-semibold">Invite a teammate</h2>
          <InviteForm currentUserRole={user.role} />
        </div>
      ) : null}
    </div>
  );
}
