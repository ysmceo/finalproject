import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DetailRow, EmptyState, Notice, SectionHeading, StatusPill, Surface, TextField, Timeline } from "@/components/site/shared";
import { SitePageShell } from "@/components/site/marketing";
import { apiGet } from "@/lib/api";
import { formatDateTime, getErrorMessage } from "@/lib/site";
import { sectionBackdrops } from "@/lib/landing";

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

    try {
      const data = await apiGet(
        `/api/product-orders/track?orderCode=${encodeURIComponent(form.orderCode)}&email=${encodeURIComponent(form.email)}`
      );
      setResult(data);
      setNotice({ tone: "success", message: "Order loaded." });
    } catch (error) {
      setResult(null);
      setNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  const order = result?.order;

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
              description="Order details appear here after a successful lookup."
              eyebrow="Details"
              title="Order overview"
            />
            {order ? (
              <div className="space-y-3 rounded-[1.5rem] border border-line/70 bg-panel/92 px-5 py-4">
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
