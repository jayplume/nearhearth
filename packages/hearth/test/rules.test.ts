import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BPS, ONE, TESTNET_PARAMS as P, claimFor, closeRound, lineFor } from "../src/rules.js";
import { SCENARIOS, simulate } from "../src/sim.js";
import { STRATEGIES } from "../src/strategies.js";

const E = (n: number) => BigInt(n) * ONE;
const fresh = { streak: 0, bestStreak: 0, treasury: E(700_000), supply: E(1_000_000) };

describe("the line", () => {
  it("starts at the base and grows 10% of the base per streak level, capped at 3×", () => {
    expect(lineFor(P, 0)).toBe(E(1_000));
    expect(lineFor(P, 1)).toBe(E(1_100));
    expect(lineFor(P, 20)).toBe(E(3_000));
    expect(lineFor(P, 500)).toBe(E(3_000));
  });
});

describe("closing a round", () => {
  it("roars at the line: burns the escrow, mints a 150% pool, extends the streak", () => {
    const { closed, state } = closeRound(P, fresh, 0, E(1_000));
    expect(closed.outcome).toBe("roared");
    expect(closed.payout).toBe(E(1_500));
    expect(state.streak).toBe(1);
    expect(state.supply).toBe(E(1_000_000) - E(1_000) + E(1_500));
  });
  it("goes out below the line: 50% ash, refunds, streak reset, 2% treasury burn", () => {
    const { closed, state } = closeRound(P, { ...fresh, streak: 4 }, 0, E(600));
    expect(closed.outcome).toBe("out");
    expect(closed.burned).toBe(E(300));
    expect(closed.treasuryBurned).toBe(E(14_000));
    expect(state.streak).toBe(0);
    expect(state.treasury).toBe(E(686_000));
  });
  it("is cold when nobody pledged: streak resets, nothing burns", () => {
    const { closed, state } = closeRound(P, { ...fresh, streak: 4 }, 0, 0n);
    expect(closed.outcome).toBe("cold");
    expect(state).toEqual({ ...fresh, streak: 0 });
  });
});

describe("claims", () => {
  it("never pay out more than the pool or the refunds, whatever the split", () => {
    const pledges = [E(333) + 1n, E(333), E(334) + 7n];
    const total = pledges.reduce((a, b) => a + b, 0n);
    const roar = closeRound(P, fresh, 0, total).closed;
    const paid = pledges.reduce((a, m) => a + claimFor(P, roar, m), 0n);
    expect(paid <= roar.payout).toBe(true);
    expect(roar.payout - paid < 3n).toBe(true);
    const out = closeRound(P, fresh, 0, E(500) + 3n).closed;
    const refunded = [E(250), E(250) + 3n].reduce((a, m) => a + claimFor(P, out, m), 0n);
    expect(refunded <= out.payout).toBe(true);
  });
  it("pay pro rata, so splitting one holder into many accounts earns nothing extra", () => {
    const roar = closeRound(P, fresh, 0, E(1_000)).closed;
    const whole = claimFor(P, roar, E(400));
    const split = [E(100), E(100), E(100), E(100)].reduce((a, m) => a + claimFor(P, roar, m), 0n);
    expect(split).toBe(whole);
  });
});

describe("strategies", () => {
  it("closers fill the exact gap when it is small, and never over-pledge", () => {
    const d = STRATEGIES.closer.decide({ round: 0, line: E(1_000), pledged: E(900), elapsed: 0.9, streak: 0, balance: E(5_000), mine: 0n });
    expect(d.pledge).toBe(E(100));
    const none = STRATEGIES.closer.decide({ round: 0, line: E(1_000), pledged: E(1_000), elapsed: 0.9, streak: 0, balance: E(5_000), mine: 0n });
    expect(none.pledge).toBe(0n);
  });
  it("every decision carries a reason", () => {
    for (const s of Object.values(STRATEGIES)) {
      const d = s.decide({ round: 0, line: E(1_000), pledged: E(500), elapsed: s.wakesAt, streak: 3, balance: E(5_000), mine: 0n });
      expect(d.reason.length).toBeGreaterThan(10);
    }
  });
});

describe("simulation", () => {
  it("is deterministic and the coordinated swarm keeps the fire roaring", () => {
    const a = simulate(P, SCENARIOS[0]!);
    const b = simulate(P, SCENARIOS[0]!);
    expect(a).toEqual(b);
    expect(a.summary.roared).toBeGreaterThan(50);
    const noClosers = simulate(P, SCENARIOS[1]!);
    expect(noClosers.summary.roared).toBeLessThan(a.summary.roared);
  });
});

/**
 * Shared test vector: the contract's unit tests replay these rounds and must
 * reach the same outcomes, burns and claims (contract/tests/vector.json).
 */
describe("shared vector with the contract", () => {
  it("writes the vector", () => {
    const rounds = [[E(400), E(600)], [E(500), E(700) + 5n], [E(300)], [], [E(1_000), E(1_000), E(1_000)]];
    let s = fresh;
    const out = rounds.map((pl, r) => {
      const total = pl.reduce((a, b) => a + b, 0n);
      const { closed, state } = closeRound(P, s, r, total);
      s = state;
      return {
        pledges: pl.map(String),
        outcome: closed.outcome,
        line: String(closed.line),
        burned: String(closed.burned),
        treasury_burned: String(closed.treasuryBurned),
        claims: pl.map((m) => String(claimFor(P, closed, m))),
        streak_after: closed.streakAfter,
        treasury_after: String(s.treasury),
      };
    });
    writeFileSync(new URL("../../../contract/tests/vector.json", import.meta.url), `${JSON.stringify(out, null, 1)}\n`);
    expect(out.map((o) => o.outcome)).toEqual(["roared", "roared", "out", "cold", "roared"]);
    expect(BPS).toBe(10_000n);
  });
});
