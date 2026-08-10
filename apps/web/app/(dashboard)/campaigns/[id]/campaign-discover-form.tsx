"use client";

import { useActionState } from "react";
import { discoverForCampaignAction, type CampaignDiscoverState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CampaignDiscoverState = {};

export function CampaignDiscoverForm({
  campaignId,
  defaultLimit,
  providerName,
}: {
  campaignId: string;
  defaultLimit: number;
  providerName: string;
}) {
  const [state, formAction, pending] = useActionState(discoverForCampaignAction, initialState);
  const isOpenStreetMap = providerName === "openstreetmap";

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-sm font-semibold">Run discovery for this campaign</h2>
      <p className="mb-4 text-xs text-(--sub)">
        Searches using the campaign's own category and location, and attaches every result to this campaign.
        {isOpenStreetMap ? " Using free OpenStreetMap data — no cost, no signup." : ""}
      </p>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="campaignId" value={campaignId} />
        <div>
          <Label htmlFor="limit">How many</Label>
          <Input id="limit" name="limit" type="number" min={1} max={50} defaultValue={defaultLimit} required />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Searching…" : "Discover for this campaign"}
        </Button>
      </form>
      {state.error ? <p className="mt-3 text-sm text-(--danger)">{state.error}</p> : null}
      {state.success ? (
        <p className="mt-3 text-sm text-(--sub)">
          Found via <strong>{state.providerName}</strong>: {state.createdCount} new, {state.updatedCount} updated,{" "}
          {state.duplicateCount} already known — {state.attachedCount} newly attached to this campaign.
        </p>
      ) : null}
    </div>
  );
}
