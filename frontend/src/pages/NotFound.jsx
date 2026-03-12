import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-16 text-center text-ink">
      <div className="max-w-2xl rounded-[2rem] border border-line bg-panel px-8 py-10 shadow-[0_18px_44px_rgba(116,77,44,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-deep/75">404</p>
        <h1 className="mt-4 font-display text-5xl leading-none text-ink sm:text-6xl">Page not found</h1>
        <p className="mt-4 text-sm leading-7 text-ink-soft sm:text-base">
          This route is not part of the new React interface. Return to the website or open the admin workspace.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(141,69,22,0.22)] transition hover:bg-brand-deep"
            to="/"
          >
            Go to Website
          </Link>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-panel px-5 text-sm font-semibold text-ink transition hover:bg-panel-strong/70"
            to="/admin"
          >
            Admin Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
