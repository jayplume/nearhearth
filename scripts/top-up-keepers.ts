/**
 * Keeps every keeper able to pay its own gas. A keeper spends about 0.01
 * testnet NEAR a day on pledges and claims; without this the swarm would go
 * quiet within a couple of weeks of launch. Tops up any keeper whose balance
 * has fallen below --min, from the fund account.
 *
 *   pnpm tsx scripts/top-up-keepers.ts [--from nearhearth-fund.testnet] [--min 0.06] [--to 0.15] [--dry-run]
 */
import { KEEPERS, txUrl } from "@nearhearth/hearth";
import { flag, opt } from "./lib/args.js";
import { transferNear } from "./lib/signer.js";

const from = opt("from", "nearhearth-fund.testnet");
const min = Number(opt("min", "0.06"));
const to = Number(opt("to", "0.15"));
const dry = flag("dry-run");
const MILLI = 10n ** 21n;

async function balanceOf(accountId: string): Promise<number> {
  const r = await fetch("https://near-testnet.drpc.org", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "view_account", finality: "final", account_id: accountId } }),
  }).then((x) => x.json());
  if (!r.result) throw new Error(`could not read ${accountId}: ${JSON.stringify(r.error ?? r).slice(0, 160)}`);
  return Number(BigInt(r.result.amount) / MILLI) / 1000;
}

let topped = 0;
for (const k of KEEPERS) {
  const id = k.id;
  const b = await balanceOf(id);
  if (b >= min) {
    console.log(`ok    ${id}: ${b.toFixed(3)} NEAR`);
    continue;
  }
  const add = Math.max(0, to - b);
  if (dry) {
    console.log(`low   ${id}: ${b.toFixed(3)} NEAR, would send ${add.toFixed(3)}`);
    continue;
  }
  const s = await transferNear(from, id, BigInt(Math.round(add * 1000)) * MILLI);
  console.log(`${s.ok ? "sent " : "FAIL "} ${id}: ${b.toFixed(3)} NEAR + ${add.toFixed(3)} from ${from}${s.ok ? "" : ` (${s.failure})`}\n      ${txUrl(s.hash)}`);
  if (s.ok) topped++;
}
console.log(topped ? `topped up ${topped} keeper(s)` : "no keeper needed gas");
