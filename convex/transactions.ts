import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

function scoreTransaction(
  tx: {
    amount: number;
    type: string;
    channel: string;
    merchantCountry: string;
    deviceId?: string;
    latitude?: number;
    longitude?: number;
  },
  history: Array<{
    amount: number;
    type: string;
    deviceId?: string;
    latitude?: number;
    longitude?: number;
    _creationTime: number;
  }>
): { score: number; riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; flags: string[] } {
  const flags: string[] = [];
  let score = 0;
  const now = Date.now();
  const last1Hour = history.filter((h) => now - h._creationTime < 3600000);

  if (last1Hour.length > 10) { score += 25; flags.push("VELOCITY_BREACH"); }
  const smallTx = last1Hour.filter((h) => h.amount < 10);
  if (smallTx.length >= 3) { score += 35; flags.push("CARD_TESTING"); }
  const hour = new Date().getHours();
  if (hour >= 23 || hour <= 4) { score += 10; flags.push("AFTER_HOURS"); }
  const avgAmount = history.length ? history.reduce((s, h) => s + h.amount, 0) / history.length : 0;
  if (avgAmount > 0 && tx.amount > avgAmount * 3) { score += 20; flags.push("AMOUNT_ANOMALY"); }
  if (tx.merchantCountry !== "ZA") { score += 15; flags.push("FOREIGN_TRANSACTION"); }
  const lastTx = history[0];
  if (lastTx?.latitude && tx.latitude) {
    const R = 6371;
    const dLat = ((tx.latitude - lastTx.latitude) * Math.PI) / 180;
    const dLon = (((tx.longitude ?? 0) - (lastTx.longitude ?? 0)) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lastTx.latitude * Math.PI) / 180) * Math.cos((tx.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (distance > 500 && (now - lastTx._creationTime) / 3600000 < 1) { score += 40; flags.push("GEO_ANOMALY"); }
  }
  if (tx.deviceId && !history.find((h) => h.deviceId === tx.deviceId)) {
    score += 15; flags.push("NEW_DEVICE");
    if (tx.amount > 10000) { score += 20; flags.push("ACCOUNT_TAKEOVER_SIGNAL"); }
  }
  const recentCredits = history.filter((h) => h.type === "CREDIT" && now - h._creationTime < 86400000);
  if (recentCredits.length >= 3 && tx.type === "DEBIT" && tx.amount > 5000) { score += 30; flags.push("MULE_ACCOUNT_PATTERN"); }
  const recentSalary = history.find((h) => h.type === "CREDIT" && h.amount > 5000 && now - h._creationTime < 3600000);
  if (recentSalary && tx.type === "TRANSFER") { score += 25; flags.push("SALARY_DIVERSION_RISK"); }

  score = Math.min(score, 100);
  const riskLevel = score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";
  return { score, riskLevel, flags };
}

export const list = query({
  args: {
    organisationId: v.id("organisations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = "public_user";
    if (!userId) return [];
    return await ctx.db
      .query("transactions")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .order("desc")
      .take(args.limit ?? 100);
  },
});

export const getStats = query({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const userId = "public_user";
    if (!userId) return null;

    const org = await ctx.db.get(args.organisationId);
    if (!org) return null;

    // Fast path: use pre-aggregated counters (populated by batch ingest)
    if (org.statsTotal !== undefined) {
      return {
        totalToday: org.statsTodayTotal ?? 0,
        flaggedTotal: org.statsFlagged ?? 0,
        criticalTotal: org.statsCritical ?? 0,
        totalVolume: org.statsTodayVolume ?? 0,
        riskDist: {
          LOW: org.statsLow ?? 0,
          MEDIUM: org.statsMedium ?? 0,
          HIGH: org.statsHigh ?? 0,
          CRITICAL: org.statsCriticalCount ?? 0,
        },
      };
    }

    // Fallback: scan recent transactions (demo / low-volume path)
    const all = await ctx.db
      .query("transactions")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .order("desc")
      .take(500);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const today = all.filter((t) => t._creationTime >= todayStart.getTime());
    const flagged = all.filter((t) => t.riskLevel === "HIGH" || t.riskLevel === "CRITICAL");
    const critical = all.filter((t) => t.riskLevel === "CRITICAL");

    return {
      totalToday: today.length,
      flaggedTotal: flagged.length,
      criticalTotal: critical.length,
      totalVolume: today.reduce((s, t) => s + t.amount, 0),
      riskDist: {
        LOW: all.filter((t) => t.riskLevel === "LOW").length,
        MEDIUM: all.filter((t) => t.riskLevel === "MEDIUM").length,
        HIGH: all.filter((t) => t.riskLevel === "HIGH").length,
        CRITICAL: all.filter((t) => t.riskLevel === "CRITICAL").length,
      },
    };
  },
});

export const ingest = mutation({
  args: {
    organisationId: v.id("organisations"),
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
    isDemo: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("transactions")
      .withIndex("by_org_account", (q) =>
        q.eq("organisationId", args.organisationId).eq("accountNumber", args.accountNumber)
      )
      .order("desc")
      .take(50);

    const { score, riskLevel, flags } = scoreTransaction(
      {
        amount: args.amount,
        type: args.type,
        channel: args.channel,
        merchantCountry: args.merchantCountry,
        deviceId: args.deviceId,
        latitude: args.latitude,
        longitude: args.longitude,
      },
      history
    );

    const txId = await ctx.db.insert("transactions", {
      organisationId: args.organisationId,
      amount: args.amount,
      currency: "ZAR",
      type: args.type,
      channel: args.channel,
      accountNumber: args.accountNumber,
      accountHolder: args.accountHolder,
      bankCode: args.bankCode,
      merchantName: args.merchantName,
      merchantCity: args.merchantCity,
      merchantCountry: args.merchantCountry,
      ipAddress: args.ipAddress,
      deviceId: args.deviceId,
      latitude: args.latitude,
      longitude: args.longitude,
      riskScore: score,
      riskLevel,
      fraudFlags: flags,
      isReviewed: false,
      isDemo: args.isDemo ?? false,
    });

    if (score >= 50) {
      const alertMap: Record<string, { title: string; description: string; type: string }> = {
        VELOCITY_BREACH: { type: "VELOCITY_BREACH", title: "Velocity Breach Detected", description: `Account ${args.accountNumber} has exceeded 10 transactions in the last hour.` },
        CARD_TESTING: { type: "CARD_TESTING", title: "Card Testing Pattern", description: "Multiple micro-transactions detected — possible card testing attack." },
        GEO_ANOMALY: { type: "GEO_ANOMALY", title: "Geographic Anomaly", description: "Impossible travel detected." },
        ACCOUNT_TAKEOVER_SIGNAL: { type: "ACCOUNT_TAKEOVER", title: "Account Takeover Signal", description: "New device with high-value transaction." },
        MULE_ACCOUNT_PATTERN: { type: "MULE_ACCOUNT", title: "Mule Account Pattern", description: "Multiple credits followed by large debit." },
        SALARY_DIVERSION_RISK: { type: "SALARY_DIVERSION", title: "Salary Diversion Risk", description: "Transfer detected shortly after salary credit." },
        FOREIGN_TRANSACTION: { type: "GEO_ANOMALY", title: "Foreign Transaction", description: `Transaction from ${args.merchantCountry}.` },
        AMOUNT_ANOMALY: { type: "UNUSUAL_SPENDING", title: "Unusual Spending Amount", description: `Transaction amount R${args.amount.toFixed(2)} is 3x above account average.` },
      };
      const severity = score >= 75 ? "CRITICAL" : "HIGH";
      const primaryFlag = flags.find((f) => alertMap[f]);
      if (primaryFlag && alertMap[primaryFlag]) {
        await ctx.db.insert("alerts", {
          organisationId: args.organisationId,
          transactionId: txId,
          type: alertMap[primaryFlag].type,
          severity,
          title: alertMap[primaryFlag].title,
          description: alertMap[primaryFlag].description,
          isRead: false,
          isResolved: false,
        });
      }
    }

    return { txId, score, riskLevel, flags };
  },
});

export const markReviewed = mutation({
  args: {
    transactionId: v.id("transactions"),
    isFraud: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = "public_user";
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.patch(args.transactionId, {
      isReviewed: true,
      isFraud: args.isFraud,
    });
  },
});
