/**
 * One-time setup of the keeper swarm on testnet (idempotent):
 * 1. creates any missing keeper sub-account under nearhearth.testnet (0.15 NEAR each),
 * 2. each keeper takes its one-time drip, which also registers it with the token.
 *
 *   pnpm tsx scripts/setup-keepers.ts
 */
import { HEARTH_CONTRACT, KEEPERS, PARENT, STORAGE_DEPOSIT, txUrl, view } from "@nearhearth/hearth";
import { call, createSubAccount } from "./lib/signer.js";

const exists = async (id: string) => {
  const r = await fetch("https://rpc.testnet.fastnear.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "view_account", finality: "final", account_id: id } }),
  }).then((x) => x.json());
  return !!r.result;
};

for (const k of KEEPERS) {
  if (!(await exists(k.id))) {
    const s = await createSubAccount(PARENT, k.id, 150_000_000_000_000_000_000_000n);
    console.log(`created ${k.id} ${s.ok ? "" : s.failure} ${txUrl(s.hash)}`);
  }
  const bal = await view<string>(HEARTH_CONTRACT, "ft_balance_of", { account_id: k.id });
  if (BigInt(bal) === 0n) {
    const s = await call(k.id, HEARTH_CONTRACT, "drip", {}, STORAGE_DEPOSIT);
    console.log(`drip   ${k.id} ${s.ok ? "ok" : s.failure} ${txUrl(s.hash)}`);
  } else console.log(`ready  ${k.id} ${BigInt(bal) / 10n ** 18n} EMBER`);
}

// Summary: what each keeper holds now.
console.log("\nkeeper                          strategy   EMBER");
for (const k of KEEPERS) {
  const bal = BigInt(await view<string>(HEARTH_CONTRACT, "ft_balance_of", { account_id: k.id }));
  console.log(`${k.id.padEnd(32)}${k.strategy.padEnd(11)}${(bal / 10n ** 18n).toLocaleString("en-US")}`);
}
