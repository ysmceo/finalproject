import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DetailRow, EmptyState, Notice, SectionHeading, StatusPill, Surface, TextField, Timeline } from "@/components/site/shared";
import { SitePageShell } from "@/components/site/marketing";
import { apiGet } from "@/lib/api";
import { formatDateTime, getErrorMessage } from "@/lib/site";
import { sectionBackdrops } from "@/lib/landing";

const ORDER_PROGRESS_STEPS = [
  { key: "pending", label: "Order received", statuses: ["pending", "approved", "processed", "shipped", "on_the_way", "delivered"] },
  { key: "approved", label: "Approved", statuses: ["approved", "processed", "shipped", "on_the_way", "delivered"] },
  { key: "processed", label: "Processing", statuses: ["processed", "shipped", "on_the_way", "delivered"] },
  { key: "shipped", label: "Shipped", statuses: ["shipped", "on_the_way", "delivered"] },
  { key: "on_the_way", label: "On the way", statuses: ["on_the_way", "delivered"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] }
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

function TrackingHeroAside() {
  return (
    <div className="grid gap-4">
      <div className="rounded-[1.9rem] border border-white/14 bg-white/10 p-5 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-soft">Order tracking</p>
        <p className="mt-4 text-sm leading-7 text-white/80">
          Use your order code and checkout email to follow fulfillment, dispatch, and delivery updates.
        </p>
      </div>
      <div className="rounded-[1.7rem] border border-white/14 bg-white/8 p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-white/60">Need to order first?</p>
        <p className="mt-3 text-lg font-semibold">Place the product order, then track its progress here.</p>
      </div>
    </div>
  );
}

export default function TrackOrder() {
  const [form, setForm] = useState({ orderCode: "", email: "" });
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null);

  async function lookupOrder(event) {
    event.preventDefault();
    setNotice(null);

    const normalizedOrderCode = normalizeTrackingInput(form.orderCode);
    const normalizedEmail = String(form.email || "").trim().toLowerCase();

    if (!normalizedOrderCode || !normalizedEmail) {
      setResult(null);
      setNotice({ tone: "error", message: "Please enter both order code and order email." });
      return;
    }

    setForm((current) => ({ ...current, orderCode: normalizedOrderCode, email: normalizedEmail }));

    try {
      const data = await apiGet(
        `/api/product-orders/track?orderCode=${encodeURIComponent(normalizedOrderCode)}&email=${encodeURIComponent(normalizedEmail)}`
      );
      setResult(data);
      setNotice({ tone: "success", message: "Order loaded." });
    } catch (error) {
      setResult(null);
      setNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  const order = result?.order;
  const normalizedStatus = String(order?.status || "pending").toLowerCase();

  return (
    <SitePageShell
      aside={<TrackingHeroAside />}
      backgroundImages={sectionBackdrops.gallery}
      description="Product tracking now has its own route as well, with the same backend notifications and order lookup flow."
      eyebrow="Track order"
      secondaryAction={{ label: "Order now", to: "/order-products" }}
      title="Check your product order"
    >
      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Surface className="space-y-5">
          <SectionHeading
            description="Use the code generated after your product checkout."
            eyebrow="Lookup"
            title="Find your order"
          />
          <form className="space-y-4" onSubmit={lookupOrder}>
            <TextField
              id="track-order-code"
              label="Order code"
              onChange={(event) => setForm((current) => ({ ...current, orderCode: event.target.value }))}
              placeholder="e.g. ORD-MA4N7X2"
              required
              value={form.orderCode}
            />
            <TextField
              id="track-order-email"
              label="Order email"
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
              type="email"
              value={form.email}
            />
            <Button className="w-full sm:w-auto" type="submit">Check order</Button>
          </form>
          <Notice message={notice?.message} tone={notice?.tone} />
        </Surface>

        <div className="space-y-6 xl:sticky xl:top-32 xl:self-start">
          <Surface className="space-y-5">
            <SectionHeading
              description="Live fulfillment progress for your product order."
              eyebrow="Progress"
              title="Order progress"
            />
            {order ? (
              <div className="space-y-3 rounded-3xl border border-line/70 bg-panel/92 px-5 py-4">
                {normalizedStatus === "cancelled" ? (
                  <Notice tone="error" message="This order was cancelled. Please contact support for assistance." />
                ) : null}
                <div className="grid gap-2">
                  {ORDER_PROGRESS_STEPS.map((step, index) => {
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
              <EmptyState description="Search for your order to see real-time progress." title="No progress yet" />
            )}
          </Surface>

          <Surface className="space-y-5">
            <SectionHeading
              description="Order details appear here after a successful lookup."
              eyebrow="Details"
              title="Order overview"
            />
            {order ? (
              <div className="space-y-3 rounded-3xl border border-line/70 bg-panel/92 px-5 py-4">
                <DetailRow label="Order code" value={order.orderCode || form.orderCode} />
                <DetailRow label="Client" value={order.name || "Guest"} />
                <DetailRow label="Email" value={order.email || form.email} />
                <DetailRow label="Created" value={formatDateTime(order.createdAt)} />
                <DetailRow label="Delivery speed" value={String(order.deliverySpeed || "standard")} />
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-ink-soft">Status</span>
                  <StatusPill value={order.status || "pending"} />
                </div>
              </div>
            ) : (
              <EmptyState description="Enter your order code and email to load the order record." title="No order loaded" />
            )}
          </Surface>

          <Surface className="space-y-5">
            <SectionHeading
              description="Updates from product processing and delivery appear in time order."
              eyebrow="Timeline"
              title="Order updates"
            />
            <Timeline emptyText="Order updates will appear here after a successful lookup." items={result?.notifications} />
          </Surface>
        </div>
      </section>
    </SitePageShell>
  );
}
