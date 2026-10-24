"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/whatsapp/send";
import { randomBytes } from "node:crypto";
import { convexClient } from "@/lib/db/client";
import { api } from "../../../../convex/_generated/api";

const settingsSchema = z.object({
  fullName: z.string().trim().max(100).nullable(),
  calOrganizerEmail: z
    .string()
    .trim()
    .email("כתובת אימייל לא תקינה")
    .nullable()
    .or(z.literal("").transform(() => null)),
  whatsappNumber: z
    .string()
    .trim()
    .max(20)
    .regex(/^\d{8,20}$/, "מספר טלפון לא תקין (ספרות בלבד, כולל קידומת)")
    .nullable()
    .or(z.literal("").transform(() => null)),
  wassenderToken: z.string().trim().max(500).nullable(),
});

export type FormState = { error?: string; ok?: boolean };

export async function configureWebsiteWebhookAction(action: "create" | "rotate" | "disable") {
  await requireUser();
  if (!["create", "rotate", "disable"].includes(action)) return { error: "פעולה לא תקינה" };
  try {
    const client = await convexClient();
    await client.mutation(api.leadWebhooks.configure, {
      action,
      ...(action !== "disable" ? { token: randomBytes(32).toString("hex") } : {}),
    });
    const webhook = await client.query(api.leadWebhooks.current, {});
    revalidatePath("/settings");
    return { webhook };
  } catch {
    return { error: "לא ניתן לעדכן את הוובהוק כרגע. נסו שוב." };
  }
}

export async function updateSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const rawWhatsapp = ((formData.get("whatsappNumber") as string) ?? "").trim();
  const normalizedWhatsapp = rawWhatsapp ? normalizePhone(rawWhatsapp) : "";

  const parsed = settingsSchema.safeParse({
    fullName: ((formData.get("fullName") as string) ?? "").trim() || null,
    calOrganizerEmail:
      ((formData.get("calOrganizerEmail") as string) ?? "").trim() || null,
    whatsappNumber: normalizedWhatsapp || null,
    wassenderToken:
      ((formData.get("wassenderToken") as string) ?? "").trim() || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  await db.profile.update({
    where: { id: user.id },
    data: parsed.data,
  });
  revalidatePath("/settings");
  return { ok: true };
}
