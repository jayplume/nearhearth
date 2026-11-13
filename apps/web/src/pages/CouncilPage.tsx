import { Council, WarmthBoard } from "../components/Council";
import type { Snapshot } from "../lib/live";

export function CouncilPage({ snap }: { snap: Snapshot }) {
  return (
    <main className="page">
      <div className="wrap">
        <h1>The Hearth Council</h1>
        <p className="lead">
          30% of EMBER launched into a Sputnik DAO. The council pays the people who keep the fire lit, and it decides by warmth: EMBER each
          account burned in roaring rounds, recorded by the contract and never transferable. Every payout is a normal DAO proposal and vote.
        </p>
        <div className="split">
          <section>
            <h2>Proposals</h2>
            <Council snap={snap} />
          </section>
          <section>
            <h2>Warmth</h2>
            <WarmthBoard snap={snap} />
            <p className="aside">
              <code>pnpm council warmth</code> reads this board from the contract and files two kinds of proposal: the warmest keepers join the
              council role, and a grant of 5% of their warmth is paid from the council's EMBER.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
