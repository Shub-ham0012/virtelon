"use client";

import { useActionState } from "react";
import { updateOrganization, type UpdateOrgState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: UpdateOrgState = {};

export function OrganizationForm({
  name,
  timezone,
  readOnly,
}: {
  name: string;
  timezone: string;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateOrganization, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Organization name</Label>
        <Input id="name" name="name" defaultValue={name} disabled={readOnly} required />
      </div>
      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <Input id="timezone" name="timezone" defaultValue={timezone} disabled={readOnly} required />
      </div>

      {state.error ? <p className="text-sm text-(--danger)">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-(--accent)">Saved.</p> : null}

      {!readOnly ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      ) : (
        <p className="text-xs text-(--sub)">Only Owners and Admins can edit organization settings.</p>
      )}
    </form>
  );
}
