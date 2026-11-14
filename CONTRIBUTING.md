# Contributing

Thanks for wanting to tend the fire.

## Setup

```bash
pnpm install          # Node 22+, pnpm 10
pnpm check            # lint, types, tests, simulation
cd contract && cargo test
```

## Ground rules

- **The rules live in two places and must agree**: `contract/src/lib.rs` and `packages/hearth/src/rules.ts`. If you change either, regenerate the shared vector (`pnpm --filter @nearhearth/hearth test`) and run `cargo test`; `agrees_with_the_typescript_rules_engine` must pass.
- **Parameters are fixed at launch.** A change to a parameter is a new deployment, not an edit. Change `RULES.md` first, re-run `pnpm simulate`, and explain the result in the pull request.
- **The contract state layout is frozen** for the testnet deployment. New views are fine; new or reordered fields are not.
- **Strategies are one file** (`packages/hearth/src/strategies.ts`). A new strategy needs a reason string for every decision and a test.
- Write user-facing text in plain sentences, no marketing.

## Pull requests

Small and focused. Say what changed, why, and how you checked it. CI must be green.
