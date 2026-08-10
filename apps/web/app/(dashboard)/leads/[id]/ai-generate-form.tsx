"use client";

import { useActionState } from "react";
import { generateAIAction, type GenerateAIState } from "../actions";
import { Button } from "@/components/ui/button";

const initialState: GenerateAIState = {};

const TONES = ["professional", "friendly", "concise", "formal", "hinglish"] as const;
const LANGUAGES = ["en", "hi", "hinglish"] as const;

export function AIGenerateForm({ leadId, hasAnalysis }: { leadId: string; hasAnalysis: boolean }) {
  const [state, formAction, pending] = useActionState(generateAIAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-(--sub)" htmlFor="tone">
            Tone
          </label>
          <select id="tone" name="tone" defaultValue="professional" className="input rounded-lg px-3 py-2 text-sm">
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-(--sub)" htmlFor="language">
            Language
          </label>
          <select id="language" name="language" defaultValue="en" className="input rounded-lg px-3 py-2 text-sm">
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Generating…" : hasAnalysis ? "Regenerate" : "Generate AI analysis & message"}
        </Button>
      </div>
      {state.error ? <p className="text-sm text-(--danger)">{state.error}</p> : null}
    </form>
  );
}
