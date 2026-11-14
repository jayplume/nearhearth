import type { Snapshot } from "../lib/live";

const E = (n: number) => (BigInt(n) * 10n ** 18n).toString();

/** A small, fixed snapshot of the chain for component tests. */
export function snapshot(over: Partial<Snapshot> = {}): Snapshot {
  return {
    state: {
      round: 42,
      round_ends_ms: Date.now() + 300_000,
      line: E(1_000),
      pledged: E(600),
      pledgers: 6,
      streak: 3,
      best_streak: 9,
      treasury: E(698_000),
      escrow: E(600),
      total_supply: E(1_005_000),
      total_burned: E(20_000),
      total_minted: E(25_000),
      drip_left: E(98_000),
      rounds_roared: 30,
      rounds_out: 2,
      council: "nearhearth-council.sputnikv2.testnet",
      needs_close: false,
    },
    params: {
      round_secs: 600,
      base_line: E(1_000),
      line_step_bps: 1_000,
      max_line_multiple: 3,
      spark_bps: 15_000,
      ash_bps: 5_000,
      treasury_burn_bps: 200,
      min_pledge: E(1),
      drip: E(100),
      drip_budget: E(100_000),
    },
    rounds: [],
    keepers: [
      { id: "keeper-01.nearhearth.testnet", strategy: "steady", balance: 4_000n * 10n ** 18n, warmth: 900n * 10n ** 18n, pledge: 100n * 10n ** 18n },
      { id: "keeper-08.nearhearth.testnet", strategy: "closer", balance: 6_000n * 10n ** 18n, warmth: 4_000n * 10n ** 18n, pledge: 0n },
      { id: "keeper-12.nearhearth.testnet", strategy: "freerider", balance: 100n * 10n ** 18n, warmth: 0n, pledge: 0n },
    ],
    council: {
      balance: 272_000n * 10n ** 18n,
      members: ["nearhearth.testnet", "keeper-08.nearhearth.testnet"],
      proposals: [
        { id: 1, proposer: "nearhearth-fund.testnet", description: "Add keeper-08 to the council.", status: "Approved", kind: { AddMemberToRole: {} }, submission_time: "0", votes: { "nearhearth.testnet": "Approve" } },
        { id: 0, proposer: "nearhearth-fund.testnet", description: "Fund the keeper swarm.", status: "Approved", kind: { FunctionCall: {} }, submission_time: "0", votes: {} },
      ],
    },
    warmth: [{ account: "keeper-08.nearhearth.testnet", warmth: 4_000n * 10n ** 18n }],
    at: Date.now(),
    ...over,
  };
}
