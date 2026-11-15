/**
 * The Hearth Council (a Sputnik DAO) acting on warmth. Every payout is a normal
 * DAO proposal that the council votes on; this script only files and votes.
 *
 *   pnpm council grant-keepers         # fund the keeper swarm from the council (one proposal, many transfers)
 *   pnpm council grant --to <account> --amount <EMBER> --why "<reason>"   # one grant, as a normal proposal
 *   pnpm council warmth [--min 2000]   # propose the warmest keepers into the council's "keepers" role and a warmth grant
 *   pnpm council list                  # the DAO's latest proposals
 *   add --dry-run to print the proposals without sending anything
 *
 * Proposer: nearhearth-fund.testnet. Voter: nearhearth.testnet (one approval passes, see the DAO policy).
 */
import { COUNCIL_DAO, HEARTH_CONTRACT, KEEPERS, ONE, fmt, txUrl, view } from "@nearhearth/hearth";
import { flag, opt } from "./lib/args.js";
import { call } from "./lib/signer.js";

const PROPOSER = "nearhearth-fund.testnet";
const VOTER = "nearhearth.testnet";
const BOND = "100000000000000000000000"; // 0.1 NEAR, the DAO's proposal bond
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");

const DRY = flag("dry-run");

async function propose(description: string, kind: unknown): Promise<number> {
  if (DRY) {
    console.log(`[dry run] would propose: ${description}\n  ${JSON.stringify(kind).slice(0, 220)}`);
    return -1;
  }
  const s = await call(PROPOSER, COUNCIL_DAO, "add_proposal", { proposal: { description, kind } }, BOND, "100000000000000");
  if (!s.ok) throw new Error(`add_proposal failed: ${s.failure} ${txUrl(s.hash)}`);
  console.log(`proposed #${s.value}: ${description}\n  ${txUrl(s.hash)}`);
  return s.value as number;
}

/** Council members who can vote from this machine: the two founders, then any keeper the council has admitted. */
async function voters(): Promise<string[]> {
  const policy = await view<{ roles: { name: string; kind: { Group?: string[] } | string }[] }>(COUNCIL_DAO, "get_policy");
  const council = policy.roles.find((r) => r.name === "council");
  const members = typeof council?.kind === "object" ? (council.kind.Group ?? []) : [];
  return [VOTER, PROPOSER, ...members.filter((m) => m !== VOTER && m !== PROPOSER)];
}

/** Votes until the DAO's threshold is met: as the council grows, one approval stops being enough. */
async function approve(id: number, kind: unknown) {
  if (id < 0) return;
  for (const v of await voters()) {
    const p = await view<{ status: string; votes: Record<string, string> }>(COUNCIL_DAO, "get_proposal", { id });
    if (p.status !== "InProgress") break;
    if (p.votes[v]) continue;
    const s = await call(v, COUNCIL_DAO, "act_proposal", { id, action: "VoteApprove", proposal: kind }, "0", "300000000000000");
    console.log(`${v} approves #${id}: ${s.ok ? "ok" : s.failure}\n  ${txUrl(s.hash)}`);
  }
  const p = await view<{ status: string }>(COUNCIL_DAO, "get_proposal", { id });
  console.log(`  status: ${p.status}`);
}

const transfers = (pays: { to: string; amount: bigint; memo: string }[]) => ({
  FunctionCall: {
    receiver_id: HEARTH_CONTRACT,
    actions: pays.map((p) => ({
      method_name: "ft_transfer",
      args: b64({ receiver_id: p.to, amount: p.amount.toString(), memo: p.memo }),
      deposit: "1",
      gas: "10000000000000",
    })),
  },
});

const cmd = process.argv[2] ?? "list";
if (cmd === "grant-keepers") {
  const each = BigInt(opt("each") ?? "2400") * ONE;
  const pays = KEEPERS.filter((k) => k.strategy !== "freerider").map((k) => ({ to: k.id, amount: each, memo: "council grant: keeper starter stack" }));
  const kind = transfers(pays);
  const id = await propose(`Fund the keeper swarm: ${fmt(each)} EMBER to each of ${pays.length} working keepers (the free rider gets nothing).`, kind);
  await approve(id, kind);
} else if (cmd === "grant") {
  const to = opt("to");
  const amount = opt("amount");
  const why = opt("why") ?? "council grant";
  if (!to || !amount || !/^\d+$/.test(amount)) throw new Error('usage: pnpm council grant --to <account> --amount <whole EMBER> --why "<reason>"');
  const kind = transfers([{ to, amount: BigInt(amount) * ONE, memo: why.slice(0, 120) }]);
  const id = await propose(`Grant ${fmt(BigInt(amount) * ONE)} EMBER to ${to}: ${why}`, kind);
  await approve(id, kind);
} else if (cmd === "warmth") {
  const min = BigInt(opt("min") ?? "2000") * ONE;
  const all = await view<[string, string][]>(HEARTH_CONTRACT, "list_warmth", { limit: 200 });
  const warm = all.map(([a, w]) => ({ a, w: BigInt(w) })).filter((x) => x.w >= min).sort((x, y) => (y.w > x.w ? 1 : -1));
  if (warm.length === 0) {
    console.log(`nobody has ${fmt(min)} warmth yet`);
    process.exit(0);
  }
  const members = new Set(await voters());
  const newcomers = warm.filter(({ a }) => !members.has(a)).slice(0, 3);
  if (newcomers.length === 0) console.log("the warmest keepers are already on the council");
  for (const { a, w } of newcomers) {
    const kind = { AddMemberToRole: { member_id: a, role: "council" } };
    const id = await propose(`${a} has ${fmt(w)} warmth (every point is EMBER it burned in roaring rounds). Add to the council.`, kind);
    await approve(id, kind);
  }
  // Grant: 5% of each top keeper's warmth, from the council's EMBER.
  const pays = warm.slice(0, 5).map(({ a, w }) => ({ to: a, amount: w / 20n, memo: "warmth grant: 5% of warmth" }));
  const kind = transfers(pays);
  const id = await propose(`Warmth grant: 5% of warmth to the ${pays.length} warmest keepers.`, kind);
  await approve(id, kind);
} else {
  const n = await view<number>(COUNCIL_DAO, "get_last_proposal_id");
  const ps = await view<{ id: number; description: string; status: string; proposer: string }[]>(COUNCIL_DAO, "get_proposals", { from_index: Math.max(0, n - 10), limit: 10 });
  for (const p of ps) console.log(`#${p.id} ${p.status.padEnd(10)} ${p.description}`);
}
