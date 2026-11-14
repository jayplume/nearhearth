/**
 * Keeps the hearth contract able to pay for its own storage. Each closed round
 * leaves a ~300-byte record (0.003 NEAR on NEAR); with 10-minute testnet rounds
 * that adds up, so this tops the contract up when its free balance runs low.
 *
 *   pnpm tsx scripts/top-up.ts [--from nearhearth-fund.testnet] [--min 1] [--amount 3]
 */
import { HEARTH_CONTRACT, txUrl } from "@nearhearth/hearth";
import { transferNear } from "./lib/signer.js";

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1]! : d;
};
const from = arg("from", "nearhearth-fund.testnet");
const min = Number(arg("min", "1"));
const amount = Number(arg("amount", "3"));
const r = await fetch("https://near-testnet.drpc.org", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "view_account", finality: "final", account_id: HEARTH_CONTRACT } }),
}).then((x) => x.json());
const balance = Number(BigInt(r.result.amount) / 10n ** 21n) / 1000;
const locked = r.result.storage_usage / 100_000;
const free = balance - locked;
console.log(`${HEARTH_CONTRACT}: ${balance.toFixed(3)} NEAR, ${locked.toFixed(3)} locked for ${r.result.storage_usage} bytes, ${free.toFixed(3)} free`);
if (free >= min) process.exit(0);
const s = await transferNear(from, HEARTH_CONTRACT, BigInt(Math.round(amount * 1000)) * 10n ** 21n);
console.log(`topped up ${amount} NEAR from ${from}: ${s.ok ? "ok" : s.failure}\n${txUrl(s.hash)}`);
