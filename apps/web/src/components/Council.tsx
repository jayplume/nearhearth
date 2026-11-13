import { COUNCIL_DAO, accountUrl } from "@nearhearth/hearth";
import { em, short } from "../lib/format";
import type { Snapshot } from "../lib/live";

const kindName = (k: unknown) => (typeof k === "string" ? k : Object.keys(k as object)[0] ?? "?");

export function Council({ snap }: { snap: Snapshot }) {
  const c = snap.council;
  return (
    <div className="council">
      <dl className="council-facts">
        <div>
          <dt>Council treasury</dt>
          <dd className="tnum">{em(c.balance)} EMBER</dd>
        </div>
        <div>
          <dt>Members</dt>
          <dd>{c.members.map(short).join(", ")}</dd>
        </div>
        <div>
          <dt>DAO</dt>
          <dd>
            <a href={accountUrl(COUNCIL_DAO)} target="_blank" rel="noreferrer">
              {COUNCIL_DAO}
            </a>
          </dd>
        </div>
      </dl>
      <ol className="proposals">
        {c.proposals.map((p) => (
          <li key={p.id} className={`proposal proposal--${p.status.toLowerCase()}`}>
            <span className="proposal-id tnum">#{p.id}</span>
            <div>
              <p>{p.description}</p>
              <span className="muted">
                {kindName(p.kind)} · proposed by {short(p.proposer)} · {Object.keys(p.votes).length} vote{Object.keys(p.votes).length === 1 ? "" : "s"}
              </span>
            </div>
            <span className="proposal-status">{p.status}</span>
          </li>
        ))}
        {c.proposals.length === 0 && <li className="muted">No proposals yet.</li>}
      </ol>
    </div>
  );
}

export function WarmthBoard({ snap }: { snap: Snapshot }) {
  const top = snap.warmth.slice(0, 10);
  const max = top[0]?.warmth ?? 1n;
  if (top.length === 0) return <p className="muted">Nobody has warmth yet: it is earned by pledging in a round that roars, and credited on claim.</p>;
  return (
    <ol className="warmth">
      {top.map((w, i) => (
        <li key={w.account}>
          <span className="tnum warmth-rank">{i + 1}</span>
          <a href={accountUrl(w.account)} target="_blank" rel="noreferrer">
            {short(w.account)}
          </a>
          <span className="warmth-bar">
            <i style={{ width: `${Number((w.warmth * 1000n) / (max === 0n ? 1n : max)) / 10}%` }} />
          </span>
          <b className="tnum">{em(w.warmth)}</b>
        </li>
      ))}
    </ol>
  );
}
