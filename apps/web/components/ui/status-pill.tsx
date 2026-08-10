import { Pill, type PillTone } from "./pill";

const STATUS_TONE: Record<string, PillTone> = {
  NEW: "sub",
  QUALIFIED: "teal",
  CONTACTED: "accent",
  REPLIED: "teal",
  INTERESTED: "success",
  MEETING: "success",
  PROPOSAL: "success",
  WON: "success",
  NOT_INTERESTED: "sub",
  LOST: "danger",
  OPTED_OUT: "danger",
  DO_NOT_CONTACT: "danger",
};

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={STATUS_TONE[status] ?? "sub"}>{status.replace(/_/g, " ")}</Pill>;
}
