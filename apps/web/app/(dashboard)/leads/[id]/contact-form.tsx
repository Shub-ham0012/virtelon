"use client";

import { useActionState } from "react";
import { addContactAction, type AddContactState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: AddContactState = {};

export function ContactForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(addContactAction, initialState);

  return (
    <form action={formAction} className="grid grid-cols-2 gap-2 md:grid-cols-5 md:items-end">
      <input type="hidden" name="leadId" value={leadId} />
      <Input name="name" placeholder="Name" />
      <Input name="role" placeholder="Role (e.g. Owner)" />
      <Input name="phone" placeholder="Phone" />
      <Input name="email" placeholder="Email" />
      <Button type="submit" variant="secondary" disabled={pending} className="whitespace-nowrap">
        {pending ? "Adding…" : "Add contact"}
      </Button>
      {state.error ? <p className="col-span-full text-sm text-(--danger)">{state.error}</p> : null}
    </form>
  );
}
