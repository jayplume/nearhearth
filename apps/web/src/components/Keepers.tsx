import { STRATEGIES, accountUrl } from "@nearhearth/hearth";
import { useState } from "react";
import { em, short } from "../lib/format";
import type { Snapshot } from "../lib/live";

/**
 * The swarm, as the chain sees it right now. "If it woke now" runs the keeper's
 * own strategy (packages/hearth/src/strategies.ts) on the live state, so the
 * reason shown is exactly the code the agent runs.
 */
export function Keepers({ snap, compact = false }: { snap: Snapshot; compact?: boolean }) {
  const s = snap.state;
  const roundMs = snap.params.round_secs * 1000;
  const elapsed = 1 - Math.max(0, s.round_ends_ms - Date.now()) / roundMs;
  const [only, setOnly] = useState<string>("all");
  const [order, setOrder] = useState<"roster" | "warmth" | "ember">("roster");
  const kinds = ["all", ...new Set(snap.keepers.map((k) => k.strategy))];
  const filtered = only === "all" ? snap.keepers : snap.keepers.filter((k) => k.strategy === only);
  const by = (f: (k: (typeof filtered)[number]) => bigint) => [...filtered].sort((a, b) => (f(b) > f(a) ? 1 : f(b) < f(a) ? -1 : 0));
  const visible = order === "warmth" ? by((k) => k.warmth) : order === "ember" ? by((k) => k.balance) : filtered;
  const rows = compact ? visible.slice(0, 6) : visible;
  return (
    <>
      {!compact && (
        <fieldset className="roster-tools">
          <legend className="sr">Show keepers by strategy</legend>
          {kinds.map((k) => (
            <button key={k} type="button" className={`chip-btn${only === k ? " is-on" : ""}`} aria-pressed={only === k} onClick={() => setOnly(k)}>
              {k === "all" ? `All ${snap.keepers.length}` : `${STRATEGIES[k as keyof typeof STRATEGIES].name} (${snap.keepers.filter((x) => x.strategy === k).length})`}
            </button>
          ))}
          <label className="roster-sort">
            Sort
            <select value={order} onChange={(e) => setOrder(e.target.value as typeof order)}>
              <option value="roster">by keeper</option>
              <option value="warmth">by warmth</option>
              <option value="ember">by EMBER</option>
            </select>
          </label>
        </fieldset>
      )}
    <ol className="roster">
      {rows.map((k) => {
        const st = STRATEGIES[k.strategy];
        const d = st.decide({ round: s.round, line: BigInt(s.line), pledged: BigInt(s.pledged), elapsed, streak: s.streak, balance: k.balance, mine: k.pledge });
        return (
          <li key={k.id} className={`keeper keeper--${k.strategy}${k.pledge > 0n ? " is-in" : ""}`}>
            <span className="keeper-glyph" aria-hidden="true" />
            <div className="keeper-id">
              <a href={accountUrl(k.id)} target="_blank" rel="noreferrer">
                {short(k.id)}
              </a>
              <span className="keeper-strat" title={st.summary}>
                {st.name}
              </span>
            </div>
            <div className="keeper-now">
              {k.pledge > 0n ? (
                <b className="keeper-pledged">Pledged {em(k.pledge)} this round</b>
              ) : (
                <span className="muted">Wakes at {Math.round(st.wakesAt * 100)}% of the round</span>
              )}
              <span className="keeper-why">
                <span className="sr">If it woke now: </span>
                {d.reason}
              </span>
            </div>
            <dl className="keeper-nums">
              <div>
                <dt>EMBER</dt>
                <dd className="tnum">{em(k.balance)}</dd>
              </div>
              <div>
                <dt>Warmth</dt>
                <dd className="tnum">{em(k.warmth)}</dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ol>
    </>
  );
}
