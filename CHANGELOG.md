# Changelog

## 0.4.0 · 15 Nov 2026

- **An AI keeper.** `keeper-13` asks a model on NEAR AI Cloud (`deepseek-ai/DeepSeek-V4.1-Flash-1017`, in a TEE) what to pledge, from the rules and the public state only, and is held to a closer's cap: a whole number of EMBER, at most 25% of the line and its balance, once per round (`packages/hearth/src/ai.ts`, `scripts/lib/ai-keeper.ts`). Funded by council proposal #5. Its first decision, in round 168, set up a roar landed exactly on the line. 8 new engine tests (28).
- **The swarm keeps itself running.** `scripts/top-up-keepers.ts`, run by the swarm workflow, refills any keeper below 0.06 testnet NEAR from `nearhearth-fund.testnet` (keepers spend about 0.01 NEAR a day; without it the swarm would have gone quiet within two weeks). The fund was topped up by 2.5 testnet NEAR.
- `pnpm council grant`: one grant as a normal DAO proposal.
- The home page says when the keepers next play (`nextSwarmSession`, tested).
- Dependabot: major versions are upgraded by hand, minor and patch bumps are grouped; four major-bump PRs closed with the reason.
- README: the demo video is published (release v0.4.0), current figures from the For NEAR page, 39 TypeScript tests.

## 0.3.0 · 14 Nov 2026

Moved to github.com/jayplume/nearhearth, public. About seventy focused changes:

- **Engine**: `validateParams` (the contract's launch checks), `outcomeOf` and `previewPledge`, a `matcher` strategy, a "matchers instead of closers" scenario, burned and minted totals in the simulation, RPC backoff, `allRounds` paging. 20 tests.
- **Contract**: `get_line_for` view, clippy-clean, tests for the batch-read cap, warmth listing and drip exhaustion (18 tests); upgraded on testnet without re-init.
- **Scripts**: shared flag parser, `swarm --dry-run` and per-round summaries, `council --dry-run`, the council no longer re-proposes sitting members, `status --json`, `pnpm health` (renamed from `doctor`, which pnpm reserves), scripts are type-checked.
- **Site**: pledge preview and validation, all-in chip, dismissable toasts, strategy colours, roster filter and sort, accessible simulation slider and legend, council proposal names and member warmth, line-schedule bars and anchors on the rules page, a not-found page, a loading skeleton, a live indicator, progress in the tab title, page fades, an error boundary, code-split pages, the build commit in the footer, a share button; the fire pauses when hidden and is lighter on phones.
- **Hosting and repo**: security headers, robots and sitemap, per-page descriptions; badges, contributing guide, issue and PR templates, editorconfig, gitattributes, Dependabot, clippy and a Rust cache in CI, `pnpm check`.
- **Docs**: ARCHITECTURE, STRATEGIES, GLOSSARY, a contract README and a FAQ.
- **Tests**: React Testing Library tests of the keeper roster, the council and the rules page. 30 TypeScript tests in all.

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
