# Self-audit

We checked NEAR Hearth against each track prompt it fits (from `nearai/near-hackathon-prompt-examples`) and against the judging dimensions NEAR has used before: technical implementation, design, impact, originality and sustainability. ✅ means done and demonstrable; ◐ means partly; ✗ means not done, with the reason.

## Memecoins With Mechanics

| Prompt asks | Status | Where |
|---|---|---|
| NEP-141 token with the mechanic in the contract, not a backend | ✅ | `contract/src/lib.rs`: the round, line, burns and mints are all in the token contract |
| Parameters set at launch, readable by anyone, no admin key that can change them | ✅ ◐ | `get_params`; no admin method exists. The contract account still has a deploy key (used to add views); see SECURITY.md |
| Sybil resistance good enough for a demo, limits written plainly | ✅ | Pro-rata sparks (sybil-neutral, tested), warmth costs burned EMBER, drip capped; limits in RULES.md |
| A page with the current streak, today's progress and a log of every mint and burn | ✅ | Home: live round and streak; ledger of every closed round with burns and sparks; `ft_mint`/`ft_burn` events on chain |
| Simulate 60 days first, show supply under scenarios, then pick parameters | ✅ | `pnpm simulate` → SIMULATION.md; the site charts it; parameters changed after the first run |

## AI Swarms

| Prompt asks | Status | Where |
|---|---|---|
| Each agent on its own sub-account under one parent | ✅ | `keeper-01 … 12.nearhearth.testnet`, own keys |
| A coordinator contract that opens a round, collects bids and settles | ✅ | The hearth contract: rounds, conditional pledges, settlement at close |
| Rules written down before code | ✅ | RULES.md (first commit) |
| Simulation mode with many agents and scripted strategies, no LLM | ✅ | `packages/hearth/src/sim.ts`, 12–16 agents per scenario |
| A live page with rounds, bids, clearing result and who got what | ✅ | Keepers page and the round ledger |
| Settlement through NEAR Intents | ✗ | Pledges settle inside the token contract, which is the asset itself; routing a same-token escrow through Intents would add a hop without adding a guarantee. Paying keepers in other assets through Intents is a natural next step. |
| Sealed bids | ✗ | Pledges are public on purpose: the closers' strategy depends on seeing the gap. A commit-reveal variant would make it a blind assurance game. |

## Social Money

| Prompt asks | Status | Where |
|---|---|---|
| Use an existing Sputnik DAO or Trezu treasury; don't write a multisig | ✅ | Stock Sputnik DAO v2 from `sputnikv2.testnet` |
| Reputation tied to named accounts, every point traceable | ✅ | Warmth: credited per claim with an event, only from roaring rounds |
| Reputation-based access | ✅ | Proposals #1–#3 seated the three warmest keepers on the council, so warmth now carries votes |
| Tiered approvals (auto for small, one member for mid, full vote for large) | ◐ | All payouts are normal DAO proposals; tiers are not implemented. Sputnik's role-based vote policy per proposal kind could express them. |
| A public board of payouts and records | ✅ | Council page: proposals, statuses, warmth leaderboard |

## Games With Real Economies

| Prompt asks | Status | Where |
|---|---|---|
| NPCs with wallets and inventories whose behaviour moves the economy | ✅ | Keepers hold EMBER, act on readable rules, and change supply each round |
| Rules in one readable file, reasoning shown in the UI | ✅ | `strategies.ts`; each keeper's live reason on the Keepers page |
| A fast-forward mode | ✅ | The simulation (60 rounds in milliseconds) |
| Items as NEP-245 multi tokens | ✗ | The game has one asset, EMBER (NEP-141) |
| Social or email login, no wallet popups | ✗ | Players use a NEAR wallet; pledges need a 1-yocto confirmation by design |

## Judging dimensions

| Dimension | Evidence |
|---|---|
| Technical implementation | One contract with no owner; exact 256-bit payouts; lazy claims so closing is O(1) in pledgers; a TypeScript engine that matches the contract to the last unit (shared vector); 18 contract tests (clippy-clean) and 30 TypeScript tests, including React Testing Library component tests; CI that also checks the simulation is reproducible; a swarm that runs live on testnet and survives RPC rate limits |
| Design | A live canvas fire whose size is the round's progress, cursor-fanned embers and a spark burst when a round roars; a deliberate night-hearth palette; reduced-motion fallback; mobile layout |
| Impact | Gives a NEAR memecoin a reason to come back every round, and gives a DAO a reputation to pay by. Problem data: NEAR's memecoin launchpad fees fell from $8,807/month to under $2 |
| Originality | A memecoin whose supply records how well its community coordinated (an assurance game), played by humans and agents side by side |
| Sustainability | No server to run (static site, public RPCs); the contract needs no operator; the swarm runs from a scheduled GitHub Action; the contract's storage is topped up by script; the council treasury funds keepers and contributors; a launchpad could offer the hearth for a launch fee (For NEAR page) |
| Market value for NEAR | Recurring daily accounts, gas burned and shared with the contract, NEAR locked for storage, and a real job for a Sputnik DAO and for agents on NEAR (For NEAR page, with live figures) |

## Known gaps, in one place

- The contract account's deploy key (SECURITY.md).
- No NEAR Intents settlement, no sealed bids, no NEP-245, no social login (above).
- Storage is paid by the contract (about 300 bytes per closed round, 0.003 NEAR). On 10-minute testnet rounds that needed a top-up script; a daily mainnet hearth would use about 1 NEAR a year.
- Testnet only.
