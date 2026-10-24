"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { z } from "zod";

const credentials = z.object({
  email: z.string().trim().email("כתובת אימייל לא תקינה"),
  password: z.string().min(6, "סיסמה חייבת להיות באורך 6 תווים לפחות"),
});
export type AuthState = { error?: string; success?: string };

export function useLoginAction(flow: "signIn" | "signUp") {
  const { signIn } = useAuthActions();
  return async (_previous: AuthState, formData: FormData): Promise<AuthState> => {
    const parsed = credentials.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
    if (flow === "signUp" && !String(formData.get("fullName") ?? "").trim()) return { error: "שם מלא הוא שדה חובה" };
    formData.set("flow", flow);
    formData.set("email", parsed.data.email.toLowerCase());
    try {
      await signIn("password", formData);
      window.location.assign("/dashboard");
      return {};
    } catch {
      return { error: flow === "signIn" ? "אימייל או סיסמה שגויים" : "יצירת החשבון נכשלה. בדקו את הפרטים ונסו שוב." };
    }
  };
}
