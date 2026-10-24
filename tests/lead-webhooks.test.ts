/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { parseWebsiteLead } from "../src/schemas/lead-webhook";

const modules = import.meta.glob("../convex/**/*.ts");
const token = "a".repeat(64);
const secondToken = "b".repeat(64);
const payload = { fullName: "ליד מטופס", email: "form@example.com", phone: "972501234567", company: null, websiteUrl: null, notes: "אשמח לפרטים", source: "website" };
const page = (table: "lead" | "leadNote", ownerId?: string) => ({ table, where: ownerId ? { ownerId } : {}, paginationOpts: { cursor: null, numItems: 100 } });
async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "owner" });
  const other = t.withIdentity({ subject: "other" });
  for (const [client, id] of [[owner, "owner"], [other, "other"]] as const) {
    await client.mutation(api.crm.commit, { commands: [{ table: "profile", operation: "create", data: { id, email: `${id}@example.com` } }] });
  }
  await owner.mutation(api.leadWebhooks.configure, { action: "create", token });
  const service = t.withIdentity({ subject: "jackcrm-service", role: "service", issuer: "https://jackcrm.internal" });
  return { t, owner, other, service };
}

describe("Website form webhook", () => {
  test("settings and tokens are scoped to the signed-in owner", async () => {
    const { t, owner, other } = await setup();
    await expect(t.query(api.leadWebhooks.current, {})).rejects.toThrow("Unauthorized");
    await expect(t.mutation(api.leadWebhooks.configure, { action: "disable" })).rejects.toThrow("Unauthorized");
    expect(await other.query(api.leadWebhooks.current, {})).toBeNull();
    await other.mutation(api.leadWebhooks.configure, { action: "disable" });
    expect(await owner.query(api.leadWebhooks.current, {})).toMatchObject({ token, enabled: true });
    await expect(other.mutation(api.leadWebhooks.configure, { action: "create", token })).rejects.toThrow("Token already exists");
  });

  test("ingestion requires service auth and an active token, and ignores caller owner/status", async () => {
    const { t, owner, other, service } = await setup();
    const args = { token, payload: { ...payload, ownerId: "other", status: "DEAL_CLOSED" }, deliveryId: "1".repeat(64) };
    await expect(t.mutation(api.leadWebhooks.receive, args)).rejects.toThrow("Unauthorized");
    await expect(owner.mutation(api.leadWebhooks.receive, args)).rejects.toThrow("Forbidden");
    expect(await service.mutation(api.leadWebhooks.receive, { ...args, token: secondToken })).toMatchObject({ ok: false, error: "unauthorized" });
    expect(await service.mutation(api.leadWebhooks.receive, args)).toMatchObject({ ok: true, created: true });
    expect((await owner.query(api.crm.page, page("lead"))).page[0]).toMatchObject({ ownerId: "owner", fullName: payload.fullName, status: "NEW", source: "website" });
    expect((await other.query(api.crm.page, page("lead"))).page).toHaveLength(0);
    await owner.mutation(api.leadWebhooks.configure, { action: "rotate", token: secondToken });
    expect(await service.mutation(api.leadWebhooks.receive, args)).toMatchObject({ error: "unauthorized" });
    await owner.mutation(api.leadWebhooks.configure, { action: "disable" });
    expect(await service.mutation(api.leadWebhooks.receive, { ...args, token: secondToken })).toMatchObject({ error: "unauthorized" });
  });

  test("retries are deduplicated, later inquiries retain notes and preserve the sales stage", async () => {
    const { owner, other, service } = await setup();
    await other.mutation(api.crm.commit, { commands: [{ table: "lead", operation: "create", data: { ownerId: "other", fullName: "Other", email: payload.email } }] });
    const args = { token, payload, deliveryId: "2".repeat(64) };
    await service.mutation(api.leadWebhooks.receive, args);
    expect(await service.mutation(api.leadWebhooks.receive, args)).toEqual({ ok: true, duplicate: true });
    const [lead] = (await owner.query(api.crm.page, page("lead"))).page;
    await owner.mutation(api.crm.commit, { commands: [{ table: "lead", operation: "update", where: { id: lead.id }, data: { status: "DEAL_CLOSED" } }] });
    await service.mutation(api.leadWebhooks.receive, { ...args, payload: { ...payload, notes: "פנייה נוספת" }, deliveryId: "3".repeat(64) });
    const leads = (await owner.query(api.crm.page, page("lead"))).page;
    expect(leads).toHaveLength(1);
    expect(leads[0].status).toBe("DEAL_CLOSED");
    const notes = (await owner.query(api.crm.page, page("leadNote"))).page;
    expect(notes).toHaveLength(1);
    expect(notes[0].content).toContain("פנייה נוספת");
    expect(await owner.query(api.leadWebhooks.current, {})).toMatchObject({ receivedCount: 2 });
  });

  test("conflicting contacts and malformed data do not partially create records", async () => {
    const { t, owner, service } = await setup();
    await owner.mutation(api.crm.commit, { commands: [
      { table: "lead", operation: "create", data: { ownerId: "owner", fullName: "Email", email: payload.email } },
      { table: "lead", operation: "create", data: { ownerId: "owner", fullName: "Phone", phone: payload.phone } },
    ] });
    const args = { token, payload, deliveryId: "4".repeat(64) };
    expect(await service.mutation(api.leadWebhooks.receive, args)).toMatchObject({ error: "contact_conflict" });
    expect(await service.mutation(api.leadWebhooks.receive, { ...args, payload: { ...payload, email: null, phone: null } })).toMatchObject({ error: "invalid_payload" });
    expect((await owner.query(api.crm.page, page("lead"))).page).toHaveLength(2);
    expect(await t.run((ctx) => ctx.db.query("webhookEvent").collect())).toHaveLength(0);
    expect(await owner.query(api.leadWebhooks.current, {})).toMatchObject({ receivedCount: 0 });
  });

  test("normalizes flat, nested and encoded form fields, rejecting invalid contacts", () => {
    const flat = parseWebsiteLead({ name: " ישראל ישראלי ", email: "ISRAEL@example.com", message: "שלום", phone: "+972 (50) 123-4567", ownerId: "ignored" });
    expect(flat.success && flat.data).toMatchObject({ fullName: "ישראל ישראלי", email: "israel@example.com", notes: "שלום", phone: "972501234567", source: "website" });
    expect(flat.success && "ownerId" in flat.data).toBe(false);
    const nested = parseWebsiteLead({ fields: { name: { value: "ישראל" }, email: { value: "lead@example.com" }, message: { value: "פנייה" } } });
    expect(nested.success && nested.data).toMatchObject({ fullName: "ישראל", email: "lead@example.com", notes: "פנייה" });
    const encoded = parseWebsiteLead({ "form_fields[first_name]": "ישראל", "form_fields[last_name]": "ישראלי", "form_fields[phone]": "050-1234567" });
    expect(encoded.success && encoded.data).toMatchObject({ fullName: "ישראל ישראלי", phone: "0501234567" });
    const advanced = parseWebsiteLead({ "fields[name][value]": "ישראל", "fields[email][value]": "lead@example.com" });
    expect(advanced.success && advanced.data).toMatchObject({ fullName: "ישראל", email: "lead@example.com" });
    expect(parseWebsiteLead({ form_fields: { name: "ישראל", email: "test@example.com" } }).success).toBe(true);
    for (const invalid of [{ name: "Only name" }, { email: "test@example.com" }, { name: "Bad email", email: "invalid" }, { name: "Bad phone", phone: "abc12345678" }, { name: "Bad URL", email: "a@example.com", website: "javascript:alert(1)" }]) expect(parseWebsiteLead(invalid).success).toBe(false);
  });
});
