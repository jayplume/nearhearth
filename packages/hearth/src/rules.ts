/**
 * The rules of the Hearth (RULES.md), in the same integer arithmetic as the
 * contract. Amounts are in the token's smallest unit (18 decimals) as bigint.
 */

export const DECIMALS = 18;
export const ONE = 10n ** 18n;
export const BPS = 10_000n;

export interface Params {
  roundSecs: number;
  baseLine: bigint;
  lineStepBps: bigint;
  maxLineMultiple: bigint;
  sparkBps: bigint;
  ashBps: bigint;
  treasuryBurnBps: bigint;
  minPledge: bigint;
  drip: bigint;
  dripBudget: bigint;
}

/** The parameters the testnet contract launches with. */
export const TESTNET_PARAMS: Params = {
  roundSecs: 600,
  baseLine: 1_000n * ONE,
  lineStepBps: 1_000n,
  maxLineMultiple: 3n,
  sparkBps: 15_000n,
  ashBps: 5_000n,
  treasuryBurnBps: 200n,
  minPledge: 1n * ONE,
  drip: 100n * ONE,
  dripBudget: 100_000n * ONE,
};

export const INITIAL_SUPPLY = 1_000_000n * ONE;
export const TREASURY_SHARE = 700_000n * ONE;
export const COUNCIL_SHARE = 300_000n * ONE;

export type Outcome = "roared" | "out" | "cold";

/** The line a round must reach, given the streak going into it. */
export function lineFor(p: Params, streak: number): bigint {
  const steps = BigInt(streak) * p.lineStepBps;
  const cap = (p.maxLineMultiple - 1n) * BPS;
  const extra = steps < cap ? steps : cap;
  return (p.baseLine * (BPS + extra)) / BPS;
}

export interface ClosedRound {
  round: number;
  line: bigint;
  pledged: bigint;
  outcome: Outcome;
  /** Roared: the pool minted back to pledgers. Out: the total refunded. */
  payout: bigint;
  burned: bigint;
  treasuryBurned: bigint;
  streakAfter: number;
}

export interface HearthState {
  streak: number;
  bestStreak: number;
  treasury: bigint;
  supply: bigint;
}

/**
 * Closes one round. Pure: returns the outcome and the new state. Claims are
 * accounted here as if every pledger claims (payout counts toward supply).
 */
export function closeRound(p: Params, s: HearthState, round: number, pledged: bigint): { closed: ClosedRound; state: HearthState } {
  const line = lineFor(p, s.streak);
  if (pledged === 0n) {
    return {
      closed: { round, line, pledged, outcome: "cold", payout: 0n, burned: 0n, treasuryBurned: 0n, streakAfter: 0 },
      state: { ...s, streak: 0 },
    };
  }
  if (pledged >= line) {
    const pool = (line * p.sparkBps) / BPS;
    const streak = s.streak + 1;
    return {
      closed: { round, line, pledged, outcome: "roared", payout: pool, burned: pledged, treasuryBurned: 0n, streakAfter: streak },
      // escrow burns, pool mints
      state: { ...s, streak, bestStreak: Math.max(s.bestStreak, streak), supply: s.supply - pledged + pool },
    };
  }
  // Refunds are floor(pledge × (1 − ash)) per pledger, so the burn at close is everything the refunds cannot take.
  const refunds = (pledged * (BPS - p.ashBps)) / BPS;
  const ash = pledged - refunds;
  const tb = (s.treasury * p.treasuryBurnBps) / BPS;
  return {
    closed: { round, line, pledged, outcome: "out", payout: refunds, burned: ash, treasuryBurned: tb, streakAfter: 0 },
    state: { ...s, streak: 0, treasury: s.treasury - tb, supply: s.supply - ash - tb },
  };
}

/** What one pledger gets back from a closed round (rounded down, exactly as the contract does). */
export function claimFor(p: Params, closed: ClosedRound, mine: bigint): bigint {
  if (closed.outcome === "roared") return (closed.payout * mine) / closed.pledged;
  if (closed.outcome === "out") return (mine * (BPS - p.ashBps)) / BPS;
  return 0n;
}

export const fmt = (x: bigint, dp = 0): string => {
  const neg = x < 0n;
  const a = neg ? -x : x;
  const whole = a / ONE;
  const frac = a % ONE;
  const w = whole.toLocaleString("en-US");
  if (dp === 0) return `${neg ? "−" : ""}${w}`;
  const f = (frac * 10n ** BigInt(dp)) / ONE;
  return `${neg ? "−" : ""}${w}.${f.toString().padStart(dp, "0")}`;
};

export const toEmber = (x: bigint): number => Number(x / 10n ** 12n) / 1e6;
export const ember = (n: number): bigint => BigInt(Math.round(n * 1e6)) * 10n ** 12n;

/** The same checks the contract makes in `new`. Returns the problems, empty when the parameters are valid. */
export function validateParams(p: Params): string[] {
  const out: string[] = [];
  if (p.roundSecs < 60) out.push("roundSecs must be at least 60");
  if (p.baseLine <= 0n) out.push("baseLine must be positive");
  if (p.minPledge <= 0n) out.push("minPledge must be positive");
  if (p.maxLineMultiple < 1n) out.push("maxLineMultiple must be at least 1");
  if (p.sparkBps <= 0n) out.push("sparkBps must be positive");
  if (p.ashBps > BPS) out.push("ashBps cannot exceed 10,000");
  if (p.treasuryBurnBps > 1_000n) out.push("treasuryBurnBps cannot exceed 1,000 (10%)");
  if (p.dripBudget > TREASURY_SHARE) out.push("dripBudget exceeds the treasury");
  return out;
}

/** Which ending a round will have, given the line and what is pledged so far. */
export function outcomeOf(line: bigint, pledged: bigint): Outcome {
  if (pledged === 0n) return "cold";
  return pledged >= line ? "roared" : "out";
}

/**
 * What a pledge of `extra` would bring back if the round closed now, given
 * what is already pledged (including the caller's earlier pledges as `mine`).
 */
export function previewPledge(p: Params, line: bigint, pledged: bigint, mine: bigint, extra: bigint): { outcome: Outcome; back: bigint; total: bigint } {
  const total = pledged + extra;
  const own = mine + extra;
  const outcome = outcomeOf(line, total);
  if (outcome === "roared") return { outcome, back: (((line * p.sparkBps) / BPS) * own) / total, total };
  if (outcome === "out") return { outcome, back: (own * (BPS - p.ashBps)) / BPS, total };
  return { outcome, back: 0n, total };
}
