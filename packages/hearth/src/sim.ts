/**
 * A deterministic simulation of the Hearth with scripted keepers: no chain, no
 * LLM. It runs the same rules as the contract and records what the supply,
 * treasury and streak do over many rounds.
 */
import { type ClosedRound, type HearthState, INITIAL_SUPPLY, type Params, TREASURY_SHARE, claimFor, closeRound, ember, toEmber } from "./rules.js";
import { STRATEGIES, type StrategyId } from "./strategies.js";

export interface KeeperSpec {
  name: string;
  strategy: StrategyId;
  balance: bigint;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  keepers: KeeperSpec[];
  /** Chance (0–1) that a keeper shows up in a given round; can change over time. */
  presence: (round: number) => number;
}

export interface SimRow {
  round: number;
  line: number;
  pledged: number;
  outcome: ClosedRound["outcome"];
  streak: number;
  supply: number;
  treasury: number;
  burned: number;
  minted: number;
}

export interface SimResult {
  scenario: string;
  rows: SimRow[];
  summary: { roared: number; out: number; cold: number; bestStreak: number; supplyChangePct: number; treasuryChangePct: number };
}

/** Small seeded PRNG so every run of a scenario is identical. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulate(p: Params, sc: Scenario, rounds = 60, seed = 7): SimResult {
  const rnd = mulberry32(seed);
  const balances = sc.keepers.map((k) => k.balance);
  // Keepers' EMBER comes out of the council's 300,000 (grants), so total supply starts at the initial supply.
  let state: HearthState = { streak: 0, bestStreak: 0, treasury: TREASURY_SHARE, supply: INITIAL_SUPPLY };
  const rows: SimRow[] = [];
  const count = { roared: 0, out: 0, cold: 0 };
  for (let r = 0; r < rounds; r++) {
    const line = closeRound(p, state, r, 0n).closed.line;
    const mine = sc.keepers.map(() => 0n);
    let pledged = 0n;
    const order = sc.keepers
      .map((k, i) => ({ i, t: STRATEGIES[k.strategy].wakesAt + rnd() * 0.04 }))
      .filter(() => rnd() < sc.presence(r))
      .sort((a, b) => a.t - b.t);
    for (const { i, t } of order) {
      const k = sc.keepers[i]!;
      const d = STRATEGIES[k.strategy].decide({ round: r, line, pledged, elapsed: t, streak: state.streak, balance: balances[i]!, mine: mine[i]! });
      if (d.pledge > 0n && d.pledge <= balances[i]!) {
        balances[i]! -= d.pledge;
        mine[i]! += d.pledge;
        pledged += d.pledge;
      }
    }
    const { closed, state: next } = closeRound(p, state, r, pledged);
    let minted = 0n;
    sc.keepers.forEach((_, i) => {
      if (mine[i]! > 0n) {
        const back = claimFor(p, closed, mine[i]!);
        balances[i]! += back;
        if (closed.outcome === "roared") minted += back;
      }
    });
    // Supply from actual claims (rounding dust stays unminted), not the pool.
    const supply = closed.outcome === "roared" ? state.supply - pledged + minted : next.supply;
    state = { ...next, supply };
    count[closed.outcome]++;
    rows.push({
      round: r,
      line: toEmber(line),
      pledged: toEmber(pledged),
      outcome: closed.outcome,
      streak: state.streak,
      supply: toEmber(state.supply),
      treasury: toEmber(state.treasury),
      burned: toEmber(closed.burned + closed.treasuryBurned),
      minted: toEmber(minted),
    });
  }
  const first = toEmber(INITIAL_SUPPLY);
  const last = rows.at(-1)!;
  return {
    scenario: sc.id,
    rows,
    summary: {
      ...count,
      bestStreak: state.bestStreak,
      supplyChangePct: Math.round(((last.supply - first) / first) * 10_000) / 100,
      treasuryChangePct: Math.round(((last.treasury - toEmber(TREASURY_SHARE)) / toEmber(TREASURY_SHARE)) * 10_000) / 100,
    },
  };
}

const k = (name: string, strategy: StrategyId, n = 5_000) => ({ name, strategy, balance: ember(n) });
const many = (n: number, prefix: string, strategy: StrategyId, bal = 5_000) => Array.from({ length: n }, (_, i) => k(`${prefix}-${i + 1}`, strategy, bal));

export const SCENARIOS: Scenario[] = [
  {
    id: "swarm",
    title: "A coordinated swarm",
    description: "6 steady keepers, 2 skeptics, 3 closers and a guardian. Late in each round the closers fill the gap, each up to a quarter of the line.",
    keepers: [...many(6, "steady", "steady"), ...many(2, "skeptic", "skeptic"), ...many(3, "closer", "closer"), k("guardian-1", "guardian", 20_000)],
    presence: () => 0.9,
  },
  {
    id: "no-closers",
    title: "Nobody closes the gap",
    description: "The same crowd without closers or a guardian. Pledges land wherever they land.",
    keepers: [...many(8, "steady", "steady"), ...many(4, "skeptic", "skeptic")],
    presence: () => 0.9,
  },
  {
    id: "overeager",
    title: "An overeager crowd",
    description: "10 holders who throw 20% of the line every round without looking. The fire roars, but the sparks are diluted.",
    keepers: many(10, "overeager", "overeager", 20_000),
    presence: () => 0.9,
  },
  {
    id: "fading",
    title: "A fading community",
    description: "The coordinated swarm, but each round 2% fewer keepers show up, and free riders join.",
    keepers: [...many(6, "steady", "steady"), ...many(2, "skeptic", "skeptic"), ...many(3, "closer", "closer"), k("guardian-1", "guardian", 20_000), ...many(4, "freerider", "freerider")],
    presence: (r) => Math.max(0.15, 0.95 - r * 0.02),
  },
];
