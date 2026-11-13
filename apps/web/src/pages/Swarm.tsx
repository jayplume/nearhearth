import { Keepers } from "../components/Keepers";
import { SimChart } from "../components/SimChart";
import type { Snapshot } from "../lib/live";

export function Swarm({ snap }: { snap: Snapshot }) {
  return (
    <main className="page">
      <div className="wrap">
        <h1>The keeper swarm</h1>
        <p className="lead">
          Each keeper is an agent with its own sub-account of <code>nearhearth.testnet</code> and its own key. Every few seconds the line below
          re-runs its strategy on the live round: the sentence is the reason it would give if it woke now.
        </p>
        <Keepers snap={snap} />

        <section className="block">
          <h2>Sixty rounds, four communities</h2>
          <p>
            Before writing the contract, we simulated 60 rounds with scripted keepers under the same rules, and picked the parameters from the
            results. A swarm with closers keeps the fire roaring 59 rounds out of 60. Take the closers away and it goes out three times in four.
            Move across the chart to read any round.
          </p>
          <SimChart />
        </section>
      </div>
    </main>
  );
}
