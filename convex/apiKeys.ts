import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

function generateKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "fs_live_";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const list = query({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("apiKeys")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect();
  },
});

export const create = mutation({
  args: {
    organisationId: v.id("organisations"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const key = generateKey();
    return await ctx.db.insert("apiKeys", {
      name: args.name,
      key,
      organisationId: args.organisationId,
      active: true,
    });
  },
});

export const revoke = mutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.keyId, { active: false });
  },
});

