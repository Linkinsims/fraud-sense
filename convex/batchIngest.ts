import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Lightweight scoring — no DB lookups, pure signal-based
// For batch ingestion we score each tx independently using only the data provided
function scoreFast(tx: {
  amount: number;
  type: string;
  merchantCountry: string;
  deviceId?: string;
  ipAddress?: string;
}): { score: number; riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  if (tx.merchantCountry !== "ZA") { score += 15; flags.push("FOREIGN_TRANSACTION"); }
  if (tx.amount > 100000) { score += 40; flags.push("VERY_HIGH_AMOUNT"); }
  else if (tx.amount > 50000) { score += 20; flags.push("HIGH_AMOUNT"); }
  else if (tx.amount < 5) { score += 25; flags.push("MICRO_TRANSACTION"); }

  const hour = new Date().getHours();
  if (hour >= 23 || hour <= 4) { score += 10; flags.push("AFTER_HOURS"); }

  score = Math.min(score, 100);
  const riskLevel = score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";
  return { score, riskLevel, flags };
}

const TX_ITEM = v.object({
  externalId: v.optional(v.string()),
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
});

export const validateApiKey = internalQuery({
  args: { apiKey: v.string() },
  handler: async (ctx, args) => {
    const keyDoc = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", (q) => q.eq("key", args.apiKey))
      .first();
    if (!keyDoc || !keyDoc.active) return null;
    return { organisationId: keyDoc.organisationId, keyId: keyDoc._id };
  },
});

export const bulkInsert = internalMutation({
  args: {
    organisationId: v.id("organisations"),
    keyId: v.id("apiKeys"),
    transactions: v.array(TX_ITEM),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Update API key lastUsed
    await ctx.db.patch(args.keyId, { lastUsed: now });

    let countLow = 0, countMedium = 0, countHigh = 0, countCritical = 0;
    let totalVolume = 0;
    const alertsToInsert: Array<{
      txId: Id<"transactions">;
      flag: string;
      score: number;
      amount: number;
      accountNumber: string;
      merchantCountry: string;
    }> = [];

    // Insert all transactions — Convex allows up to 8192 writes per mutation
    // We cap at 500 per call to stay well within limits
    for (const tx of args.transactions) {
      const { score, riskLevel, flags } = scoreFast({
        amount: tx.amount,
        type: tx.type,
        merchantCountry: tx.merchantCountry,
        deviceId: tx.deviceId,
        ipAddress: tx.ipAddress,
      });

      const txId = await ctx.db.insert("transactions", {
        organisationId: args.organisationId,
        externalId: tx.externalId,
        amount: tx.amount,
        currency: "ZAR",
        type: tx.type,
        channel: tx.channel,
        accountNumber: tx.accountNumber,
        accountHolder: tx.accountHolder,
        bankCode: tx.bankCode,
        merchantName: tx.merchantName,
        merchantCity: tx.merchantCity,
        merchantCountry: tx.merchantCountry,
        ipAddress: tx.ipAddress,
        deviceId: tx.deviceId,
        latitude: tx.latitude,
        longitude: tx.longitude,
        riskScore: score,
        riskLevel,
        fraudFlags: flags,
        isReviewed: false,
        isDemo: false,
      });

      // Track counters
      totalVolume += tx.amount;
      if (riskLevel === "LOW") countLow++;
      else if (riskLevel === "MEDIUM") countMedium++;
      else if (riskLevel === "HIGH") countHigh++;
      else if (riskLevel === "CRITICAL") countCritical++;

      // Queue alert for high-risk (only primary flag, no extra DB reads)
      if (score >= 50 && flags.length > 0) {
        alertsToInsert.push({
          txId,
          flag: flags[0],
          score,
          amount: tx.amount,
          accountNumber: tx.accountNumber,
          merchantCountry: tx.merchantCountry,
        });
      }
    }

    // Bulk insert alerts
    const ALERT_TITLES: Record<string, { title: string; description: string }> = {
      VERY_HIGH_AMOUNT: { title: "Very High Amount", description: "Transaction exceeds R100,000." },
      HIGH_AMOUNT: { title: "High Amount Alert", description: "Transaction exceeds R50,000." },
      MICRO_TRANSACTION: { title: "Micro Transaction", description: "Possible card testing — amount under R5." },
      FOREIGN_TRANSACTION: { title: "Foreign Transaction", description: "Transaction outside South Africa." },
      AFTER_HOURS: { title: "After Hours Transaction", description: "Transaction during high-risk hours (23:00–04:00)." },
    };

    for (const a of alertsToInsert) {
      const info = ALERT_TITLES[a.flag] ?? { title: a.flag, description: `Flag: ${a.flag}` };
      await ctx.db.insert("alerts", {
        organisationId: args.organisationId,
        transactionId: a.txId,
        type: a.flag,
        severity: a.score >= 75 ? "CRITICAL" : "HIGH",
        title: info.title,
        description: `${info.description} Account: ${a.accountNumber}, R${a.amount.toFixed(2)}`,
        isRead: false,
        isResolved: false,
      });
    }

    // Update pre-aggregated counters atomically
    const org = await ctx.db.get(args.organisationId);
    if (org) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const lastReset = org.statsLastReset ?? 0;
      const isNewDay = lastReset < todayStart.getTime();

      await ctx.db.patch(args.organisationId, {
        statsTotal: (org.statsTotal ?? 0) + args.transactions.length,
        statsFlagged: (org.statsFlagged ?? 0) + countHigh + countCritical,
        statsCritical: (org.statsCritical ?? 0) + countCritical,
        statsVolume: (org.statsVolume ?? 0) + totalVolume,
        statsTodayTotal: isNewDay ? args.transactions.length : (org.statsTodayTotal ?? 0) + args.transactions.length,
        statsTodayVolume: isNewDay ? totalVolume : (org.statsTodayVolume ?? 0) + totalVolume,
        statsLastReset: isNewDay ? todayStart.getTime() : (org.statsLastReset ?? 0),
        statsLow: (org.statsLow ?? 0) + countLow,
        statsMedium: (org.statsMedium ?? 0) + countMedium,
        statsHigh: (org.statsHigh ?? 0) + countHigh,
        statsCriticalCount: (org.statsCriticalCount ?? 0) + countCritical,
      });
    }

    return {
      inserted: args.transactions.length,
      flagged: countHigh + countCritical,
      critical: countCritical,
    };
  },
});
