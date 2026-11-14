import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Footer, Nav, Spinner, ToastProvider } from "./components/parts";
import { useHearth } from "./lib/live";
import { RouterProvider, useRoute } from "./lib/router";
import { CouncilPage } from "./pages/CouncilPage";
import { ForNear } from "./pages/ForNear";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { Rules } from "./pages/Rules";
import { Swarm } from "./pages/Swarm";
import "./styles/tokens.css";
import "./styles/app.css";

const TITLES: Record<string, string> = {
  "/": "NEAR Hearth: keep the fire lit",
  "/swarm": "The keeper swarm · NEAR Hearth",
  "/council": "The Hearth Council · NEAR Hearth",
  "/rules": "The rules · NEAR Hearth",
  "/for-near": "What a hearth is worth to NEAR · NEAR Hearth",
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
      <div id="content">{body}</div>
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
