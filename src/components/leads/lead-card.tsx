import Link from "next/link";
import type { Lead } from "@prisma/client";
import { Building2, Mail, Phone } from "lucide-react";
import { StatusChanger } from "./status-changer";
import { FollowUpControl } from "./follow-up-control";
import { formatDate } from "@/lib/utils";
import { t } from "@/i18n/he";
import type { ReactNode } from "react";

export function LeadCard({ lead, disabled = false, handle }: { lead: Lead; disabled?: boolean; handle?: ReactNode }) {
  return <article className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-4">
    <div className="flex items-start justify-between gap-2"><div className="min-w-0 space-y-1"><Link href={`/leads/${lead.id}`} className="break-words font-semibold hover:text-primary"><bdi>{lead.fullName}</bdi></Link>{lead.company && <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /><bdi>{lead.company}</bdi></p>}</div>{handle}</div>
    <StatusChanger leadId={lead.id} current={lead.status} name={lead.fullName} disabled={disabled} />
    {(lead.email || lead.phone) && <div className="space-y-1.5 text-xs text-muted-foreground">
      {lead.email && <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0" /><bdi className="truncate">{lead.email}</bdi></p>}
      {lead.phone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" /><bdi>{lead.phone}</bdi></p>}
    </div>}
    <div className="border-t border-border pt-2"><FollowUpControl leadId={lead.id} name={lead.fullName} date={lead.followUpDate} closed={lead.status === "DEAL_CLOSED" || lead.status === "DEAL_LOST"} disabled={disabled} /></div>
    <div className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground"><span>{t.leads.sources[lead.source as keyof typeof t.leads.sources] ?? lead.source ?? "ידני"}</span><span>{formatDate(lead.createdAt)}</span></div>
  </article>;
}

export function LeadCards({ leads }: { leads: Lead[] }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)}</div>;
}
