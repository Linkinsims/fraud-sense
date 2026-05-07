import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  organisations: defineTable({
    name: v.string(),
    type: v.union(v.literal("BANK"), v.literal("FINTECH"), v.literal("PAYMENT_PROCESSOR")),
    plan: v.union(v.literal("STARTER"), v.literal("GROWTH"), v.literal("ENTERPRISE")),
    ownerId: v.string(), // Changed from v.id("users") to v.string() for public access
    // Pre-aggregated counters for fast dashboard reads
    statsTotal: v.optional(v.number()),
    statsFlagged: v.optional(v.number()),
    statsCritical: v.optional(v.number()),
    statsVolume: v.optional(v.number()),
    statsTodayTotal: v.optional(v.number()),
    statsTodayVolume: v.optional(v.number()),
    statsLastReset: v.optional(v.number()), // timestamp of last daily reset
    statsLow: v.optional(v.number()),
    statsMedium: v.optional(v.number()),
    statsHigh: v.optional(v.number()),
    statsCriticalCount: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),

  apiKeys: defineTable({
    name: v.string(),
    key: v.string(),
    organisationId: v.id("organisations"),
    lastUsed: v.optional(v.number()),
    active: v.boolean(),
  })
    .index("by_org", ["organisationId"])
    .index("by_key", ["key"]),

  transactions: defineTable({
    organisationId: v.id("organisations"),
    externalId: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
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
    riskScore: v.number(),
    riskLevel: v.union(v.literal("LOW"), v.literal("MEDIUM"), v.literal("HIGH"), v.literal("CRITICAL")),
    fraudFlags: v.array(v.string()),
    isReviewed: v.boolean(),
    isFraud: v.optional(v.boolean()),
    caseId: v.optional(v.id("cases")),
    isDemo: v.optional(v.boolean()),
  })
    .index("by_org", ["organisationId"])
    .index("by_org_account", ["organisationId", "accountNumber"])
    .index("by_org_risk", ["organisationId", "riskLevel"]),

  alerts: defineTable({
    organisationId: v.id("organisations"),
    transactionId: v.id("transactions"),
    type: v.string(),
    severity: v.union(v.literal("LOW"), v.literal("MEDIUM"), v.literal("HIGH"), v.literal("CRITICAL")),
    title: v.string(),
    description: v.string(),
    isRead: v.boolean(),
    isResolved: v.boolean(),
  })
    .index("by_org", ["organisationId"])
    .index("by_transaction", ["transactionId"])
    .index("by_org_severity", ["organisationId", "severity"]),

  cases: defineTable({
    caseNumber: v.string(),
    title: v.string(),
    status: v.union(
      v.literal("OPEN"),
      v.literal("INVESTIGATING"),
      v.literal("ESCALATED"),
      v.literal("RESOLVED"),
      v.literal("CLOSED")
    ),
    priority: v.union(v.literal("LOW"), v.literal("MEDIUM"), v.literal("HIGH"), v.literal("CRITICAL")),
    organisationId: v.id("organisations"),
    assignedToId: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    totalAmount: v.number(),
  })
    .index("by_org", ["organisationId"])
    .index("by_org_status", ["organisationId", "status"]),

  rules: defineTable({
    name: v.string(),
    description: v.string(),
    organisationId: v.id("organisations"),
    isActive: v.boolean(),
    field: v.string(),
    operator: v.string(),
    value: v.number(),
    action: v.union(v.literal("ALERT"), v.literal("BLOCK"), v.literal("FLAG"), v.literal("REVIEW")),
    severity: v.union(v.literal("LOW"), v.literal("MEDIUM"), v.literal("HIGH"), v.literal("CRITICAL")),
    scoreBoost: v.number(),
  }).index("by_org", ["organisationId"]),

  demoState: defineTable({
    organisationId: v.id("organisations"),
    isRunning: v.boolean(),
    scenarioIndex: v.number(),
    transactionCount: v.number(),
  }).index("by_org", ["organisationId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
