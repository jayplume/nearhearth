import { HEARTH_CONTRACT, accountUrl } from "@nearhearth/hearth";
import { Hearth } from "../components/Hearth";
import { Keepers } from "../components/Keepers";
import { Rounds } from "../components/Rounds";
import { em } from "../lib/format";
import type { Snapshot } from "../lib/live";
import { Link } from "../lib/router";

export function Home({ snap, refresh }: { snap: Snapshot; refresh: () => Promise<void> }) {
  const s = snap.state;
  const p = snap.params;
  const pct = (bps: number) => `${bps / 100}%`;
  return (
    <main>
      <section className="hero">
        <div className="wrap">
          <Hearth
            snap={snap}
            refresh={refresh}
            intro={
              <div className="hero-copy">
            <h1>
              Keep the fire lit.
              <span>Or watch it burn the treasury.</span>
            </h1>
            <p className="lead">
              EMBER is a memecoin with a fire. Every {p.round_secs / 60} minutes, holders and a swarm of keeper agents pledge EMBER. Reach the
              line together and the fire roars: the pledges burn and {pct(p.spark_bps)} of the line comes back as sparks. Fall short and{" "}
              {pct(p.ash_bps)} of every pledge turns to ash.
            </p>
          </div>
            }
          />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>One round, three endings.</h2>
          <ol className="endings">
            <li className="ending ending--roared">
              <h3>The fire roars</h3>
              <p>
                Pledges reach the line ({em(s.line)} EMBER this round). Every pledge burns, a spark pool of {pct(p.spark_bps)} of the line is
                minted, and each pledger claims their share. The streak grows, and so does the next line, by {pct(p.line_step_bps)} of the
                base, up to {p.max_line_multiple}×.
              </p>
            </li>
            <li className="ending ending--out">
              <h3>The fire goes out</h3>
              <p>
                Pledges fall short. {pct(p.ash_bps)} of each pledge burns as ash, the rest is refunded, the streak resets, and{" "}
                {pct(p.treasury_burn_bps)} of the treasury burns with it. A dying community costs everyone.
              </p>
            </li>
            <li className="ending ending--cold">
              <h3>Nobody comes</h3>
              <p>No pledges, no burn: the round is cold and only the streak resets. The fire waits for its keepers.</p>
            </li>
          </ol>
          <p className="aside">
            Pledging more than the line does not help: the spark pool is fixed, so extra logs dilute everyone's sparks. The best rounds land
            right on the line. <Link to="/rules">All the rules</Link>
          </p>
        </div>
      </section>

      <section className="section section--deep">
        <div className="wrap supply">
          <div>
            <h2>Supply that answers to the room.</h2>
            <p>
              No price chart decides what EMBER is. The contract does, round by round, from what the community does. Every number here is read
              from{" "}
              <a href={accountUrl(HEARTH_CONTRACT)} target="_blank" rel="noreferrer">
                {HEARTH_CONTRACT}
              </a>{" "}
              while you watch.
            </p>
          </div>
          <dl className="supply-figs">
            <div>
              <dt>Total supply</dt>
              <dd className="tnum">{em(s.total_supply)}</dd>
            </div>
            <div>
              <dt>Burned so far</dt>
              <dd className="tnum">{em(s.total_burned)}</dd>
            </div>
            <div>
              <dt>Minted as sparks</dt>
              <dd className="tnum">{em(s.total_minted)}</dd>
            </div>
            <div>
              <dt>Treasury</dt>
              <dd className="tnum">{em(s.treasury)}</dd>
            </div>
            <div>
              <dt>Rounds roared</dt>
              <dd className="tnum">{s.rounds_roared}</dd>
            </div>
            <div>
              <dt>Rounds that went out</dt>
              <dd className="tnum">{s.rounds_out}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="section">
        <div className="wrap split">
          <div>
            <h2>The keepers.</h2>
            <p>
              Thirteen agents, each on its own NEAR sub-account. Twelve run one strategy from a single readable file: steady keepers throw
              early, skeptics wait for momentum, closers land the gap in the last minutes, a guardian protects long streaks, and one free rider
              shows what doing nothing earns. The thirteenth asks a model on NEAR AI Cloud what to pledge, within the same caps. They see only
              what you see.
            </p>
            <Link to="/swarm" className="btn">
              Watch the whole swarm
            </Link>
          </div>
          <Keepers snap={snap} compact />
        </div>
      </section>

      <section className="section section--deep">
        <div className="wrap">
          <h2>Every round, on chain.</h2>
          <Rounds snap={snap} />
        </div>
      </section>

      <section className="section">
        <div className="wrap why">
          <h2>Why a memecoin needs a fire.</h2>
          <p className="why-big">
            NEAR's memecoin launchpad took <b>$8,807</b> in fees in November 2024. This month: <b>$1.91</b>.
          </p>
          <p>
            Most memecoins have one mechanic: the price. After launch there is nothing to do but watch it, so nobody comes back. EMBER gives
            holders a reason to show up every round, a way to lose together, and a high score that only the community can set. Source:{" "}
            <a href="https://defillama.com/protocol/meme-cooking" target="_blank" rel="noreferrer">
              DefiLlama, meme.cooking fees
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
