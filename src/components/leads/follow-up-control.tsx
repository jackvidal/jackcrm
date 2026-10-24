"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { updateFollowUpAction } from "@/app/(dashboard)/leads/actions";
import { browserDate } from "@/lib/leads";
import { cn } from "@/lib/utils";

export function FollowUpControl({ leadId, name, date, closed = false, disabled = false }: { leadId: string; name: string; date?: string | null; closed?: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(date ?? "");
  const [today, setToday] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  useEffect(() => { setToday(browserDate()); }, []);
  const overdue = !closed && !!date && !!today && date < today;
  const dueToday = !closed && date === today;
  const label = date ? date.split("-").reverse().join(".") : "קביעת פולואפ";
  function save(nextDate: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateFollowUpAction(leadId, nextDate);
        if (result.error) { setError(result.error); return; }
        setOpen(false);
      } catch { setError("לא ניתן לשמור כרגע. נסו שוב."); }
    });
  }
  return <Dialog open={open} onOpenChange={(next) => { if (pending) return; setOpen(next); if (next) { setValue(date ?? ""); setError(null); } }}>
    <DialogTrigger asChild>
      <button type="button" disabled={disabled} aria-label={`פולואפ עבור ${name}`} className={cn("inline-flex flex-wrap items-center gap-1.5 rounded py-1 text-xs text-muted-foreground hover:text-primary disabled:opacity-50", overdue && "text-destructive", dueToday && "text-primary")}>
        <CalendarClock className="h-3.5 w-3.5" /><span>{label}</span>{overdue ? <span>· באיחור</span> : dueToday ? <span>· היום</span> : null}
      </button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>תכנון פולואפ — {name}</DialogTitle><DialogDescription>בחרו מתי לחזור לליד. שלב המכירה יישאר כפי שהוא.</DialogDescription></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); const selected = new FormData(e.currentTarget).get("followUpDate"); save(typeof selected === "string" && selected ? selected : null); }} className="space-y-4">
        <div className="space-y-2"><Label htmlFor={inputId}>תאריך פולואפ</Label><Input id={inputId} name="followUpDate" type="date" value={value} onChange={(e) => setValue(e.target.value)} dir="ltr" disabled={pending} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          {date && <Button type="button" variant="outline" disabled={pending} onClick={() => save(null)}>ניקוי תאריך</Button>}
          <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>ביטול</Button>
          <Button type="submit" disabled={pending}>{pending ? "שומר..." : "שמירה"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
