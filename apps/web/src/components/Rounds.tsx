import { EXPLORER, HEARTH_CONTRACT } from "@nearhearth/hearth";
import { em } from "../lib/format";
import type { Snapshot } from "../lib/live";
import { Outcome } from "./parts";

/** Every closed round that had pledges, newest first, straight from list_rounds. */
export function Rounds({ snap, limit = 12 }: { snap: Snapshot; limit?: number }) {
  if (snap.rounds.length === 0) return <p className="muted">No round has closed with pledges yet.</p>;
  return (
    <div className="ledger-wrap">
      <table className="ledger">
        <thead>
          <tr>
            <th scope="col">Round</th>
            <th scope="col">Outcome</th>
            <th scope="col">Line</th>
            <th scope="col">Pledged</th>
            <th scope="col">Burned</th>
            <th scope="col">Back to pledgers</th>
            <th scope="col">Streak</th>
            <th scope="col">Closed in block</th>
          </tr>
        </thead>
        <tbody>
          {snap.rounds.slice(0, limit).map((r) => (
            <tr key={r.round}>
              <th scope="row" className="tnum">
                {r.round}
              </th>
              <td>
                <Outcome o={r.outcome} />
              </td>
              <td className="tnum">{em(r.line)}</td>
              <td className="tnum">
                {em(r.pledged)} <small>by {r.pledgers}</small>
              </td>
              <td className="tnum">{em(BigInt(r.burned) + BigInt(r.treasury_burned))}</td>
              <td className="tnum">
                {em(r.payout)} <small>{r.outcome === "roared" ? "sparks" : "refunds"}</small>
              </td>
              <td className="tnum">{r.streak_after}</td>
              <td className="tnum">
                <a href={`${EXPLORER}/blocks/${r.closed_block}`} target="_blank" rel="noreferrer">
                  {r.closed_block.toLocaleString("en-US")}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="aside">
        Every pledge, close and claim is a transaction to{" "}
        <a href={`${EXPLORER}/address/${HEARTH_CONTRACT}`} target="_blank" rel="noreferrer">
          {HEARTH_CONTRACT}
        </a>
        .
      </p>
    </div>
  );
}
