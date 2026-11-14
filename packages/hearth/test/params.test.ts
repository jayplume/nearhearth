import { describe, expect, it } from "vitest";
import { TESTNET_PARAMS, validateParams } from "../src/rules.js";

describe("launch parameters", () => {
  it("the testnet parameters pass the contract's checks", () => {
    expect(validateParams(TESTNET_PARAMS)).toEqual([]);
  });
  it("every broken parameter is reported", () => {
    const bad = { ...TESTNET_PARAMS, roundSecs: 10, ashBps: 20_000n, treasuryBurnBps: 5_000n, baseLine: 0n };
    expect(validateParams(bad)).toEqual([
      "roundSecs must be at least 60",
      "baseLine must be positive",
      "ashBps cannot exceed 10,000",
      "treasuryBurnBps cannot exceed 1,000 (10%)",
    ]);
  });
});
