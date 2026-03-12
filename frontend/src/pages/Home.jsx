import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  LoaderCircle,
  Mail,
  MapPin,
  MessageCircle,
  PackageSearch,
  PhoneCall,
  ShoppingBag,
  Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { MarketingHeader, AnimatedBackdrop } from "@/components/site/marketing";
import { Notice, SectionHeading, Surface } from "@/components/site/shared";
import {
  businessHours,
  ceoProfiles,
  fallbackProductImages,
  galleryItems,
  guestActionCards,
  heroBackdropImages,
  heroStats,
  heroTrust,
  landingNav,
  ribbonItems,
  salonContact,
  sectionBackdrops,
  teamMembers
} from "@/lib/landing";
import { formatCurrency, getErrorMessage } from "@/lib/site";
import { loadCatalog, resolveMediaSrc } from "@/lib/storefront";

function HeroStat({ label, value }) {
  return (
    <div className="rounded-[1.55rem] border border-white/14 bg-white/10 px-5 py-4 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.22em] text-white/60">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{value}</p>
    </div>
  );
}

function FeatureShell({ id, title, eyebrow, description, images, children }) {
  return (
    <section
      className="relative isolate overflow-hidden rounded-[2rem] border border-line/70 bg-panel/92 shadow-card sm:rounded-[2.25rem]"
      id={id}
    >
      <AnimatedBackdrop
        className="opacity-90"
        imageClassName="mix-blend-multiply dark:mix-blend-soft-light dark:opacity-45"
        images={images}
        overlayClassName="bg-[linear-gradient(135deg,rgba(255,250,243,0.96),rgba(255,250,243,0.82)_44%,rgba(196,107,45,0.12))] dark:bg-[linear-gradient(135deg,rgba(9,12,20,0.94),rgba(11,16,28,0.8)_42%,rgba(196,107,45,0.12))]"
      />
      <div className="relative space-y-8 px-5 py-6 sm:px-8 sm:py-10 lg:px-10">
        <SectionHeading description={description} eyebrow={eyebrow} title={title} />
        {children}
      </div>
    </section>
  );
}

export default function Home() {
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogNotice, setCatalogNotice] = useState(null);

  useEffect(() => {
    let active = true;

    loadCatalog()
      .then((data) => {
        if (!active) {
          return;
        }

        setServices(data.services);
        setProducts(data.products);
      })
      .catch((error) => {
        if (active) {
          setCatalogNotice({ tone: "error", message: getErrorMessage(error) });
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const featuredServices = services.slice(0, 6);
  const featuredProducts = products.slice(0, 6);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MarketingHeader
        links={landingNav}
        primaryAction={{ label: "Book now", to: "/book" }}
        secondaryAction={{ label: "Track booking", to: "/track-booking" }}
      />

      <main>
        <section className="relative isolate overflow-hidden border-b border-line/70 bg-night text-white">
          <AnimatedBackdrop
            images={heroBackdropImages}
            overlayClassName="bg-[linear-gradient(135deg,rgba(17,24,39,0.88),rgba(17,24,39,0.58)_42%,rgba(196,107,45,0.16))]"
          />
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-10 lg:py-24">
            <div className="relative space-y-6">
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-brand-soft backdrop-blur">
                Premium care / Smart booking / Live tracking
              </div>
              <div className="space-y-4">
                <img alt="CEO Unisex Salon" className="h-14 w-14" src="/images/logo.svg" />
                <h1 className="max-w-4xl font-display text-5xl leading-[0.9] sm:text-7xl lg:text-8xl">
                  CEO Unisex Salon
                </h1>
                <p className="text-lg font-semibold text-brand-soft sm:text-xl">Where beauty meets excellence</p>
                <p className="max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
                  Transform your look with professional stylists, thoughtful aftercare, and a calmer guest experience.
                  The landing page is now focused on the brand story while every form lives on its own dedicated route.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild className="w-full sm:w-auto" size="lg">
                  <Link to="/book">Book an appointment</Link>
                </Button>
                <Button asChild className="w-full sm:w-auto" size="lg" variant="contrast">
                  <Link to="/order-products">Order products</Link>
                </Button>
                <Button asChild className="w-full sm:w-auto" size="lg" variant="contrast">
                  <Link to="/contact">Contact the salon</Link>
                </Button>
              </div>

              <div className="flex flex-wrap gap-3">
                {heroTrust.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white/82"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative grid gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                {heroStats.map((item) => (
                  <HeroStat key={item.label} label={item.label} value={item.value} />
                ))}
              </div>

              <div className="rounded-[2rem] border border-white/14 bg-white/10 p-6 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-soft">Guest services</p>
                <div className="mt-5 grid gap-3">
                  <div className="flex items-start gap-3 rounded-[1.4rem] border border-white/10 bg-black/10 px-4 py-4">
                    <CalendarDays className="mt-0.5 h-5 w-5 text-brand-soft" />
                    <div>
                      <p className="font-semibold">Book an appointment</p>
                      <p className="mt-1 text-sm text-white/72">Choose services, slot, payment plan, and style reference.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-[1.4rem] border border-white/10 bg-black/10 px-4 py-4">
                    <ShoppingBag className="mt-0.5 h-5 w-5 text-brand-soft" />
                    <div>
                      <p className="font-semibold">Order salon products</p>
                      <p className="mt-1 text-sm text-white/72">Browse products with live totals and delivery fees.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-[1.4rem] border border-white/10 bg-black/10 px-4 py-4">
                    <PackageSearch className="mt-0.5 h-5 w-5 text-brand-soft" />
                    <div>
                      <p className="font-semibold">Track updates</p>
                      <p className="mt-1 text-sm text-white/72">Check booking or order progress on separate tracking pages.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-line/70 bg-panel">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 md:grid-cols-3">
            {ribbonItems.map((item) => (
              <div
                key={item.title}
                className="rounded-[1.7rem] border border-line/70 bg-panel/92 px-5 py-5 shadow-[0_16px_32px_rgba(116,77,44,0.06)]"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-deep/75">{item.title}</p>
                <p className="mt-3 text-sm leading-6 text-ink-soft">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-10 sm:gap-16 sm:px-6 sm:py-14">
          <FeatureShell
            description="The same leadership spotlight from the legacy homepage, but with a cleaner presentation."
            eyebrow="Leadership"
            id="ceo"
            images={sectionBackdrops.ceo}
            title="Meet our CEOs"
          >
            <div className="grid gap-5 lg:grid-cols-2">
              {ceoProfiles.map((profile) => (
                <Surface key={profile.name} className="bg-panel/92">
                  <div className="grid gap-5 sm:grid-cols-[220px_1fr] sm:items-center">
                    <img
                      alt={profile.name}
                      className="h-64 w-full rounded-[1.7rem] object-cover sm:h-72"
                      src={profile.image}
                    />
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-deep/75">CEO spotlight</p>
                      <h3 className="font-display text-4xl leading-none text-ink">{profile.name}</h3>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">{profile.role}</p>
                      <p className="text-sm leading-7 text-ink-soft">{profile.summary}</p>
                    </div>
                  </div>
                </Surface>
              ))}
            </div>
          </FeatureShell>

          <FeatureShell
            description="Service cards are still driven by the live catalog and now guide guests into the booking page instead of opening a form inline."
            eyebrow="Services"
            id="services"
            images={sectionBackdrops.services}
            title="Our services"
          >
            <Notice className="max-w-3xl" message={catalogNotice?.message} tone={catalogNotice?.tone} />
            {loading ? (
              <div className="flex items-center gap-3 rounded-[1.7rem] border border-line bg-panel/85 px-5 py-4 text-sm text-ink-soft">
                <LoaderCircle className="h-4 w-4 animate-spin text-brand" />
                Loading services...
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featuredServices.map((service) => (
                <Surface key={service.id} className="bg-panel/92">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-deep/75">Premium service</p>
                      <h3 className="text-2xl font-semibold text-ink">{service.name}</h3>
                      <p className="text-sm text-ink-soft">
                        {formatCurrency(service.price)} | {Number(service.duration || 0)} mins
                      </p>
                    </div>
                    <Button asChild className="w-full sm:w-auto" variant="outline">
                      <Link to="/book">Book this service</Link>
                    </Button>
                  </div>
                </Surface>
              ))}
            </div>
          </FeatureShell>

          <FeatureShell
            description="Products remain on the homepage as a proper showcase, with ordering moved into its own route."
            eyebrow="Products"
            id="products"
            images={sectionBackdrops.products}
            title="Products we sell"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featuredProducts.map((product, index) => (
                <Surface key={product.id} className="overflow-hidden bg-panel/92 p-0">
                  <div className="h-56 overflow-hidden">
                    <img
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-700 hover:scale-105"
                      src={resolveMediaSrc(product.image) || fallbackProductImages[index % fallbackProductImages.length]}
                    />
                  </div>
                  <div className="space-y-4 p-6">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-deep/75">
                        {product.category || "Salon product"}
                      </p>
                      <h3 className="text-2xl font-semibold text-ink">{product.name}</h3>
                      <p className="text-sm text-ink-soft">
                        {formatCurrency(product.price)} | Stock: {Number(product.stock || 0)}
                      </p>
                    </div>
                    <Button asChild className="w-full sm:w-auto" variant="outline">
                      <Link to="/order-products">Order this product</Link>
                    </Button>
                  </div>
                </Surface>
              ))}
            </div>
          </FeatureShell>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {guestActionCards.map((card) => (
              <Surface key={card.title} className="bg-panel-strong/35">
                <div className="space-y-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-night text-white">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-semibold text-ink">{card.title}</h3>
                    <p className="text-sm leading-7 text-ink-soft">{card.description}</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Button asChild className="w-full sm:w-auto">
                      <Link to={card.to}>{card.cta}</Link>
                    </Button>
                    {card.secondaryTo ? (
                      <Button asChild className="w-full sm:w-auto" variant="ghost">
                        <Link to={card.secondaryTo}>{card.secondaryCta}</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Surface>
            ))}
          </section>

          <FeatureShell
            description="The original image-led showcase remains, now framed with softer spacing and cleaner cards."
            eyebrow="Gallery"
            id="gallery"
            images={sectionBackdrops.gallery}
            title="Our portfolio"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {galleryItems.map((item) => (
                <div
                  key={item.title}
                  className="overflow-hidden rounded-[1.9rem] border border-line/70 bg-panel/92 shadow-[0_16px_32px_rgba(116,77,44,0.08)]"
                >
                  <img alt={item.title} className="h-60 w-full object-cover transition duration-700 hover:scale-105" src={item.image} />
                  <div className="px-5 py-4">
                    <h3 className="text-xl font-semibold text-ink">{item.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </FeatureShell>

          <FeatureShell
            description="The same team section from the old landing page, restyled for better hierarchy and image presentation."
            eyebrow="Team"
            id="team"
            images={sectionBackdrops.team}
            title="Our professional team"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {teamMembers.map((member) => (
                <Surface key={member.name} className="overflow-hidden bg-panel/92 p-0">
                  <img alt={member.name} className="h-72 w-full object-cover" src={member.image} />
                  <div className="space-y-2 p-6">
                    <h3 className="text-2xl font-semibold text-ink">{member.name}</h3>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">{member.role}</p>
                    <p className="text-sm leading-7 text-ink-soft">{member.bio}</p>
                  </div>
                </Surface>
              ))}
            </div>
          </FeatureShell>

          <FeatureShell
            description="The contact section stays on the homepage, but the actual message form now lives on its own route."
            eyebrow="Contact"
            id="contact"
            images={sectionBackdrops.contact}
            title="Get in touch"
          >
            <div className="grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
              <Surface className="space-y-5 bg-panel/92">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-deep/75">Contact information</p>
                  <h3 className="font-display text-4xl leading-none text-ink">Salon details</h3>
                </div>
                <div className="space-y-4 text-sm text-ink-soft">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 text-brand" />
                    <span>{salonContact.address}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <PhoneCall className="mt-0.5 h-5 w-5 text-brand" />
                    <span>{salonContact.phone}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-5 w-5 text-brand" />
                    <span>{salonContact.email}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 h-5 w-5 text-brand" />
                    <div className="space-y-2">
                      {businessHours.map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button asChild className="w-full sm:w-auto">
                    <Link to="/contact">Send a message</Link>
                  </Button>
                  <Button asChild className="w-full sm:w-auto" variant="outline">
                    <a href={salonContact.whatsapp} rel="noreferrer" target="_blank">
                      WhatsApp support
                    </a>
                  </Button>
                </div>
              </Surface>

              <Surface className="space-y-5 bg-night text-white">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-soft">Customer care desk</p>
                  <h3 className="font-display text-4xl leading-none">Need help fast?</h3>
                  <p className="text-sm leading-7 text-white/72">
                    Professional support for bookings, payments, complaints, product orders, and follow-up care.
                  </p>
                </div>
                <div className="grid gap-3">
                  <a
                    className="flex items-center justify-between rounded-[1.4rem] border border-white/12 bg-white/8 px-4 py-4 text-sm transition hover:bg-white/12"
                    href={`tel:${salonContact.phone}`}
                  >
                    <span className="flex items-center gap-3">
                      <PhoneCall className="h-5 w-5 text-brand-soft" />
                      Call support
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a
                    className="flex items-center justify-between rounded-[1.4rem] border border-white/12 bg-white/8 px-4 py-4 text-sm transition hover:bg-white/12"
                    href={`mailto:${salonContact.email}`}
                  >
                    <span className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-brand-soft" />
                      Email support
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a
                    className="flex items-center justify-between rounded-[1.4rem] border border-white/12 bg-white/8 px-4 py-4 text-sm transition hover:bg-white/12"
                    href={salonContact.whatsapp}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="flex items-center gap-3">
                      <MessageCircle className="h-5 w-5 text-brand-soft" />
                      WhatsApp support
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </Surface>
            </div>
          </FeatureShell>
        </div>
      </main>

      <footer className="relative isolate overflow-hidden border-t border-line/70 bg-night text-white">
        <AnimatedBackdrop
          images={sectionBackdrops.footer}
          overlayClassName="bg-[linear-gradient(135deg,rgba(17,24,39,0.9),rgba(17,24,39,0.72)_42%,rgba(196,107,45,0.12))]"
        />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr_0.8fr]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-soft">CEO Unisex Salon</p>
            <h2 className="font-display text-5xl leading-none">Professional hair and beauty services in Lagos.</h2>
            <p className="max-w-xl text-sm leading-7 text-white/72">
              The homepage has been rebuilt in React and Tailwind, with booking, product orders, tracking, and contact
              flows now handled on focused dedicated pages.
            </p>
          </div>

          <div className="grid gap-3 text-sm text-white/75">
            <a className="transition hover:text-white" href="#services">
              Services
            </a>
            <a className="transition hover:text-white" href="#products">
              Products
            </a>
            <a className="transition hover:text-white" href="#gallery">
              Gallery
            </a>
            <a className="transition hover:text-white" href="#team">
              Team
            </a>
            <a className="transition hover:text-white" href="#contact">
              Contact
            </a>
          </div>

          <div className="space-y-3 text-sm text-white/75">
            <p>{salonContact.address}</p>
            <p>{salonContact.phone}</p>
            <p>{salonContact.email}</p>
            <Link className="inline-flex items-center gap-2 text-brand-soft transition hover:text-white" to="/admin">
              Admin
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
