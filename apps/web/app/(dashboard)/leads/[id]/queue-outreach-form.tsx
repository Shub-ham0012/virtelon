"use client";

import { useActionState } from "react";
import { queueOutreachAction, type QueueOutreachState } from "../actions";
import { Button } from "@/components/ui/button";

const initialState: QueueOutreachState = {};

export function QueueOutreachForm({ leadId, content }: { leadId: string; content: string }) {
  const [state, formAction, pending] = useActionState(queueOutreachAction, initialState);

  if (state.success) {
    return <p className="text-sm text-(--sub)">Queued — a manager can approve it on the Outreach page.</p>;
  }

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="content" value={content} />
      <input type="hidden" name="channel" value="whatsapp" />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Queuing…" : "Queue for outreach"}
      </Button>
      {state.error ? <span className="text-sm text-(--danger)">{state.error}</span> : null}
    </form>
  );
}
