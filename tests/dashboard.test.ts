import { describe, expect, it } from "vitest";
import type { Lead, Call, Meeting, Task } from "@prisma/client";
import { dashboardDay, dashboardSummary } from "../src/lib/dashboard";

const now = new Date("2026-10-24T18:00:00Z"); // 25 October in the follow-up timezone.
function lead(id: string, patch: Partial<Lead> = {}): Lead {
  return {
    id,
    ownerId: "owner",
    fullName: id,
    status: "NEW",
    source: "manual",
    createdAt: now,
    updatedAt: now,
    followUpDate: null,
    email: null,
    phone: null,
    company: null,
    websiteUrl: null,
    notes: null,
    ...patch,
  };
}

describe("dashboard totals and actionable work", () => {
  it("does not invent a conversion rate or activity for an empty account", () => {
    const result = dashboardSummary([], [], [], [], now);
    expect(result.winRate).toBeNull();
    expect(result.total).toBe(0);
    expect(result.recordings).toEqual([]);
    expect(result.stages.every((stage) => stage.count === 0)).toBe(true);
  });
  it("distinguishes stage counts from documents, meetings and recorded/analyzed calls", () => {
    const leads = [
      lead("new"),
      lead("proposal", { status: "PROPOSAL_SENT" }),
      lead("negotiation", { status: "NEGOTIATION" }),
      lead("won1", { status: "DEAL_CLOSED" }),
      lead("won2", { status: "DEAL_CLOSED" }),
      lead("lost", { status: "DEAL_LOST" }),
      lead("meeting", { status: "MEETING_SCHEDULED" }),
    ];
    const calls = [
      {
        id: "manual",
        audioUrl: null,
        transcript: "text",
        analyzedAt: now,
        occurredAt: now,
      },
      {
        id: "recorded",
        audioUrl: "private-storage-id",
        analyzedAt: null,
        occurredAt: now,
      },
      {
        id: "analyzed",
        audioUrl: "private-storage-id-2",
        analyzedAt: now,
        occurredAt: new Date("2026-10-20"),
      },
    ] as Call[];
    const result = dashboardSummary(leads, calls, [], [], now);
    expect(result).toMatchObject({
      total: 7,
      open: 4,
      won: 2,
      lost: 1,
      proposalsSent: 1,
      winRate: 67,
      meetingsThisWeek: 0,
      analyzedCalls: 1,
    });
    expect(result.proposals).toHaveLength(2);
    expect(result.recordings.map((call) => call.id)).toEqual([
      "recorded",
      "analyzed",
    ]);
    expect(result.stages.reduce((sum, stage) => sum + stage.count, 0)).toBe(7);
  });
  it("handles the local day boundary, completed work and the next seven days", () => {
    expect(dashboardDay(now)).toBe("2026-10-25");
    const leads = [
      lead("today", { followUpDate: "2026-10-25" }),
      lead("overdue", { followUpDate: "2026-10-24" }),
      lead("later", { followUpDate: "2026-10-26" }),
      lead("closed", { status: "DEAL_CLOSED", followUpDate: "2026-10-23" }),
    ];
    const tasks = [
      {
        id: "today",
        status: "PENDING",
        dueDate: new Date("2026-10-24T20:00:00Z"),
      },
      {
        id: "overdue",
        status: "IN_PROGRESS",
        dueDate: new Date("2026-10-24T10:00:00Z"),
      },
      { id: "done", status: "DONE", dueDate: new Date("2026-10-23") },
      { id: "canceled", status: "CANCELED", dueDate: new Date("2026-10-23") },
      { id: "undated", status: "PENDING", dueDate: null },
    ] as Task[];
    const meetings = [
      {
        id: "past",
        status: "SCHEDULED",
        scheduledAt: new Date(now.getTime() - 1),
      },
      { id: "now", status: "SCHEDULED", scheduledAt: now },
      {
        id: "later",
        status: "SCHEDULED",
        scheduledAt: new Date(now.getTime() + 7 * 86400000),
      },
      {
        id: "canceled",
        status: "CANCELED",
        scheduledAt: new Date(now.getTime() + 86400000),
      },
    ] as Meeting[];
    const result = dashboardSummary(leads, [], meetings, tasks, now);
    expect(result.followUps.map((lead) => lead.id)).toEqual([
      "overdue",
      "today",
    ]);
    expect(result.dueTasks.map((task) => task.id)).toEqual([
      "overdue",
      "today",
    ]);
    expect(result.overdueTasks).toBe(1);
    expect(result.activeTasks).toBe(3);
    expect(result.meetingsThisWeek).toBe(1);
    expect(result.upcoming.map((meeting) => meeting.id)).toEqual([
      "now",
      "later",
    ]);
  });
  it("groups source overflow without dropping any leads", () => {
    const leads = Array.from({ length: 9 }, (_, i) =>
      lead(String(i), { source: `source${i}` }),
    );
    leads.push(
      lead("missing", { source: null }),
      lead("blank", { source: " " }),
    );
    const result = dashboardSummary(leads, [], [], [], now);
    expect(result.sources).toHaveLength(6);
    expect(result.sources[0]).toEqual({ source: "unknown", count: 2 });
    expect(result.sources.reduce((sum, source) => sum + source.count, 0)).toBe(
      leads.length,
    );
  });
});
