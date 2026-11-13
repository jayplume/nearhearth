/**
 * Runs the keeper swarm on NEAR testnet. Each keeper signs with its own
 * sub-account key and follows its strategy from packages/hearth/src/strategies.ts,
 * reading only public state. At the start of each round the swarm closes the
 * last one and claims what it is owed.
 *
 *   pnpm swarm              # run until stopped
 *   pnpm swarm --rounds 6   # run six rounds, then stop
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ChainClaimable,
  type ChainState,
  HEARTH_CONTRACT,
  KEEPERS,
  ONE_YOCTO,
  STRATEGIES,
  fmt,
  hearth,
  txUrl,
} from "@nearhearth/hearth";
import { call } from "./lib/signer.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logFile = join(root, "data", "swarm-log.jsonl");
mkdirSync(dirname(logFile), { recursive: true });
const i = process.argv.indexOf("--rounds");
const maxRounds = i > 0 ? Number(process.argv[i + 1]) : Number.POSITIVE_INFINITY;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (o: Record<string, unknown>) => {
  appendFileSync(logFile, `${JSON.stringify({ at: new Date().toISOString(), ...o })}\n`);
  console.log(Object.values(o).join("  "));
};

const params = await hearth<{ round_secs: number }>("get_params");
const roundMs = params.round_secs * 1000;
let played = 0;

async function playRound() {
  let s = await hearth<ChainState>("get_state");
  const round = s.round;
  const startMs = s.round_ends_ms - roundMs;

  // 1. Close the last round and collect what each keeper is owed.
  if (s.needs_close) {
    const c = await call(KEEPERS[0]!.id, HEARTH_CONTRACT, "close_rounds", {});
    log({ round, event: "close_rounds", ok: c.ok, tx: txUrl(c.hash) });
  }
  for (const k of KEEPERS) {
    const due = (await hearth<ChainClaimable[]>("get_claimable", { account_id: k.id })).filter((c) => c.status !== "open");
    if (due.length === 0) continue;
    const c = await call(k.id, HEARTH_CONTRACT, "claim_all", {});
    log({ round, keeper: k.id, event: "claim_all", got: c.ok ? fmt(BigInt(String(c.value ?? "0"))) : c.failure, tx: txUrl(c.hash) });
  }

  // 2. Each keeper wakes at its own time in the round and decides from public state.
  const order = KEEPERS.map((k) => ({ k, at: startMs + STRATEGIES[k.strategy].wakesAt * roundMs + Math.random() * 0.03 * roundMs })).sort((a, b) => a.at - b.at);
  for (const { k, at } of order) {
    const wait = at - Date.now();
    if (wait > 0) await sleep(wait);
    s = await hearth<ChainState>("get_state");
    if (s.round !== round) break; // the round ended under us
    const [bal, mine] = await Promise.all([
      hearth<string>("ft_balance_of", { account_id: k.id }),
      hearth<string>("get_pledge", { round, account_id: k.id }),
    ]);
    const d = STRATEGIES[k.strategy].decide({
      round,
      line: BigInt(s.line),
      pledged: BigInt(s.pledged),
      elapsed: (Date.now() - startMs) / roundMs,
      streak: s.streak,
      balance: BigInt(bal),
      mine: BigInt(mine),
    });
    if (d.pledge > 0n) {
      const c = await call(k.id, HEARTH_CONTRACT, "pledge", { amount: d.pledge.toString() }, ONE_YOCTO);
      log({ round, keeper: k.id, strategy: k.strategy, event: "pledge", amount: fmt(d.pledge), reason: d.reason, ok: c.ok ? "ok" : c.failure, tx: txUrl(c.hash) });
    } else {
      log({ round, keeper: k.id, strategy: k.strategy, event: "pass", reason: d.reason });
    }
  }

  // 3. Wait for the round to end.
  s = await hearth<ChainState>("get_state");
  log({ round, event: "round_end", pledged: fmt(BigInt(s.pledged)), line: fmt(BigInt(s.line)), streak: s.streak });
  const left = s.round_ends_ms - Date.now() + 3_000;
  if (left > 0) await sleep(left);
}

while (played < maxRounds) {
  try {
    await playRound();
    played++;
  } catch (e) {
    // One failed read or transaction must not stop the swarm: log it and pick up from the current round.
    log({ event: "error", message: e instanceof Error ? e.message.slice(0, 200) : String(e) });
    await sleep(15_000);
  }
}
