import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

const VALID_TYPES = new Set(["DEBIT", "CREDIT", "TRANSFER", "PAYMENT"]);
const VALID_CHANNELS = new Set(["ATM", "ONLINE", "POS", "MOBILE", "EFT"]);

function validateTx(tx: any, index: number): string | null {
  const required = [
    "amount",
    "type",
    "channel",
    "accountNumber",
    "accountHolder",
    "bankCode",
    "merchantCountry",
  ];
  for (const f of required) {
    if (tx[f] === undefined || tx[f] === null)
      return `transactions[${index}]: missing field "${f}"`;
  }
  if (!VALID_TYPES.has(tx.type))
    return `transactions[${index}]: invalid type "${tx.type}"`;
  if (!VALID_CHANNELS.has(tx.channel))
    return `transactions[${index}]: invalid channel "${tx.channel}"`;
  if (typeof tx.amount !== "number" || isNaN(tx.amount) || tx.amount <= 0)
    return `transactions[${index}]: amount must be a positive number`;
  return null;
}

// POST /api/ingest — single transaction
http.route({
  path: "/api/ingest",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing or invalid Authorization header" }, 401);
    }
    const apiKey = authHeader.slice(7);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const err = validateTx(body, 0);
    if (err) return json({ error: err }, 400);

    const keyInfo = await ctx.runQuery(internal.batchIngest.validateApiKey, {
      apiKey,
    });
    if (!keyInfo) return json({ error: "Invalid or revoked API key" }, 403);

    const result = await ctx.runMutation(internal.batchIngest.bulkInsert, {
      organisationId: keyInfo.organisationId,
      keyId: keyInfo.keyId,
      transactions: [normalizeTx(body)],
    });

    return json(
      { ...result, message: "Transaction ingested successfully" },
      200,
    );
  }),
});

// POST /api/ingest/batch — up to 500 transactions per call
http.route({
  path: "/api/ingest/batch",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing or invalid Authorization header" }, 401);
    }
    const apiKey = authHeader.slice(7);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (!Array.isArray(body.transactions)) {
      return json({ error: "Body must have a 'transactions' array" }, 400);
    }
    if (body.transactions.length === 0) {
      return json({ error: "transactions array is empty" }, 400);
    }
    if (body.transactions.length > 2500) {
      return json({ error: "Maximum 2500 transactions per batch call" }, 400);
    }

    // Validate all transactions upfront
    for (let i = 0; i < body.transactions.length; i++) {
      const err = validateTx(body.transactions[i], i);
      if (err) return json({ error: err }, 400);
    }

    const keyInfo = await ctx.runQuery(internal.batchIngest.validateApiKey, {
      apiKey,
    });
    if (!keyInfo) return json({ error: "Invalid or revoked API key" }, 403);

    const result = await ctx.runMutation(internal.batchIngest.bulkInsert, {
      organisationId: keyInfo.organisationId,
      keyId: keyInfo.keyId,
      transactions: body.transactions.map(normalizeTx),
    });

    return json(
      {
        inserted: result.inserted,
        flagged: result.flagged,
        critical: result.critical,
        message: `${result.inserted} transactions ingested successfully`,
      },
      200,
    );
  }),
});

// GET helpers
http.route({
  path: "/api/ingest",
  method: "GET",
  handler: httpAction(async () =>
    json({ error: "Use POST /api/ingest or POST /api/ingest/batch" }, 405),
  ),
});

http.route({
  path: "/api/ingest/batch",
  method: "GET",
  handler: httpAction(async () =>
    json({ error: "Use POST /api/ingest/batch" }, 405),
  ),
});

function normalizeTx(tx: any) {
  return {
    externalId: tx.externalId ? String(tx.externalId) : undefined,
    amount: Number(tx.amount),
    type: tx.type as "DEBIT" | "CREDIT" | "TRANSFER" | "PAYMENT",
    channel: tx.channel as "ATM" | "ONLINE" | "POS" | "MOBILE" | "EFT",
    accountNumber: String(tx.accountNumber),
    accountHolder: String(tx.accountHolder),
    bankCode: String(tx.bankCode),
    merchantName: tx.merchantName ? String(tx.merchantName) : undefined,
    merchantCity: tx.merchantCity ? String(tx.merchantCity) : undefined,
    merchantCountry: String(tx.merchantCountry),
    ipAddress: tx.ipAddress ? String(tx.ipAddress) : undefined,
    deviceId: tx.deviceId ? String(tx.deviceId) : undefined,
    latitude: tx.latitude !== undefined ? Number(tx.latitude) : undefined,
    longitude: tx.longitude !== undefined ? Number(tx.longitude) : undefined,
  };
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default http;
