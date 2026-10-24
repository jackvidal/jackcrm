import { z } from "zod";
import { isDateOnly, LEAD_STATUSES, type PipelineStatus } from "./leads";
import { t } from "../i18n/he";

export const IMPORT_LIMIT = 5000;
export const IMPORT_BATCH = 25;
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_FIELDS = { fullName: "שם מלא", firstName: "שם פרטי", lastName: "שם משפחה", email: "אימייל", phone: "טלפון", company: "חברה", websiteUrl: "אתר", source: "מקור", status: "סטטוס", followUpDate: "תאריך פולואפ", notes: "הערות" } as const;
export type ImportField = keyof typeof IMPORT_FIELDS;
export type ColumnMapping = Partial<Record<ImportField, number>>;
export type ImportCell = string | number | boolean | Date | null;
export type ImportSheet = { name: string; headers: string[]; rows: { row: number; cells: ImportCell[] }[]; error?: string };
export type ImportOutcome = { row: number; status: "ready" | "created" | "duplicate" | "invalid" | "conflict"; reason: string };

export function emailKey(value: string | null | undefined) { return value?.trim().toLowerCase() || null; }
export function phoneKey(value: string | null | undefined) { return value?.replace(/\D/g, "") || null; }
const optional = (max: number) => z.string().trim().max(max, `הערך מוגבל ל־${max} תווים`).nullable().transform((v) => v || null);
export const importLeadSchema = z.object({
  fullName: z.string().trim().min(1, "חסר שם מלא או שם פרטי").max(200, "השם מוגבל ל־200 תווים"),
  email: optional(254).refine((v) => !v || z.string().email().safeParse(v).success, "כתובת אימייל לא תקינה").transform(emailKey),
  phone: optional(30).refine((v) => !v || (/^[+\d\s().-]+$/.test(v) && /^\d{7,20}$/.test(phoneKey(v) ?? "")), "טלפון לא תקין; שמרו טלפונים כטקסט עם הקידומת"),
  company: optional(300),
  websiteUrl: optional(2000).refine((v) => !v || /^https?:\/\//i.test(v) && z.string().url().safeParse(v).success, "כתובת אתר צריכה להתחיל ב־https:// או http://"),
  source: optional(100),
  status: z.enum(LEAD_STATUSES),
  followUpDate: optional(10).refine((v) => !v || isDateOnly(v), "תאריך לא תקין; השתמשו ב־YYYY-MM-DD או DD/MM/YYYY"),
  notes: optional(5000),
}).strict();
export type ImportLead = z.infer<typeof importLeadSchema>;
export type ImportRow = { row: number; data: ImportLead };
export type CheckedRow = { row: number; data?: ImportLead; name: string; reason?: string };

const normalize = (text: string) => text.toLowerCase().replace(/[\s_\-"'״׳]/g, "");
const aliases: Record<ImportField, string[]> = {
  fullName: ["שם", "שם מלא", "שם ליד", "שם לקוח", "fullName", "name", "contact name"],
  firstName: ["שם פרטי", "firstName"], lastName: ["שם משפחה", "lastName", "surname"],
  email: ["אימייל", "מייל", "דואר אלקטרוני", "דואל", "email", "email address"],
  phone: ["טלפון", "נייד", "מספר טלפון", "phone", "mobile", "telephone"],
  company: ["חברה", "עסק", "שם העסק", "company", "organization"], websiteUrl: ["אתר", "אתר אינטרנט", "website", "websiteUrl", "url"],
  source: ["מקור", "מקור ליד", "source", "lead source"], status: ["סטטוס", "שלב", "מצב", "status", "stage"],
  followUpDate: ["תאריך פולואפ", "פולואפ הבא", "followUpDate", "follow up date"], notes: ["הערות", "תיאור", "notes", "description", "message"],
};
export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}; const used = new Set<number>();
  for (const field of Object.keys(IMPORT_FIELDS) as ImportField[]) {
    const index = headers.findIndex((header, i) => !used.has(i) && aliases[field].some((alias) => normalize(alias) === normalize(header)));
    if (index >= 0) { mapping[field] = index; used.add(index); }
  }
  return mapping;
}
export function cellText(value: ImportCell | undefined): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value == null ? "" : String(value).trim();
}
export function suggestStatus(value: string): PipelineStatus | "" {
  const text = normalize(value);
  const stage = LEAD_STATUSES.find((key) => normalize(key) === text || normalize(t.leads.status[key]) === text);
  if (stage) return stage;
  const alternatives: Record<string, PipelineStatus> = { newlead: "NEW", followup: "FOLLOW_UP", won: "DEAL_CLOSED", closedwon: "DEAL_CLOSED", lost: "DEAL_LOST", closedlost: "DEAL_LOST", נסגר: "DEAL_CLOSED", אבד: "DEAL_LOST" };
  return Object.hasOwn(alternatives, text) ? alternatives[text] : "";
}
function dateText(value: string) {
  const match = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : value;
}
export function mapImportRows(sheet: ImportSheet, mapping: ColumnMapping, statuses: Record<string, string>, defaultStatus: PipelineStatus): CheckedRow[] {
  return sheet.rows.map(({ row, cells }) => {
    const get = (field: ImportField) => cellText(mapping[field] === undefined ? null : cells[mapping[field]!]);
    const fullName = get("fullName") || [get("firstName"), get("lastName")].filter(Boolean).join(" ");
    if (mapping.phone !== undefined && typeof cells[mapping.phone] === "number") return { row, name: fullName, reason: "הטלפון שמור כמספר ב־Excel ועלול לאבד אפס מוביל. הגדירו את התא כטקסט ובדקו את המספר." };
    const statusText = get("status");
    const status = statusText ? (Object.hasOwn(statuses, statusText) ? statuses[statusText] : suggestStatus(statusText)) : defaultStatus;
    if (!status) return { row, name: fullName, reason: `יש למפות את הסטטוס ״${statusText.slice(0, 100)}״ לשלב במערכת` };
    const parsed = importLeadSchema.safeParse({ fullName, email: get("email"), phone: get("phone"), company: get("company"), websiteUrl: get("websiteUrl"), source: get("source") || "import", status, followUpDate: dateText(get("followUpDate")), notes: get("notes") });
    return parsed.success ? { row, name: fullName, data: parsed.data } : { row, name: fullName, reason: parsed.error.issues.map((issue) => issue.message).join("; ") };
  });
}
export function separateFileDuplicates(rows: CheckedRow[]) {
  const email = new Set<string>(), phone = new Set<string>(), exact = new Set<string>();
  const candidates: ImportRow[] = [], outcomes: ImportOutcome[] = [];
  for (const row of rows) {
    if (!row.data) { outcomes.push({ row: row.row, status: "invalid", reason: row.reason! }); continue; }
    const e = emailKey(row.data.email), p = phoneKey(row.data.phone), signature = JSON.stringify(row.data);
    if (e && email.has(e) || p && phone.has(p) || exact.has(signature)) { outcomes.push({ row: row.row, status: "duplicate", reason: "כפילות בתוך הקובץ לפי אימייל, טלפון או שורה זהה" }); continue; }
    if (e) email.add(e); if (p) phone.add(p); exact.add(signature); candidates.push({ row: row.row, data: row.data });
  }
  return { candidates, outcomes };
}
export async function importFingerprint(data: ImportLead) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(data)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
