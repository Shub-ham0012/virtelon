"use client";

import { useActionState } from "react";
import { updateLeadStatus, type UpdateStatusState } from "../actions";
import { Button } from "@/components/ui/button";

const STATUSES = [
  "NEW",
  "QUALIFIED",
  "CONTACTED",
  "REPLIED",
  "INTERESTED",
  "NOT_INTERESTED",
  "MEETING",
  "PROPOSAL",
  "WON",
  "LOST",
  "OPTED_OUT",
  "DO_NOT_CONTACT",
] as const;

const initialState: UpdateStatusState = {};

export function StatusForm({ leadId, currentStatus }: { leadId: string; currentStatus: string }) {
  const [state, formAction, pending] = useActionState(updateLeadStatus, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <select name="status" defaultValue={currentStatus} className="input rounded-lg px-3 py-2 text-sm">
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Update status"}
      </Button>
      {state.error ? <span className="text-sm text-(--danger)">{state.error}</span> : null}
    </form>
  );
}
