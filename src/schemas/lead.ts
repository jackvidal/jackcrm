import { z } from "zod";
import { LEAD_STATUSES, isDateOnly } from "@/lib/leads";

export const leadStatusEnum = z.enum(LEAD_STATUSES);
export const followUpDateSchema = z.string().refine(isDateOnly, "תאריך פולואפ לא תקין").nullable();
export type LeadStatusValue = z.infer<typeof leadStatusEnum>;

const optionalString = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? null : v))
  .nullable();

export const leadCreateSchema = z.object({
  fullName: z.string().trim().min(1, "שם מלא הוא שדה חובה").max(200),
  email: z
    .string()
    .trim()
    .email("כתובת אימייל לא תקינה")
    .nullable()
    .or(z.literal("").transform(() => null)),
  phone: optionalString.refine((v) => !v || v.length <= 30, "טלפון ארוך מדי"),
  company: optionalString,
  websiteUrl: z
    .string()
    .trim()
    .url("כתובת אתר לא תקינה")
    .nullable()
    .or(z.literal("").transform(() => null)),
  source: optionalString,
  status: leadStatusEnum.default("NEW"),
  notes: optionalString,
  followUpDate: followUpDateSchema.optional(),
});

export const leadUpdateSchema = leadCreateSchema.partial();

export const leadNoteCreateSchema = z.object({
  content: z.string().trim().min(1, "הערה לא יכולה להיות ריקה").max(5000),
});

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;
