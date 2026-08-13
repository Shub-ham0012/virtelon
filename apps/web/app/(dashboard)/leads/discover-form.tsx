"use client";

import { useActionState } from "react";
import { discoverLeads, type DiscoverState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryField } from "@/components/category-field";
import { SUPPORTED_CATEGORIES } from "@virtelon/core/lead-discovery";

const initialState: DiscoverState = {};

export function DiscoverForm({ providerName }: { providerName: string }) {
  const [state, formAction, pending] = useActionState(discoverLeads, initialState);
  const isOpenStreetMap = providerName === "openstreetmap";
  const isMock = providerName === "mock";

  return (
    <div className="card reveal p-5">
      <h2 className="mb-1 text-[13px] font-bold">Discover leads</h2>
      <p className="mb-4 text-xs text-(--sub)">
        {isOpenStreetMap
          ? "Using free OpenStreetMap data — real businesses, no cost, no signup. Coverage is less complete than Google: no ratings/review counts, and phone numbers are missing on many listings. Add a Google Places API key in Settings later for more complete results."
          : isMock
            ? "No Google Places API key is configured yet, so this generates clearly-labeled sample data — useful for testing the pipeline before a real key is added."
            : "Searches Google Places for businesses matching your criteria."}
      </p>

      <form action={formAction} className="grid grid-cols-2 gap-4 md:grid-cols-5 md:items-end">
        <div className="col-span-2">
          <CategoryField categories={SUPPORTED_CATEGORIES} restrictToKnown={isOpenStreetMap} />
        </div>
        <div className="col-span-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" placeholder="Patna, Bihar" required />
        </div>
        <div>
          <Label htmlFor="limit">How many</Label>
          <Input id="limit" name="limit" type="number" min={1} max={50} defaultValue={20} required />
        </div>
        <div>
          <Label htmlFor="minRating">Min rating</Label>
          <Input
            id="minRating"
            name="minRating"
            type="number"
            min={0}
            max={5}
            step={0.1}
            placeholder="e.g. 4.0"
            disabled={isOpenStreetMap}
          />
          {isOpenStreetMap ? <p className="mt-1 text-xs text-(--sub)">Not available with free data</p> : null}
        </div>
        <div>
          <Label htmlFor="requireWebsite">Website</Label>
          <select id="requireWebsite" name="requireWebsite" className="input w-full rounded-lg px-3 py-2 text-sm" defaultValue="any">
            <option value="any">Any</option>
            <option value="yes">Must have one</option>
            <option value="no">Must NOT have one</option>
          </select>
        </div>
        <div className="col-span-2 md:col-span-1">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Searching…" : "Discover"}
          </Button>
        </div>
      </form>

      {state.error ? <p className="mt-3 text-sm text-(--danger)">{state.error}</p> : null}
      {state.success ? (
        <p className="mt-3 text-sm text-(--sub)">
          Found via <strong>{state.providerName}</strong>: {state.createdCount} new,{" "}
          {state.updatedCount} updated, {state.duplicateCount} already known.
        </p>
      ) : null}
    </div>
  );
}
