"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const settingsSchema = z.object({
  fullName: z.string().trim().max(100).nullable(),
  calOrganizerEmail: z
    .string()
    .trim()
    .email("כתובת אימייל לא תקינה")
    .nullable()
    .or(z.literal("").transform(() => null)),
});

export type FormState = { error?: string; ok?: boolean };

export async function updateSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse({
    fullName: ((formData.get("fullName") as string) ?? "").trim() || null,
    calOrganizerEmail:
      ((formData.get("calOrganizerEmail") as string) ?? "").trim() || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  await prisma.profile.update({
    where: { id: user.id },
    data: parsed.data,
  });
  revalidatePath("/settings");
  return { ok: true };
}
