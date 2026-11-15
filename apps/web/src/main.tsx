import { StrictMode, Suspense, lazy, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Footer, Nav, Spinner, ToastProvider } from "./components/parts";
import { useHearth } from "./lib/live";
import { RouterProvider, useRoute } from "./lib/router";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";

// The home page loads with the app; the other pages load when first visited.
const Swarm = lazy(() => import("./pages/Swarm").then((m) => ({ default: m.Swarm })));
const CouncilPage = lazy(() => import("./pages/CouncilPage").then((m) => ({ default: m.CouncilPage })));
const ForNear = lazy(() => import("./pages/ForNear").then((m) => ({ default: m.ForNear })));
const Rules = lazy(() => import("./pages/Rules").then((m) => ({ default: m.Rules })));
import "./styles/tokens.css";
import "./styles/app.css";

const TITLES: Record<string, string> = {
  "/": "NEAR Hearth: keep the fire lit",
  "/swarm": "The keeper swarm · NEAR Hearth",
  "/council": "The Hearth Council · NEAR Hearth",
  "/rules": "The rules · NEAR Hearth",
  "/for-near": "What a hearth is worth to NEAR · NEAR Hearth",
};

const DESCRIPTIONS: Record<string, string> = {
  "/": "EMBER is a memecoin with a fire. Holders and a swarm of keeper agents pledge every round on NEAR; reach the line together and it roars, fall short and it burns the treasury.",
  "/swarm": "Thirteen keeper agents on their own NEAR sub-accounts (one decides with a model on NEAR AI Cloud), their live reasoning, and a 60-round simulation of four communities.",
  "/council": "The Hearth Council, a Sputnik DAO holding 30% of EMBER, pays and seats keepers by warmth: EMBER they burned in rounds that roared.",
  "/for-near": "What a hearth brings NEAR: recurring accounts, gas burned, storage locked, a job for DAOs and agents, and how the project pays for itself.",
  "/rules": "The launch parameters of the NEAR Hearth contract, read live from the chain, and how a round works.",
};

function App() {
  const { path } = useRoute();
  const { snap, error, refresh } = useHearth();
  // On the home page the tab shows the round's progress, so the fire is visible from another tab.
  const pct = snap && BigInt(snap.state.line) > 0n ? Number((BigInt(snap.state.pledged) * 100n) / BigInt(snap.state.line)) : null;
  useEffect(() => {
    if (path === "/" && pct !== null) document.title = `${pct >= 100 ? "Roaring" : `${pct}%`} · NEAR Hearth`;
  }, [path, pct]);
  useEffect(() => {
    document.title = TITLES[path] ?? "Not found · NEAR Hearth";
    document.querySelector('meta[name="description"]')?.setAttribute("content", DESCRIPTIONS[path] ?? DESCRIPTIONS["/"]!);
    if (!window.location.hash) window.scrollTo({ top: 0 });
  }, [path]);
  let body: React.ReactNode;
  if (!snap)
    body = (
      <main className="page">
        <div className="wrap">
          {error ? (
            <p className="error">Could not reach NEAR testnet: {error}. Trying again in a few seconds.</p>
          ) : (
            <div className="skeleton" aria-busy="true">
              <Spinner label="Reading the fire from NEAR" />
              <div className="skeleton-grid">
                <div className="skeleton-block skeleton-block--copy" />
                <div className="skeleton-block skeleton-block--stage" />
              </div>
            </div>
          )}
        </div>
      </main>
    );
  else if (path === "/") body = <Home snap={snap} refresh={refresh} />;
  else if (path === "/swarm") body = <Swarm snap={snap} />;
  else if (path === "/council") body = <CouncilPage snap={snap} />;
  else if (path === "/rules") body = <Rules snap={snap} />;
  else if (path === "/for-near") body = <ForNear snap={snap} />;
  else body = <NotFound />;
  return (
    <>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <Nav at={snap?.at} />
      <div id="content">
        <ErrorBoundary key={path}>
          <Suspense
            fallback={
              <main className="page">
                <div className="wrap">
                  <Spinner label="Opening the page" />
                </div>
              </main>
            }
          >
            <div className="route" key={path}>
              {body}
            </div>
          </Suspense>
        </ErrorBoundary>
      </div>
      <Footer />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </RouterProvider>
  </StrictMode>,
);
