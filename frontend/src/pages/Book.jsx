import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Notice, SectionHeading, SelectField, Surface, TextField, DetailRow, EmptyState } from "@/components/site/shared";
import { SitePageShell } from "@/components/site/marketing";
import { ProductPicker } from "@/components/site/storefront";
import { apiGet, apiRequest } from "@/lib/api";
import { getErrorMessage, formatCurrency } from "@/lib/site";
import { buildSelectedItems, getSelectionTotal, getTodayDateInputValue, loadCatalog, PAYMENT_METHODS } from "@/lib/storefront";
import { sectionBackdrops } from "@/lib/landing";

function BookingHeroAside({ serviceCount, productCount }) {
  return (
    <div className="grid gap-4">
      <div className="rounded-[1.9rem] border border-white/14 bg-white/10 p-5 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-soft">What to expect</p>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-white/80">
          <li>Pick one or more services.</li>
          <li>Choose an available date and time slot.</li>
          <li>Add salon products or upload a style reference before submitting.</li>
        </ul>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.7rem] border border-white/14 bg-white/8 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-white/60">Services live</p>
          <p className="mt-3 text-3xl font-semibold">{serviceCount}</p>
        </div>
        <div className="rounded-[1.7rem] border border-white/14 bg-white/8 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-white/60">Products live</p>
          <p className="mt-3 text-3xl font-semibold">{productCount}</p>
        </div>
      </div>
    </div>
  );
}

export default function Book() {
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogNotice, setCatalogNotice] = useState(null);
  const [slots, setSlots] = useState([]);

  const [booking, setBooking] = useState({
    name: "",
    email: "",
    phone: "",
    date: "",
    time: "",
    paymentMethod: "Bank Transfer",
    paymentPlan: "deposit_50",
    serviceIds: [],
    styleImage: null
  });
  const [bookingProducts, setBookingProducts] = useState({});
  const [bookingNotice, setBookingNotice] = useState(null);
  const [bookingResult, setBookingResult] = useState(null);

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

  useEffect(() => {
    let active = true;

    if (!booking.date) {
      return () => {
        active = false;
      };
    }

    apiGet(`/api/bookings/available-slots?date=${encodeURIComponent(booking.date)}`)
      .then((data) => {
        if (active) {
          setSlots(Array.isArray(data.slots) ? data.slots : []);
        }
      })
      .catch(() => {
        if (active) {
          setSlots([]);
        }
      });

    return () => {
      active = false;
    };
  }, [booking.date]);

  const selectedServices = services.filter((service) => booking.serviceIds.includes(Number(service.id)));
  const serviceSubtotal = selectedServices.reduce((sum, service) => sum + Number(service.price || 0), 0);
  const addonsSubtotal = getSelectionTotal(products, bookingProducts);
  const dueNow =
    (booking.paymentPlan === "deposit_50" ? Math.ceil(serviceSubtotal * 0.5) : serviceSubtotal) +
    addonsSubtotal;

  async function submitBooking(event) {
    event.preventDefault();
    setBookingNotice(null);

    const payload = new FormData();
    payload.append("name", booking.name);
    payload.append("email", booking.email);
    payload.append("phone", booking.phone);
    payload.append("serviceId", String(booking.serviceIds[0] || ""));
    payload.append("serviceIds", JSON.stringify(booking.serviceIds));
    payload.append("date", booking.date);
    payload.append("time", booking.time);
    payload.append("paymentMethod", booking.paymentMethod);
    payload.append("paymentPlan", booking.paymentPlan);
    payload.append("productSelections", JSON.stringify(buildSelectedItems(products, bookingProducts)));

    if (booking.styleImage) {
      payload.append("styleImage", booking.styleImage);
    }

    try {
      const data = await apiRequest("/api/bookings", { method: "POST", body: payload });
      setBookingResult(data);
      setBookingNotice({ tone: "success", message: data.message || "Booking created." });
    } catch (error) {
      setBookingNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  function toggleService(serviceId) {
    setBooking((current) => ({
      ...current,
      serviceIds: current.serviceIds.includes(serviceId)
        ? current.serviceIds.filter((id) => id !== serviceId)
        : [...current.serviceIds, serviceId]
    }));
  }

  return (
    <SitePageShell
      aside={<BookingHeroAside productCount={products.length} serviceCount={services.length} />}
      backgroundImages={sectionBackdrops.services}
      description="Book your appointment from a dedicated page instead of the landing screen. Service selection, slot lookup, payment choice, and optional product add-ons all stay available."
      eyebrow="Appointments"
      secondaryAction={{ label: "Track booking", to: "/track-booking" }}
      title="Book your appointment"
    >
      <section className="space-y-5">
        <SectionHeading
          description="These services still come directly from the API, but the experience is cleaner and easier to scan."
          eyebrow="Services"
          title="Choose your salon services"
        />
        <Notice className="max-w-3xl" message={catalogNotice?.message} tone={catalogNotice?.tone} />
        {loading ? (
          <div className="flex items-center gap-3 rounded-[1.7rem] border border-line bg-panel px-5 py-4 text-sm text-ink-soft">
            <LoaderCircle className="h-4 w-4 animate-spin text-brand" />
            Loading services and products...
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => {
            const active = booking.serviceIds.includes(Number(service.id));

            return (
              <Surface
                key={service.id}
                className={active ? "border-brand bg-brand/5 shadow-[0_18px_44px_hsl(var(--brand)_/_0.16)]" : undefined}
              >
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-deep/75">Salon service</p>
                    <h2 className="text-2xl font-semibold text-ink">{service.name}</h2>
                    <p className="text-sm text-ink-soft">
                      {formatCurrency(service.price)} | {Number(service.duration || 0)} mins
                    </p>
                  </div>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => toggleService(Number(service.id))}
                    type="button"
                    variant={active ? "secondary" : "outline"}
                  >
                    {active ? "Remove service" : "Add service"}
                  </Button>
                </div>
              </Surface>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <Surface className="space-y-5">
          <SectionHeading
            description="Complete the essentials below and we will keep your reference and slot choice with the booking."
            eyebrow="Booking form"
            title="Appointment details"
          />
          <Notice message={bookingNotice?.message} tone={bookingNotice?.tone} />
          <form className="space-y-4" onSubmit={submitBooking}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                id="booking-name"
                label="Full name"
                onChange={(event) => setBooking((current) => ({ ...current, name: event.target.value }))}
                required
                value={booking.name}
              />
              <TextField
                id="booking-email"
                label="Email"
                onChange={(event) => setBooking((current) => ({ ...current, email: event.target.value }))}
                required
                type="email"
                value={booking.email}
              />
              <TextField
                id="booking-phone"
                label="Phone"
                onChange={(event) => setBooking((current) => ({ ...current, phone: event.target.value }))}
                required
                value={booking.phone}
              />
              <TextField
                id="booking-date"
                label="Date"
                min={getTodayDateInputValue()}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  setSlots([]);
                  setBooking((current) => ({
                    ...current,
                    date: nextDate,
                    time: nextDate ? current.time : ""
                  }));
                }}
                required
                type="date"
                value={booking.date}
              />
              <SelectField
                id="booking-time"
                label="Time slot"
                onChange={(event) => setBooking((current) => ({ ...current, time: event.target.value }))}
                required
                value={booking.time}
              >
                <option value="">Select a slot</option>
                {slots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="booking-payment"
                label="Payment method"
                onChange={(event) => setBooking((current) => ({ ...current, paymentMethod: event.target.value }))}
                value={booking.paymentMethod}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="booking-plan"
                label="Payment plan"
                onChange={(event) => setBooking((current) => ({ ...current, paymentPlan: event.target.value }))}
                value={booking.paymentPlan}
              >
                <option value="deposit_50">50% deposit</option>
                <option value="full">Pay in full</option>
              </SelectField>
            </div>

            <Field help="Optional image upload for the style you want." htmlFor="booking-style-image" label="Style reference">
              <Input
                accept="image/*"
                id="booking-style-image"
                onChange={(event) =>
                  setBooking((current) => ({ ...current, styleImage: event.target.files?.[0] || null }))
                }
                type="file"
              />
            </Field>

            <Field label="Add-on salon products">
              <ProductPicker onChange={(id, value) => setBookingProducts((current) => ({ ...current, [id]: value }))} products={products} quantities={bookingProducts} />
            </Field>

            <Button className="w-full sm:w-auto" disabled={!booking.serviceIds.length} type="submit">
              Create booking
            </Button>
          </form>
        </Surface>

        <div className="space-y-6 xl:sticky xl:top-32 xl:self-start">
          <Surface className="space-y-5">
            <SectionHeading
              description="Your total updates as services and add-ons change."
              eyebrow="Summary"
              title="Booking estimate"
            />
            <div className="space-y-3 rounded-[1.5rem] border border-line/70 bg-panel/92 px-5 py-4">
              <DetailRow label="Selected services" value={String(selectedServices.length)} />
              <DetailRow label="Service subtotal" value={formatCurrency(serviceSubtotal)} />
              <DetailRow label="Product add-ons" value={formatCurrency(addonsSubtotal)} />
              <DetailRow label="Due now" value={formatCurrency(dueNow)} />
            </div>
            {selectedServices.length ? (
              <div className="space-y-3">
                {selectedServices.map((service) => (
                  <div key={service.id} className="rounded-[1.4rem] border border-line/70 bg-panel/92 px-4 py-3">
                    <p className="font-semibold text-ink">{service.name}</p>
                    <p className="mt-1 text-sm text-ink-soft">
                      {formatCurrency(service.price)} | {Number(service.duration || 0)} mins
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState description="Add one or more services to build your appointment estimate." title="No service selected" />
            )}
          </Surface>

          <Surface className="space-y-4 bg-night text-white shadow-glow">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-soft">Tracking</p>
              <h2 className="font-display text-4xl leading-none">After submission</h2>
              <p className="text-sm leading-7 text-white/72">
                Once submitted, your booking code appears here and can be checked on the tracking page.
              </p>
            </div>
            {bookingResult?.trackingCode ? (
              <div className="rounded-[1.5rem] border border-white/14 bg-white/8 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Booking code</p>
                <p className="mt-3 text-3xl font-semibold">{bookingResult.trackingCode}</p>
              </div>
            ) : (
              <EmptyState
                description="Submit your booking to receive a tracking code and next-step confirmation."
                title="No booking yet"
                variant="contrast"
              />
            )}
          </Surface>
        </div>
      </section>
    </SitePageShell>
  );
}
