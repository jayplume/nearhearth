import { useState } from "react";
import sim from "../../../../data/simulation.json";

type Row = { round: number; outcome: "roared" | "out" | "cold"; supply: number; streak: number; pledged: number; line: number };
type Result = { scenario: string; title: string; description: string; rows: Row[]; summary: { roared: number; out: number; cold: number; bestStreak: number; supplyChangePct: number } };
const results = (sim as unknown as { results: Result[] }).results;

/** Supply over 60 simulated rounds for each scenario, plus a strip of what each round did. */
export function SimChart() {
  const [pick, setPick] = useState(results[0]!.scenario);
  const [hover, setHover] = useState<number | null>(null);
  const all = results.flatMap((r) => r.rows.map((x) => x.supply));
  const min = Math.min(...all, 1_000_000) * 0.98;
  const max = Math.max(...all, 1_000_000) * 1.02;
  const W = 640;
  const H = 220;
  const x = (i: number) => 8 + (i / 59) * (W - 16);
  const y = (v: number) => 10 + (1 - (v - min) / (max - min)) * (H - 20);
  const cur = results.find((r) => r.scenario === pick)!;
  const row = hover === null ? null : cur.rows[hover];
  return (
    <div className="sim">
      <div className="sim-tabs" role="tablist" aria-label="Simulated communities">
        {results.map((r) => (
          <button key={r.scenario} type="button" role="tab" aria-selected={r.scenario === pick} className={r.scenario === pick ? "is-on" : undefined} onClick={() => setPick(r.scenario)}>
            {r.title}
          </button>
        ))}
      </div>
      <p className="sim-desc">{cur.description}</p>
      <svg
        viewBox={`0 0 ${W} ${H + 26}`}
        className="sim-svg"
        role="img"
        aria-label={`EMBER supply over 60 rounds: ${cur.title}`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round((((e.clientX - r.left) / r.width) * W - 8) / ((W - 16) / 59));
          setHover(Math.max(0, Math.min(59, i)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <line x1={8} x2={W - 8} y1={y(1_000_000)} y2={y(1_000_000)} className="sim-base" />
        <text x={W - 8} y={y(1_000_000) - 6} textAnchor="end" className="sim-label">
          launch supply, 1,000,000
        </text>
        {results.map((r) => (
          <polyline
            key={r.scenario}
            points={r.rows.map((p, i) => `${x(i)},${y(p.supply)}`).join(" ")}
            className={`sim-line${r.scenario === pick ? " is-on" : ""}`}
          />
        ))}
        {cur.rows.map((p, i) => (
          <rect key={p.round} x={x(i) - 4} y={H + 8} width={8} height={12} rx={2} className={`sim-tick sim-tick--${p.outcome}`} />
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={6} y2={H + 22} className="sim-cross" />}
      </svg>
      <p className="sim-read tnum">
        {row
          ? `Round ${row.round}: line ${row.line.toLocaleString("en-US")}, pledged ${Math.round(row.pledged).toLocaleString("en-US")}, ${row.outcome}, streak ${row.streak}, supply ${Math.round(row.supply).toLocaleString("en-US")}`
          : `${cur.summary.roared} roared, ${cur.summary.out} went out, ${cur.summary.cold} cold. Best streak ${cur.summary.bestStreak}. Supply ${cur.summary.supplyChangePct > 0 ? "+" : ""}${cur.summary.supplyChangePct}% after 60 rounds.`}
      </p>
    </div>
  );
}
