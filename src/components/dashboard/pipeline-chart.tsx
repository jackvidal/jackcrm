"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpLeft, ChartNoAxesCombined } from "lucide-react";
import { statusColor } from "@/lib/branding";
import type { PipelineStatus } from "@/lib/leads";
import { t } from "@/i18n/he";

const sourceNames: Record<string, string> = {
  manual: "הזנה ידנית",
  import: "ייבוא",
  website: "טופס באתר",
  cal: "Cal.com",
  "cal.com": "Cal.com",
  calcom: "Cal.com",
  whatsapp: "WhatsApp",
  unknown: "ללא מקור",
  __other__: "מקורות נוספים",
};

export function PipelineChart({
  stages,
  sources,
  total,
  open,
  won,
  lost,
  winRate,
}: {
  stages: { status: PipelineStatus; count: number }[];
  sources: { source: string; count: number }[];
  total: number;
  open: number;
  won: number;
  lost: number;
  winRate: number | null;
}) {
  const [view, setView] = useState<"stages" | "sources">("stages");
  const [active, setActive] = useState<string | null>(null);
  const data =
    view === "stages"
      ? stages.map(({ status, count }) => ({
          key: status,
          label: t.leads.status[status],
          count,
          color: statusColor(status),
          href: `/leads?status=${status}`,
        }))
      : sources.map(({ source, count }) => ({
          key: source,
          label: sourceNames[source] ?? source,
          count,
          color: "hsl(var(--primary))",
          href: undefined,
        }));
  const max = Math.max(
    4,
    Math.ceil(Math.max(0, ...data.map((item) => item.count)) / 4) * 4,
  );
  const selected = data.find((item) => item.key === active);

  return (
    <section
      className="dashboard-panel min-w-0 overflow-hidden"
      aria-labelledby="pipeline-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 p-6 pb-0">
        <div>
          <h2 id="pipeline-title" className="text-lg font-semibold">
            תמונת המכירות שלך
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            התפלגות הלידים כרגע במערכת
          </p>
        </div>
        <div
          className="inline-flex rounded-lg bg-muted p-1"
          role="group"
          aria-label="תצוגת הגרף"
        >
          {(
            [
              ["stages", "שלבי מכירה"],
              ["sources", "מקורות לידים"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => {
                setView(key);
                setActive(null);
              }}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${view === key ? "bg-card font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 px-6 pb-4 pt-6">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight tabular-nums">
            {open.toLocaleString("he-IL")}
          </span>
          <span className="text-sm text-muted-foreground">לידים בתהליך</span>
        </div>
        <div
          className="min-h-5 text-xs text-muted-foreground"
          aria-live="polite"
        >
          {selected
            ? `${selected.label} · ${selected.count} לידים · ${total ? Math.round((selected.count / total) * 100) : 0}% מהלידים`
            : view === "stages"
              ? "לחיצה על עמודה פותחת את הלידים בשלב"
              : `${sources.length} מקורות מוצגים`}
        </div>
      </div>
      {total === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
          <ChartNoAxesCombined className="h-10 w-10 text-primary" />
          <p className="font-medium">תמונת המכירות תתחיל בליד הראשון</p>
          <Link
            href="/leads/import"
            className="text-sm text-primary hover:underline"
          >
            ייבוא לידים למערכת <ArrowUpLeft className="inline h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto px-6 pb-5 scrollbar-thin">
          <div
            className="relative min-w-[520px] pt-6"
            onMouseLeave={() => setActive(null)}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-6 h-48"
              aria-hidden="true"
            >
              {[0, 1, 2, 3, 4].map((tick) => (
                <div
                  key={tick}
                  className="absolute inset-x-0 border-t border-dashed border-border/70"
                  style={{ bottom: `${tick * 25}%` }}
                >
                  <span className="absolute -top-2 start-0 bg-card pe-2 text-[10px] text-muted-foreground">
                    {(max * tick) / 4}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="relative grid gap-3 ps-8"
              style={{
                gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
              }}
            >
              {data.map((item) => {
                const contents = (
                  <>
                    <div className="relative flex h-48 items-end justify-center">
                      <div
                        className="dashboard-bar relative w-full max-w-12 rounded-t-lg"
                        style={
                          {
                            height: item.count
                              ? `${(item.count / max) * 100}%`
                              : 2,
                            "--bar-color": item.color,
                          } as React.CSSProperties
                        }
                      >
                        <span className="absolute -top-6 inset-x-0 text-center text-xs font-semibold text-foreground tabular-nums">
                          {item.count}
                        </span>
                      </div>
                    </div>
                    <span className="mt-3 block min-h-9 break-words text-center text-[11px] leading-4 text-muted-foreground group-hover:text-foreground">
                      {item.label}
                    </span>
                  </>
                );
                const className = `group block min-w-0 rounded-lg transition-opacity ${active && active !== item.key ? "opacity-40" : "opacity-100"}`;
                return item.href ? (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={className}
                    onMouseEnter={() => setActive(item.key)}
                    onFocus={() => setActive(item.key)}
                    onBlur={() => setActive(null)}
                    aria-label={`${item.label}: ${item.count} לידים`}
                  >
                    {contents}
                  </Link>
                ) : (
                  <div
                    key={item.key}
                    className={className}
                    onMouseEnter={() => setActive(item.key)}
                  >
                    {contents}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 divide-x divide-x-reverse border-t bg-muted/20 px-4 py-4 text-center">
        <div>
          <div className="text-lg font-semibold tabular-nums">{won}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            עסקאות שנסגרו בהצלחה
          </div>
        </div>
        <div>
          <div className="text-lg font-semibold tabular-nums">{lost}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            עסקאות שאבדו
          </div>
        </div>
        <div>
          <div className="text-lg font-semibold tabular-nums">
            {winRate === null ? "—" : `${winRate}%`}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            הצלחה מתוך עסקאות שהסתיימו
          </div>
        </div>
      </div>
    </section>
  );
}
