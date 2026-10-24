import Link from "next/link";
import { cookies } from "next/headers";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LeadFilters } from "@/components/leads/lead-filters";
import { LeadTable } from "@/components/leads/lead-table";
import { LeadBoard } from "@/components/leads/lead-board";
import { LeadCards } from "@/components/leads/lead-card";
import { ViewToggle } from "@/components/leads/view-toggle";
import { LEAD_VIEWS, type LeadView } from "@/lib/leads";
import { leadWhere, leadOrder, type LeadSearch } from "@/lib/lead-query";
import { t } from "@/i18n/he";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<LeadSearch> }) {
  const user = await requireUser();
  const search = await searchParams;
  const savedView = (await cookies()).get("crm-leads-view")?.value;
  const requestedView = search.view ?? savedView;
  const currentView: LeadView = LEAD_VIEWS.includes(requestedView as LeadView) ? requestedView as LeadView : "list";
  // Date-only follow-ups. Toolbar links carry the browser's local day explicitly.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const leads = await db.lead.findMany({ where: leadWhere(user.id, search, today), orderBy: leadOrder(search.sort) });
  const filtered = !!(search.q?.trim() || search.status || search.followUp || search.scope);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3"><h1 className="text-2xl font-semibold">{t.leads.title}</h1><span className="rounded-full bg-muted px-2.5 py-1 text-sm text-muted-foreground">{leads.length}</span></div>
      <div className="flex flex-wrap items-center gap-3"><ViewToggle current={currentView} /><Button asChild><Link href="/leads/new"><Plus className="h-4 w-4" />{t.leads.new}</Link></Button></div>
    </div>
    <LeadFilters />
    {leads.length === 0 ? <div className="rounded-xl border border-dashed bg-card px-4 py-14 text-center"><p className="font-medium">{filtered ? "אין לידים התואמים לסינון" : t.leads.none}</p><p className="mt-2 text-sm text-muted-foreground">{filtered ? "נסו לבחור סטטוס אחר או לנקות את הסינון." : t.leads.noneHint}</p></div>
      : currentView === "board" ? <LeadBoard leads={leads} /> : currentView === "cards" ? <LeadCards leads={leads} /> : <LeadTable leads={leads} />}
  </div>;
}
