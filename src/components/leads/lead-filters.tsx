"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEAD_STATUSES, browserDate } from "@/lib/leads";
import { t } from "@/i18n/he";

export function LeadFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = params.get("q") ?? "";
  useEffect(() => { setSearch(q); }, [q]);
  function update(values: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value && value !== "ALL") next.set(key, value); else next.delete(key);
    }
    if (next.get("followUp")) next.set("day", browserDate()); else next.delete("day");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }
  const followUp = params.get("followUp") ?? "ALL";
  const status = params.get("status") ?? "ALL";
  const scope = params.get("scope");
  const activePreset = followUp !== "ALL" ? followUp : status === "NEW" ? "new" : status === "FOLLOW_UP" ? "followup" : scope === "open" ? "open" : status === "ALL" ? "all" : "";
  return <div className="space-y-3">
    <div role="group" aria-label="סינון מהיר" className="flex flex-wrap gap-2">
      {[["all", "כל הלידים"], ["open", "פתוחים"], ["new", "לידים חדשים"], ["followup", "פולואפ"], ["today", "פולואפ היום"], ["overdue", "באיחור"], ["none", "ללא תאריך פולואפ"]].map(([key, label]) => <Button key={key} type="button" size="sm" variant={activePreset === key ? "secondary" : "outline"} aria-pressed={activePreset === key} disabled={pending} onClick={() => update({ status: key === "new" ? "NEW" : key === "followup" ? "FOLLOW_UP" : null, scope: key === "open" ? "open" : null, followUp: ["today", "overdue", "none"].includes(key) ? key : null })}>{label}</Button>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_12rem_12rem]">
      <form onSubmit={(e) => { e.preventDefault(); update({ q: search.trim() }); }} className="space-y-1.5">
        <Label htmlFor="lead-search">חיפוש לידים</Label>
        <div className="flex gap-2"><Input id="lead-search" placeholder="שם, חברה, אימייל או טלפון" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={200} /><Button type="submit" variant="outline" disabled={pending} aria-label="חיפוש"><Search className="h-4 w-4" /></Button></div>
      </form>
      <div className="space-y-1.5"><Label htmlFor="lead-status-filter">סטטוס</Label><Select value={status} disabled={pending} onValueChange={(value) => update({ status: value })}><SelectTrigger id="lead-status-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">כל הסטטוסים</SelectItem>{LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{t.leads.status[s]}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label htmlFor="lead-sort">מיון</Label><Select value={params.get("sort") ?? "newest"} disabled={pending} onValueChange={(value) => update({ sort: value })}><SelectTrigger id="lead-sort"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="newest">החדשים ביותר</SelectItem><SelectItem value="updated">עודכנו לאחרונה</SelectItem><SelectItem value="name">שם הליד</SelectItem><SelectItem value="followup">תאריך פולואפ</SelectItem></SelectContent></Select></div>
    </div>
    <div className="flex min-h-5 items-center gap-3 text-xs text-muted-foreground" role="status">
      {pending && <span>מעדכן תצוגה...</span>}
      {(q || status !== "ALL" || followUp !== "ALL" || scope) && <button type="button" className="text-primary hover:underline" disabled={pending} onClick={() => { setSearch(""); update({ q: null, status: null, followUp: null, scope: null }); }}>ניקוי סינון</button>}
    </div>
  </div>;
}
