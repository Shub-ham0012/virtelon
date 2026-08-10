"use client";

import { useActionState } from "react";
import { researchLeadAction, type ResearchState } from "../actions";
import { Button } from "@/components/ui/button";

const initialState: ResearchState = {};

export function ResearchForm({ leadId, hasBeenResearched }: { leadId: string; hasBeenResearched: boolean }) {
  const [state, formAction, pending] = useActionState(researchLeadAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Researching…" : hasBeenResearched ? "Research again" : "Research this lead"}
      </Button>
      {state.error ? <span className="text-sm text-(--danger)">{state.error}</span> : null}
      {state.success ? <span className="text-sm text-(--sub)">Done — results below are up to date.</span> : null}
    </form>
  );
}
