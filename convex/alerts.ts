import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    organisationId: v.id("organisations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = "public_user";
    if (!userId) return [];
    return await ctx.db
      .query("alerts")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .order("desc")
      .take(args.limit ?? 100);
  },
});

export const getUnreadCount = query({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const userId = "public_user";
    if (!userId) return 0;
    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect();
    return alerts.filter((a) => !a.isRead).length;
  },
});

export const markRead = mutation({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, args) => {
    const userId = "public_user";
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.alertId, { isRead: true });
  },
});

export const markResolved = mutation({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, args) => {
    const userId = "public_user";
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.alertId, { isRead: true, isResolved: true });
  },
});

export const markAllRead = mutation({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const userId = "public_user";
    if (!userId) throw new Error("Not authenticated");
    const unread = await ctx.db
      .query("alerts")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .collect();
    for (const alert of unread.filter((a) => !a.isRead)) {
      await ctx.db.patch(alert._id, { isRead: true });
    }
  },
});

