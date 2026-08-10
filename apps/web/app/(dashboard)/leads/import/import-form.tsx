"use client";

import { useActionState } from "react";
import { importCsv, type ImportCsvState } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initialState: ImportCsvState = {};

export function ImportForm() {
  const [state, formAction, pending] = useActionState(importCsv, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="file">CSV file</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="input block w-full rounded-lg px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-(--sub)">
          Required columns: <code>businessName</code>, <code>category</code>. Optional: <code>phone</code>,{" "}
          <code>website</code>, <code>address</code>, <code>city</code>, <code>state</code>, <code>country</code>,{" "}
          <code>rating</code>.
        </p>
      </div>

      {state.error ? <p className="text-sm text-(--danger)">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-(--sub)">
          Processed {state.totalRows} row(s): {state.imported} imported, {state.duplicates} already known,{" "}
          {state.errorCount} had errors.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Importing…" : "Import"}
      </Button>
    </form>
  );
}
