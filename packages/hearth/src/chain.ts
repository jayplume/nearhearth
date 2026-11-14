/** Where NEAR Hearth lives on chain, and read-only access to it (no key needed). */
import type { Params } from "./rules.js";

export const NETWORK = "testnet";
export const HEARTH_CONTRACT = "fire.nearhearth.testnet";
export const PARENT = "nearhearth.testnet";
export const COUNCIL_DAO = "nearhearth-council.sputnikv2.testnet";
export const RPC = "https://rpc.testnet.fastnear.com";
/** Read-only fallbacks, tried in order when an RPC rate-limits or fails. */
export const READ_RPCS = [RPC, "https://near-testnet.drpc.org", "https://archival-rpc.testnet.fastnear.com"];
/** Where transactions go when the first RPC rate-limits. */
export const WRITE_RPCS = [RPC, "https://near-testnet.drpc.org"];
export const EXPLORER = "https://testnet.nearblocks.io";
export const txUrl = (h: string) => `${EXPLORER}/txns/${h}`;
export const accountUrl = (a: string) => `${EXPLORER}/address/${a}`;
export const ONE_YOCTO = "1";
export const STORAGE_DEPOSIT = "12500000000000000000000"; // 0.0125 NEAR, the NEP-145 minimum for this token
export const CALL_GAS = "30000000000000";

export interface ChainState {
  round: number;
  round_ends_ms: number;
  line: string;
  pledged: string;
  pledgers: number;
  streak: number;
  best_streak: number;
  treasury: string;
  escrow: string;
  total_supply: string;
  total_burned: string;
  total_minted: string;
  drip_left: string;
  rounds_roared: number;
  rounds_out: number;
  council: string;
  needs_close: boolean;
}

export interface ChainRound {
  round: number;
  line: string;
  pledged: string;
  pledgers: number;
  outcome: "roared" | "out";
  payout: string;
  burned: string;
  treasury_burned: string;
  streak_after: number;
  closed_block: number;
}

export interface ChainAccount {
  account_id: string;
  balance: string;
  pledge: string;
  warmth: string;
}

export interface ChainClaimable {
  round: number;
  pledged: string;
  status: "open" | "roared" | "out";
  amount: string;
}

export interface ChainParams {
  round_secs: number;
  base_line: string;
  line_step_bps: number;
  max_line_multiple: number;
  spark_bps: number;
  ash_bps: number;
  treasury_burn_bps: number;
  min_pledge: string;
  drip: string;
  drip_budget: string;
}

export const toParams = (p: ChainParams): Params => ({
  roundSecs: p.round_secs,
  baseLine: BigInt(p.base_line),
  lineStepBps: BigInt(p.line_step_bps),
  maxLineMultiple: BigInt(p.max_line_multiple),
  sparkBps: BigInt(p.spark_bps),
  ashBps: BigInt(p.ash_bps),
  treasuryBurnBps: BigInt(p.treasury_burn_bps),
  minPledge: BigInt(p.min_pledge),
  drip: BigInt(p.drip),
  dripBudget: BigInt(p.drip_budget),
});

function b64(s: string): string {
  return typeof btoa === "function" ? btoa(s) : Buffer.from(s).toString("base64");
}

let preferred = 0;

/** Calls a view method on any testnet contract, moving to the next RPC when one rate-limits or fails. */
export async function view<T>(contract: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: "nearhearth",
    method: "query",
    params: { request_type: "call_function", finality: "optimistic", account_id: contract, method_name: method, args_base64: b64(JSON.stringify(args)) },
  });
  let lastError: unknown;
  for (let i = 0; i < READ_RPCS.length; i++) {
    const idx = (preferred + i) % READ_RPCS.length;
    try {
      const res = await fetch(READ_RPCS[idx]!, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = await res.json();
      // An RPC-level error (rate limit, node trouble): try the next RPC.
      if (out.error) throw new Error(`RPC ${READ_RPCS[idx]}: ${JSON.stringify(out.error).slice(0, 160)}`);
      // The contract itself refused: that is the answer, from any RPC.
      if (out.result?.error) throw new Error(`${method}: ${String(out.result.error).slice(0, 200)}`);
      preferred = idx;
      return JSON.parse(new TextDecoder().decode(new Uint8Array(out.result.result))) as T;
    } catch (e) {
      lastError = e;
      // A contract panic is an answer, not an outage: do not retry it elsewhere.
      if (e instanceof Error && e.message.startsWith(`${method}:`)) throw e;
      // Give a rate-limited RPC a moment before trying the next one.
      await new Promise((r) => setTimeout(r, 150 * (i + 1) + Math.random() * 100));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export const hearth = <T>(method: string, args: Record<string, unknown> = {}) => view<T>(HEARTH_CONTRACT, method, args);

/** The 12 keeper agents of the testnet swarm and the strategy each one runs. */
export const KEEPERS: { id: string; strategy: "steady" | "skeptic" | "closer" | "guardian" | "freerider" }[] = [
  ...[1, 2, 3, 4, 5].map((n) => ({ id: `keeper-0${n}.${PARENT}`, strategy: "steady" as const })),
  { id: `keeper-06.${PARENT}`, strategy: "skeptic" },
  { id: `keeper-07.${PARENT}`, strategy: "skeptic" },
  { id: `keeper-08.${PARENT}`, strategy: "closer" },
  { id: `keeper-09.${PARENT}`, strategy: "closer" },
  { id: `keeper-10.${PARENT}`, strategy: "closer" },
  { id: `keeper-11.${PARENT}`, strategy: "guardian" },
  { id: `keeper-12.${PARENT}`, strategy: "freerider" },
];
