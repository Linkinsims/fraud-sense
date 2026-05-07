import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const userId = "public_user";
    if (!userId) return [];
    return await ctx.db
      .query("cases")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    organisationId: v.id("organisations"),
    title: v.string(),
    priority: v.union(v.literal("LOW"), v.literal("MEDIUM"), v.literal("HIGH"), v.literal("CRITICAL")),
    transactionIds: v.array(v.id("transactions")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = "public_user";
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("cases")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect();
    const caseNumber = `FS-2024-${String(existing.length + 1).padStart(5, "0")}`;

    let totalAmount = 0;
    for (const txId of args.transactionIds) {
      const tx = await ctx.db.get(txId);
      if (tx) totalAmount += tx.amount;
    }

    const caseId = await ctx.db.insert("cases", {
      caseNumber,
      title: args.title,
      status: "OPEN",
      priority: args.priority,
      organisationId: args.organisationId,
      notes: args.notes,
      totalAmount,
    });

    for (const txId of args.transactionIds) {
      await ctx.db.patch(txId, { caseId });
    }

    return caseId;
  },
});

export const updateStatus = mutation({
  args: {
    caseId: v.id("cases"),
    status: v.union(
      v.literal("OPEN"),
      v.literal("INVESTIGATING"),
      v.literal("ESCALATED"),
      v.literal("RESOLVED"),
      v.literal("CLOSED")
    ),
  },
  handler: async (ctx, args) => {
    const userId = "public_user";
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.caseId, { status: args.status });
  },
});

export const addNote = mutation({
  args: { caseId: v.id("cases"), notes: v.string() },
  handler: async (ctx, args) => {
    const userId = "public_user";
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.caseId, { notes: args.notes });
  },
});

