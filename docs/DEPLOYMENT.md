# Deployment

## Accounts (testnet)

| Account | Role | Funded from |
|---|---|---|
| `nearhearth.testnet` | Parent of the contract and the keepers; council member | Testnet faucet |
| `nearhearth-fund.testnet` | Created the council DAO; council member; files proposals | Testnet faucet |
| `fire.nearhearth.testnet` | The hearth contract (EMBER) | 4 NEAR from the parent |
| `keeper-01 … keeper-12.nearhearth.testnet` | The swarm | 0.15 NEAR each from the parent |
| `nearhearth-council.sputnikv2.testnet` | The council, a Sputnik DAO v2 | 6 NEAR, through `sputnikv2.testnet` `create` |

## Contract

```bash
cd contract
cargo test
cargo near build non-reproducible-wasm --locked --no-wasmopt
near contract deploy fire.nearhearth.testnet use-file target/near/nearhearth.wasm \
  with-init-call new json-args '{"params":{"round_secs":600,"base_line":"1000000000000000000000","line_step_bps":1000,"max_line_multiple":3,"spark_bps":15000,"ash_bps":5000,"treasury_burn_bps":200,"min_pledge":"1000000000000000000","drip":"100000000000000000000","drip_budget":"100000000000000000000000"},"council":"nearhearth-council.sputnikv2.testnet","icon":"data:image/svg+xml;base64,…"}' \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-legacy-keychain send
```

Adding a view later (state layout unchanged): `pnpm tsx scripts/deploy.ts target/near/nearhearth.wasm`.

`--no-wasmopt`: Rust 1.87+ emits WebAssembly bulk-memory instructions that the bundled `wasm-opt` rejects; NEAR accepts them.

## Council DAO

Created with `sputnikv2.testnet` `create` and this policy: roles `all` (anyone may add proposals) and `council` (`nearhearth.testnet`, `nearhearth-fund.testnet`; every permission), default vote threshold `[1, 3]` by role weight, proposal bond 0.1 NEAR, proposal period 1 day.

## RPC

Public testnet RPCs rate-limit. Reads try `rpc.testnet.fastnear.com`, then `near-testnet.drpc.org`, then `archival-rpc.testnet.fastnear.com`; scripts send transactions through the first that does not answer 429 (set `NEAR_RPC` to force one).

## Site

```bash
cd apps/web
pnpm build:vercel                  # → apps/web/.vercel/output (Build Output API v3, static)
vercel deploy --prebuilt --prod    # https://nearhearth.vercel.app
```
