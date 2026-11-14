import { type ChainRound, HEARTH_CONTRACT, hearth } from "@nearhearth/hearth";
import { em } from "../lib/format";
import { type Snapshot, useAsyncOnce } from "../lib/live";

/**
 * What NEAR gets out of a hearth, and how the project pays for itself.
 * Live figures come from the contract; everything else is stated as a plan.
 */
export function ForNear({ snap }: { snap: Snapshot }) {
  const s = snap.state;
  const history = useAsyncOnce(() => hearth<ChainRound[]>("list_rounds", { limit: 100 }));
  const rounds = history ?? snap.rounds;
  const pledges = rounds.reduce((a, r) => a + r.pledgers, 0);
  const closed = s.rounds_roared + s.rounds_out;
  const warm = snap.warmth.length;
  return (
    <main className="page">
      <div className="wrap">
        <h1>What a hearth is worth to NEAR</h1>
        <p className="lead">
          NEAR's daily active accounts fell from 2.02 million a day in July 2024 to about 64 thousand, and its memecoins went quiet with them. A
          hearth turns a token's holders into accounts that come back every round, on chain, because the token itself depends on it.
        </p>

        <section className="value-block" aria-labelledby="live-h">
          <h2 id="live-h">What one testnet hearth has done so far</h2>
          <dl className="value-figs">
            <div>
              <dt>Rounds closed with pledges</dt>
              <dd className="tnum">{closed}</dd>
            </div>
            <div>
              <dt>Pledges</dt>
              <dd className="tnum">{pledges}</dd>
              <span>{history ? "across all closed rounds" : "in the last 30 rounds"}, each a NEAR transaction, each followed by a claim</span>
            </div>
            <div>
              <dt>Accounts with warmth</dt>
              <dd className="tnum">{warm}</dd>
              <span>burned EMBER in a roaring round</span>
            </div>
            <div>
              <dt>EMBER burned</dt>
              <dd className="tnum">{em(s.total_burned)}</dd>
            </div>
          </dl>
          <p className="aside">Read from {HEARTH_CONTRACT} just now. Testnet rounds last 10 minutes; a mainnet hearth would run one round a day.</p>
        </section>

        <section className="value-block" aria-labelledby="flow-h">
          <h2 id="flow-h">Where the value goes</h2>
          <ol className="value-flow">
            <li>
              <b>Recurring daily accounts.</b> Every holder who plays makes two transactions a round: a pledge and a claim. A community of 1,000
              players on a daily hearth is 2,000 NEAR transactions a day that would not exist without it, by accounts with a reason to return
              tomorrow.
            </li>
            <li>
              <b>Gas, burned and shared.</b> Every pledge, close and claim pays NEAR gas. Most of it is burned, which offsets NEAR's issuance; the
              protocol credits 30% of the gas a contract's calls burn to that contract's account, which pays the hearth's own storage.
            </li>
            <li>
              <b>NEAR locked for storage.</b> Each new holder registers with the token (0.0125 NEAR), and each closed round keeps a record on
              chain. That NEAR stays locked for as long as the hearth lives.
            </li>
            <li>
              <b>A use for DAOs on NEAR.</b> The council is a stock Sputnik DAO that pays contributors by a reputation it cannot fake. Every
              grant and every new member is a DAO proposal and vote: governance with something real to decide.
            </li>
            <li>
              <b>A reason to build agents on NEAR.</b> Keepers are agents with their own NEAR accounts and a live economy to play in. Better
              keepers land the line more often, so agent builders have something to compete on.
            </li>
          </ol>
        </section>

        <section className="value-block" aria-labelledby="model-h">
          <h2 id="model-h">How it pays for itself</h2>
          <table className="model">
            <thead>
              <tr>
                <th scope="col">What</th>
                <th scope="col">Who pays</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">EMBER's hearth, keepers and council</th>
                <td>Nobody. The council's 30% of supply funds keepers and contributors; contract rewards from gas help pay storage</td>
                <td>
                  <span className="status status--live">Live on testnet</span>
                </td>
              </tr>
              <tr>
                <th scope="row">A hearth for any memecoin</th>
                <td>
                  Launchpads such as meme.cooking, as a launch option: the same contract for any NEP-141 token, with a launch fee in NEAR. Every
                  launch is a token whose holders have a reason to return
                </td>
                <td>
                  <span className="status">Planned</span>
                </td>
              </tr>
              <tr>
                <th scope="row">Hosted keepers</th>
                <td>Communities that want their fire tended while they sleep, paid in their own token through their council</td>
                <td>
                  <span className="status">Planned</span>
                </td>
              </tr>
              <tr>
                <th scope="row">Pledging from any chain</th>
                <td>Players who hold assets elsewhere, buying EMBER through NEAR Intents: each purchase pays NEAR's Intents fee</td>
                <td>
                  <span className="status">Planned</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="aside">Planned rows have no prices yet, and none of this is a forecast.</p>
        </section>

        <section className="value-block" aria-labelledby="why-h">
          <h2 id="why-h">Why this is safe to offer</h2>
          <ul className="plain">
            <li>The hearth has no owner and no admin method: a launchpad can offer it without being able to rug it, and so can anyone else.</li>
            <li>Parameters are fixed at launch and readable by anyone. A community picks its round length, line and burns once, in public.</li>
            <li>Sparks are pro rata, so splitting into many accounts earns nothing; warmth costs burned EMBER.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
