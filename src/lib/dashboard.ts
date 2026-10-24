import type { Call, Lead, Meeting, Task } from "@prisma/client";
import { LEAD_STATUSES } from "./leads";

// Match the date-only follow-up convention used by the leads screen.
export function dashboardDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(
    date,
  );
}

export function dashboardSummary(
  leads: Lead[],
  calls: Call[],
  meetings: Meeting[],
  tasks: Task[],
  now: Date,
) {
  const today = dashboardDay(now);
  const stages = LEAD_STATUSES.map((status) => ({
    status,
    count: leads.filter((lead) => lead.status === status).length,
  }));
  const won = stages.find((s) => s.status === "DEAL_CLOSED")!.count;
  const lost = stages.find((s) => s.status === "DEAL_LOST")!.count;
  const open = leads.filter(
    (lead) => !["DEAL_CLOSED", "DEAL_LOST"].includes(lead.status),
  );
  const followUps = open
    .filter((lead) => lead.followUpDate && lead.followUpDate <= today)
    .sort(
      (a, b) =>
        a.followUpDate!.localeCompare(b.followUpDate!) ||
        a.fullName.localeCompare(b.fullName, "he"),
    );
  const activeTasks = tasks.filter(
    (task) => !["DONE", "CANCELED"].includes(task.status),
  );
  const dueTasks = activeTasks
    .filter((task) => task.dueDate && dashboardDay(task.dueDate) <= today)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
  const upcoming = meetings
    .filter(
      (meeting) => meeting.status === "SCHEDULED" && meeting.scheduledAt >= now,
    )
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const sourceCounts = new Map<string, number>();
  for (const lead of leads) {
    const source = lead.source?.trim() || "unknown";
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }
  const sortedSources = [...sourceCounts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const sources = sortedSources
    .slice(0, 5)
    .map(([source, count]) => ({ source, count }));
  if (sortedSources.length > 5)
    sources.push({
      source: "__other__",
      count: sortedSources.slice(5).reduce((sum, [, count]) => sum + count, 0),
    });
  return {
    today,
    stages,
    sources,
    total: leads.length,
    open: open.length,
    won,
    lost,
    winRate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null,
    newLeads: stages[0].count,
    proposalsSent: leads.filter((lead) => lead.status === "PROPOSAL_SENT")
      .length,
    proposals: leads
      .filter((lead) => ["PROPOSAL_SENT", "NEGOTIATION"].includes(lead.status))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    recordings: calls
      .filter((call) => !!call.audioUrl)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()),
    analyzedCalls: calls.filter((call) => !!call.audioUrl && !!call.analyzedAt)
      .length,
    followUps,
    dueTasks,
    activeTasks: activeTasks.length,
    overdueTasks: dueTasks.filter((task) => dashboardDay(task.dueDate!) < today)
      .length,
    upcoming,
    meetingsThisWeek: upcoming.filter(
      (meeting) => meeting.scheduledAt.getTime() < now.getTime() + 7 * 86400000,
    ).length,
  };
}
