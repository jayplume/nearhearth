import { COUNCIL_DAO, HEARTH_CONTRACT, accountUrl } from "@nearhearth/hearth";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, useRoute } from "../lib/router";

export const REPO = "https://github.com/jayplume/nearhearth";
declare const __COMMIT__: string;
const COMMIT = typeof __COMMIT__ === "string" ? __COMMIT__ : "dev";

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lg-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff5e1a" />
          <stop offset="0.6" stopColor="#ff9f1c" />
          <stop offset="1" stopColor="#ffd166" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#241812" />
      <path d="M32 9c3 9 14 14 14 28a14 14 0 0 1-28 0c0-7 4-12 8-16 0 5 2 8 5 10-2-8 0-16 1-22z" fill="url(#lg-flame)" />
      <path d="M32 31c2 5 7 7 7 13a7 7 0 0 1-14 0c0-4 2-6 4-9 1 3 2 4 3 4-1-3-1-6 0-8z" fill="#fff1c9" />
      <rect x="15" y="52" width="34" height="5" rx="2.5" fill="#6b4029" />
    </svg>
  );
}

const NAV = [
  { to: "/", label: "The fire" },
  { to: "/swarm", label: "Keepers" },
  { to: "/council", label: "Council" },
  { to: "/for-near", label: "For NEAR" },
  { to: "/rules", label: "Rules" },
];

/** "Live" while reads keep arriving; says how old the last read is if they stop. */
function Freshness({ at }: { at?: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!at) return null;
  const age = Math.max(0, Math.round((now - at) / 1000));
  const stale = age > 30;
  return (
    <span className={`fresh${stale ? " is-stale" : ""}`} title="When this page last read the contract">
      <span className="fresh-dot" />
      {stale ? `read ${age} s ago` : "live"}
    </span>
  );
}

export function Nav({ at }: { at?: number }) {
  const { path } = useRoute();
  const [open, setOpen] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: close the menu on navigation
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand" aria-label="NEAR Hearth home">
          <Logo />
          <span>NEAR Hearth</span>
        </Link>
        <Freshness at={at} />
        <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen((o) => !o)}>
          Menu
        </button>
        <nav id="main-nav" className={`nav-links${open ? " is-open" : ""}`} aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="nav-link">
              {n.label}
            </Link>
          ))}
          <a className="nav-link" href={REPO} target="_blank" rel="noreferrer">
            Code
          </a>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Link to="/" className="brand">
            <Logo />
            <span>NEAR Hearth</span>
          </Link>
          <p>
            EMBER is a memecoin with a fire that only the community can keep lit. Everything runs in one contract on NEAR testnet, with no
            owner and no admin key. Test tokens only.
          </p>
        </div>
        <div>
          <h4>On chain</h4>
          <a href={accountUrl(HEARTH_CONTRACT)} target="_blank" rel="noreferrer">
            Hearth contract
          </a>
          <a href={accountUrl(COUNCIL_DAO)} target="_blank" rel="noreferrer">
            Council DAO
          </a>
          <a href="https://testnet.nearblocks.io/token/fire.nearhearth.testnet" target="_blank" rel="noreferrer">
            EMBER on NearBlocks
          </a>
        </div>
        <div>
          <h4>Project</h4>
          <a href={REPO} target="_blank" rel="noreferrer">
            Source code
          </a>
          <Link to="/rules">The rules</Link>
          <Link to="/swarm">The simulation</Link>
          <Link to="/for-near">What it is worth to NEAR</Link>
        </div>
      </div>
      <p className="footer-build">
        Built from{" "}
        <a href={`${REPO}/commit/${COMMIT}`} target="_blank" rel="noreferrer">
          {COMMIT}
        </a>
      </p>
    </footer>
  );
}

// ---------- toasts ----------

type Toast = { id: number; msg: ReactNode; tone: "info" | "good" | "bad" };
const ToastCtx = createContext<(msg: ReactNode, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const next = useRef(0);
  const push = useCallback((msg: ReactNode, tone: Toast["tone"] = "info") => {
    const id = next.current++;
    setItems((xs) => [...xs, { id, msg, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 5200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <div>{t.msg}</div>
            <button type="button" className="toast-x" aria-label="Dismiss" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <output className="loading">
      <span className="spinner" aria-hidden="true" />
      {label}
    </output>
  );
}

export function Outcome({ o }: { o: "roared" | "out" | "cold" | "open" }) {
  const word = o === "roared" ? "Roared" : o === "out" ? "Went out" : o === "cold" ? "Cold" : "Burning";
  return <span className={`chip chip--${o}`}>{word}</span>;
}
