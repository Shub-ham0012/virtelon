"use client";

import { useActionState } from "react";
import { createCampaignAction, type CampaignFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryField } from "@/components/category-field";
import { SUPPORTED_CATEGORIES } from "@virtelon/core/lead-discovery/categories";

const initialState: CampaignFormState = {};

export function CampaignForm({
  services,
  providerName,
}: {
  services: { id: string; name: string }[];
  providerName: string;
}) {
  const [state, formAction, pending] = useActionState(createCampaignAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Campaign name</Label>
        <Input id="name" name="name" placeholder="Patna Coaching Website Campaign" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <CategoryField categories={SUPPORTED_CATEGORIES} restrictToKnown={providerName === "openstreetmap"} />
        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" placeholder="Patna, Bihar" required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="serviceId">Service (optional)</Label>
          <select id="serviceId" name="serviceId" className="input w-full rounded-lg px-3 py-2 text-sm" defaultValue="">
            <option value="">None configured</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="serviceLabel">Service label</Label>
          <Input id="serviceLabel" name="serviceLabel" placeholder="Website Development" required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="dailyLeadTarget">Daily lead target</Label>
          <Input id="dailyLeadTarget" name="dailyLeadTarget" type="number" min={1} max={500} defaultValue={20} required />
        </div>
        <div>
          <Label htmlFor="minLeadScore">Minimum lead score</Label>
          <Input id="minLeadScore" name="minLeadScore" type="number" min={0} max={100} defaultValue={70} required />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="messageTone">Tone</Label>
          <select id="messageTone" name="messageTone" defaultValue="professional" className="input w-full rounded-lg px-3 py-2 text-sm">
            {["professional", "friendly", "concise", "formal", "hinglish"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="language">Language</Label>
          <select id="language" name="language" defaultValue="en" className="input w-full rounded-lg px-3 py-2 text-sm">
            {["en", "hi", "hinglish"].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="mode">Mode</Label>
          <select id="mode" name="mode" defaultValue="APPROVAL_REQUIRED" className="input w-full rounded-lg px-3 py-2 text-sm">
            <option value="MANUAL">Manual</option>
            <option value="APPROVAL_REQUIRED">Approval required</option>
            <option value="AUTOMATED">Automated</option>
          </select>
        </div>
      </div>

      {state.error ? <p className="text-sm text-(--danger)">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create campaign"}
      </Button>
    </form>
  );
}
