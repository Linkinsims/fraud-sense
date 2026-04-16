import dotenv from "dotenv";
dotenv.config();

const BATCH_SIZE = 2500;
const CONCURRENCY = 10;
const API_URL = process.env.API_URL || "http://localhost:3000";
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY env required");
  process.exit(1);
}

interface Transaction {
  amount: number;
  type: "DEBIT" | "CREDIT" | "TRANSFER" | "PAYMENT";
  channel: "ATM" | "ONLINE" | "POS" | "MOBILE" | "EFT";
  accountNumber: string;
  accountHolder: string;
  bankCode: string;
  merchantCountry: string;
  merchantName?: string;
  merchantCity?: string;
  ipAddress?: string;
  deviceId?: string;
  latitude?: number;
  longitude?: number;
}

function generateRandomTx(index: number): Transaction {
  const types = ["DEBIT", "CREDIT", "TRANSFER", "PAYMENT"] as const;
  const channels = ["ATM", "ONLINE", "POS", "MOBILE", "EFT"] as const;
  const countries = ["ZA", "US", "GB", "CN", "NG", "KE"];
  return {
    amount: Math.random() * 150000 + 1,
    type: types[Math.floor(Math.random() * types.length)],
    channel: channels[Math.floor(Math.random() * channels.length)],
    accountNumber: `ACC${String(index).padStart(8, "0")}`,
    accountHolder: `User ${index}`,
    bankCode: "632005",
    merchantCountry: countries[Math.floor(Math.random() * countries.length)],
    merchantName: `Merchant ${index % 1000}`,
    merchantCity: "Johannesburg",
  };
}

async function sendBatch(
  txs: Transaction[],
): Promise<{ inserted: number; flagged: number }> {
  const res = await fetch(`${API_URL}/api/ingest/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ transactions: txs }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Batch failed: ${res.status} ${err}`);
  }
  return res.json();
}

async function main() {
  const total = parseInt(process.env.TOTAL || "200000", 10);
  const start = Date.now();

  console.log(
    `Sending ${total} transactions in batches of ${BATCH_SIZE} (concurrency: ${CONCURRENCY})`,
  );

  const batches: Transaction[][] = [];
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = [];
    for (let j = 0; j < BATCH_SIZE && i + j < total; j++) {
      batch.push(generateRandomTx(i + j));
    }
    batches.push(batch);
  }

  let completed = 0;
  let flagged = 0;
  let errors = 0;

  const workers = Array.from({ length: CONCURRENCY }, async (_, workerId) => {
    for (let i = workerId; i < batches.length; i += CONCURRENCY) {
      try {
        const result = await sendBatch(batches[i]);
        completed += result.inserted;
        flagged += result.flagged;
      } catch (e) {
        errors++;
        console.error(`Batch ${i} error:`, e);
      }
    }
  });

  await Promise.all(workers);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const rate = Math.round((completed / (Date.now() - start)) * 1000);

  console.log(`\nDone in ${elapsed}s`);
  console.log(
    `Completed: ${completed}, Flagged: ${flagged}, Errors: ${errors}`,
  );
  console.log(`Rate: ~${rate} txn/sec`);
}

main();
