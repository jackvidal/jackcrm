import { Badge } from "@/components/ui/badge";
import type { LeadStatus } from "@prisma/client";
import { t } from "@/i18n/he";

const variantMap: Record<
  LeadStatus,
  "default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
  NEW: "default",
  CONTACTED: "secondary",
  FOLLOW_UP: "warning",
  MEETING_SCHEDULED: "secondary",
  MEETING_COMPLETED: "warning",
  PROPOSAL_SENT: "outline",
  NEGOTIATION: "warning",
  DEAL_CLOSED: "success",
  DEAL_LOST: "destructive",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant={variantMap[status]} className="font-normal">
      {t.leads.status[status]}
    </Badge>
  );
}
