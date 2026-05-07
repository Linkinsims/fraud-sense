import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const SA_BANKS = ["ABSA", "FNB", "Standard Bank", "Nedbank", "Capitec", "TymeBank"];
const SA_MERCHANTS = [
  "Woolworths Food", "Pick n Pay", "Checkers", "Shoprite",
  "Engen Garage", "Shell Garage", "McDonald's SA", "Nando's",
  "Takealot", "Mr Price", "Clicks", "Dischem",
  "Uber Eats SA", "Mr Delivery", "Netflix", "Showmax",
];
const SA_CITIES = ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth", "Bloemfontein"];
const SA_NAMES = [
  "Sipho Dlamini", "Thabo Nkosi", "Nomsa Khumalo", "Zanele Mokoena",
  "Pieter van der Berg", "Liezel Botha", "Priya Naidoo", "Ashraf Hendricks",
  "Lungisa Mthembu", "Ayanda Cele", "Fatima Essop", "Johan Pretorius",
];
const ACCOUNT_NUMBERS = [
  "4001234567", "4009876543", "4005551234", "4007778899",
  "4003334455", "4006667788", "4002223344", "4008889900",
];

type Scenario = "NORMAL" | "CARD_TESTING" | "ACCOUNT_TAKEOVER" | "FOREIGN" | "AFTER_HOURS" | "MULE" | "VELOCITY";
const SCENARIOS: Scenario[] = ["NORMAL", "NORMAL", "NORMAL", "NORMAL", "NORMAL", "CARD_TESTING", "ACCOUNT_TAKEOVER", "FOREIGN"];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTxData(scenario: Scenario) {
  const base = {
    amount: Math.floor(Math.random() * 2000) + 50,
    type: "DEBIT" as const,
    channel: rand(["POS", "ONLINE", "MOBILE", "EFT", "ATM"] as const),
    accountNumber: rand(ACCOUNT_NUMBERS),
    accountHolder: rand(SA_NAMES),
    bankCode: rand(SA_BANKS),
    merchantName: rand(SA_MERCHANTS),
    merchantCity: rand(SA_CITIES),
    merchantCountry: "ZA",
    ipAddress: `196.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    deviceId: `DEV-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
    latitude: -(25.7 + Math.random() * 5),
    longitude: 28.0 + Math.random() * 5,
    isDemo: true,
  };

  switch (scenario) {
    case "CARD_TESTING":
      return {
        ...base,
        amount: Math.random() * 9 + 0.5,
        channel: "ONLINE" as const,
        merchantName: "Unknown Online Merchant",
      };
    case "ACCOUNT_TAKEOVER":
      return {
        ...base,
        amount: 45000 + Math.random() * 30000,
        deviceId: "DEV-UNKNOWN-NEW-" + Math.random().toString(36).substr(2, 4).toUpperCase(),
        merchantName: "International Wire Transfer",
      };
    case "FOREIGN":
      return {
        ...base,
        merchantCountry: "NG",
        merchantCity: "Lagos",
        amount: 8000 + Math.random() * 20000,
        merchantName: "Lagos Merchant",
      };
    case "AFTER_HOURS":
      return {
        ...base,
        amount: 15000 + Math.random() * 10000,
        merchantName: "Late Night Transfer",
      };
    case "MULE":
      return {
        ...base,
        type: "CREDIT" as const,
        amount: 50000 + Math.random() * 50000,
        merchantName: "Unknown Credit Source",
      };
    case "VELOCITY":
      return {
        ...base,
        amount: Math.floor(Math.random() * 500) + 10,
        accountNumber: ACCOUNT_NUMBERS[0],
      };
    default:
      return base;
  }
}

export const getState = query({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const userId = "public_user";
    if (!userId) return null;
    return await ctx.db
      .query("demoState")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .first();
  },
});

export const start = mutation({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const userId = "public_user";
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("demoState")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { isRunning: true });
    } else {
      await ctx.db.insert("demoState", {
        organisationId: args.organisationId,
        isRunning: true,
        scenarioIndex: 0,
        transactionCount: 0,
      });
    }

    await ctx.scheduler.runAfter(0, internal.demo.tick, {
      organisationId: args.organisationId,
    });
  },
});

export const stop = mutation({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const userId = "public_user";
    if (!userId) throw new Error("Not authenticated");
    const state = await ctx.db
      .query("demoState")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .first();
    if (state) {
      await ctx.db.patch(state._id, { isRunning: false });
    }
  },
});

export const tick = internalMutation({
  args: { organisationId: v.id("organisations") },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("demoState")
      .withIndex("by_org", (q) => q.eq("organisationId", args.organisationId))
      .first();

    if (!state || !state.isRunning) return;

    const scenarioIndex = state.scenarioIndex % SCENARIOS.length;
    const scenario = SCENARIOS[scenarioIndex];
    const txData = generateTxData(scenario);

    // Score the transaction inline
    const history = await ctx.db
      .query("transactions")
      .withIndex("by_org_account", (q) =>
        q.eq("organisationId", args.organisationId).eq("accountNumber", txData.accountNumber)
      )
      .order("desc")
      .take(50);

    let score = 0;
    const flags: string[] = [];
    const now = Date.now();
    const last1Hour = history.filter((h) => now - h._creationTime < 3600000);

    if (last1Hour.length > 10) { score += 25; flags.push("VELOCITY_BREACH"); }
    const smallTx = last1Hour.filter((h) => h.amount < 10);
    if (smallTx.length >= 3) { score += 35; flags.push("CARD_TESTING"); }
    if (txData.merchantCountry !== "ZA") { score += 15; flags.push("FOREIGN_TRANSACTION"); }
    if (txData.deviceId && !history.find((h) => h.deviceId === txData.deviceId)) {
      score += 15; flags.push("NEW_DEVICE");
      if (txData.amount > 10000) { score += 20; flags.push("ACCOUNT_TAKEOVER_SIGNAL"); }
    }
    const recentCredits = history.filter((h) => h.type === "CREDIT" && now - h._creationTime < 86400000);
    if (recentCredits.length >= 3 && txData.type === "DEBIT" && txData.amount > 5000) {
      score += 30; flags.push("MULE_ACCOUNT_PATTERN");
    }
    const avgAmount = history.length ? history.reduce((s, h) => s + h.amount, 0) / history.length : 0;
    if (avgAmount > 0 && txData.amount > avgAmount * 3) { score += 20; flags.push("AMOUNT_ANOMALY"); }

    score = Math.min(score, 100);
    const riskLevel =
      score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";

    const txId = await ctx.db.insert("transactions", {
      organisationId: args.organisationId,
      amount: txData.amount,
      currency: "ZAR",
      type: txData.type,
      channel: txData.channel,
      accountNumber: txData.accountNumber,
      accountHolder: txData.accountHolder,
      bankCode: txData.bankCode,
      merchantName: txData.merchantName,
      merchantCity: txData.merchantCity,
      merchantCountry: txData.merchantCountry,
      ipAddress: txData.ipAddress,
      deviceId: txData.deviceId,
      latitude: txData.latitude,
      longitude: txData.longitude,
      riskScore: score,
      riskLevel,
      fraudFlags: flags,
      isReviewed: false,
      isDemo: true,
    });

    if (score >= 50 && flags.length > 0) {
      const alertTitles: Record<string, string> = {
        CARD_TESTING: "Card Testing Pattern Detected",
        ACCOUNT_TAKEOVER_SIGNAL: "Account Takeover Signal",
        FOREIGN_TRANSACTION: "Foreign Transaction Alert",
        MULE_ACCOUNT_PATTERN: "Mule Account Pattern",
        VELOCITY_BREACH: "Velocity Breach",
        AMOUNT_ANOMALY: "Unusual Amount Detected",
      };
      const primaryFlag = flags.find((f) => alertTitles[f]);
      if (primaryFlag) {
        await ctx.db.insert("alerts", {
          organisationId: args.organisationId,
          transactionId: txId,
          type: primaryFlag,
          severity: score >= 75 ? "CRITICAL" : "HIGH",
          title: alertTitles[primaryFlag],
          description: `Demo: ${alertTitles[primaryFlag]} on account ${txData.accountNumber} — R${txData.amount.toFixed(2)}`,
          isRead: false,
          isResolved: false,
        });
      }
    }

    await ctx.db.patch(state._id, {
      scenarioIndex: state.scenarioIndex + 1,
      transactionCount: state.transactionCount + 1,
    });

    // Schedule next tick in 1.5 seconds
    await ctx.scheduler.runAfter(1500, internal.demo.tick, {
      organisationId: args.organisationId,
    });
  },
});

