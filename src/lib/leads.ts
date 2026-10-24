// Shared by forms, filters, boards and server-side validation.
export const LEAD_STATUSES = [
  "NEW", "CONTACTED", "FOLLOW_UP", "MEETING_SCHEDULED", "MEETING_COMPLETED",
  "PROPOSAL_SENT", "NEGOTIATION", "DEAL_CLOSED", "DEAL_LOST",
] as const;
export type PipelineStatus = typeof LEAD_STATUSES[number];
export const OPEN_LEAD_STATUSES = LEAD_STATUSES.filter((s) => s !== "DEAL_CLOSED" && s !== "DEAL_LOST");
export const EARLY_LEAD_STATUSES: readonly string[] = ["NEW", "CONTACTED", "FOLLOW_UP"];
export const LEAD_VIEWS = ["list", "board", "cards"] as const;
export type LeadView = typeof LEAD_VIEWS[number];

export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function browserDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
