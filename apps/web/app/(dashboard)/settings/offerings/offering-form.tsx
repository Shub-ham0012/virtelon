"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OfferingFormState } from "./actions";

const initialState: OfferingFormState = {};

export interface OfferingDefaults {
  name: string;
  description: string;
  targetIndustries: string[];
  targetBusinessTypes: string[];
  painPoints: string[];
  pitchAngles: string[];
  portfolioUrls: string[];
  idealCustomerProfile: string | null;
  priceRange: string | null;
}

export function OfferingForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (prevState: OfferingFormState, formData: FormData) => Promise<OfferingFormState>;
  defaultValues?: OfferingDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={defaultValues?.name} required />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={defaultValues?.description}
          required
          rows={3}
          className="input w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="targetIndustries">Target industries (one per line)</Label>
          <textarea
            id="targetIndustries"
            name="targetIndustries"
            defaultValue={defaultValues?.targetIndustries.join("\n")}
            rows={4}
            placeholder={"coaching\nrestaurant"}
            className="input w-full rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="targetBusinessTypes">Target business types (one per line)</Label>
          <textarea
            id="targetBusinessTypes"
            name="targetBusinessTypes"
            defaultValue={defaultValues?.targetBusinessTypes.join("\n")}
            rows={4}
            className="input w-full rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="painPoints">Pain points this solves (one per line)</Label>
          <textarea
            id="painPoints"
            name="painPoints"
            defaultValue={defaultValues?.painPoints.join("\n")}
            rows={4}
            placeholder={"no website\noutdated design"}
            className="input w-full rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="pitchAngles">Pitch angles (one per line)</Label>
          <textarea
            id="pitchAngles"
            name="pitchAngles"
            defaultValue={defaultValues?.pitchAngles.join("\n")}
            rows={4}
            placeholder={"local competitors already have websites"}
            className="input w-full rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="idealCustomerProfile">Ideal customer profile</Label>
        <Input id="idealCustomerProfile" name="idealCustomerProfile" defaultValue={defaultValues?.idealCustomerProfile ?? ""} />
      </div>
      <div>
        <Label htmlFor="priceRange">Price range (shown internally only — never sent to the AI)</Label>
        <Input id="priceRange" name="priceRange" defaultValue={defaultValues?.priceRange ?? ""} placeholder="e.g. ₹15,000–₹50,000" />
      </div>
      <div>
        <Label htmlFor="portfolioUrls">Portfolio URLs (one per line)</Label>
        <textarea
          id="portfolioUrls"
          name="portfolioUrls"
          defaultValue={defaultValues?.portfolioUrls.join("\n")}
          rows={3}
          className="input w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {state.error ? <p className="text-sm text-(--danger)">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
