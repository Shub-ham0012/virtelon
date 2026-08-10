"use client";

import { useActionState } from "react";
import { addNoteAction, type NoteState } from "../actions";
import { Button } from "@/components/ui/button";

const initialState: NoteState = {};

export function NotesForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(addNoteAction, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <textarea
        name="content"
        rows={2}
        placeholder="Add a note…"
        required
        className="input w-full rounded-lg px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Add note"}
        </Button>
        {state.error ? <span className="text-sm text-(--danger)">{state.error}</span> : null}
      </div>
    </form>
  );
}
