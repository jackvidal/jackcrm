import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).nullable();

export const websiteLeadSchema = z.object({
  fullName: z.string().trim().min(1, "fullName is required").max(100),
  email: z.string().trim().email().max(254).toLowerCase().nullable(),
  phone: z.string().regex(/^\d{8,20}$/, "phone must contain 8–20 digits").nullable(),
  company: optionalText(200),
  websiteUrl: z.string().url().max(2000).refine((s) => /^https?:\/\//i.test(s), "websiteUrl must use http or https").nullable(),
  notes: optionalText(10000),
  source: z.string().trim().min(1).max(100),
}).refine((data) => data.email || data.phone, "email or phone is required");

export type WebsiteLead = z.infer<typeof websiteLeadSchema>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

// Flat JSON / form data, nested form_fields, and Elementor's fields.{id}.value.
// Field IDs remain explicit; arbitrary owner/status fields are never forwarded.
export function parseWebsiteLead(payload: unknown) {
  const root = record(payload);
  const fields = { ...root, ...record(root.form_fields), ...record(root.fields) };
  const get = (...keys: string[]): string | null => {
    for (const key of keys) {
      let value = fields[key] ?? fields[`form_fields[${key}]`] ?? fields[`fields[${key}][value]`];
      if (value && typeof value === "object") value = record(value).value;
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  };
  const phone = get("phone", "telephone", "tel", "mobile");
  const name = get("fullName", "full_name", "name")
    ?? [get("firstName", "first_name"), get("lastName", "last_name")].filter(Boolean).join(" ");
  return websiteLeadSchema.safeParse({
    fullName: name,
    email: get("email"),
    phone: phone ? phone.replace(/[\s+().-]/g, "") : null,
    company: get("company", "company_name"),
    websiteUrl: get("websiteUrl", "website_url", "website"),
    notes: get("notes", "message", "comments"),
    source: get("source", "utm_source") ?? "website",
  });
}

export function websiteSubmissionId(payload: unknown): string | null {
  const root = record(payload);
  for (const key of ["submissionId", "submission_id", "eventId", "event_id"]) {
    const value = root[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
