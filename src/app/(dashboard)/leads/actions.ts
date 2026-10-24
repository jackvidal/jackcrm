"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  leadCreateSchema,
  leadUpdateSchema,
  leadNoteCreateSchema,
  leadStatusEnum,
  followUpDateSchema,
} from "@/schemas/lead";
import type { PipelineStatus } from "@/lib/leads";

export type FormState = { error?: string; ok?: boolean };

function parseForm(formData: FormData) {
  return {
    fullName: (formData.get("fullName") as string) ?? "",
    email: (formData.get("email") as string) ?? "",
    phone: (formData.get("phone") as string) ?? "",
    company: (formData.get("company") as string) ?? "",
    websiteUrl: (formData.get("websiteUrl") as string) ?? "",
    source: (formData.get("source") as string) ?? "manual",
    status: (formData.get("status") as string) ?? "NEW",
    notes: (formData.get("notes") as string) ?? "",
    followUpDate: (formData.get("followUpDate") as string) || null,
  };
}

export async function createLeadAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = leadCreateSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  const lead = await db.lead.create({
    data: { ...parsed.data, ownerId: user.id },
  });
  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function updateLeadAction(
  leadId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = leadUpdateSchema.safeParse(parseForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  const result = await db.lead.updateMany({
    where: { id: leadId, ownerId: user.id },
    data: parsed.data,
  });
  if (result.count === 0) return { error: "הליד לא נמצא" };

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}`);
}

export async function deleteLeadAction(leadId: string) {
  const user = await requireUser();
  await db.lead.deleteMany({
    where: { id: leadId, ownerId: user.id },
  });
  revalidatePath("/leads");
  redirect("/leads");
}

export async function quickUpdateStatusAction(
  leadId: string,
  status: PipelineStatus,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = leadStatusEnum.safeParse(status);
  if (!parsed.success) return { error: "סטטוס לא תקין" };
  const result = await db.lead.updateMany({
    where: { id: leadId, ownerId: user.id },
    data: { status: parsed.data },
  });
  if (!result.count) return { error: "הליד לא נמצא" };
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateFollowUpAction(leadId: string, date: string | null): Promise<FormState> {
  const user = await requireUser();
  const parsed = followUpDateSchema.safeParse(date);
  if (!parsed.success) return { error: "תאריך פולואפ לא תקין" };
  const result = await db.lead.updateMany({ where: { id: leadId, ownerId: user.id }, data: { followUpDate: parsed.data } });
  if (!result.count) return { error: "הליד לא נמצא" };
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function addNoteAction(
  leadId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = leadNoteCreateSchema.safeParse({
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }

  // Verify the lead belongs to the user
  const lead = await db.lead.findFirst({
    where: { id: leadId, ownerId: user.id },
    select: { id: true },
  });
  if (!lead) return { error: "הליד לא נמצא" };

  await db.leadNote.create({
    data: {
      leadId,
      authorId: user.id,
      content: parsed.data.content,
    },
  });
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function deleteNoteAction(leadId: string, noteId: string) {
  const user = await requireUser();
  await db.leadNote.deleteMany({
    where: { id: noteId, authorId: user.id },
  });
  revalidatePath(`/leads/${leadId}`);
}
