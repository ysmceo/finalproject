import { useState } from "react";
import { ChevronRight, Menu, X } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const guestServiceLinks = [
  { label: "Home", to: "/" },
  { label: "Book", to: "/book" },
  { label: "Order", to: "/order-products" },
  { label: "Track booking", to: "/track-booking" },
  { label: "Track order", to: "/track-order" },
  { label: "Contact", to: "/contact" }
];

function HeaderLink({ item, className, activeClassName, onNavigate, withChevron = false }) {
  const location = useLocation();

  const content = (
    <>
      <span>{item.label}</span>
      {withChevron ? <ChevronRight className="h-4 w-4 shrink-0" /> : null}
    </>
  );

  if (item.to) {
    return (
      <NavLink
        className={({ isActive }) => cn(className, isActive && activeClassName)}
        onClick={onNavigate}
        to={item.to}
      >
        {content}
      </NavLink>
    );
  }

  const isActive = location.pathname === "/" && location.hash === item.href;

  return (
    <a className={cn(className, isActive && activeClassName)} href={item.href} onClick={onNavigate}>
      {content}
    </a>
  );
}

export function AnimatedBackdrop({ images, className, overlayClassName, imageClassName }) {
  return (
    <div aria-hidden="true" className={cn("absolute inset-0 overflow-hidden", className)}>
      {images.map((image, index) => (
        <span
          key={`${image}-${index}`}
          className={cn("slideshow-layer", `slideshow-layer--${index % 3}`, imageClassName)}
          style={{ backgroundImage: `url("${image}")` }}
        />
      ))}
      <span
        className={cn(
          "absolute inset-0 bg-[linear-gradient(135deg,rgba(22,28,36,0.72),rgba(22,28,36,0.24)_45%,rgba(196,107,45,0.18))]",
          overlayClassName
        )}
      />
    </div>
  );
}

export function MarketingHeader({ links, primaryAction, secondaryAction, compact = false }) {
  const [menuOpen, setMenuOpen] = useState(false);

  function renderAction(action, variant, className, onNavigate) {
    if (!action) {
      return null;
    }

    if (action.to) {
      return (
        <Button asChild className={className} variant={variant}>
          <Link onClick={onNavigate} to={action.to}>
            {action.label}
          </Link>
        </Button>
      );
    }

    return (
      <Button asChild className={className} variant={variant}>
        <a href={action.href} onClick={onNavigate}>
          {action.label}
        </a>
      </Button>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-panel/80 shadow-glow backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link className="flex min-w-0 flex-1 items-center gap-3" onClick={() => setMenuOpen(false)} to="/">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-night text-white shadow-[0_14px_30px_rgba(31,41,55,0.18)]">
              <img alt="CEO Unisex Salon" className="h-7 w-7" src="/images/logo.svg" />
            </span>
            <span className="min-w-0">
              <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-brand-deep/75">
                CEO Unisex Salon
              </span>
              <span className="block truncate font-display text-[1.65rem] leading-none text-ink sm:text-2xl">
                {compact ? "Guest Services" : "Beauty Meets Excellence"}
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            {links.map((item) => (
              <HeaderLink
                key={item.label}
                activeClassName="border-brand/60 bg-brand/10 text-ink"
                className="inline-flex items-center gap-2 rounded-full border border-transparent px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-line/70 hover:bg-panel-strong/45 hover:text-ink"
                item={item}
              />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle className="inline-flex" />
            {renderAction(secondaryAction, "ghost", "hidden xl:inline-flex")}
            {renderAction(primaryAction, "default", "hidden sm:inline-flex")}
            <Button
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="lg:hidden"
              onClick={() => setMenuOpen((current) => !current)}
              size="icon"
              type="button"
              variant="outline"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {menuOpen ? (
          <div className="mobile-nav-panel border-t border-line/70 bg-panel/95 lg:hidden">
            <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6">
              <div className="grid gap-2">
                {links.map((item) => (
                  <HeaderLink
                    key={item.label}
                    activeClassName="border-brand/50 bg-brand/10 text-ink shadow-soft"
                    className="flex items-center justify-between rounded-[1.3rem] border border-line/70 bg-panel/85 px-4 py-3 text-sm font-semibold text-ink transition hover:border-brand/35 hover:bg-panel-strong/45"
                    item={item}
                    onNavigate={() => setMenuOpen(false)}
                    withChevron
                  />
                ))}
              </div>

              {primaryAction || secondaryAction ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {renderAction(primaryAction, "default", "w-full justify-center", () => setMenuOpen(false))}
                  {renderAction(secondaryAction, "outline", "w-full justify-center", () => setMenuOpen(false))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      {compact ? (
        <div className="sticky top-[4.65rem] z-30 border-b border-line/60 bg-canvas/80 backdrop-blur-xl">
          <div className="route-rail mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
            {guestServiceLinks.map((item) => (
              <HeaderLink
                key={item.label}
                activeClassName="border-brand bg-brand text-white shadow-[0_16px_34px_hsl(var(--brand)_/_0.22)]"
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line/70 bg-panel/88 px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-brand/30 hover:bg-panel-strong/55 hover:text-ink"
                item={item}
              />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function SitePageShell({
  eyebrow,
  title,
  description,
  children,
  aside,
  backgroundImages,
  primaryAction,
  secondaryAction
}) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MarketingHeader
        compact
        links={guestServiceLinks}
        primaryAction={primaryAction || { label: "Back Home", to: "/" }}
        secondaryAction={secondaryAction}
      />

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 pb-14 sm:px-6 sm:py-8 lg:gap-8 lg:py-10">
        <section className="relative isolate overflow-hidden rounded-4xl border border-line/70 bg-night text-white shadow-[0_30px_80px_rgba(31,41,55,0.18)] sm:rounded-[2.25rem]">
          <AnimatedBackdrop
            images={backgroundImages}
            overlayClassName="bg-[linear-gradient(135deg,rgba(17,24,39,0.86),rgba(17,24,39,0.52)_42%,rgba(196,107,45,0.18))]"
          />
          <div className="relative grid gap-6 px-5 py-6 sm:px-8 sm:py-9 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:px-10 lg:py-12">
            <div className="space-y-4 sm:space-y-5">
              <Link
                className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:bg-white/14"
                to="/"
              >
                Landing page
              </Link>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-soft">{eyebrow}</p>
                <h1 className="max-w-3xl font-display text-4xl leading-[0.94] sm:text-5xl lg:text-6xl">{title}</h1>
                <p className="max-w-2xl text-sm leading-7 text-white/75 sm:text-base">{description}</p>
              </div>
            </div>
            <div>{aside}</div>
          </div>
        </section>

        {children}
      </main>
    </div>
  );
}
