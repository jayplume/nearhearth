# Changelog

## 0.1.0 · 13–14 Nov 2026

- RULES.md written first; rules engine, keeper strategies and a 60-round simulation picked the parameters.
- Contract `fire.nearhearth.testnet`: EMBER (NEP-141/145/148) with the hearth built in, no owner; 256-bit `mul_div`; shared test vector with the TypeScript engine.
- Council: Sputnik DAO `nearhearth-council.sputnikv2.testnet`; proposal #0 funded 11 keepers.
- Swarm: 12 keeper sub-accounts; `scripts/swarm.ts` plays rounds live.
- Site at nearhearth.vercel.app: live fire, wallet pledge/drip/claim, keepers, ledger, simulation, council, rules.
