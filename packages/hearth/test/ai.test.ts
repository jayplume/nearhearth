import { describe, expect, it } from "vitest";
import { AI_CAP_BPS, ONE, STRATEGIES, aiDecision, aiPrompt, type View } from "../src/index.js";

const E = (n: number) => BigInt(n) * ONE;
const v = (o: Partial<View> = {}): View => ({ round: 170, line: E(1_000), pledged: E(600), elapsed: 0.7, streak: 2, balance: E(1_500), mine: 0n, ...o });

describe("aiDecision: the model's answer, held to a keeper's limits", () => {
  it("takes a clean answer", () => {
    expect(aiDecision('{"pledge": 150, "reason": "Closes part of the gap."}', v())).toMatchObject({ pledge: E(150), reason: "Closes part of the gap.", capped: false });
  });
  it("reads JSON wrapped in prose or a code fence", () => {
    expect(aiDecision('Here:\n```json\n{"pledge": 0, "reason": "Let the closers finish it."}\n```', v()).pledge).toBe(0n);
  });
  it("caps any pledge at 25% of the line and at the balance", () => {
    const big = aiDecision('{"pledge": 900, "reason": "All in."}', v());
    expect(big.pledge).toBe((E(1_000) * AI_CAP_BPS) / 10_000n);
    expect(big.capped).toBe(true);
    const poor = aiDecision('{"pledge": 200, "reason": "x"}', v({ balance: E(40) }));
    expect(poor.pledge).toBe(E(40));
  });
  it("passes on unreadable, negative, fractional or non-numeric answers", () => {
    for (const c of ["I'd rather not.", '{"pledge": -5, "reason": "x"}', '{"pledge": 12.5, "reason": "x"}', '{"pledge": "lots", "reason": "x"}', '{"pledge": 1e9}']) {
      expect(aiDecision(c, v()).pledge).toBe(0n);
    }
  });
  it("pledges once per round", () => {
    expect(aiDecision('{"pledge": 100, "reason": "again"}', v({ mine: E(100) })).pledge).toBe(0n);
  });
  it("keeps the reason short and on one line", () => {
    const r = aiDecision(JSON.stringify({ pledge: 10, reason: `a\n${"b".repeat(400)}` }), v()).reason;
    expect(r.length).toBeLessThanOrEqual(240);
    expect(r).not.toContain("\n");
  });
});

describe("aiPrompt", () => {
  it("tells the model the rules, its limit and the public state only", () => {
    const { system, user } = aiPrompt(v(), 6, [{ round: 169, outcome: "roared", pledged: E(1_050).toString(), line: E(1_000).toString() }]);
    expect(system).toContain("150% of the line");
    expect(system).toContain("from 0 to 250");
    const u = JSON.parse(user);
    expect(u).toMatchObject({ round: 170, line: "1,000", pledged_so_far: "600", gap_to_line: "400", pledgers_so_far: 6, your_balance: "1,500" });
    expect(u.recent_rounds[0]).toMatchObject({ round: 169, outcome: "roared" });
  });
});

describe("the AI strategy on the page", () => {
  it("never pledges by itself: only the runner, with a model, does", () => {
    expect(STRATEGIES.oracle.decide(v()).pledge).toBe(0n);
    expect(STRATEGIES.oracle.decide(v()).reason).toContain("NEAR AI Cloud");
  });
});
