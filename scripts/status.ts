/** The fire right now, read from NEAR testnet (no key needed).  pnpm status [--json] */
import { flag } from "./lib/args.js";
import { type ChainRound, type ChainState, COUNCIL_DAO, HEARTH_CONTRACT, fmt, hearth } from "@nearhearth/hearth";

const s = await hearth<ChainState>("get_state");
const rounds = await hearth<ChainRound[]>("list_rounds", { limit: 8 });
const council = await hearth<string>("ft_balance_of", { account_id: COUNCIL_DAO });
const e = (x: string) => fmt(BigInt(x));
if (flag("json")) {
  console.log(JSON.stringify({ contract: HEARTH_CONTRACT, state: s, council_balance: council, rounds }, null, 2));
  process.exit(0);
}
console.log(`${HEARTH_CONTRACT}
round ${s.round}, ${Math.max(0, Math.round((s.round_ends_ms - Date.now()) / 1000))} s left: ${e(s.pledged)} / ${e(s.line)} EMBER pledged by ${s.pledgers}
streak ${s.streak} (best ${s.best_streak}); ${s.rounds_roared} roared, ${s.rounds_out} went out
supply ${e(s.total_supply)}  burned ${e(s.total_burned)}  minted ${e(s.total_minted)}  treasury ${e(s.treasury)}  council ${e(council)}
last rounds:`);
for (const r of rounds) console.log(`  #${r.round} ${r.outcome.padEnd(6)} line ${e(r.line).padStart(6)}  pledged ${e(r.pledged).padStart(6)} by ${r.pledgers}  streak → ${r.streak_after}`);
