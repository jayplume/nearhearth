import { describe, expect, it } from "vitest";
import { clock, em, emNum, nextSwarmSession, short, toYocto } from "./format";

const E = (n: number) => BigInt(n) * 10n ** 18n;

describe("EMBER formatting", () => {
  it("shows whole EMBER with separators, and one decimal under 100", () => {
    expect(em(E(1_000_500))).toBe("1,000,500");
    expect(em(E(75))).toBe("75");
    expect(em(E(75) + 5n * 10n ** 17n)).toBe("75.5");
    expect(em("0")).toBe("0");
    expect(em(-E(3))).toBe("−3");
  });
  it("round-trips what a player types into yocto units exactly", () => {
    expect(toYocto(50)).toBe(E(50).toString());
    expect(toYocto(0.5)).toBe((5n * 10n ** 17n).toString());
    expect(emNum(BigInt(toYocto(12.345)))).toBe(12.345);
  });
  it("formats the round clock and keeper names", () => {
    expect(clock(125_000)).toBe("2:05");
    expect(clock(-5)).toBe("0:00");
    expect(short("keeper-08.nearhearth.testnet")).toBe("keeper-08");
    expect(short("itup.testnet")).toBe("itup");
  });
});

describe("nextSwarmSession", () => {
  it("is the next 00:17, 08:17 or 16:17 UTC", () => {
    expect(nextSwarmSession(Date.UTC(2026, 10, 15, 2, 50)).toISOString()).toBe("2026-11-15T08:17:00.000Z");
    expect(nextSwarmSession(Date.UTC(2026, 10, 15, 8, 17)).toISOString()).toBe("2026-11-15T16:17:00.000Z");
    expect(nextSwarmSession(Date.UTC(2026, 10, 15, 23, 59)).toISOString()).toBe("2026-11-16T00:17:00.000Z");
  });
});
