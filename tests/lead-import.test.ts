/// <reference types="vite/client" />
import { readFile } from "node:fs/promises";
import readExcel from "read-excel-file/node";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { importLeadSchema, mapImportRows, separateFileDuplicates, suggestMapping, type ImportCell } from "../src/lib/lead-import";
import { parseCsv, prepareSheet, readImportFile } from "../src/lib/lead-import-file";

const modules = import.meta.glob("../convex/**/*.ts");
const lead = (overrides: Record<string, unknown> = {}) => importLeadSchema.parse({ fullName: "נועה בדיקה", email: "import@example.com", phone: null, company: null, websiteUrl: null, source: "import", status: "NEW", followUpDate: null, notes: null, ...overrides });
const requestId = "11111111-1111-4111-8111-111111111111";
async function setup() {
  const t = convexTest(schema, modules), owner = t.withIdentity({ subject: "import-owner" }), other = t.withIdentity({ subject: "other" });
  for (const [client, id] of [[owner, "import-owner"], [other, "other"]] as const) await client.mutation(api.crm.commit, { commands: [{ table: "profile", operation: "create", data: { id, email: `${id}@example.com` } }] });
  const count = async () => (await owner.query(api.crm.page, { table: "lead", paginationOpts: { cursor: null, numItems: 100 } })).page;
  return { t, owner, other, count };
}

describe("Bulk lead import", () => {
  test("CSV preserves Hebrew, leading zeroes, quoted delimiters/newlines and row numbers", () => {
    const sheet = parseCsv('\uFEFFשם מלא;טלפון;הערות;סטטוס;תאריך פולואפ\r\n"נועה; לוי";0501234567;"שורה ראשונה\nשורה שנייה";פולואפ;24/10/2026\r\n;;;;\r\nאיתי;0507654321;;חדש;');
    const checked = mapImportRows(sheet, suggestMapping(sheet.headers), { חדש: "NEW" }, "NEW");
    expect(checked[0].data).toMatchObject({ fullName: "נועה; לוי", phone: "0501234567", status: "FOLLOW_UP", followUpDate: "2026-10-24", notes: "שורה ראשונה\nשורה שנייה" });
    expect(checked[1].row).toBe(4);
    expect(checked[1].data?.status).toBe("NEW");
    expect(() => parseCsv('name,email\n"unclosed,x@example.com')).toThrow("מבנה CSV");
  });
  test("XLSX fixture decodes text phone and Excel date, numeric phone and invalid dates are flagged", async () => {
    const bytes = await readFile(new URL("./fixtures/lead-import.xlsx", import.meta.url));
    const workbook = await readExcel(bytes);
    const [throughFileInput] = await readImportFile(new File([bytes], "leads.xlsx"), "utf-8");
    expect(throughFileInput.error).toBeUndefined();
    expect(throughFileInput.rows[0].cells[2]).toBe("0501234567");
    const sheet = prepareSheet(workbook[0].sheet, workbook[0].data as unknown as ImportCell[][]);
    const row = mapImportRows(sheet, suggestMapping(sheet.headers), {}, "NEW")[0];
    expect(row.data).toMatchObject({ phone: "0501234567", followUpDate: "2026-10-24", status: "FOLLOW_UP" });
    sheet.rows[0].cells[2] = 501234567;
    expect(mapImportRows(sheet, suggestMapping(sheet.headers), {}, "NEW")[0].reason).toContain("אפס מוביל");
    sheet.rows[0].cells[2] = "0501234567"; sheet.rows[0].cells[4] = "31/02/2026";
    expect(mapImportRows(sheet, suggestMapping(sheet.headers), {}, "NEW")[0].reason).toContain("תאריך לא תקין");
  });
  test("file duplicates and unknown status are explicit; first/last names can be combined", () => {
    const sheet = parseCsv('first_name,last_name,email,stage\nNoa,Levi,NOA@example.com,new\nNoa,Levi,noa@example.com,new\nItay,Cohen,itay@example.com,custom');
    const result = separateFileDuplicates(mapImportRows(sheet, suggestMapping(sheet.headers), {}, "NEW"));
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].data.fullName).toBe("Noa Levi");
    expect(result.outcomes.map((row) => row.status)).toEqual(["duplicate", "invalid"]);
    expect(() => prepareSheet("oversized", [["name"], ...Array.from({ length: 5001 }, () => ["name"])] )).toThrow("5,000");
  });
  test("preview never writes; commit is owner-scoped and skips invalid fields", async () => {
    const { t, owner, other, count } = await setup();
    const rows = [{ row: 2, data: lead() }];
    expect((await owner.query(api.leadImports.preview, { rows }))[0].status).toBe("ready");
    expect(await count()).toHaveLength(0);
    await expect(t.mutation(api.leadImports.commit, { requestId, rows })).rejects.toThrow("Unauthorized");
    const result = await owner.mutation(api.leadImports.commit, { requestId, rows: [...rows, { row: 3, data: { ...lead(), ownerId: "other" } }, { row: 4, data: { ...lead(), followUpDate: "2026-02-30" } }] });
    expect(result.map((row) => row.status)).toEqual(["created", "invalid", "invalid"]);
    expect(await count()).toHaveLength(1);
    expect((await other.query(api.leadImports.preview, { rows }))[0].status).toBe("ready");
    await other.mutation(api.leadImports.commit, { requestId, rows });
    expect(await count()).toHaveLength(1);
  });
  test("normalized duplicate/conflict checks preserve current sales data, including a concurrent insert", async () => {
    const { owner, count } = await setup();
    await owner.mutation(api.crm.commit, { commands: [
      { table: "lead", operation: "create", data: { ownerId: "import-owner", fullName: "Existing", email: " IMPORT@Example.com ", status: "DEAL_CLOSED" } },
      { table: "lead", operation: "create", data: { ownerId: "import-owner", fullName: "Other", phone: "+972 (50) 123-4567" } },
    ] });
    const rows = [{ row: 2, data: lead() }, { row: 3, data: lead({ phone: "972501234567" }) }];
    const before = await count();
    expect((await owner.mutation(api.leadImports.commit, { requestId, rows })).map((row) => row.status)).toEqual(["duplicate", "conflict"]);
    expect(await count()).toEqual(before);
    const fresh = [{ row: 4, data: lead({ email: "fresh@example.com" }) }];
    expect((await owner.query(api.leadImports.preview, { rows: fresh }))[0].status).toBe("ready");
    await owner.mutation(api.crm.commit, { commands: [{ table: "lead", operation: "create", data: { ownerId: "import-owner", fullName: "Concurrent", email: "fresh@example.com" } }] });
    expect((await owner.mutation(api.leadImports.commit, { requestId, rows: fresh }))[0].status).toBe("duplicate");
  });
  test("retry returns the original created outcome; repeat imports also dedupe contactless rows", async () => {
    const { owner, count } = await setup();
    const rows = [{ row: 2, data: lead({ email: null }) }];
    expect((await owner.mutation(api.leadImports.commit, { requestId, rows }))[0].status).toBe("created");
    expect((await owner.mutation(api.leadImports.commit, { requestId, rows }))[0].status).toBe("created");
    expect(await count()).toHaveLength(1);
    expect((await owner.mutation(api.leadImports.commit, { requestId: "22222222-2222-4222-8222-222222222222", rows }))[0].status).toBe("duplicate");
    const [stored] = await count();
    await owner.mutation(api.crm.commit, { commands: [{ table: "lead", operation: "delete", where: { id: stored.id } }] });
    expect((await owner.mutation(api.leadImports.commit, { requestId, rows }))[0].status).toBe("created");
    expect(await count()).toHaveLength(1);
  });
  test("contact keys backfill is bounded, required before import, and maintained when a lead is edited", async () => {
    const { t, owner, count } = await setup();
    await owner.mutation(api.crm.commit, { commands: [{ table: "lead", operation: "create", data: { ownerId: "import-owner", fullName: "Legacy", email: "IMPORT@example.com" } }] });
    await t.run(async (ctx) => { const row = (await ctx.db.query("lead").collect())[0]; await ctx.db.patch(row._id, { emailKey: undefined, phoneKey: undefined, contactKeysVersion: undefined }); });
    const rows = [{ row: 2, data: lead() }];
    await expect(owner.query(api.leadImports.preview, { rows })).rejects.toThrow("מכינה");
    expect(await t.mutation(internal.leadImports.backfillContactKeys, {})).toMatchObject({ processed: 1, done: true });
    expect((await owner.query(api.leadImports.preview, { rows }))[0].status).toBe("duplicate");
    const [stored] = await count();
    await owner.mutation(api.crm.commit, { commands: [{ table: "lead", operation: "update", where: { id: stored.id }, data: { email: "changed@example.com" } }] });
    expect((await owner.query(api.leadImports.preview, { rows }))[0].status).toBe("ready");
    await expect(owner.mutation(api.leadImports.commit, { requestId, rows: Array.from({ length: 26 }, (_, i) => ({ row: i + 2, data: lead() })) })).rejects.toThrow("Invalid import batch");
  });
});
