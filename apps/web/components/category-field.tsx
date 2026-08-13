"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SupportedCategory } from "@virtelon/core/lead-discovery/categories";

const OTHER_VALUE = "__other__";

/**
 * Free-text category input for providers with no fast/slow split (e.g.
 * Google Places), or a dropdown of categories known to be fast and reliable
 * for the active provider (OpenStreetMap), with an "Other" escape hatch that
 * reveals free text — so typing an unlisted category is still possible, just
 * clearly opt-in rather than an accidental trap into a slow search.
 */
export function CategoryField({
  categories,
  restrictToKnown,
  defaultValue,
}: {
  categories: SupportedCategory[];
  restrictToKnown: boolean;
  defaultValue?: string;
}) {
  const matchesKnown = categories.some((c) => c.value === defaultValue);
  const [mode, setMode] = useState<"known" | "other">(defaultValue && !matchesKnown ? "other" : "known");

  if (!restrictToKnown) {
    return (
      <div>
        <Label htmlFor="category">Category</Label>
        <Input id="category" name="category" placeholder="Coaching Institute" defaultValue={defaultValue} required />
      </div>
    );
  }

  if (mode === "other") {
    return (
      <div>
        <Label htmlFor="category">Category</Label>
        <div className="flex items-center gap-2">
          <Input
            id="category"
            name="category"
            placeholder="Type a category"
            defaultValue={matchesKnown ? undefined : defaultValue}
            autoFocus
            required
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => setMode("known")}
            className="text-xs whitespace-nowrap text-(--accent)"
          >
            Choose from list
          </button>
        </div>
        <p className="mt-1 text-xs text-(--sub)">
          Not one of the common categories — this may search slower and less reliably on free data.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Label htmlFor="category">Category</Label>
      <select
        id="category"
        name="category"
        defaultValue={matchesKnown ? defaultValue : ""}
        className="input w-full rounded-lg px-3 py-2 text-sm"
        onChange={(e) => {
          if (e.target.value === OTHER_VALUE) setMode("other");
        }}
        required
      >
        <option value="" disabled>
          Choose a category
        </option>
        {categories.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
        <option value={OTHER_VALUE}>Other — type my own</option>
      </select>
    </div>
  );
}
