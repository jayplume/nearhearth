/**
 * Runs the keeper swarm on NEAR testnet. Each keeper signs with its own
 * sub-account key and follows its strategy from packages/hearth/src/strategies.ts,
 * reading only public state. At the start of each round the swarm closes the
 * last one and claims what it is owed.
 *
 *   pnpm swarm              # run until stopped
 *   pnpm swarm --rounds 6   # run six rounds, then stop
 *   pnpm swarm --dry-run    # every keeper decides on the live round, nothing is sent
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ChainClaimable,
  type ChainRound,
  type ChainState,
  HEARTH_CONTRACT,
  KEEPERS,
  ONE_YOCTO,
  STRATEGIES,
  fmt,
  hearth,
  txUrl,
} from "@nearhearth/hearth";
import { aiKeeperDecide } from "./lib/ai-keeper.js";
import { flag, opt } from "./lib/args.js";
import { call } from "./lib/signer.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logFile = join(root, "data", "swarm-log.jsonl");
mkdirSync(dirname(logFile), { recursive: true });
const maxRounds = Number(opt("rounds", "Infinity"));
const DRY = flag("dry-run");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (o: Record<string, unknown>) => {
  appendFileSync(logFile, `${JSON.stringify({ at: new Date().toISOString(), ...o })}\n`);
  console.log(Object.values(o).join("  "));
};

if (DRY) {
  const s = await hearth<ChainState>("get_state");
  const roundMs = (await hearth<{ round_secs: number }>("get_params")).round_secs * 1000;
  const elapsed = 1 - Math.max(0, s.round_ends_ms - Date.now()) / roundMs;
  console.log(`round ${s.round}: ${fmt(BigInt(s.pledged))} / ${fmt(BigInt(s.line))} pledged, ${Math.round(elapsed * 100)}% through, streak ${s.streak}`);
  for (const k of KEEPERS) {
    const [bal, mine] = await Promise.all([hearth<string>("ft_balance_of", { account_id: k.id }), hearth<string>("get_pledge", { round: s.round, account_id: k.id })]);
    const d = STRATEGIES[k.strategy].decide({ round: s.round, line: BigInt(s.line), pledged: BigInt(s.pledged), elapsed, streak: s.streak, balance: BigInt(bal), mine: BigInt(mine) });
    console.log(`  ${k.id.padEnd(30)} ${k.strategy.padEnd(9)} ${d.pledge > 0n ? `would pledge ${fmt(d.pledge)}` : "would pass"}: ${d.reason}`);
  }
  process.exit(0);
}

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
    const [last] = await hearth<ChainRound[]>("list_rounds", { limit: 1 });
    if (last) {
      const back = last.outcome === "roared" ? `${fmt(BigInt(last.payout))} EMBER of sparks` : `${fmt(BigInt(last.burned))} EMBER of ash`;
      log({ round: last.round, event: "closed", outcome: last.outcome, pledged: `${fmt(BigInt(last.pledged))}/${fmt(BigInt(last.line))}`, result: back, streak: last.streak_after });
    }
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
    const v = {
      round,
      line: BigInt(s.line),
      pledged: BigInt(s.pledged),
      elapsed: (Date.now() - startMs) / roundMs,
      streak: s.streak,
      balance: BigInt(bal),
      mine: BigInt(mine),
    };
    // The AI keeper asks a model on NEAR AI Cloud; every other keeper runs its strategy from strategies.ts.
    const ai = k.strategy === "oracle" ? await aiKeeperDecide(v, s.pledgers, (await hearth<ChainRound[]>("list_rounds", { limit: 5 })).map((r) => ({ round: r.round, outcome: r.outcome, pledged: r.pledged, line: r.line }))) : null;
    const d = ai ?? STRATEGIES[k.strategy].decide(v);
    const extra = ai ? { model: ai.model, asked: ai.asked, ...(ai.capped ? { capped: "the model asked for more than the 25% cap" } : {}) } : {};
    if (d.pledge > 0n) {
      const c = await call(k.id, HEARTH_CONTRACT, "pledge", { amount: d.pledge.toString() }, ONE_YOCTO);
      log({ round, keeper: k.id, strategy: k.strategy, event: "pledge", amount: fmt(d.pledge), reason: d.reason, ...extra, ok: c.ok ? "ok" : c.failure, tx: txUrl(c.hash) });
    } else {
      log({ round, keeper: k.id, strategy: k.strategy, event: "pass", reason: d.reason, ...extra });
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
