/**
 * The AI keeper's rules, without the model. The swarm runner asks a model on
 * NEAR AI Cloud what to pledge (scripts/lib/ai-keeper.ts); everything here is
 * pure, so the site, the tests and the runner agree on what the model is shown
 * and on how its answer is held to the same limits as any keeper.
 */
import { BPS, ONE, fmt } from "./rules.js";
import type { Decision, View } from "./strategies.js";

/** The most any single keeper may add in one round: 25% of the line, the closers' cap. */
export const AI_CAP_BPS = 2_500n;
export const AI_MODEL = "deepseek-ai/DeepSeek-V4.1-Flash-1017";

export interface RecentRound {
  round: number;
  outcome: string;
  pledged: string;
  line: string;
}

/** What the model is told: the rules of the game and the public state, nothing else. */
export function aiPrompt(v: View, pledgers: number, recent: RecentRound[]): { system: string; user: string } {
  const cap = (v.line * AI_CAP_BPS) / BPS;
  const system = [
    "You are keeper-13, one of thirteen agents playing NEAR Hearth, a memecoin game on NEAR.",
    "Each round, holders pledge EMBER to a fire. If pledges reach the line, the fire roars: every pledge burns and 150% of the line is minted back to pledgers, pro rata.",
    "If pledges fall short, 50% of every pledge burns and the rest is refunded, the streak resets and 2% of the treasury burns. Pledging far past the line only dilutes the sparks.",
    `You may pledge a whole number of EMBER from 0 to ${fmt(cap < v.balance ? cap : v.balance)} this round (25% of the line, and no more than you hold).`,
    'Reply with one JSON object and nothing else: {"pledge": <whole EMBER>, "reason": "<one sentence>"}.',
  ].join(" ");
  const user = JSON.stringify({
    round: v.round,
    line: fmt(v.line),
    pledged_so_far: fmt(v.pledged),
    gap_to_line: fmt(v.line > v.pledged ? v.line - v.pledged : 0n),
    share_of_round_elapsed: Math.round(v.elapsed * 100) / 100,
    pledgers_so_far: pledgers,
    streak: v.streak,
    your_balance: fmt(v.balance),
    your_pledge_this_round: fmt(v.mine),
    other_keepers_still_to_act: "three closers wake in the last 15% of the round and fill gaps of up to 25% of the line each",
    recent_rounds: recent.map((r) => ({ round: r.round, outcome: r.outcome, pledged: fmt(BigInt(r.pledged)), line: fmt(BigInt(r.line)) })),
  });
  return { system, user };
}

/**
 * Reads the model's answer strictly and applies the keeper's limits: a whole
 * number of EMBER, at most 25% of the line and no more than the balance; one
 * pledge per round. Anything unreadable becomes a pass with the reason why.
 */
export function aiDecision(content: string, v: View): Decision & { asked: string; capped: boolean } {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  let raw: { pledge?: unknown; reason?: unknown };
  try {
    if (start < 0 || end <= start) throw new Error("no JSON");
    raw = JSON.parse(content.slice(start, end + 1));
  } catch {
    return { pledge: 0n, reason: "The model's answer was not readable JSON, so the AI keeper passes.", asked: "?", capped: false };
  }
  const reason = String(raw.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 240) || "The model gave no reason.";
  const asked = String(raw.pledge ?? "");
  if (!/^\d{1,9}$/.test(asked)) return { pledge: 0n, reason: `The model answered "${asked.slice(0, 20)}", not a whole amount of EMBER, so the AI keeper passes.`, asked, capped: false };
  if (v.mine > 0n) return { pledge: 0n, reason: "Already pledged this round.", asked, capped: false };
  const want = BigInt(asked) * ONE;
  const cap = (v.line * AI_CAP_BPS) / BPS;
  const limit = cap < v.balance ? cap : v.balance;
  const pledge = want > limit ? limit : want;
  return { pledge, reason, asked, capped: want > limit };
}
