import { describe, expect, it } from "vitest";
import { ONE, TESTNET_PARAMS as P, outcomeOf, previewPledge } from "../src/rules.js";

const E = (n: number) => BigInt(n) * ONE;

describe("pledge preview", () => {
  it("names the ending from the line and the total", () => {
    expect(outcomeOf(E(1_000), 0n)).toBe("cold");
    expect(outcomeOf(E(1_000), E(999))).toBe("out");
    expect(outcomeOf(E(1_000), E(1_000))).toBe("roared");
  });
  it("shows what a pledge that lands the line brings back", () => {
    // 900 pledged by others, I add 100: the pool of 1,500 is shared 100/1,000.
    expect(previewPledge(P, E(1_000), E(900), 0n, E(100))).toEqual({ outcome: "roared", back: E(150), total: E(1_000) });
  });
  it("shows the refund when the round would still fall short", () => {
    expect(previewPledge(P, E(1_000), E(200), 0n, E(100))).toEqual({ outcome: "out", back: E(50), total: E(300) });
  });
  it("counts the caller's earlier pledges in their share", () => {
    expect(previewPledge(P, E(1_000), E(950), E(50), E(50)).back).toBe(E(150));
  });
});
