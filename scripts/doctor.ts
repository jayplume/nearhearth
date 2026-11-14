/**
 * Health check for a running hearth: RPCs, the contract's storage headroom,
 * the keepers' NEAR for gas and EMBER to play, and the council's balance.
 * Exits 1 if anything needs attention.   pnpm doctor
 */
import { COUNCIL_DAO, HEARTH_CONTRACT, KEEPERS, READ_RPCS, fmt, hearth, view } from "@nearhearth/hearth";

const problems: string[] = [];
const ok = (m: string) => console.log(`  ok    ${m}`);
const bad = (m: string) => {
  problems.push(m);
  console.log(`  FIX   ${m}`);
};

async function account(id: string) {
  for (const rpc of READ_RPCS) {
    try {
      const r = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "view_account", finality: "final", account_id: id } }),
      }).then((x) => x.json());
      if (r.result) return { near: Number(BigInt(r.result.amount) / 10n ** 21n) / 1000, storage: r.result.storage_usage as number };
    } catch {
      /* next RPC */
    }
  }
  throw new Error(`could not read ${id}`);
}

console.log("RPCs");
for (const rpc of READ_RPCS) {
  const t = Date.now();
  try {
    const r = await fetch(rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "status", params: [] }) });
    (r.ok ? ok : bad)(`${rpc} answered ${r.status} in ${Date.now() - t} ms`);
  } catch (e) {
    bad(`${rpc} unreachable: ${e instanceof Error ? e.message : e}`);
  }
}

console.log("Contract");
const c = await account(HEARTH_CONTRACT);
const free = c.near - c.storage / 100_000;
(free >= 1 ? ok : bad)(`${HEARTH_CONTRACT}: ${free.toFixed(2)} NEAR free for storage (${c.storage.toLocaleString("en-US")} bytes used)`);
const s = await hearth<{ round: number; streak: number; needs_close: boolean; drip_left: string }>("get_state");
ok(`round ${s.round}, streak ${s.streak}, drip budget left ${fmt(BigInt(s.drip_left))} EMBER`);

console.log("Keepers");
const line = BigInt(await hearth<string>("get_line_for", { streak: 0 }));
for (const k of KEEPERS) {
  const a = await account(k.id);
  const ember = BigInt(await hearth<string>("ft_balance_of", { account_id: k.id }));
  const needs = k.strategy !== "freerider" && ember < line / 10n;
  if (a.near < 0.05) bad(`${k.id}: only ${a.near.toFixed(3)} NEAR for gas`);
  else if (needs) bad(`${k.id}: only ${fmt(ember)} EMBER, less than one steady log`);
  else ok(`${k.id}: ${a.near.toFixed(3)} NEAR, ${fmt(ember)} EMBER`);
}

console.log("Council");
const dao = BigInt(await hearth<string>("ft_balance_of", { account_id: COUNCIL_DAO }));
const last = await view<number>(COUNCIL_DAO, "get_last_proposal_id");
ok(`${COUNCIL_DAO}: ${fmt(dao)} EMBER, ${last} proposals`);

console.log(problems.length ? `\n${problems.length} thing(s) to fix.` : "\nAll good.");
process.exit(problems.length ? 1 : 0);
