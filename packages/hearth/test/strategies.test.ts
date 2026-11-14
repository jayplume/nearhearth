import { describe, expect, it } from "vitest";
import { ONE } from "../src/rules.js";
import { STRATEGIES } from "../src/strategies.js";

const E = (n: number) => BigInt(n) * ONE;
const view = (o: Partial<Parameters<(typeof STRATEGIES)["steady"]["decide"]>[0]>) => ({
  round: 0,
  line: E(1_000),
  pledged: 0n,
  elapsed: 0.5,
  streak: 0,
  balance: E(5_000),
  mine: 0n,
  ...o,
});

describe("matcher", () => {
  it("matches what is pledged, capped at 15% of the line", () => {
    expect(STRATEGIES.matcher.decide(view({ pledged: E(100) })).pledge).toBe(E(100));
    expect(STRATEGIES.matcher.decide(view({ pledged: E(600) })).pledge).toBe(E(150));
  });
  it("passes, with a reason, when there is nothing to match or it already matched", () => {
    expect(STRATEGIES.matcher.decide(view({})).pledge).toBe(0n);
    expect(STRATEGIES.matcher.decide(view({ pledged: E(100), mine: E(100) })).reason).toMatch(/Already/);
  });
});

describe("every strategy", () => {
  it("never pledges more than the keeper holds", () => {
    for (const s of Object.values(STRATEGIES)) {
      for (const pledged of [0n, E(300), E(700), E(990)]) {
        const d = s.decide(view({ pledged, balance: E(40), streak: 4 }));
        expect(d.pledge <= E(40)).toBe(true);
      }
    }
  });
  it("wakes inside the round", () => {
    for (const s of Object.values(STRATEGIES)) expect(s.wakesAt > 0 && s.wakesAt < 1).toBe(true);
  });
});
