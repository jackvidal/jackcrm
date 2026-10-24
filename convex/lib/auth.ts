import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";

export type Principal = { userId: string; service: boolean };
export async function principal(ctx: Pick<QueryCtx, "auth">): Promise<Principal> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Unauthorized");
  const service = identity.issuer === "https://jackcrm.internal" && identity.role === "service" && identity.subject === "jackcrm-service";
  return { userId: service ? identity.subject : (await getAuthUserId(ctx))!, service };
}
export function requireService(user: Principal) {
  if (!user.service) throw new ConvexError("Forbidden");
}
