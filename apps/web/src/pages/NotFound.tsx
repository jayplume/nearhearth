import { Logo } from "../components/parts";
import { Link } from "../lib/router";

/** A cold hearth: nothing burns at this address. */
export function NotFound() {
  return (
    <main className="page">
      <div className="wrap notfound">
        <div className="notfound-mark" aria-hidden="true">
          <Logo size={96} />
        </div>
        <h1>Nothing burns here.</h1>
        <p className="lead">This page went cold. The fire is still going on the home page, and the keepers are tending it.</p>
        <Link to="/" className="btn btn--ember">
          Back to the fire
        </Link>
      </div>
    </main>
  );
}
