"use client";

import { useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { LeadStatus } from "@prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadStatusBadge } from "./lead-status-badge";
import { quickUpdateStatusAction } from "@/app/(dashboard)/leads/actions";
import { LEAD_STATUSES } from "@/lib/leads";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/i18n/he";

export function StatusChanger({
  leadId,
  current,
  disabled = false,
  name,
}: {
  leadId: string;
  current: LeadStatus;
  disabled?: boolean;
  name?: string;
}) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending || disabled}
          aria-label={`שינוי סטטוס${name ? ` עבור ${name}` : ""}: ${t.leads.status[current]}`}
          className="inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <LeadStatusBadge status={current} />
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {LEAD_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            disabled={s === current}
            onSelect={() => {
              if (s === current) return;
              startTransition(async () => {
                try {
                  const result = await quickUpdateStatusAction(leadId, s);
                  if (result.error) throw new Error(result.error);
                } catch (error) {
                  toast({ title: "הסטטוס לא עודכן", description: error instanceof Error ? error.message : "נסו שוב", variant: "destructive" });
                }
              });
            }}
            className="flex items-center justify-between"
          >
            <LeadStatusBadge status={s} />
            {s === current && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
