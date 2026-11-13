# The rules of the Hearth

Written before any contract code, as the track prompts ask. The contract (`contract/src/lib.rs`) and the simulator (`packages/hearth/src/rules.ts`) implement exactly these rules with the same integer arithmetic, and a shared test vector checks that they agree.

## The idea in one paragraph

EMBER is a memecoin with a fire. Every round, holders and keeper agents **pledge** EMBER to keep the fire lit. When the round closes, the contract checks the pledges against the **line**. If the pledges reach the line, the fire **roars**: every pledge burns, and a **spark pool** worth 1.5× the line is minted back to the pledgers in proportion to what they pledged. If they fall short, the fire **goes out**: half of every pledge burns as ash, half is refunded, the **streak** resets and the treasury burns a slice. The streak is the high score. Nothing here runs on a server: the round, the line, the pool and every burn and mint are in the contract.

## Why it is a game

It is an assurance game. Pledging alone is a loss; pledging together pays. And because the spark pool is fixed, pledging far more than the line dilutes everyone's sparks. The best outcome is a community, or a swarm, that lands the line almost exactly, round after round, while the line rises with the streak.

## Parameters (fixed at launch, readable with `get_params`, no admin can change them)

| Name | Value on testnet | Meaning |
|---|---|---|
| `round_secs` | 600 (10 minutes) | Round length. One day on a mainnet launch. |
| `base_line` | 1,000 EMBER | The line at streak 0. |
| `line_step_bps` | 1,000 (10%) | The line grows by 10% of the base for each round of streak... |
| `max_line_multiple` | 3 | ...up to 3× the base. |
| `spark_bps` | 15,000 (150%) | Spark pool minted on a roaring round, as a share of that round's line. |
| `ash_bps` | 5,000 (50%) | Share of each pledge that burns when the fire goes out. The rest is refunded. |
| `treasury_burn_bps` | 200 (2%) | Share of the treasury that burns when a round with pledges goes out. |
| `min_pledge` | 1 EMBER | Smallest pledge. |
| `drip` | 100 EMBER | One-time starter grant per account, from the treasury, while the drip budget lasts. |
| `drip_budget` | 100,000 EMBER | Total the drip can ever hand out. |

Initial supply: 1,000,000 EMBER. 700,000 to the treasury (held by the contract account, which has no code path to spend it except drips and burns) and 300,000 to the Hearth Council, a Sputnik DAO.

## One round

1. Round `r` covers `[genesis + r·round_secs, genesis + (r+1)·round_secs)`.
2. During the round anyone with EMBER calls `pledge(amount)` (1 yoctoNEAR attached). The EMBER moves into escrow in the contract. Pledges add up; one account can pledge several times.
3. After the round ends, anyone calls `close_rounds()`. Rounds close strictly in order. Closing round `r`:
   - `line = base_line × (1 + min(streak × line_step_bps / 10,000, max_line_multiple − 1))`
   - **Roars** if `pledged ≥ line`: the whole escrow burns, `spark_pool = line × spark_bps / 10,000` becomes claimable pro rata, `streak += 1`, `best_streak = max(best_streak, streak)`.
   - **Goes out** if `0 < pledged < line`: `pledged × ash_bps / 10,000` burns, the rest becomes refundable, `streak = 0`, and `treasury × treasury_burn_bps / 10,000` burns.
   - **Cold** if `pledged = 0`: nobody came. `streak = 0`, nothing burns.
4. Each pledger calls `claim(round)`. A roaring round mints `spark_pool × my_pledge / pledged` (rounded down) to them; a round that went out returns their refund. Claims are lazy so a round with a thousand pledgers costs the same to close as one with two.

## Warmth: reputation that can be traced

Every EMBER an account pledged in a roaring round adds the same amount of **warmth**, credited when they claim. Warmth never decreases and is never transferable. `get_warmth(account)` returns it, and each credit is an event in the transaction that made it, so every point traces to a round.

The Hearth Council (a Sputnik DAO on `sputnikv2.testnet`) holds 300,000 EMBER. `pnpm council` reads warmth from the contract and files proposals: keepers above a warmth threshold are proposed as council members, and the season's warmest keepers are proposed for EMBER grants from the council's treasury. The DAO's own votes approve them. We do not write a multisig.

## Keepers: the swarm

Keepers are agents, each with its own sub-account (`keeper-01.nearhearth.testnet` …). Each runs one strategy from `packages/hearth/src/strategies.ts`, a single readable file, and each decision comes with a one-sentence reason that the site shows. Strategies only read public state (the line, what is pledged so far, the time left, the streak, their balance) and only call `pledge` and `claim`. No keeper has any power a human holder lacks.

## Sybil resistance and its limits

- Sparks are pro rata to EMBER pledged, so splitting one holder into many accounts earns nothing extra.
- The drip is once per account, so a sybil farm can collect drips. That is capped by `drip_budget` (10% of supply) and by NEAR's account and storage costs. A mainnet launch would replace the drip with a sale or an airdrop.
- Warmth is only earned in roaring rounds, by burning EMBER, so farming it costs the farmer real EMBER.

## What is out of scope

No price, no AMM pool and no promise of value. The mechanic is the product.
