/**
 * Every keeper strategy, in one readable file. A strategy sees only public
 * state and its own balance, and returns a pledge (or none) with the reason
 * the site shows next to the keeper.
 */
import { BPS, fmt } from "./rules.js";

export interface View {
  round: number;
  line: bigint;
  pledged: bigint;
  /** 0 at the start of the round, 1 at the end. */
  elapsed: number;
  streak: number;
  balance: bigint;
  /** What this keeper already pledged this round. */
  mine: bigint;
}

export interface Decision {
  pledge: bigint;
  reason: string;
}

export type StrategyId = "steady" | "closer" | "skeptic" | "guardian" | "overeager" | "freerider";

export interface Strategy {
  id: StrategyId;
  name: string;
  /** One line for the keeper card. */
  summary: string;
  /** When in the round it looks at the fire, as a share of the round (0–1). */
  wakesAt: number;
  decide(v: View): Decision;
}

const pct = (x: bigint, bps: bigint) => (x * bps) / BPS;
const none = (reason: string): Decision => ({ pledge: 0n, reason });
const gapOf = (v: View) => (v.line > v.pledged ? v.line - v.pledged : 0n);

export const STRATEGIES: Record<StrategyId, Strategy> = {
  steady: {
    id: "steady",
    name: "Steady",
    summary: "Throws the same log every round, early.",
    wakesAt: 0.15,
    decide(v) {
      if (v.mine > 0n) return none("Already threw its log this round.");
      const log = pct(v.line, 1_000n);
      if (v.balance < log) return none(`Wants to throw ${fmt(log)} EMBER but holds only ${fmt(v.balance)}.`);
      return { pledge: log, reason: `Throws its usual log: 10% of the line, ${fmt(log)} EMBER.` };
    },
  },
  skeptic: {
    id: "skeptic",
    name: "Skeptic",
    summary: "Joins only once the fire is clearly catching.",
    wakesAt: 0.55,
    decide(v) {
      if (v.mine > 0n) return none("Already in this round.");
      if (v.pledged * BPS < v.line * 6_000n) return none(`Only ${pctOf(v.pledged, v.line)} of the line is pledged; waits for 60%.`);
      const log = pct(v.line, 500n);
      if (v.balance < log) return none("Convinced, but out of EMBER.");
      return { pledge: log, reason: `${pctOf(v.pledged, v.line)} is already pledged, so it adds 5% of the line.` };
    },
  },
  closer: {
    id: "closer",
    name: "Closer",
    summary: "Waits for the last minutes, then fills the gap, up to a quarter of the line.",
    wakesAt: 0.85,
    decide(v) {
      const gap = gapOf(v);
      if (gap === 0n) return none("The line is already reached; adding more would only dilute the sparks.");
      const cap = pct(v.line, 2_500n);
      const log = gap < cap ? gap : cap;
      if (v.balance < log) return none(`The gap is ${fmt(gap)} EMBER and it holds ${fmt(v.balance)}.`);
      return gap <= cap
        ? { pledge: log, reason: `Fills the last ${fmt(gap)} EMBER so the fire roars exactly at the line.` }
        : { pledge: log, reason: `The gap is ${fmt(gap)} EMBER; it covers a quarter of the line and leaves the rest to the next closer.` };
    },
  },
  guardian: {
    id: "guardian",
    name: "Guardian",
    summary: "Protects a long streak when the fire is about to go out.",
    wakesAt: 0.92,
    decide(v) {
      const gap = gapOf(v);
      if (gap === 0n) return none("Nothing to protect: the fire will roar.");
      if (v.streak < 3) return none(`Streak is ${v.streak}; it only steps in from 3.`);
      const cap = pct(v.line, 3_000n);
      const log = gap < cap ? gap : cap;
      if (v.balance < log) return none("Wants to save the streak but is out of EMBER.");
      return { pledge: log, reason: `Streak ${v.streak} at risk: throws ${fmt(log)} EMBER at the last moment.` };
    },
  },
  overeager: {
    id: "overeager",
    name: "Overeager",
    summary: "Throws a big log every round, whatever the others do.",
    wakesAt: 0.05,
    decide(v) {
      if (v.mine > 0n) return none("Already threw a big log.");
      const log = pct(v.line, 2_000n);
      if (v.balance < log) return none("Out of EMBER for a big log.");
      return { pledge: log, reason: `Throws 20% of the line, ${fmt(log)} EMBER, without looking.` };
    },
  },
  freerider: {
    id: "freerider",
    name: "Free rider",
    summary: "Watches and never pledges. Gets no sparks.",
    wakesAt: 0.5,
    decide: () => none("Hopes the others keep the fire going. Sparks only go to pledgers, so it gets nothing."),
  },
};

function pctOf(a: bigint, b: bigint): string {
  if (b === 0n) return "0%";
  return `${Number((a * 1000n) / b) / 10}%`;
}
