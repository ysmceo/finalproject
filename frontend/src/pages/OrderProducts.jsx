import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DetailRow, EmptyState, Field, Notice, SectionHeading, SelectField, Surface, TextField } from "@/components/site/shared";
import { SitePageShell } from "@/components/site/marketing";
import { ProductPicker } from "@/components/site/storefront";
import { apiPost } from "@/lib/api";
import { formatCurrency, getErrorMessage } from "@/lib/site";
import { getSelectionTotal, loadCatalog, PAYMENT_METHODS, buildSelectedItems } from "@/lib/storefront";
import { sectionBackdrops } from "@/lib/landing";

function OrderHeroAside({ productCount, expressFee, standardFee }) {
  return (
    <div className="grid gap-4">
      <div className="rounded-[1.9rem] border border-white/14 bg-white/10 p-5 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-soft">Ordering flow</p>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-white/80">
          <li>Select your products and set quantities.</li>
          <li>Enter delivery details and choose a payment method.</li>
          <li>Review subtotal, delivery fee, and grand total before placing the order.</li>
        </ul>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.7rem] border border-white/14 bg-white/8 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-white/60">Products</p>
          <p className="mt-3 text-3xl font-semibold">{productCount}</p>
        </div>
        <div className="rounded-[1.7rem] border border-white/14 bg-white/8 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-white/60">Standard</p>
          <p className="mt-3 text-xl font-semibold">{formatCurrency(standardFee)}</p>
        </div>
        <div className="rounded-[1.7rem] border border-white/14 bg-white/8 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-white/60">Express</p>
          <p className="mt-3 text-xl font-semibold">{formatCurrency(expressFee)}</p>
        </div>
      </div>
    </div>
  );
}

export default function OrderProducts() {
  const [products, setProducts] = useState([]);
  const [fees, setFees] = useState({ standard: 0, express: 0 });
  const [loading, setLoading] = useState(true);
  const [catalogNotice, setCatalogNotice] = useState(null);

  const [order, setOrder] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    paymentMethod: "Bank Transfer",
    deliverySpeed: "standard"
  });
  const [orderItems, setOrderItems] = useState({});
  const [orderNotice, setOrderNotice] = useState(null);
  const [orderResult, setOrderResult] = useState(null);

  useEffect(() => {
    let active = true;

    loadCatalog()
      .then((data) => {
        if (!active) {
          return;
        }

        setProducts(data.products);
        setFees(data.fees);
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

  const subtotal = getSelectionTotal(products, orderItems);
  const deliveryFee = Number(fees[order.deliverySpeed] || 0);
  const grandTotal = subtotal + deliveryFee;

  async function submitOrder(event) {
    event.preventDefault();
    setOrderNotice(null);

    try {
      const data = await apiPost("/api/product-orders", {
        ...order,
        items: buildSelectedItems(products, orderItems)
      });
      setOrderResult(data);
      setOrderNotice({ tone: "success", message: data.message || "Order created." });
    } catch (error) {
      setOrderNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  return (
    <SitePageShell
      aside={
        <OrderHeroAside
          expressFee={fees.express}
          productCount={products.length}
          standardFee={fees.standard}
        />
      }
      backgroundImages={sectionBackdrops.products}
      description="The product order form now lives on its own route, so the homepage can stay focused while guests still get the full cart and delivery workflow."
      eyebrow="Product orders"
      secondaryAction={{ label: "Track order", to: "/track-order" }}
      title="Order salon products"
    >
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Surface className="space-y-5">
          <SectionHeading
            description="Order products with the same backend workflow as before, but with a cleaner checkout-focused layout."
            eyebrow="Order form"
            title="Delivery details"
          />
          <Notice message={catalogNotice?.message || orderNotice?.message} tone={catalogNotice?.tone || orderNotice?.tone} />
          {loading ? (
            <div className="flex items-center gap-3 rounded-[1.7rem] border border-line bg-panel px-5 py-4 text-sm text-ink-soft">
              <LoaderCircle className="h-4 w-4 animate-spin text-brand" />
              Loading products...
            </div>
          ) : null}
          <form className="space-y-4" onSubmit={submitOrder}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                id="order-name"
                label="Full name"
                onChange={(event) => setOrder((current) => ({ ...current, name: event.target.value }))}
                required
                value={order.name}
              />
              <TextField
                id="order-email"
                label="Email"
                onChange={(event) => setOrder((current) => ({ ...current, email: event.target.value }))}
                required
                type="email"
                value={order.email}
              />
              <TextField
                id="order-phone"
                label="Phone"
                onChange={(event) => setOrder((current) => ({ ...current, phone: event.target.value }))}
                required
                value={order.phone}
              />
              <SelectField
                id="order-payment"
                label="Payment method"
                onChange={(event) => setOrder((current) => ({ ...current, paymentMethod: event.target.value }))}
                value={order.paymentMethod}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="order-speed"
                label="Delivery speed"
                onChange={(event) => setOrder((current) => ({ ...current, deliverySpeed: event.target.value }))}
                value={order.deliverySpeed}
              >
                <option value="standard">Standard delivery</option>
                <option value="express">Express delivery</option>
              </SelectField>
            </div>

            <TextField
              id="order-address"
              label="Delivery address"
              onChange={(event) => setOrder((current) => ({ ...current, address: event.target.value }))}
              required
              value={order.address}
            />

            <Field label="Product selections">
              <ProductPicker onChange={(id, value) => setOrderItems((current) => ({ ...current, [id]: value }))} products={products} quantities={orderItems} />
            </Field>

            <Button
              className="w-full sm:w-auto"
              disabled={!Object.values(orderItems).some((value) => Number(value) > 0)}
              type="submit"
            >
              Place order
            </Button>
          </form>
        </Surface>

        <div className="space-y-6 xl:sticky xl:top-32 xl:self-start">
          <Surface className="space-y-5">
            <SectionHeading
              description="Totals stay in sync with quantity and delivery speed changes."
              eyebrow="Summary"
              title="Cart overview"
            />
            <div className="space-y-3 rounded-3xl border border-line/70 bg-panel/92 px-5 py-4">
              <DetailRow label="Items subtotal" value={formatCurrency(subtotal)} />
              <DetailRow label="Delivery fee" value={formatCurrency(deliveryFee)} />
              <DetailRow label="Grand total" value={formatCurrency(grandTotal)} />
            </div>
            {subtotal > 0 ? (
              <div className="space-y-3">
                {products
                  .filter((product) => Number(orderItems[product.id] || 0) > 0)
                  .map((product) => (
                    <div key={product.id} className="rounded-[1.4rem] border border-line/70 bg-panel/92 px-4 py-3">
                      <p className="font-semibold text-ink">{product.name}</p>
                      <p className="mt-1 text-sm text-ink-soft">
                        Qty {Number(orderItems[product.id] || 0)} | {formatCurrency(product.price)}
                      </p>
                    </div>
                  ))}
              </div>
            ) : (
              <EmptyState description="Select products to build an order estimate." title="No items selected" />
            )}
          </Surface>

          <Surface className="space-y-4 bg-night text-white shadow-glow">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-soft">Tracking</p>
              <h2 className="font-display text-4xl leading-none">Order code</h2>
              <p className="text-sm leading-7 text-white/72">
                Your generated order code will show here after a successful submission.
              </p>
            </div>
            {orderResult?.order?.orderCode ? (
              <div className="rounded-3xl border border-white/14 bg-white/8 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Order code</p>
                <p className="mt-3 text-3xl font-semibold">{orderResult.order.orderCode}</p>
              </div>
            ) : (
              <EmptyState description="Place an order to receive a trackable order code." title="No order yet" variant="contrast" />
            )}
          </Surface>
        </div>
      </section>
    </SitePageShell>
  );
}
