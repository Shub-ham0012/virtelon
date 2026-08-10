"use client";

import { useActionState } from "react";
import { assignLeadAction, type AssignState } from "../actions";
import { Button } from "@/components/ui/button";

const initialState: AssignState = {};

export function AssignForm({
  leadId,
  members,
  currentAssigneeId,
}: {
  leadId: string;
  members: { userId: string; name: string | null; email: string }[];
  currentAssigneeId: string | null;
}) {
  const [state, formAction, pending] = useActionState(assignLeadAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <select name="assigneeUserId" defaultValue={currentAssigneeId ?? ""} className="input rounded-lg px-3 py-2 text-sm">
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name ?? m.email}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Assign"}
      </Button>
      {state.error ? <span className="text-sm text-(--danger)">{state.error}</span> : null}
    </form>
  );
}
