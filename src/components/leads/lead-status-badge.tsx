import { Badge } from "@/components/ui/badge";
import type { LeadStatus } from "@prisma/client";
import { t } from "@/i18n/he";
import { contrastText, DEFAULT_STATUS_COLORS, statusColor } from "@/lib/branding";

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge variant="outline" className="border-transparent font-normal" style={{ backgroundColor: statusColor(status), color: `var(--lead-${status}-text, ${contrastText(DEFAULT_STATUS_COLORS[status])})` }}>{t.leads.status[status]}</Badge>;
}
