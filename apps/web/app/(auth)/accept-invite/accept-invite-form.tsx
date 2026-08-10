"use client";

import { useActionState } from "react";
import { acceptInvite, type AcceptInviteState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AcceptInviteState = {};

export function AcceptInviteForm({
  token,
  organizationName,
  role,
}: {
  token: string;
  organizationName: string;
  role: string;
}) {
  const [state, formAction, pending] = useActionState(acceptInvite, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="font-serif-display text-xl font-medium">Join {organizationName}</h1>
      <p className="text-sm text-(--sub)">You've been invited as {role.toLowerCase()}.</p>

      <input type="hidden" name="token" value={token} />

      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" placeholder="Jane Doe" required />
      </div>
      <div>
        <Label htmlFor="password">Set a password</Label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>

      {state.error ? <p className="text-sm text-(--danger)">{state.error}</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Joining…" : "Join organization"}
      </Button>
    </form>
  );
}
