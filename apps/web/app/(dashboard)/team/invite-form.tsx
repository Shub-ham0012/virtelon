"use client";

import { useActionState, useState } from "react";
import { inviteTeamMember, type InviteState } from "./actions";
import { canManageRole, ROLE_HIERARCHY, ROLE_LABELS } from "@virtelon/core/rbac";
import type { Role } from "@virtelon/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: InviteState = {};

export function InviteForm({ currentUserRole }: { currentUserRole: Role }) {
  const [state, formAction, pending] = useActionState(inviteTeamMember, initialState);
  const assignableRoles = ROLE_HIERARCHY.filter((role) => canManageRole(currentUserRole, role));
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="teammate@company.com" required />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            name="role"
            className="input w-full rounded-lg px-3 py-2 text-sm"
            defaultValue={assignableRoles[assignableRoles.length - 1]}
          >
            {assignableRoles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        {state.error ? <p className="text-sm text-(--danger)">{state.error}</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Inviting…" : "Send invite"}
        </Button>
      </form>

      {state.inviteUrl ? (
        <div className="rounded-lg border border-(--border) bg-(--bg) p-3 text-sm">
          <p className="mb-2 text-(--sub)">
            No email provider is connected yet (that ships in a later phase) — share this link with your teammate
            directly:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate text-xs">{state.inviteUrl}</code>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(state.inviteUrl!);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
