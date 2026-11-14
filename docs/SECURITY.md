# Security

NEAR Hearth runs on NEAR **testnet** with test tokens. This page says what the contract protects, how, and what it does not.

## No owner

`fire.nearhearth.testnet` has no owner field and no admin method. The parameters are set once in `new` and every method that changes state is one of `pledge`, `close_rounds`, `claim`, `claim_all`, `drip`, and the standard NEP-141/NEP-145 calls. Nobody can mint outside the spark pool, move the treasury, or change the line.

**One honest caveat.** The contract account still holds a full-access key, used on 13–14 Nov 2026 to add read-only views (`has_dripped`, `get_accounts`, `get_line_for`) and to free storage at close (latest upgrade [C5i8E5rw…](https://testnet.nearblocks.io/txns/C5i8E5rwAFpikrqSD4rNjFLFVkdV5msMhiACKpZfMiA2)), never to change the state layout or the rules. A key that can deploy code could in principle deploy a different contract. A mainnet launch would delete that key after the final deploy (or hand it to the council DAO), which makes "no admin" a property of the chain rather than a promise.

## What the contract checks

| Risk | Handling |
|---|---|
| Paying out more than exists | Escrow is tracked separately from the treasury (`escrow`), every burn and refund moves from the contract's own balance, and the shared test vector checks the contract against an independent bigint implementation to the last unit. |
| Overflow in pro-rata payouts | `mul_div` multiplies into 256 bits before dividing; a unit test checks it at `u128::MAX`. Release builds keep `overflow-checks = true`. |
| Claiming twice, or claiming an open round | A claim removes the pledge record; claiming an open round panics (tests). |
| Sybil farming of sparks | Sparks are pro rata to EMBER pledged, so many small accounts earn exactly what one account would (test in the TypeScript suite). |
| Sybil farming of the drip | One drip per account, from a fixed budget (10% of supply). Limits stated in RULES.md. |
| Wallet confirmation | `pledge` requires exactly 1 yoctoNEAR, like `ft_transfer`, so a function-call access key cannot pledge silently. |
| Breaking the escrow by unregistering | `storage_unregister(force: true)` is disabled: it would burn a pledger's balance while they had EMBER in escrow. |
| A long pause | `close_rounds` settles at most 8 pending rounds per call, and cold rounds cost nothing, so a call after a long idle period still fits in gas. |
| Running out of storage | The contract pays for its storage. Pledge records are freed on claim and each round's running total is freed at close; the closed-round record (~300 bytes) stays. `scripts/top-up.ts` (also run by the swarm workflow) refills the contract when its free balance drops below 1 NEAR. |

## Keys

- No private key is in the repository. Scripts read keys from `NEAR_KEYS` or the NEAR CLI keychain (`~/.near-credentials/testnet`), and `scripts/lib/signer.ts` writes new keeper keys there with mode 600.
- Keepers are sub-accounts of `nearhearth.testnet` holding 0.15 NEAR each and test EMBER. A leaked keeper key loses that keeper's EMBER, nothing else.
- The site never sees a key. Wallets sign in their own windows.

## Council

The Hearth Council is a stock Sputnik DAO v2 created by `sputnikv2.testnet`. Proposals need a 0.1 NEAR bond; one approval passes while the council has two members (`threshold [1,3]`). As warmth adds keepers to the council, the same threshold needs more votes.

## Reporting

Open an issue on GitHub. For anything sensitive, contact the maintainer through the GitHub profile first.
