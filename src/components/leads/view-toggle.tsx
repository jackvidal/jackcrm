"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Columns3, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadView } from "@/lib/leads";

export function ViewToggle({ current }: { current: LeadView }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  function switchTo(view: LeadView) {
    const search = new URLSearchParams(params.toString());
    search.set("view", view);
    document.cookie = `crm-leads-view=${view}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    startTransition(() => router.replace(`${pathname}?${search.toString()}`, { scroll: false }));
  }
  return <div role="group" aria-label="תצוגת לידים" className="inline-flex rounded-md border border-border bg-card p-1 text-sm">
    {([{ value: "list", label: "רשימה", icon: List }, { value: "board", label: "קנבאן", icon: Columns3 }, { value: "cards", label: "כרטיסיות", icon: LayoutGrid }] as const).map(({ value, label, icon: Icon }) => (
      <button key={value} type="button" aria-pressed={current === value} disabled={pending} onClick={() => switchTo(value)} className={cn("inline-flex items-center gap-1.5 rounded px-3 py-2 transition-colors disabled:opacity-60", current === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="h-4 w-4" />{label}</button>
    ))}
  </div>;
}
