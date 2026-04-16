"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const ingestTransaction = internalAction({
  args: {
    apiKey: v.string(),
    amount: v.number(),
    type: v.union(v.literal("DEBIT"), v.literal("CREDIT"), v.literal("TRANSFER"), v.literal("PAYMENT")),
    channel: v.union(v.literal("ATM"), v.literal("ONLINE"), v.literal("POS"), v.literal("MOBILE"), v.literal("EFT")),
    accountNumber: v.string(),
    accountHolder: v.string(),
    bankCode: v.string(),
    merchantName: v.optional(v.string()),
    merchantCity: v.optional(v.string()),
    merchantCountry: v.string(),
    ipAddress: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    externalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { apiKey, ...txArgs } = args;

    // Validate API key and get org
    const result: { organisationId: string } = await ctx.runMutation(internal.ingestMutation.validateKeyAndIngest, {
      apiKey,
      ...txArgs,
    });

    return result;
  },
});
