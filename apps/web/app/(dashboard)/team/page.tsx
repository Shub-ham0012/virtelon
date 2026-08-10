import { requireSession } from "@/lib/session";
import { tenantDb } from "@/lib/tenant-db";
import { hasPermission, ROLE_LABELS } from "@virtelon/core/rbac";
import { Pill } from "@/components/ui/pill";
import { InviteForm } from "./invite-form";

function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

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
        <h1 className="font-serif-display text-2xl font-medium">Team</h1>
        <p className="mt-1 text-[12.5px] text-(--sub)">
          {memberships.length} member{memberships.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="card reveal divide-y divide-(--border)">
        {memberships.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4.5 py-3.5">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-(--accent-fill) text-[11px] font-bold text-(--accent)">
              {initials(m.user.name, m.user.email)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{m.user.name ?? m.user.email}</div>
              <div className="truncate text-[11.5px] text-(--sub)">{m.user.email}</div>
            </div>
            <div className="flex flex-none flex-col items-end gap-1">
              <Pill tone="accent">{ROLE_LABELS[m.role]}</Pill>
              <span className="text-[10.5px] text-(--sub)">{m.joinedAt ? "Active" : "Invite pending"}</span>
            </div>
          </div>
        ))}
      </div>

      {canInvite ? (
        <div className="card reveal p-5">
          <h2 className="mb-4 text-[13px] font-bold">Invite a teammate</h2>
          <InviteForm currentUserRole={user.role} />
        </div>
      ) : null}
    </div>
  );
}
