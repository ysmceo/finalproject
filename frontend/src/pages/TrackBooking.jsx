import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DetailRow, EmptyState, Notice, SectionHeading, StatusPill, Surface, TextField, Timeline } from "@/components/site/shared";
import { SitePageShell } from "@/components/site/marketing";
import { apiGet } from "@/lib/api";
import { getErrorMessage, formatDateTime } from "@/lib/site";
import { sectionBackdrops } from "@/lib/landing";

const BOOKING_PROGRESS_STEPS = [
  { key: "pending", label: "Request received", statuses: ["pending", "approved", "completed"] },
  { key: "approved", label: "Approved by salon", statuses: ["approved", "completed"] },
  { key: "completed", label: "Service completed", statuses: ["completed"] }
];

function normalizeTrackingInput(value) {
  return String(value || "")
    .trim()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function isStepComplete(step, status) {
  if (String(status || "").toLowerCase() === "cancelled") {
    return false;
  }

  return step.statuses.includes(String(status || "").toLowerCase());
}

function formatBookingLookupError(error) {
  const raw = getErrorMessage(error);
  const message = String(raw || "").trim();
  const lowered = message.toLowerCase();

  if (lowered.includes("trackingcode and email are required")) {
    return "Tracking requires both booking code and the same email used when booking.";
  }

  if (lowered.includes("email does not match this booking")) {
    return "This booking code was found, but the email doesn't match. Use the exact email used during booking.";
  }

  if (lowered.includes("booking not found")) {
    return "Booking not found. Use the BOOK- code from your confirmation and check for typos.";
  }

  return message || "Unable to load booking right now.";
}

function TrackingHeroAside() {
  return (
    <div className="grid gap-4">
      <div className="rounded-[1.9rem] border border-white/14 bg-white/10 p-5 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-soft">Booking tracking</p>
        <p className="mt-4 text-sm leading-7 text-white/80">
          Enter the booking code and email used during checkout to view approval updates and salon notifications.
        </p>
      </div>
      <div className="rounded-[1.7rem] border border-white/14 bg-white/8 p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-white/60">Need to book first?</p>
        <p className="mt-3 text-lg font-semibold">Create the appointment, then return here anytime.</p>
      </div>
    </div>
  );
}

export default function TrackBooking() {
  const [form, setForm] = useState({ trackingCode: "", email: "" });
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null);

  async function lookupBooking(event) {
    event.preventDefault();
    setNotice(null);

    const normalizedTrackingCode = normalizeTrackingInput(form.trackingCode);
    const normalizedEmail = String(form.email || "").trim().toLowerCase();

    if (!normalizedTrackingCode || !normalizedEmail) {
      setResult(null);
      setNotice({ tone: "error", message: "Please enter both booking code and booking email." });
      return;
    }

    setForm((current) => ({ ...current, trackingCode: normalizedTrackingCode, email: normalizedEmail }));

    try {
      const data = await apiGet(
        `/api/bookings/track?trackingCode=${encodeURIComponent(normalizedTrackingCode)}&email=${encodeURIComponent(normalizedEmail)}`
      );
      setResult(data);
      setNotice({ tone: "success", message: "Booking loaded." });
    } catch (error) {
      setResult(null);
      setNotice({ tone: "error", message: formatBookingLookupError(error) });
    }
  }

  const booking = result?.booking;
  const normalizedStatus = String(booking?.status || "pending").toLowerCase();

  return (
    <SitePageShell
      aside={<TrackingHeroAside />}
      backgroundImages={sectionBackdrops.ceo}
      description="Tracking moved out of the homepage, but the same live booking status and notification timeline remain available."
      eyebrow="Track booking"
      secondaryAction={{ label: "Book now", to: "/book" }}
      title="Check your appointment status"
    >
      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Surface className="space-y-5">
          <SectionHeading
            description="Enter your BOOK- code and the same booking email from your appointment confirmation."
            eyebrow="Lookup"
            title="Find your booking"
          />
          <form className="space-y-4" onSubmit={lookupBooking}>
            <TextField
              id="track-booking-code"
              label="Tracking code"
              help="Use your booking code (starts with BOOK-)."
              onChange={(event) => setForm((current) => ({ ...current, trackingCode: event.target.value }))}
              placeholder="e.g. BOOK-ABC12345"
              required
              value={form.trackingCode}
            />
            <TextField
              id="track-booking-email"
              label="Booking email"
              help="Must be the same email used when creating the booking."
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
              type="email"
              value={form.email}
            />
            <Button className="w-full sm:w-auto" type="submit">Check booking</Button>
          </form>
          <Notice message={notice?.message} tone={notice?.tone} />
        </Surface>

        <div className="space-y-6 xl:sticky xl:top-32 xl:self-start">
          <Surface className="space-y-5">
            <SectionHeading
              description="Live approval progress for your appointment."
              eyebrow="Progress"
              title="Booking progress"
            />
            {booking ? (
              <div className="space-y-3 rounded-3xl border border-line/70 bg-panel/92 px-5 py-4">
                {normalizedStatus === "cancelled" ? (
                  <Notice tone="error" message="This booking was cancelled. Please contact support to reschedule." />
                ) : null}
                <div className="grid gap-2">
                  {BOOKING_PROGRESS_STEPS.map((step, index) => {
                    const completed = isStepComplete(step, normalizedStatus);
                    return (
                      <div
                        key={step.key}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${completed ? "border-success/40 bg-success/10" : "border-line/70 bg-panel/80"}`}
                      >
                        <span className="text-ink">{index + 1}. {step.label}</span>
                        <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${completed ? "text-success" : "text-ink-soft"}`}>
                          {completed ? "Done" : "Pending"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState description="Search for your booking to see live approval progress." title="No progress yet" />
            )}
          </Surface>

          <Surface className="space-y-5">
            <SectionHeading
              description="Appointment details appear here after a successful lookup."
              eyebrow="Details"
              title="Booking overview"
            />
            {booking ? (
              <div className="space-y-3 rounded-3xl border border-line/70 bg-panel/92 px-5 py-4">
                <DetailRow label="Booking code" value={result.trackingCode || booking.trackingCode || form.trackingCode} />
                <DetailRow label="Client" value={booking.name || "Guest"} />
                <DetailRow label="Email" value={booking.email || form.email} />
                <DetailRow label="Scheduled time" value={formatDateTime(booking.bookingDateTime || booking.date)} />
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-ink-soft">Status</span>
                  <StatusPill value={booking.status || "pending"} />
                </div>
              </div>
            ) : (
              <EmptyState description="Enter your booking code and email to load the appointment record." title="No booking loaded" />
            )}
          </Surface>

          <Surface className="space-y-5">
            <SectionHeading
              description="Notifications from the salon appear in chronological order."
              eyebrow="Timeline"
              title="Booking updates"
            />
            <Timeline emptyText="Booking updates will appear here after a successful lookup." items={result?.notifications} />
          </Surface>
        </div>
      </section>
    </SitePageShell>
  );
}
