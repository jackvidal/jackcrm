"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
export async function refreshImportedLeadsAction() {
  await requireUser();
  revalidatePath("/leads"); revalidatePath("/dashboard");
}
