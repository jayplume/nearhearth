/** Live reads from NEAR testnet: the hearth, its rounds, the keepers and the council. Polls, no server. */
import {
  type ChainAccount,
  type ChainClaimable,
  type ChainParams,
  type ChainRound,
  type ChainState,
  COUNCIL_DAO,
  HEARTH_CONTRACT,
  KEEPERS,
  hearth,
  view,
} from "@nearhearth/hearth";
import { useCallback, useEffect, useRef, useState } from "react";

export interface Proposal {
  id: number;
  proposer: string;
  description: string;
  status: string;
  kind: Record<string, unknown> | string;
  submission_time: string;
  votes: Record<string, string>;
}

export interface Snapshot {
  state: ChainState;
  params: ChainParams;
  rounds: ChainRound[];
  keepers: { id: string; strategy: (typeof KEEPERS)[number]["strategy"]; balance: bigint; warmth: bigint; pledge: bigint }[];
  council: { balance: bigint; members: string[]; proposals: Proposal[] };
  warmth: { account: string; warmth: bigint }[];
  /** When this snapshot was read, local clock. */
  at: number;
}

let params: ChainParams | null = null;
let policyMembers: string[] | null = null;

/** The full picture: about six RPC calls, because the swarm is read in one batch (get_accounts). */
async function load(): Promise<Snapshot> {
  const state = await hearth<ChainState>("get_state");
  params ??= await hearth<ChainParams>("get_params");
  const ids = [...KEEPERS.map((k) => k.id), COUNCIL_DAO];
  const [rounds, warmthList, accounts, last] = await Promise.all([
    hearth<ChainRound[]>("list_rounds", { limit: 30 }),
    hearth<[string, string][]>("list_warmth", { limit: 200 }),
    hearth<ChainAccount[]>("get_accounts", { account_ids: ids, round: state.round }),
    view<number>(COUNCIL_DAO, "get_last_proposal_id"),
  ]);
  if (!policyMembers) {
    const policy = await view<{ roles: { name: string; kind: { Group?: string[] } | string }[] }>(COUNCIL_DAO, "get_policy");
    policyMembers = [...new Set(policy.roles.flatMap((r) => (typeof r.kind === "object" && r.kind.Group ? r.kind.Group : [])))];
  }
  const proposals = last > 0 ? await view<Proposal[]>(COUNCIL_DAO, "get_proposals", { from_index: Math.max(0, last - 12), limit: 12 }) : [];
  const by = new Map(accounts.map((a) => [a.account_id, a]));
  return {
    state,
    params,
    rounds,
    keepers: KEEPERS.map((k) => {
      const a = by.get(k.id);
      return { id: k.id, strategy: k.strategy, balance: BigInt(a?.balance ?? "0"), warmth: BigInt(a?.warmth ?? "0"), pledge: BigInt(a?.pledge ?? "0") };
    }),
    council: { balance: BigInt(by.get(COUNCIL_DAO)?.balance ?? "0"), members: policyMembers, proposals: proposals.reverse() },
    warmth: warmthList.map(([account, w]) => ({ account, warmth: BigInt(w) })).sort((a, b) => (b.warmth > a.warmth ? 1 : -1)),
    at: Date.now(),
  };
}

/**
 * Reads everything now, then the round state every `fast` ms and the full picture every `slow` ms.
 * `refresh()` reads everything again at once (after a transaction).
 */
export function useHearth(fast = 5000, slow = 20000) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      setSnap(await load());
      have.current = true;
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
    }
  }, []);
  const have = useRef(false);
  const tick = useCallback(async () => {
    if (busy.current) return;
    // Nothing loaded yet (the first read failed): try the full read again, fast.
    if (!have.current) return refresh();
    try {
      const state = await hearth<ChainState>("get_state");
      setSnap((prev) => {
        if (!prev) return prev;
        // A new round or a new pledge: read the full picture so keepers and rounds stay in step.
        if (state.round !== prev.state.round || state.pledged !== prev.state.pledged) queueMicrotask(refresh);
        return { ...prev, state };
      });
    } catch {
      /* the slow refresh will report it */
    }
  }, [refresh]);
  useEffect(() => {
    refresh();
    const a = setInterval(tick, fast);
    const b = setInterval(refresh, slow);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [refresh, tick, fast, slow]);
  return { snap, error, refresh };
}

/** Everything the play panel needs about one account, including its pledge in `round`. */
export async function loadAccount(account: string, round: number) {
  const [[a], claimable, dripped, storage] = await Promise.all([
    hearth<ChainAccount[]>("get_accounts", { account_ids: [account], round }),
    hearth<ChainClaimable[]>("get_claimable", { account_id: account }),
    hearth<boolean>("has_dripped", { account_id: account }),
    hearth<unknown>("storage_balance_of", { account_id: account }),
  ]);
  return { balance: BigInt(a?.balance ?? "0"), pledge: BigInt(a?.pledge ?? "0"), claimable, warmth: BigInt(a?.warmth ?? "0"), dripped, registered: storage !== null };
}

export const CONTRACT = HEARTH_CONTRACT;

/** Runs `fn` once on mount; undefined until it resolves (and stays undefined on error). */
export function useAsyncOnce<T>(fn: () => Promise<T>): T | undefined {
  const [v, setV] = useState<T | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once
  useEffect(() => {
    let live = true;
    fn().then(
      (x) => live && setV(x),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  return v;
}
