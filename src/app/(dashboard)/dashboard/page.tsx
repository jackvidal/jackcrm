import Link from "next/link";
import {
  ArrowUpLeft,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  FileText,
  Headphones,
  Layers3,
  Mic,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dashboardSummary } from "@/lib/dashboard";
import { getBranding } from "@/lib/branding-server";
import {
  contrastText,
  DEFAULT_METRIC_COLORS,
  statusColor,
  type MetricKey,
} from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { TaskList } from "@/components/tasks/task-list";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { RecordingShortcut } from "@/components/dashboard/recording-shortcut";
import { formatDateTime, formatRelative } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  const [leads, calls, meetings, tasks, branding] = await Promise.all([
    db.lead.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    db.call.findMany({ where: { ownerId: user.id } }),
    db.meeting.findMany({ where: { ownerId: user.id } }),
    db.task.findMany({ where: { ownerId: user.id } }),
    getBranding(),
  ]);
  const now = new Date();
  const summary = dashboardSummary(leads, calls, meetings, tasks, now);
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const name = user.fullName?.trim().split(/\s+/)[0];
  const todayLabel = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Bangkok",
  }).format(now);
  const shortcutLeads = leads.map(({ id, fullName, company }) => ({
    id,
    fullName,
    company,
  }));
  const dueTasks = summary.dueTasks.slice(0, 4).flatMap((task) => {
    const lead = leadById.get(task.leadId);
    return lead
      ? [{ ...task, lead: { id: lead.id, fullName: lead.fullName } }]
      : [];
  });

  return (
    <div className="dashboard-overview mx-auto max-w-[1600px] space-y-6 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-5 pb-1 pt-2">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            סקירה כללית <span className="mx-2 opacity-40">/</span> {todayLabel}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-[34px]">
            {name ? `היי ${name}, טוב לראות אותך.` : "טוב לראות אותך."}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            כל מה שקורה בעסק שלך, במקום אחד.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/leads?view=board">
              <Layers3 />
              לוח המכירות
            </Link>
          </Button>
          <Button asChild>
            <Link href="/leads/new">
              <Plus />
              ליד חדש
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="סה״כ לידים"
          value={summary.total}
          detail={`${summary.open} לידים בתהליך · ${summary.newLeads} חדשים`}
          icon={<Users />}
          href="/leads"
          color={metricColor("total")}
          heroText={contrastText(branding.metricColors.total)}
        />
        <Metric
          label="שיחות שהוקלטו"
          value={summary.recordings.length}
          detail={`${summary.analyzedCalls} שיחות עם ניתוח AI`}
          icon={<Headphones />}
          href="#recordings"
          color="hsl(var(--primary))"
        />
        <Metric
          label="הצעות שנשלחו"
          value={summary.proposalsSent}
          detail="לידים שנמצאים בשלב ׳נשלחה הצעה׳"
          icon={<FileText />}
          href="/leads?status=PROPOSAL_SENT"
          color={statusColor("PROPOSAL_SENT")}
        />
        <Metric
          label="עסקאות שנסגרו"
          value={summary.won}
          detail={
            summary.winRate === null
              ? "עסקאות שנסגרו בהצלחה"
              : `${summary.winRate}% הצלחה מתוך העסקאות שהסתיימו`
          }
          icon={<CheckCheck />}
          href="/leads?status=DEAL_CLOSED"
          color={metricColor("won")}
        />
      </div>

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(300px,1fr)]">
        <PipelineChart
          stages={summary.stages}
          sources={summary.sources}
          total={summary.total}
          open={summary.open}
          won={summary.won}
          lost={summary.lost}
          winRate={summary.winRate}
        />
        <section
          className="dashboard-panel flex min-w-0 flex-col"
          aria-labelledby="next-title"
        >
          <div className="flex items-center justify-between gap-3 p-6 pb-4">
            <div>
              <h2 id="next-title" className="text-lg font-semibold">
                הצעד הבא שלך
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                פולואפים להיום ובאיחור
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              {summary.followUps.length}
            </span>
          </div>
          <div className="flex-1 px-6">
            {summary.followUps.length ? (
              <ul className="divide-y">
                {summary.followUps.slice(0, 4).map((lead) => (
                  <li key={lead.id}>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="group flex items-center gap-3 py-3.5"
                    >
                      <Avatar name={lead.fullName} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold group-hover:text-primary">
                          לחזור אל {lead.fullName}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {lead.company ?? "פולואפ מתוכנן"}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-1 text-[11px] ${lead.followUpDate! < summary.today ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
                      >
                        {lead.followUpDate! < summary.today ? "באיחור" : "היום"}
                      </span>
                      <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex min-h-44 flex-col items-center justify-center gap-3 text-center">
                <CheckCircle2 className="h-9 w-9 text-primary" />
                <p className="text-sm font-medium">
                  אין פולואפים שממתינים לטיפול היום
                </p>
                <Link
                  href="/leads?scope=open&followUp=none"
                  className="text-xs text-primary hover:underline"
                >
                  תכנון פולואפ ללידים ללא תאריך
                </Link>
              </div>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t px-6 py-4">
            <SmallMetric
              value={summary.meetingsThisWeek}
              label="פגישות ב־7 ימים"
              color={metricColor("meetings")}
              href="/meetings"
              icon={<CalendarDays />}
            />
            <SmallMetric
              value={summary.overdueTasks}
              label="משימות באיחור"
              color={metricColor("overdue")}
              href="/tasks"
              icon={<Clock3 />}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section
          id="recordings"
          className="dashboard-panel min-w-0 scroll-mt-6"
          aria-labelledby="recordings-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-4">
            <div>
              <h2
                id="recordings-title"
                className="flex items-center gap-2 text-lg font-semibold"
              >
                <Mic className="h-5 w-5 text-primary" />
                השיחות שלך, עם תובנות
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                הקלטות אחרונות, תמלול וניתוח שיחות מכירה
              </p>
            </div>
            <RecordingShortcut leads={shortcutLeads} />
          </div>
          {summary.recordings.length ? (
            <ul className="divide-y px-6 pb-3">
              {summary.recordings.slice(0, 4).map((call) => {
                const lead = leadById.get(call.leadId);
                if (!lead) return null;
                return (
                  <li key={call.id}>
                    <Link
                      href={`/leads/${lead.id}#call-${call.id}`}
                      className="group flex items-center gap-4 py-4"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Headphones className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold group-hover:text-primary">
                            {lead.fullName}
                          </span>
                          {call.analyzedAt && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                              <Sparkles className="h-3 w-3" />
                              נותחה ב־AI
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {call.summary ||
                            (call.transcript
                              ? "התמלול מוכן לניתוח"
                              : "הקלטה זמינה בכרטיס הליד")}
                        </p>
                        <div className="mt-1.5 text-[11px] text-muted-foreground">
                          {formatDateTime(call.occurredAt)}
                          {call.durationSeconds != null
                            ? ` · ${Math.floor(call.durationSeconds / 60)}:${String(call.durationSeconds % 60).padStart(2, "0")} דקות`
                            : ""}
                        </div>
                      </div>
                      <ArrowUpLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mx-6 mb-6 flex min-h-48 flex-col items-center justify-center rounded-xl bg-muted/35 px-5 py-5 text-center">
              <div
                className="mb-4 flex h-10 items-center justify-center gap-1"
                aria-hidden="true"
              >
                {[
                  12, 20, 32, 18, 40, 26, 16, 34, 24, 14, 30, 38, 20, 12, 24,
                ].map((height, i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full bg-primary/25"
                    style={{ height }}
                  />
                ))}
              </div>
              <p className="text-sm font-semibold">עדיין אין שיחות מוקלטות</p>
              <p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">
                תעדו שיחה והעלו את ההקלטה בכרטיס הליד. כאן יופיעו השיחות
                האחרונות והתובנות מהניתוח.
              </p>
            </div>
          )}
        </section>
        <section
          className="dashboard-panel min-w-0"
          aria-labelledby="proposals-title"
        >
          <PanelHeader
            id="proposals-title"
            title="הצעות מחיר במעקב"
            description="לידים בשלבי הצעה ומשא ומתן"
            href="/leads?view=board"
            linkLabel="ללוח המכירות"
          />
          <div className="px-6 pb-3">
            {summary.proposals.length ? (
              <ul className="divide-y">
                {summary.proposals.slice(0, 4).map((lead) => (
                  <li key={lead.id}>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="group flex flex-wrap items-center gap-3 py-4"
                    >
                      <span
                        className="metric-icon flex h-10 w-10 items-center justify-center rounded-xl"
                        style={
                          {
                            "--metric-color": statusColor(lead.status),
                          } as React.CSSProperties
                        }
                      >
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold group-hover:text-primary">
                          {lead.fullName}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {lead.company ?? "ללא חברה"}
                        </div>
                      </div>
                      <LeadStatusBadge status={lead.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty
                icon={<FileText />}
                text="כאן יופיעו לידים שהתקדמו לשלב הצעה"
                href="/leads?view=board"
                action="פתיחת לוח המכירות"
              />
            )}
          </div>
        </section>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section
          className="dashboard-panel min-w-0"
          aria-labelledby="recent-title"
        >
          <PanelHeader
            id="recent-title"
            title="הקשרים החדשים שלך"
            description="הלידים האחרונים שנוספו למערכת"
            href="/leads"
            linkLabel="כל הלידים"
          />
          <div className="px-6 pb-4">
            {leads.length ? (
              <ul className="divide-y">
                {leads.slice(0, 5).map((lead) => (
                  <li key={lead.id}>
                    <Link
                      href={`/leads/${lead.id}`}
                      className="group flex flex-wrap items-center gap-3 py-3"
                    >
                      <Avatar name={lead.fullName} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold group-hover:text-primary">
                          {lead.fullName}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {lead.company ?? "ללא חברה"}
                        </div>
                      </div>
                      <LeadStatusBadge status={lead.status} />
                      <span className="hidden min-w-20 text-end text-[11px] text-muted-foreground sm:block">
                        {formatRelative(lead.createdAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty
                icon={<Users />}
                text="הלידים החדשים יופיעו כאן"
                href="/leads/import"
                action="ייבוא לידים"
              />
            )}
          </div>
        </section>
        <div className="space-y-5">
          <section className="dashboard-panel" aria-labelledby="meetings-title">
            <PanelHeader
              id="meetings-title"
              title="הפגישות הקרובות"
              description={`${summary.meetingsThisWeek} פגישות מתוכננות ב־7 הימים הקרובים`}
              href="/meetings"
              linkLabel="כל הפגישות"
            />
            <div className="px-6 pb-5">
              {summary.upcoming.length ? (
                <ul className="divide-y">
                  {summary.upcoming.slice(0, 3).map((meeting) => {
                    const lead = leadById.get(meeting.leadId);
                    return lead ? (
                      <li key={meeting.id}>
                        <Link
                          href={`/leads/${lead.id}`}
                          className="flex items-center gap-3 py-3"
                        >
                          <CalendarDays className="h-5 w-5 text-primary" />
                          <div>
                            <div className="text-sm font-medium">
                              {lead.fullName}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {formatDateTime(meeting.scheduledAt)} ·{" "}
                              {meeting.durationMinutes} דקות
                            </div>
                          </div>
                        </Link>
                      </li>
                    ) : null;
                  })}
                </ul>
              ) : (
                <p className="rounded-lg bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
                  אין פגישות קרובות ביומן
                </p>
              )}
            </div>
          </section>
          <section className="dashboard-panel" aria-labelledby="tasks-title">
            <PanelHeader
              id="tasks-title"
              title="משימות להיום"
              description={`${summary.activeTasks} משימות פתוחות בסך הכול`}
              href="/tasks"
              linkLabel="כל המשימות"
            />
            <div className="px-6 pb-5">
              <TaskList
                tasks={dueTasks}
                showLead
                emptyText="אין משימות להיום או באיחור"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function metricColor(key: MetricKey) {
  return `var(--metric-${key}, ${DEFAULT_METRIC_COLORS[key]})`;
}
function Metric({
  label,
  value,
  detail,
  icon,
  href,
  color,
  heroText,
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  heroText?: string;
}) {
  return (
    <Link
      href={href}
      className={`dashboard-metric relative isolate overflow-hidden rounded-2xl border p-5 transition-transform hover:-translate-y-0.5 ${heroText ? "border-transparent" : "bg-card"}`}
      style={
        {
          "--metric-color": color,
          ...(heroText ? { backgroundColor: color, color: heroText } : {}),
        } as React.CSSProperties
      }
    >
      {heroText && (
        <div
          className="pointer-events-none absolute -bottom-28 -left-16 -z-10 h-64 w-64 rounded-full border-[25px] border-current opacity-[0.06]"
          aria-hidden="true"
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-sm font-medium ${heroText ? "opacity-90" : "text-muted-foreground"}`}
        >
          {label}
        </span>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl [&_svg]:h-[18px] [&_svg]:w-[18px] ${heroText ? "bg-white/15" : "metric-icon"}`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 text-[42px] font-semibold leading-none tracking-tight tabular-nums">
        {value.toLocaleString("he-IL")}
      </div>
      <div
        className={`mt-4 text-[11px] ${heroText ? "opacity-90" : "text-muted-foreground"}`}
      >
        {detail}
      </div>
    </Link>
  );
}
function SmallMetric({
  value,
  label,
  color,
  href,
  icon,
}: {
  value: number;
  label: string;
  color: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span
        className="metric-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4"
        style={{ "--metric-color": color } as React.CSSProperties}
      >
        {icon}
      </span>
      <div>
        <div className="text-lg font-semibold leading-5 tabular-nums">
          {value}
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">{label}</div>
      </div>
    </Link>
  );
}
function PanelHeader({
  id,
  title,
  description,
  href,
  linkLabel,
}: {
  id: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-3">
      <div>
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        {linkLabel}
        <ArrowUpLeft className="h-3 w-3" />
      </Link>
    </div>
  );
}
function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary"
    >
      {name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")}
    </span>
  );
}
function Empty({
  icon,
  text,
  href,
  action,
}: {
  icon: React.ReactNode;
  text: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 py-5 text-center">
      <span className="text-muted-foreground [&_svg]:h-8 [&_svg]:w-8">
        {icon}
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link href={href} className="text-xs text-primary hover:underline">
        {action}
      </Link>
    </div>
  );
}
