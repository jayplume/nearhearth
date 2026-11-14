# Testing guide

Everything here runs against NEAR **testnet** with test tokens. No step needs a key except the wallet steps and the swarm.

## 1. Without installing anything (2 minutes)

| Do this | You should see |
|---|---|
| Open https://nearhearth.vercel.app | Round number, time left, EMBER pledged against the line, the streak. The fire's size follows pledged ÷ line. |
| Move the cursor through the fire | Embers swerve away from the cursor and sparks fly where it moves. With "reduce motion" set in your OS, the fire is a still glow instead. |
| Keep the tab open across a round boundary (10 minutes) | A toast: "Round N roared…" (and a burst of sparks) or "Round N went out…". The ledger gains a row. |
| Open **Keepers** | 12 keepers. Each row: EMBER balance, warmth, what it pledged this round, and the reason its strategy gives right now. The reasons change as the round fills. |
| On **Keepers**, switch the simulation tabs and move across the chart | Supply over 60 rounds for each community, an outcome strip (orange = roared, slate = out), and a readout for any round. |
| Open **Council** | Council balance and members, the DAO's proposals with their status, and the warmth leaderboard. |
| Open **Rules** | The launch parameters, read live from `get_params`. |
| Open **For NEAR** | Live counts of closed rounds, pledges, accounts with warmth and EMBER burned, plus the value flow and business model. |

## 2. With a testnet wallet (5 minutes)

You need a NEAR testnet account (Meteor, Intear, HERE or Sender; a new one can be funded from https://near-faucet.io).

| Do this | You should see on the site | And on NearBlocks |
|---|---|---|
| Press **Meteor** (or another wallet) and approve | "Connected you.testnet", your EMBER balance | Nothing: signing in needs no transaction. |
| Press **Take your 100 EMBER** and approve | A toast with the transaction link; your balance becomes 100 | A `drip` call to `fire.nearhearth.testnet` with 0.0125 NEAR (storage registration). Logs: `EVENT_JSON … "event":"drip"`. Your account appears in EMBER holders. |
| Type 50 (or press **Fill the gap**) and **Pledge** | A toast "Your log is on the fire…", the fire sparks, the round total grows by 50 | A `pledge` call with 1 yoctoNEAR. Logs: `"event":"pledge"` with the round total and the line. |
| Wait for the round to end, then press **Collect** | Your sparks (roared) or half your pledge (went out) | A `claim_all` call. Logs: `ft_mint` (sparks) or an `ft_transfer`-style refund, and `"event":"claim"` with your warmth. |
| Try **Take your 100 EMBER** again from the same account | The button is gone (`has_dripped` is true) | — |

## 3. From a clone

```bash
git clone https://github.com/jayplume/nearhearth && cd nearhearth
pnpm install
pnpm test          # 13 tests (10 engine + 3 site): the line, roar/out/cold, claims never exceed the pool, sybil split, strategies, simulation determinism, shared vector
pnpm simulate      # regenerates SIMULATION.md byte for byte
pnpm status        # the fire, read from NEAR
cd contract && cargo test   # 14 tests, including agrees_with_the_typescript_rules_engine
```

The shared vector is the strongest check: `packages/hearth/test/rules.test.ts` writes five rounds of pledges and the exact outcomes, burns, claims and treasury the TypeScript engine computes (`contract/tests/vector.json`). The contract test replays the same pledges against the contract and must reach the same numbers to the last unit (10⁻¹⁸ EMBER).

## 4. Run the swarm yourself

The swarm needs the keepers' keys, which stay with the maintainer. To run your own swarm against your own deployment, deploy the contract (docs/DEPLOYMENT.md), point `HEARTH_CONTRACT` and `PARENT` in `packages/hearth/src/chain.ts` at your accounts, then:

```bash
pnpm tsx scripts/setup-keepers.ts   # creates keeper sub-accounts and takes their drips
pnpm council grant-keepers          # if you also created a council DAO
pnpm swarm --rounds 6
```

Every decision, with its reason and transaction link, is appended to `data/swarm-log.jsonl`.
