import { createHash } from "node:crypto";
import type { NormalizedLead } from "./normalize";

/**
 * Fallback dedup key for when two sources describe the same real business
 * without sharing a provider id (e.g. Google Places vs. a manually-entered
 * lead). Deliberately coarse — normalized name + phone (if known) + city —
 * so near-duplicates collapse instead of multiplying. `externalId` (the
 * provider's own stable id) is always checked FIRST and is the precise key;
 * this hash is only the fallback.
 */
export function computeDedupHash(lead: NormalizedLead): string {
  const parts = [
    lead.businessName.toLowerCase(),
    lead.phoneE164 ?? "",
    (lead.city ?? "").toLowerCase(),
  ];
  return createHash("sha1").update(parts.join("|")).digest("hex");
}
