import { ONE_YOCTO, STORAGE_DEPOSIT, previewPledge, toParams, txUrl } from "@nearhearth/hearth";
import { useEffect, useRef, useState } from "react";
import { clock, em, emNum, nextSwarmSession, toYocto } from "../lib/format";
import { type Snapshot, loadAccount } from "../lib/live";
import { Fire, type FireHandle } from "./Fire";
import { Outcome, useToast } from "./parts";

const walletLib = () => import("../lib/wallet");
type Acct = Awaited<ReturnType<typeof loadAccount>>;

function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const TxLink = ({ hash, children }: { hash: string; children: string }) => (
  <a href={txUrl(hash)} target="_blank" rel="noreferrer">
    {children}
  </a>
);

/** The live round: the fire, the line, the clock, and your hands on it. */
export function Hearth({ snap, refresh, intro }: { snap: Snapshot; refresh: () => Promise<void>; intro?: React.ReactNode }) {
  const s = snap.state;
  const now = useNow();
  const fire = useRef<FireHandle>(null);
  const toast = useToast();
  const line = BigInt(s.line);
  const pledged = BigInt(s.pledged);
  const heat = line > 0n ? emNum(pledged) / emNum(line) : 0;
  const left = s.round_ends_ms - now;
  const roundMs = snap.params.round_secs * 1000;
  const gap = line > pledged ? line - pledged : 0n;
  const lastRoar = snap.rounds.find((r) => r.outcome === "roared");
  const recent = [...snap.rounds].slice(0, 14).reverse();

  // When a round closes and it roared, the fire throws sparks.
  const lastRound = useRef<number | null>(null);
  useEffect(() => {
    const newest = snap.rounds[0];
    if (newest && lastRound.current !== null && newest.round !== lastRound.current) {
      if (newest.outcome === "roared") {
        fire.current?.burst(1.4);
        toast(`Round ${newest.round} roared: ${em(newest.pledged)} EMBER burned, ${em(newest.payout)} in sparks for its ${newest.pledgers} pledgers.`, "good");
      } else toast(`Round ${newest.round} went out: ${em(newest.burned)} EMBER turned to ash, streak reset.`, "bad");
    }
    if (newest) lastRound.current = newest.round;
  }, [snap.rounds, toast]);

  // ---------- your account ----------
  const [account, setAccount] = useState<string | null>(null);
  const [me, setMe] = useState<Acct | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    walletLib()
      .then((w) => w.connectedAccount())
      .then(setAccount, () => setAccount(null));
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read the account whenever the chain snapshot moves
  useEffect(() => {
    if (!account) return setMe(null);
    loadAccount(account, s.round).then(setMe, () => setMe(null));
  }, [account, snap.at]);

  async function act(id: string, label: string, method: string, args: Record<string, unknown>, deposit: string, after?: (v: unknown) => string) {
    setBusy(id);
    try {
      const { hash, value } = await (await walletLib()).send(method, args, deposit);
      toast(
        <>
          {after ? after(value) : `${label}: done.`} <TxLink hash={hash}>See it on NearBlocks</TxLink>
        </>,
        "good",
      );
      if (method === "pledge") fire.current?.burst(0.35);
      await refresh();
      if (account) setMe(await loadAccount(account, s.round));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "bad");
    } finally {
      setBusy(null);
    }
  }

  const due = me?.claimable.filter((c) => c.status !== "open") ?? [];
  const dueTotal = due.reduce((a, c) => a + BigInt(c.amount), 0n);
  const amountNum = Number(amount);
  const amountOk = Number.isFinite(amountNum) && amountNum >= 1 && me !== null && BigInt(toYocto(amountNum)) <= me.balance;
  const amountIssue =
    amount.trim() === "" || me === null
      ? null
      : !Number.isFinite(amountNum)
        ? "Type a number of EMBER."
        : amountNum < 1
          ? "The smallest pledge is 1 EMBER."
          : BigInt(toYocto(amountNum)) > me.balance
            ? `You hold ${em(me.balance)} EMBER.`
            : null;

  return (
    <section className="hearth" aria-label="The current round">
      <div className="hearth-left">
        {intro}
      <div className="play">
        <h2>Throw a log</h2>
        {!account && (
          <>
            <p className="muted">Connect a NEAR testnet wallet. New accounts get 100 EMBER once, from the treasury.</p>
            <div className="wallets">
              {(["meteor-wallet", "intear-wallet", "here-wallet", "sender"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="wallet"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy(id);
                    try {
                      const a = await (await walletLib()).connect(id);
                      setAccount(a);
                      toast(`Connected ${a}`, "good");
                    } catch (e) {
                      toast(`Did not connect: ${e instanceof Error ? e.message : String(e)}`, "bad");
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy === id ? "Opening…" : { "meteor-wallet": "Meteor", "intear-wallet": "Intear", "here-wallet": "HERE", sender: "Sender" }[id]}
                </button>
              ))}
            </div>
          </>
        )}
        {account && me && (
          <>
            <p className="play-who">
              <b>{account}</b>
              <span className="tnum">{em(me.balance)} EMBER</span>
              <button type="button" className="link" onClick={() => walletLib().then((w) => w.disconnect()).then(() => setAccount(null))}>
                Switch
              </button>
            </p>
            {!me.dripped && (
              <button
                type="button"
                className="btn btn--ember"
                disabled={busy !== null}
                onClick={() => act("drip", "Drip", "drip", {}, me.registered ? "0" : STORAGE_DEPOSIT, (v) => `You got ${em(String(v))} EMBER from the treasury.`)}
              >
                {busy === "drip" ? "Waiting for your wallet…" : "Take your 100 EMBER"}
              </button>
            )}
            {me.balance > 0n && (
              <form
                className="pledge"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (amountOk)
                    act("pledge", "Pledge", "pledge", { amount: toYocto(amountNum) }, ONE_YOCTO, (v) => `Your log is on the fire: ${em(String(v))} EMBER pledged in round ${s.round}.`);
                }}
              >
                <label htmlFor="amt">EMBER to pledge in round {s.round}</label>
                <div className="pledge-row">
                  <input id="amt" inputMode="decimal" aria-invalid={amountIssue !== null} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 50" />
                  <button type="submit" className="btn btn--ember" disabled={!amountOk || busy !== null}>
                    {busy === "pledge" ? "Waiting…" : "Pledge"}
                  </button>
                </div>
                {amountOk &&
                  me &&
                  (() => {
                    const p = previewPledge(toParams(snap.params), line, pledged, me.pledge, BigInt(toYocto(amountNum)));
                    return (
                      <p className={`pledge-preview pledge-preview--${p.outcome}`}>
                        {p.outcome === "roared"
                          ? `If the round closed now, it would roar: about ${em(p.back)} EMBER back to you as sparks.`
                          : `If the round closed now, it would still be ${em(line - p.total)} short: ${em(p.back)} EMBER back, the rest ash.`}
                      </p>
                    );
                  })()}
                {amountIssue && (
                  <output className="pledge-msg" htmlFor="amt">
                    {amountIssue}
                  </output>
                )}
                <div className="pledge-quick">
                  {gap > 0n && gap <= me.balance && (
                    <button type="button" className="chip-btn" onClick={() => setAmount(String(Math.ceil(emNum(gap))))}>
                      Fill the gap ({em(gap)})
                    </button>
                  )}
                  <button type="button" className="chip-btn" onClick={() => setAmount(String(Math.floor(emNum(me.balance))))}>
                    All in ({em(me.balance)})
                  </button>
                  {[10, 50, 100].map((n) => (
                    <button key={n} type="button" className="chip-btn" onClick={() => setAmount(String(n))}>
                      {n}
                    </button>
                  ))}
                </div>
              </form>
            )}
            {due.length > 0 && (
              <div className="claims">
                <p>
                  {due.map((c) => (
                    <span key={c.round}>
                      Round {c.round} <Outcome o={c.status} /> {em(c.amount)} EMBER
                    </span>
                  ))}
                </p>
                <button
                  type="button"
                  className="btn btn--flame"
                  disabled={busy !== null}
                  onClick={() => act("claim", "Claim", "claim_all", {}, "0", (v) => `Collected ${em(String(v))} EMBER.`)}
                >
                  {busy === "claim" ? "Waiting…" : `Collect ${em(dueTotal)} EMBER`}
                </button>
              </div>
            )}
            <p className="play-warmth">
              Your warmth: <b className="tnum">{em(me.warmth)}</b>. It grows with every EMBER you burn in a roaring round, and the council pays
              by it.
            </p>
          </>
        )}
        {account && !me && <p className="muted">Reading your account…</p>}
        </div>
      </div>
      <div className="hearth-stage">
        <Fire ref={fire} heat={heat} label={`The fire is at ${Math.round(heat * 100)}% of the line this round`} />
        <div className="hearth-meter" aria-hidden="true">
          <div className="hearth-meter-fill" style={{ height: `${Math.min(1.25, heat) * 80}%` }} />
          <div className="hearth-meter-line" style={{ bottom: "80%" }}>
            <span>the line</span>
          </div>
        </div>
        <div className="hearth-read">
          <p className="hearth-round">
            Round {s.round} · <span className="tnum">{clock(left)}</span> left
          </p>
          <p className="hearth-big tnum">
            {em(pledged)}
            <small> / {em(line)} EMBER</small>
          </p>
          <span className="sr">{Math.round(heat * 100)}% of the line pledged.</span>
          <div className="hearth-bar" aria-hidden="true">
            <div style={{ width: `${Math.min(1, heat) * 100}%` }} className={heat >= 1 ? "is-over" : undefined} />
            <i style={{ width: `${Math.min(100, (1 - Math.max(0, left) / roundMs) * 100)}%` }} />
          </div>
          <p className="hearth-sub">
            {heat >= 1
              ? `Over the line by ${em(pledged - line)}. The fire will roar; extra logs only dilute the sparks.`
              : pledged === 0n
                ? lastRoar
                  ? `The fire is waiting. It last roared in round ${lastRoar.round}. If nobody pledges this round, it goes cold and the streak resets. The keeper swarm next plays around ${nextSwarmSession(Date.now()).toISOString().slice(11, 16)} UTC; you can pledge any time.`
                  : "Nobody has pledged yet. A cold round resets the streak."
                : `${em(gap)} EMBER short. If it stays short, half of every pledge turns to ash.`}
          </p>
          <dl className="hearth-stats">
            <div>
              <dt>Streak</dt>
              <dd className="tnum">{s.streak}</dd>
            </div>
            <div>
              <dt>Best</dt>
              <dd className="tnum">{s.best_streak}</dd>
            </div>
            <div>
              <dt>Pledgers</dt>
              <dd className="tnum">{s.pledgers}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="share"
            onClick={() => {
              const text = `Round ${s.round} of the NEAR Hearth: ${em(pledged)} / ${em(line)} EMBER pledged, streak ${s.streak}. ${heat >= 1 ? "The fire is roaring." : `${em(gap)} short.`} ${window.location.origin}`;
              navigator.clipboard?.writeText(text).then(
                () => toast("Round summary copied. Paste it anywhere.", "good"),
                () => toast(text),
              );
            }}
          >
            Share this round
          </button>
          {recent.length > 0 && (
            <ol className="streakline" aria-label="The last rounds with pledges, oldest first">
              {recent.map((r) => (
                <li key={r.round} className={`streakline-${r.outcome}`} title={`Round ${r.round}: ${r.outcome === "roared" ? "roared" : "went out"}, ${em(r.pledged)} of ${em(r.line)} EMBER`}>
                  <span className="sr">
                    Round {r.round} {r.outcome}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
