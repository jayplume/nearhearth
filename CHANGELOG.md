# Changelog

## 0.2.0 · 14 Nov 2026

From an audit as a judge would run it: clean clone, CI, the live site, the contract's balance.

- **CI was red on every push**: the site had no tests, so `vitest run` exited 1. Added formatting tests.
- **The contract would have run out of storage in about a day** of 10-minute rounds (0.59 NEAR free). Topped up, freed each round's running total at close (test), upgraded without re-init, added `scripts/top-up.ts`.
- **The council now seats agents by warmth**: proposals #1–#3 added the three warmest keepers, #4 paid a warmth grant. `pnpm council` keeps voting until the DAO's threshold is met as the council grows.
- **The swarm no longer depends on one laptop**: `swarm.yml` plays two rounds every 8 hours and tops up storage.
- **For NEAR page and README sections**: what a hearth brings NEAR, live figures, and the business model (live vs planned).
- **Hero**: a strip of recent rounds (a flame per roar, ash per fire that went out) and a clear message when the fire is waiting.
- First load retries fast when the RPC is busy.

## 0.1.0 · 13–14 Nov 2026

- RULES.md written first; rules engine, keeper strategies and a 60-round simulation picked the parameters.
- Contract `fire.nearhearth.testnet`: EMBER (NEP-141/145/148) with the hearth built in, no owner; 256-bit `mul_div`; shared test vector with the TypeScript engine.
- Council: Sputnik DAO `nearhearth-council.sputnikv2.testnet`; proposal #0 funded 11 keepers.
- Swarm: 12 keeper sub-accounts; `scripts/swarm.ts` plays rounds live.
- Site at nearhearth.vercel.app: live fire, wallet pledge/drip/claim, keepers, ledger, simulation, council, rules.
