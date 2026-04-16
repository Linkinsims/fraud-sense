import { internalMutation } from "./_generated/server";
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

export const validateKeyAndIngest = internalMutation({
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

    // Look up API key
    const keyDoc = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", (q) => q.eq("key", apiKey))
      .first();

    if (!keyDoc) throw new Error("Invalid API key");
    if (!keyDoc.active) throw new Error("API key has been revoked");

    // Update lastUsed
    await ctx.db.patch(keyDoc._id, { lastUsed: Date.now() });

    const orgId = keyDoc.organisationId;

    // Get transaction history for scoring
    const history = await ctx.db
      .query("transactions")
      .withIndex("by_org_account", (q) =>
        q.eq("organisationId", orgId).eq("accountNumber", txArgs.accountNumber)
      )
      .order("desc")
      .take(50);

    const { score, riskLevel, flags } = scoreTransaction(
      {
        amount: txArgs.amount,
        type: txArgs.type,
        channel: txArgs.channel,
        merchantCountry: txArgs.merchantCountry,
        deviceId: txArgs.deviceId,
        latitude: txArgs.latitude,
        longitude: txArgs.longitude,
      },
      history
    );

    const txId = await ctx.db.insert("transactions", {
      organisationId: orgId,
      externalId: txArgs.externalId,
      amount: txArgs.amount,
      currency: "ZAR",
      type: txArgs.type,
      channel: txArgs.channel,
      accountNumber: txArgs.accountNumber,
      accountHolder: txArgs.accountHolder,
      bankCode: txArgs.bankCode,
      merchantName: txArgs.merchantName,
      merchantCity: txArgs.merchantCity,
      merchantCountry: txArgs.merchantCountry,
      ipAddress: txArgs.ipAddress,
      deviceId: txArgs.deviceId,
      latitude: txArgs.latitude,
      longitude: txArgs.longitude,
      riskScore: score,
      riskLevel,
      fraudFlags: flags,
      isReviewed: false,
      isDemo: false,
    });

    // Generate alert for high risk
    if (score >= 50 && flags.length > 0) {
      const alertTitles: Record<string, { title: string; description: string }> = {
        VELOCITY_BREACH: { title: "Velocity Breach Detected", description: `Account ${txArgs.accountNumber} exceeded 10 transactions in 1 hour.` },
        CARD_TESTING: { title: "Card Testing Pattern", description: "Multiple micro-transactions — possible card testing." },
        GEO_ANOMALY: { title: "Geographic Anomaly", description: "Impossible travel detected." },
        ACCOUNT_TAKEOVER_SIGNAL: { title: "Account Takeover Signal", description: "New device + high-value transaction." },
        MULE_ACCOUNT_PATTERN: { title: "Mule Account Pattern", description: "Multiple credits followed by large debit." },
        SALARY_DIVERSION_RISK: { title: "Salary Diversion Risk", description: "Transfer shortly after salary credit." },
        FOREIGN_TRANSACTION: { title: "Foreign Transaction", description: `Transaction from ${txArgs.merchantCountry}.` },
        AMOUNT_ANOMALY: { title: "Unusual Amount", description: `R${txArgs.amount.toFixed(2)} is 3x above account average.` },
      };
      const primaryFlag = flags.find((f) => alertTitles[f]);
      if (primaryFlag) {
        await ctx.db.insert("alerts", {
          organisationId: orgId,
          transactionId: txId,
          type: primaryFlag,
          severity: score >= 75 ? "CRITICAL" : "HIGH",
          title: alertTitles[primaryFlag].title,
          description: alertTitles[primaryFlag].description,
          isRead: false,
          isResolved: false,
        });
      }
    }

    return {
      transactionId: txId,
      riskScore: score,
      riskLevel,
      fraudFlags: flags,
      organisationId: orgId,
    };
  },
});
