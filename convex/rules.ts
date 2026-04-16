import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("rules")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect();
  },
});

export const create = mutation({
  args: {
    organisationId: v.id("organisations"),
    name: v.string(),
    description: v.string(),
    field: v.string(),
    operator: v.string(),
    value: v.number(),
    action: v.union(v.literal("ALERT"), v.literal("BLOCK"), v.literal("FLAG"), v.literal("REVIEW")),
    severity: v.union(v.literal("LOW"), v.literal("MEDIUM"), v.literal("HIGH"), v.literal("CRITICAL")),
    scoreBoost: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("rules", { ...args, isActive: true });
  },
});

export const toggle = mutation({
  args: { ruleId: v.id("rules"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.ruleId, { isActive: args.isActive });
  },
});

export const remove = mutation({
  args: { ruleId: v.id("rules") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.delete(args.ruleId);
  },
});

