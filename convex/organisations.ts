import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getOrCreate = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("organisations")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first();

    if (existing) return existing;

    const orgId = await ctx.db.insert("organisations", {
      name: "My Organisation",
      type: "FINTECH",
      plan: "STARTER",
      ownerId: userId,
    });

    // Seed default rules
    const defaultRules = [
      {
        name: "High Amount Alert",
        description: "Flag transactions over R50,000",
        field: "amount",
        operator: "gt",
        value: 50000,
        action: "ALERT" as const,
        severity: "HIGH" as const,
        scoreBoost: 20,
      },
      {
        name: "Very High Amount Block",
        description: "Block transactions over R100,000",
        field: "amount",
        operator: "gt",
        value: 100000,
        action: "BLOCK" as const,
        severity: "CRITICAL" as const,
        scoreBoost: 40,
      },
      {
        name: "Foreign Transaction Flag",
        description: "Flag non-ZA transactions",
        field: "amount",
        operator: "gt",
        value: 5000,
        action: "FLAG" as const,
        severity: "MEDIUM" as const,
        scoreBoost: 15,
      },
    ];

    for (const rule of defaultRules) {
      await ctx.db.insert("rules", {
        ...rule,
        organisationId: orgId,
        isActive: true,
      });
    }

    return await ctx.db.get(orgId);
  },
});

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("organisations")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first();
  },
});

export const update = mutation({
  args: {
    name: v.string(),
    type: v.union(v.literal("BANK"), v.literal("FINTECH"), v.literal("PAYMENT_PROCESSOR")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const org = await ctx.db
      .query("organisations")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first();
    if (!org) throw new Error("Organisation not found");
    await ctx.db.patch(org._id, { name: args.name, type: args.type });
  },
});

