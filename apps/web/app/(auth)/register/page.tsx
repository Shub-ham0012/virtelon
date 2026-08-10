"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerOrganization, type RegisterState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: RegisterState = {};

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerOrganization, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="font-serif-display text-xl font-medium">Create your organization</h1>

      <div>
        <Label htmlFor="organizationName">Organization name</Label>
        <Input id="organizationName" name="organizationName" placeholder="Virtelon" required />
      </div>
      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" placeholder="Jane Doe" required />
      </div>
      <div>
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" placeholder="you@company.com" required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>

      {state.error ? <p className="text-sm text-(--danger)">{state.error}</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create organization"}
      </Button>

      <p className="text-center text-sm text-(--sub)">
        Already have an account?{" "}
        <Link href="/login" className="text-(--accent)">
          Sign in
        </Link>
      </p>
    </form>
  );
}
