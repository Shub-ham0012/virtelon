import type { ServiceOffering } from "@virtelon/db";
import type { ServiceOfferingSummary } from "../ai/AIProvider";

export function toAISummary(
  offering: Pick<ServiceOffering, "id" | "name" | "description" | "targetIndustries" | "painPoints" | "pitchAngles">
): ServiceOfferingSummary {
  return {
    id: offering.id,
    name: offering.name,
    description: offering.description,
    targetIndustries: offering.targetIndustries,
    painPoints: offering.painPoints,
    pitchAngles: offering.pitchAngles,
  };
}
