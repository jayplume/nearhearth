# nearhearth (contract)

EMBER, a NEP-141 token with the hearth built in. Deployed at `fire.nearhearth.testnet`. Rules: [../RULES.md](../RULES.md).

## Build and test

```bash
cargo test                                             # 18 unit tests
cargo clippy --all-targets -- -D warnings
cargo near build non-reproducible-wasm --locked --no-wasmopt
```

## Methods

| Method | Who | What |
|---|---|---|
| `new(params, council, icon?)` | deployer, once | Mints 700,000 EMBER to the contract (treasury) and 300,000 to the council |
| `pledge(amount)` + 1 yocto | holder | Moves EMBER into escrow for the current round |
| `close_rounds()` | anyone | Closes every round that has ended (pledge and claim do it too) |
| `claim(round)`, `claim_all()` | pledger | Sparks for a roaring round, the refund for one that went out; credits warmth |
| `drip()` + storage deposit if new | anyone, once | 100 EMBER from the treasury, while the drip budget lasts |
| `ft_*`, `storage_*` | standard | NEP-141 and NEP-145 (force unregister disabled) |

Views: `get_params`, `get_state`, `get_round`, `list_rounds`, `get_pledge`, `get_claimable`, `get_accounts`, `get_warmth`, `list_warmth`, `has_dripped`, `get_line_for`, `ft_metadata`.

## Events

NEP-297 events with `"standard":"nearhearth"`:

| Event | Data |
|---|---|
| `pledge` | round, account_id, amount, round_total, line |
| `round_closed` | round, outcome, line, pledged, payout, burned, treasury_burned, streak |
| `claim` | round, account_id, outcome, amount, warmth |
| `drip` | account_id, amount |

Plus standard NEP-141 `ft_mint` (launch, sparks) and `ft_burn` (logs, ash, treasury).
