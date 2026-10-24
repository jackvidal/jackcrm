/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { LEAD_STATUSES, isDateOnly } from "../src/lib/leads";
import { leadWhere } from "../src/lib/lead-query";
import { matches, type Where } from "../convex/lib/filters";

const modules = import.meta.glob("../convex/**/*.ts");
async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "pipeline-owner" });
  const other = t.withIdentity({ subject: "pipeline-other" });
  await owner.mutation(api.crm.commit, { commands: [{ table: "profile", operation: "create", data: { id: "pipeline-owner", email: "pipeline@example.com", calOrganizerEmail: "pipeline@example.com" } }] });
  const create = async (status: typeof LEAD_STATUSES[number], followUpDate?: string | null) => (await owner.mutation(api.crm.commit, { commands: [{ table: "lead", operation: "create", data: { ownerId: "pipeline-owner", fullName: status, status, ...(followUpDate !== undefined ? { followUpDate } : {}) } }] }))[0];
  return { t, owner, other, create };
}

describe("Lead pipeline and follow-ups", () => {
  test("all stages round-trip; other users cannot change status or follow-up date", async () => {
    const { owner, other, create } = await setup();
    const lead = await create("NEW");
    for (const status of LEAD_STATUSES) {
      await owner.mutation(api.crm.commit, { commands: [{ table: "lead", operation: "update", where: { id: lead.id }, data: { status, followUpDate: "2026-10-25" } }] });
      const result = await owner.query(api.crm.page, { table: "lead", where: { id: lead.id }, paginationOpts: { cursor: null, numItems: 1 } });
      expect(result.page[0]).toMatchObject({ status, followUpDate: "2026-10-25" });
    }
    await expect(other.mutation(api.crm.commit, { commands: [{ table: "lead", operation: "update", where: { id: lead.id }, data: { status: "FOLLOW_UP", followUpDate: null } }] })).rejects.toThrow("Not found");
    await expect(owner.mutation(api.crm.commit, { commands: [{ table: "lead", operation: "update", where: { id: lead.id }, data: { followUpDate: "2026-02-30" } }] })).rejects.toThrow("Invalid follow-up date");
    await owner.mutation(api.crm.commit, { commands: [{ table: "lead", operation: "update", where: { id: lead.id }, data: { followUpDate: null } }] });
  });

  test("follow-up filters exclude closed leads and keep missing dates out of overdue", async () => {
    const { owner, create } = await setup();
    await create("FOLLOW_UP", "2026-10-24");
    await create("CONTACTED", "2026-10-23");
    await create("PROPOSAL_SENT", "2026-10-25");
    await create("NEW");
    await create("DEAL_CLOSED", "2026-10-23");
    const read = (followUp: string) => owner.query(api.crm.page, { table: "lead", where: leadWhere("pipeline-owner", { followUp }, "2026-10-24"), paginationOpts: { cursor: null, numItems: 100 } });
    expect((await read("today")).page.map((x: { status: string }) => x.status)).toEqual(["FOLLOW_UP"]);
    expect((await read("overdue")).page.map((x: { status: string }) => x.status)).toEqual(["CONTACTED"]);
    expect((await read("none")).page.map((x: { status: string }) => x.status)).toEqual(["NEW"]);
    // Rows written before the optional field was introduced remain searchable.
    expect(matches({ ownerId: "pipeline-owner", status: "NEW" }, leadWhere("pipeline-owner", { followUp: "none" }, "2026-10-24") as Where)).toBe(true);
    expect(matches({ ownerId: "pipeline-owner", status: "NEW" }, leadWhere("pipeline-owner", { followUp: "overdue" }, "2026-10-24") as Where)).toBe(false);
  });

  test("meeting automation advances early stages without regressing proposals or closed deals", async () => {
    const { owner, create } = await setup();
    for (const status of ["CONTACTED", "FOLLOW_UP", "PROPOSAL_SENT", "NEGOTIATION", "DEAL_CLOSED"] as const) {
      const lead = await create(status);
      await owner.mutation(api.crm.commit, { commands: [{ table: "meeting", operation: "create", data: { ownerId: "pipeline-owner", leadId: lead.id, scheduledAt: Date.now() } }] });
      const result = await owner.query(api.crm.page, { table: "lead", where: { id: lead.id }, paginationOpts: { cursor: null, numItems: 1 } });
      expect(result.page[0].status).toBe(["CONTACTED", "FOLLOW_UP"].includes(status) ? "MEETING_SCHEDULED" : status);
    }
  });

  test("date-only validation and combined searches are deterministic", () => {
    expect(isDateOnly("2028-02-29")).toBe(true);
    for (const date of ["2026-02-29", "2026-13-01", "2026-10-24T10:00:00Z", "", "not-a-date"]) expect(isDateOnly(date)).toBe(false);
    const where = leadWhere("owner", { q: "050", status: "FOLLOW_UP", followUp: "today", day: "2026-10-25" }, "2026-10-24");
    expect(matches({ ownerId: "owner", phone: "0501234567", status: "FOLLOW_UP", followUpDate: "2026-10-25" }, where as Where)).toBe(true);
    expect(matches({ ownerId: "other", phone: "0501234567", status: "FOLLOW_UP", followUpDate: "2026-10-25" }, where as Where)).toBe(false);
  });
});
