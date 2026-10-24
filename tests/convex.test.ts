/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

const modules = import.meta.glob("../convex/**/*.ts");
const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: ownerId });
  const other = t.withIdentity({ subject: otherId });
  for (const [client, id] of [[owner, ownerId], [other, otherId]] as const) {
    await client.mutation(api.crm.commit, { commands: [{ table: "profile", operation: "create", data: { id, email: `${id}@example.com`, calOrganizerEmail: `${id}@example.com`, wassenderToken: id } }] });
  }
  const [lead] = await owner.mutation(api.crm.commit, { commands: [{ table: "lead", operation: "create", data: { ownerId, fullName: "לקוח בדיקה", email: "lead@example.com" } }] });
  return { t, owner, other, lead, service: t.withIdentity({ subject: "jackcrm-service", role: "service", issuer: "https://jackcrm.internal" }) };
}
const page = (table: "lead" | "task" | "meeting" | "profile" | "webhookEvent" | "whatsappMessage" | "call" | "websiteAnalysis" | "leadNote", where = {}) => ({ table, where, paginationOpts: { cursor: null, numItems: 100 } });

describe("Convex CRM migration", () => {
  test("anonymous and other users cannot read or mutate private records", async () => {
    const { t, owner, other, lead } = await setup();
    await expect(t.query(api.crm.page, page("lead"))).rejects.toThrow("Unauthorized");
    await expect(t.mutation(api.crm.commit, { commands: [] })).rejects.toThrow("Unauthorized");
    expect((await other.query(api.crm.page, page("lead", { id: lead.id }))).page).toEqual([]);
    expect((await owner.query(api.crm.page, page("lead"))).page).toHaveLength(1);
    await expect(other.mutation(api.crm.commit, { commands: [{ table: "lead", operation: "update", where: { id: lead.id }, data: { fullName: "stolen" } }] })).rejects.toThrow("Not found");
    await expect(owner.query(api.crm.page, page("webhookEvent"))).rejects.toThrow("Forbidden");
    const profiles = await owner.query(api.crm.page, page("profile"));
    expect(profiles.page.map((p: { id: string }) => p.id)).toEqual([ownerId]);
  });

  test("child and owner references are checked within the mutation", async () => {
    const { owner, other, lead } = await setup();
    await expect(other.mutation(api.crm.commit, { commands: [{ table: "task", operation: "create", data: { ownerId: otherId, leadId: lead.id, title: "attack" } }] })).rejects.toThrow("Not found");
    await expect(owner.mutation(api.crm.commit, { commands: [{ table: "lead", operation: "update", where: { id: lead.id }, data: { ownerId: otherId } }] })).rejects.toThrow("immutable");
    await expect(other.query(api.crm.page, page("websiteAnalysis", { leadId: lead.id }))).rejects.toThrow("Not found");
  });

  test("meeting and lead status commit atomically; failed batches roll back", async () => {
    const { owner, lead } = await setup();
    const [meeting] = await owner.mutation(api.crm.commit, { commands: [{ table: "meeting", operation: "create", data: { leadId: lead.id, ownerId, scheduledAt: Date.now() } }] });
    expect((await owner.query(api.crm.page, page("lead"))).page[0].status).toBe("MEETING_SCHEDULED");
    await owner.mutation(api.crm.commit, { commands: [{ table: "meeting", operation: "update", where: { id: meeting.id }, data: { status: "COMPLETED" } }] });
    expect((await owner.query(api.crm.page, page("lead"))).page[0].status).toBe("MEETING_COMPLETED");
    await expect(owner.mutation(api.crm.commit, { commands: [
      { table: "task", operation: "create", data: { ownerId, leadId: lead.id, title: "must rollback" } },
      { table: "task", operation: "create", data: { ownerId, leadId: "missing", title: "invalid" } },
    ] })).rejects.toThrow();
    expect((await owner.query(api.crm.page, page("task"))).page).toEqual([]);
  });

  test("meeting history excludes scheduled future meetings and includes canceled ones", async () => {
    const { owner, lead } = await setup();
    await owner.mutation(api.crm.commit, { commands: [
      { table: "meeting", operation: "create", data: { ownerId, leadId: lead.id, scheduledAt: 2000, status: "SCHEDULED" } },
      { table: "meeting", operation: "create", data: { ownerId, leadId: lead.id, scheduledAt: 2000, status: "CANCELED" } },
      { table: "meeting", operation: "create", data: { ownerId, leadId: lead.id, scheduledAt: 500, status: "SCHEDULED" } },
    ] });
    const history = await owner.query(api.crm.page, page("meeting", { OR: [{ scheduledAt: { lt: 1000 } }, { status: { not: "SCHEDULED" } }] }));
    expect(history.page).toHaveLength(2);
    expect(history.page.some((row: { scheduledAt: number; status: string }) => row.scheduledAt === 2000 && row.status === "SCHEDULED")).toBe(false);
  });

  test("lead deletion removes all history in scheduled batches", async () => {
    vi.useFakeTimers();
    try {
      const { t, owner, lead } = await setup();
      for (let batch = 0; batch < 2; batch++) await owner.mutation(api.crm.commit, { commands: Array.from({ length: 60 }, (_, i) => ({ table: "task" as const, operation: "create" as const, data: { ownerId, leadId: lead.id, title: `${batch}-${i}` } })) });
      await owner.mutation(api.crm.commit, { commands: [{ table: "lead", operation: "delete", where: { id: lead.id } }] });
      expect((await owner.query(api.crm.page, page("task"))).page).toEqual([]);
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await t.run((ctx) => ctx.db.query("task").collect())).toEqual([]);
    } finally { vi.useRealTimers(); }
  });

  test("Cal webhook is atomic, retryable, deduplicated and accepts later reschedules", async () => {
    const { t, owner, service } = await setup();
    const payload = { triggerEvent: "BOOKING_CREATED", payload: { uid: "cal-1", organizer: { email: `${ownerId}@example.com` }, attendees: [{ email: "booking@example.com", name: "Booking" }], startTime: "2026-10-25T10:00:00Z", endTime: "2026-10-25T10:30:00Z" } };
    await expect(owner.mutation(api.webhooks.cal, { payload, deliveryId: "1" })).rejects.toThrow("Forbidden");
    expect(await service.mutation(api.webhooks.cal, { payload, deliveryId: "1" })).toEqual({ ok: true });
    expect(await service.mutation(api.webhooks.cal, { payload, deliveryId: "1" })).toEqual({ ok: true, duplicate: true });
    const changed = { ...payload, triggerEvent: "BOOKING_RESCHEDULED", payload: { ...payload.payload, startTime: "2026-10-26T10:00:00Z", endTime: "2026-10-26T10:30:00Z" } };
    await service.mutation(api.webhooks.cal, { payload: changed, deliveryId: "2" });
    expect((await owner.query(api.crm.page, page("meeting"))).page[0].scheduledAt).toBe(Date.parse(changed.payload.startTime));
    await expect(service.mutation(api.webhooks.cal, { payload: { ...payload, payload: { ...payload.payload, organizer: { email: "missing@example.com" } } }, deliveryId: "bad" })).rejects.toThrow();
    expect((await t.run((ctx) => ctx.db.query("webhookEvent").collect())).length).toBe(2);
  });

  test("WhatsApp inbound, delivery receipts and duplicate events preserve one thread", async () => {
    const { owner, service } = await setup();
    const payload = { event: "messages.received", sessionId: ownerId, data: { messages: { key: { id: "wa-1", fromMe: false, cleanedSenderPn: "972501234567" }, message: { conversation: "שלום" }, messageTimestamp: 1790000000 } } };
    await service.mutation(api.webhooks.wassender, { payload, deliveryId: "wa-1" });
    expect(await service.mutation(api.webhooks.wassender, { payload, deliveryId: "wa-1" })).toMatchObject({ duplicate: true });
    await service.mutation(api.webhooks.wassender, { payload: { event: "message.read", sessionId: ownerId, data: { id: "wa-1" } }, deliveryId: "receipt" });
    const messages = await owner.query(api.crm.page, page("whatsappMessage"));
    expect(messages.page).toHaveLength(1);
    expect(messages.page[0]).toMatchObject({ body: "שלום", status: "READ", sentAt: 1790000000000 });
  });

  test("migration preserves IDs, dates, JSON and tokens; reruns are safe", async () => {
    const { t, owner, lead } = await setup();
    const rows = (await owner.query(api.crm.page, page("lead"))).page;
    expect(await t.mutation(internal.migration.importBatch, { table: "lead", rows })).toEqual({ inserted: 0, skipped: 1 });
    expect(await t.query(internal.migration.verifyBatch, { table: "lead", rows })).toEqual({ verified: 1 });
    await expect(t.mutation(internal.migration.importBatch, { table: "lead", rows: [{ ...rows[0], fullName: "stale snapshot" }] })).rejects.toThrow("conflict");
    const analysis = { id: "33333333-3333-4333-8333-333333333333", leadId: lead.id, url: "https://example.com", summary: "שלום", issues: ["x"], opportunities: [], recommendedServices: [], recommendedNextSteps: [], modelUsed: "original-model", rawResponse: { nested: { text: "createdAt", createdAt: "not a date" } }, createdAt: 123456789 };
    await t.mutation(internal.migration.importBatch, { table: "websiteAnalysis", rows: [analysis] });
    expect((await owner.query(api.crm.page, page("websiteAnalysis", { leadId: lead.id }))).page).toEqual([analysis]);
  });
});
