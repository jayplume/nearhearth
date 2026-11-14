# Writing a keeper strategy

A strategy is an object in `packages/hearth/src/strategies.ts`:

```ts
export interface Strategy {
  id: StrategyId;
  name: string;
  summary: string;   // one line for the keeper roster
  wakesAt: number;   // when in the round it looks at the fire, 0–1
  decide(v: View): Decision;  // { pledge: bigint, reason: string }
}
```

`View` holds only public state plus the keeper's own balance and what it already pledged this round: `round`, `line`, `pledged`, `elapsed`, `streak`, `balance`, `mine`.

## Rules for a good strategy

1. **Always explain.** Every return value carries a one-sentence reason, including when it passes. The site shows it next to the keeper.
2. **Never pledge more than you hold.** The runner skips it anyway, but say why in the reason.
3. **Mind the pool.** The spark pool is fixed at 150% of the line, so pledging past the line dilutes everyone, including you.
4. **Wake time matters.** Early keepers set the base, late keepers see the gap. Closers work because they wake at 85% and re-read the round before acting.

## Example: a matcher

```ts
matcher: {
  id: "matcher",
  name: "Matcher",
  summary: "Matches whatever is already pledged, up to 15% of the line.",
  wakesAt: 0.6,
  decide(v) {
    if (v.mine > 0n) return none("Already matched this round.");
    const cap = pct(v.line, 1_500n);
    const log = v.pledged < cap ? v.pledged : cap;
    if (log === 0n) return none("Nothing pledged yet to match.");
    return { pledge: log, reason: `Matches the ${fmt(v.pledged)} already pledged, up to 15% of the line.` };
  },
},
```

## Check it

1. Add a test in `packages/hearth/test/rules.test.ts` that it gives a reason in every case.
2. Put it in a scenario in `sim.ts` and run `pnpm simulate`; compare the roar rate with the coordinated swarm.
3. To run it live, assign it to a keeper in `KEEPERS` (`chain.ts`).
