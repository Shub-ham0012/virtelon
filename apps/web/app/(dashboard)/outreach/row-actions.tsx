"use client";

import { useActionState } from "react";
import { approveOutreachAction, markSentAction, type ApproveOutreachState, type MarkSentState } from "./actions";
import { Button } from "@/components/ui/button";

const approveInitial: ApproveOutreachState = {};
const sentInitial: MarkSentState = {};

export function ApproveForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(approveOutreachAction, approveInitial);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Approving…" : "Approve"}
      </Button>
      {state.error ? <span className="text-xs text-(--danger)">{state.error}</span> : null}
    </form>
  );
}

export function MarkSentForm({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(markSentAction, sentInitial);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Mark sent"}
      </Button>
      {state.error ? <span className="text-xs text-(--danger)">{state.error}</span> : null}
    </form>
  );
}
