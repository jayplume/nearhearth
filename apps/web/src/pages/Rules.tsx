import { HEARTH_CONTRACT, lineFor, toParams } from "@nearhearth/hearth";
import { em } from "../lib/format";
import type { Snapshot } from "../lib/live";
import { REPO } from "../components/parts";

export function Rules({ snap }: { snap: Snapshot }) {
  const p = snap.params;
  const rows: [string, string, string][] = [
    ["round_secs", `${p.round_secs / 60} minutes`, "Length of a round."],
    ["base_line", `${em(p.base_line)} EMBER`, "The line at streak 0."],
    ["line_step_bps", `${p.line_step_bps / 100}%`, "How much the line grows per streak level, as a share of the base."],
    ["max_line_multiple", `${p.max_line_multiple}×`, "The line never goes above this multiple of the base."],
    ["spark_bps", `${p.spark_bps / 100}%`, "Spark pool minted when the fire roars, as a share of the line."],
    ["ash_bps", `${p.ash_bps / 100}%`, "Share of each pledge that burns when the fire goes out."],
    ["treasury_burn_bps", `${p.treasury_burn_bps / 100}%`, "Share of the treasury that burns when a round with pledges goes out."],
    ["min_pledge", `${em(p.min_pledge)} EMBER`, "Smallest pledge."],
    ["drip", `${em(p.drip)} EMBER`, "One-time grant to a new account, from the treasury."],
    ["drip_budget", `${em(p.drip_budget)} EMBER`, "All the drip can ever hand out."],
  ];
  return (
    <main className="page">
      <div className="wrap prose-wide">
        <h1>The rules</h1>
        <p className="lead">
          Fixed when the contract launched and read live from <code>{HEARTH_CONTRACT}</code> (<code>get_params</code>). The contract has no
          owner and no method that changes them.
        </p>
        <nav className="toc" aria-label="On this page">
          <a href="#params">Parameters</a>
          <a href="#line">The line</a>
          <a href="#round">A round</a>
          <a href="#sybil">Sybil resistance</a>
        </nav>
        <table className="params" id="params">
          <tbody>
            {rows.map(([k, v, d]) => (
              <tr key={k}>
                <th scope="row">
                  <code>{k}</code>
                </th>
                <td className="tnum">{v}</td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2 id="line">The line, streak by streak</h2>
        <p>
          The longer the fire roars, the more it takes. Current streak: <b>{snap.state.streak}</b>.
        </p>
        <div className="schedule">
          {[0, 1, 2, 3, 5, 8, 10, 15, 20].map((k) => {
            const line = lineFor(toParams(p), k);
            return (
              <div key={k} className={snap.state.streak === k ? "is-now" : undefined}>
                <span>streak {k}</span>
                <b className="tnum">{em(line)}</b>
                <i style={{ height: `${Number((line * 100n) / lineFor(toParams(p), 20))}%` }} />
              </div>
            );
          })}
        </div>
        <h2 id="round">A round, step by step</h2>
        <ol className="steps">
          <li>
            <b>Pledge.</b> During the round, anyone holding EMBER calls <code>pledge</code>. The EMBER moves into escrow in the contract.
          </li>
          <li>
            <b>Close.</b> After the round ends, anyone calls <code>close_rounds</code> (a pledge or claim does it too). Rounds close in order, and
            the contract compares the pledges with the line for the streak at that moment.
          </li>
          <li>
            <b>Claim.</b> Each pledger calls <code>claim_all</code>: sparks pro rata for a round that roared, half the pledge back for one that
            went out. Claims are lazy so closing a round costs the same with two pledgers or two thousand.
          </li>
        </ol>
        <h2 id="sybil">Sybil resistance, and where it ends</h2>
        <ul className="plain">
          <li>Sparks are pro rata to EMBER pledged, so splitting one holder into many accounts earns nothing extra.</li>
          <li>Warmth is only earned by burning EMBER in roaring rounds, so farming it costs real EMBER.</li>
          <li>
            The drip is once per account, so a farm of accounts could collect drips. That is capped at {em(p.drip_budget)} EMBER and by
            NEAR's account and storage costs. A mainnet launch would replace the drip with a sale or an airdrop.
          </li>
        </ul>
        <p>
          The full rules, written before the contract: <a href={`${REPO}/blob/main/RULES.md`}>RULES.md</a>.
        </p>
      </div>
    </main>
  );
}
