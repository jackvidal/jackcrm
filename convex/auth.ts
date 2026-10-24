import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { z } from "zod";
import type { MutationCtx } from "./_generated/server";
import { defaults } from "./lib/models";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password({
    profile(params) {
      const email = z.string().trim().email().parse(params.email).toLowerCase();
      const name = params.flow === "signUp" ? z.string().trim().min(1).max(100).parse(params.fullName) : undefined;
      return { email, ...(name ? { name } : {}) };
    },
    validatePasswordRequirements(password) {
      if (password.length < 6) throw new ConvexError("סיסמה חייבת להיות באורך 6 תווים לפחות");
    },
  })],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, profile }) {
      const db = ctx.db as MutationCtx["db"];
      const existing = await db.query("profile").withIndex("by_legacy_id", (q) => q.eq("id", userId)).unique();
      if (!existing) await db.insert("profile", {
        ...defaults.profile,
        id: userId,
        email: profile.email ?? "",
        fullName: typeof profile.name === "string" ? profile.name : null,
        createdAt: Date.now(),
      });
    },
  },
});
