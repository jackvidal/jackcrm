import { cache } from "react";
import { redirect } from "next/navigation";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { db } from "@/lib/db";
import type { Profile } from "@prisma/client";

export const getCurrentUser = cache(async (): Promise<Profile | null> => {
  if (!await convexAuthNextjsToken()) return null;
  // Convex scopes this query to the authenticated subject. The profile is
  // created atomically during signup, so rendering never writes to the DB.
  return db.profile.findFirst();
});

export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login");
  return profile;
}
