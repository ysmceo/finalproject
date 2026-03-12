import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost, apiPut, apiRequest } from "@/lib/api";
import {
  DetailRow,
  EmptyState,
  Notice,
  SectionHeading,
  StatCard,
  StatusPill,
  Surface,
  TextField
} from "@/components/site/shared";
import { formatCurrency, getErrorMessage } from "@/lib/site";

const TOKEN_KEY = "ceo-salon-admin-token";
const BOOKING_STATUSES = ["pending", "approved", "cancelled", "completed"];
const ORDER_STATUSES = ["pending", "approved", "processed", "shipped", "on_the_way", "delivered", "cancelled"];

async function loadDashboard(token) {
  const options = { token };
  const [bookings, orders, messages, products, deliveryFees] = await Promise.all([
    apiRequest("/api/admin/bookings", options),
    apiRequest("/api/admin/product-orders", options),
    apiRequest("/api/admin/messages", options),
    apiRequest("/api/admin/products", options),
    apiRequest("/api/admin/product-orders/delivery-fees", options)
  ]);

  return {
    bookings: Array.isArray(bookings) ? bookings : [],
    orders: Array.isArray(orders) ? orders : [],
    messages: Array.isArray(messages) ? messages : [],
    products: Array.isArray(products) ? products : [],
    fees: deliveryFees && deliveryFees.fees ? deliveryFees.fees : { standard: 0, express: 0 }
  };
}

export default function Admin() {
  const [token, setToken] = useState(() => (typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) || "" : ""));
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [authNotice, setAuthNotice] = useState(null);
  const [dashboardNotice, setDashboardNotice] = useState(null);
  const [dashboard, setDashboard] = useState({ bookings: [], orders: [], messages: [], products: [], fees: { standard: 0, express: 0 } });
  const [login, setLogin] = useState({ email: "", password: "", secretPasscode: "" });
  const [register, setRegister] = useState({ name: "", email: "", password: "", secretPasscode: "" });
  const [productForm, setProductForm] = useState({ name: "", category: "", price: "", stock: "" });
  const [feeForm, setFeeForm] = useState({ standard: 0, express: 0 });

  useEffect(() => {
    apiGet("/api/admin/registration-status")
      .then((data) => setRegistrationOpen(Boolean(data.registrationOpen)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!token) return;

    loadDashboard(token)
      .then((data) => {
        setDashboard(data);
        setFeeForm({ standard: data.fees.standard || 0, express: data.fees.express || 0 });
      })
      .catch((error) => {
        setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
        setToken("");
        if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
      });
  }, [token]);

  async function handleLogin(event) {
    event.preventDefault();
    try {
      const data = await apiPost("/api/admin/login", login);
      setToken(data.token || "");
      setAuthNotice({ tone: "success", message: data.message || "Login successful." });
      if (typeof window !== "undefined" && data.token) window.localStorage.setItem(TOKEN_KEY, data.token);
    } catch (error) {
      setAuthNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    try {
      const data = await apiPost("/api/admin/register", register);
      setAuthNotice({ tone: "success", message: data.message || "Admin registered." });
      setRegistrationOpen(false);
      setLogin({ email: register.email, password: register.password, secretPasscode: register.secretPasscode });
    } catch (error) {
      setAuthNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  async function handleAddProduct(event) {
    event.preventDefault();
    try {
      await apiRequest("/api/admin/products", {
        method: "POST",
        token,
        body: { name: productForm.name, category: productForm.category, price: Number(productForm.price), stock: Number(productForm.stock) }
      });
      setDashboardNotice({ tone: "success", message: "Product added." });
      setProductForm({ name: "", category: "", price: "", stock: "" });
      setDashboard(await loadDashboard(token));
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  async function saveBooking(id, status) {
    try {
      await apiPut(`/api/admin/bookings/${encodeURIComponent(id)}`, { status }, { token });
      setDashboard(await loadDashboard(token));
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  async function saveOrder(id, status) {
    try {
      await apiPut(`/api/admin/product-orders/${encodeURIComponent(id)}`, { status }, { token });
      setDashboard(await loadDashboard(token));
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  async function saveFees(event) {
    event.preventDefault();
    try {
      await apiPut("/api/admin/product-orders/delivery-fees", { standard: Number(feeForm.standard), express: Number(feeForm.express) }, { token });
      setDashboardNotice({ tone: "success", message: "Delivery fees updated." });
      setDashboard(await loadDashboard(token));
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6 sm:py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-deep/75">Admin</p>
              <h1 className="font-display text-4xl text-ink sm:text-5xl">React dashboard</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ThemeToggle />
              <Button asChild variant="outline">
                <Link to="/">Back to site</Link>
              </Button>
            </div>
          </div>
          <Notice tone={authNotice?.tone} message={authNotice?.message} />
          <div className="grid gap-6 lg:grid-cols-2">
            <Surface className="space-y-5">
              <SectionHeading eyebrow="Login" title="Admin access" description="This replaces the old injected admin HTML view." />
              <form className="space-y-4" onSubmit={handleLogin}>
                <TextField label="Email" id="login-email" type="email" required value={login.email} onChange={(event) => setLogin((prev) => ({ ...prev, email: event.target.value }))} />
                <TextField label="Password" id="login-password" type="password" required value={login.password} onChange={(event) => setLogin((prev) => ({ ...prev, password: event.target.value }))} />
                <TextField label="Secret passcode" id="login-passcode" type="password" required value={login.secretPasscode} onChange={(event) => setLogin((prev) => ({ ...prev, secretPasscode: event.target.value }))} />
                <Button className="w-full sm:w-auto" type="submit">Login</Button>
              </form>
            </Surface>
            <Surface className="space-y-5">
              <SectionHeading eyebrow="Register" title="Initial admin setup" description="Visible only while admin registration is still open." />
              {registrationOpen ? (
                <form className="space-y-4" onSubmit={handleRegister}>
                  <TextField label="Name" id="register-name" required value={register.name} onChange={(event) => setRegister((prev) => ({ ...prev, name: event.target.value }))} />
                  <TextField label="Email" id="register-email" type="email" required value={register.email} onChange={(event) => setRegister((prev) => ({ ...prev, email: event.target.value }))} />
                  <TextField label="Password" id="register-password" type="password" required value={register.password} onChange={(event) => setRegister((prev) => ({ ...prev, password: event.target.value }))} />
                  <TextField label="Secret passcode" id="register-passcode" type="password" required value={register.secretPasscode} onChange={(event) => setRegister((prev) => ({ ...prev, secretPasscode: event.target.value }))} />
                  <Button className="w-full sm:w-auto" type="submit">Register admin</Button>
                </form>
              ) : (
                <EmptyState title="Registration closed" description="An admin already exists. Use the login form instead." />
              )}
            </Surface>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas px-4 py-6 text-ink sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-deep/75">Admin</p>
            <h1 className="font-display text-4xl text-ink sm:text-5xl">Salon operations</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <ThemeToggle />
            <Button asChild variant="outline">
              <Link to="/">Back to site</Link>
            </Button>
            <Button type="button" onClick={() => { setToken(""); if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY); }}>
              Logout
            </Button>
          </div>
        </div>

        <Notice tone={dashboardNotice?.tone} message={dashboardNotice?.message} />

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Bookings" value={dashboard.bookings.length} />
          <StatCard label="Orders" value={dashboard.orders.length} />
          <StatCard label="Messages" value={dashboard.messages.length} />
          <StatCard label="Products" value={dashboard.products.length} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Surface className="space-y-5">
            <SectionHeading eyebrow="Bookings" title="Update booking status" description="Each card is rendered directly in React." />
            {dashboard.bookings.map((item) => (
              <div key={item.id} className="rounded-[1.4rem] border border-line/70 bg-panel/92 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-ink">{item.name}</p>
                  <StatusPill value={item.status} />
                </div>
                <div className="mt-3 space-y-2">
                  <DetailRow label="Service" value={item.serviceName} />
                  <DetailRow label="When" value={`${item.date} ${item.time}`} />
                  <DetailRow label="Due now" value={formatCurrency(item.amountDueNow)} />
                </div>
                <div className="mt-4 flex gap-3">
                  <select className="h-11 flex-1 rounded-[1.4rem] border border-line bg-panel/92 px-4 text-ink" defaultValue={item.status} onChange={(event) => saveBooking(item.id, event.target.value)}>
                    {BOOKING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </Surface>

          <Surface className="space-y-5">
            <SectionHeading eyebrow="Orders" title="Update order status" description="Dispatch state is handled from React without the old sidebar markup." />
            {dashboard.orders.map((item) => (
              <div key={item.id} className="rounded-[1.4rem] border border-line/70 bg-panel/92 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-ink">{item.orderCode}</p>
                  <StatusPill value={item.status} />
                </div>
                <div className="mt-3 space-y-2">
                  <DetailRow label="Customer" value={item.name} />
                  <DetailRow label="Delivery speed" value={item.deliverySpeed} />
                  <DetailRow label="Total" value={formatCurrency(item.totalAmount)} />
                </div>
                <div className="mt-4 flex gap-3">
                  <select className="h-11 flex-1 rounded-[1.4rem] border border-line bg-panel/92 px-4 text-ink" defaultValue={item.status} onChange={(event) => saveOrder(item.id, event.target.value)}>
                    {ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </Surface>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Surface className="space-y-5">
            <SectionHeading eyebrow="Products" title="Add a product" description="Simple React form for product creation." />
            <form className="space-y-4" onSubmit={handleAddProduct}>
              <TextField label="Name" id="product-name" required value={productForm.name} onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))} />
              <TextField label="Category" id="product-category" required value={productForm.category} onChange={(event) => setProductForm((prev) => ({ ...prev, category: event.target.value }))} />
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Price" id="product-price" required value={productForm.price} onChange={(event) => setProductForm((prev) => ({ ...prev, price: event.target.value }))} />
                <TextField label="Stock" id="product-stock" required value={productForm.stock} onChange={(event) => setProductForm((prev) => ({ ...prev, stock: event.target.value }))} />
              </div>
              <Button className="w-full sm:w-auto" type="submit">Add product</Button>
            </form>
            <div className="space-y-3">
              {dashboard.products.map((item) => (
                <div key={item.id} className="rounded-[1.4rem] border border-line/70 bg-panel/92 p-4">
                  <DetailRow label={item.name} value={formatCurrency(item.price)} />
                  <p className="mt-2 text-sm text-ink-soft">{item.category} | Stock: {item.stock}</p>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="space-y-5">
            <SectionHeading eyebrow="Settings" title="Delivery fees and messages" description="Current admin essentials without the legacy panel layout." />
            <form className="space-y-4" onSubmit={saveFees}>
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Standard fee" id="fee-standard" required value={feeForm.standard} onChange={(event) => setFeeForm((prev) => ({ ...prev, standard: event.target.value }))} />
                <TextField label="Express fee" id="fee-express" required value={feeForm.express} onChange={(event) => setFeeForm((prev) => ({ ...prev, express: event.target.value }))} />
              </div>
              <Button className="w-full sm:w-auto" type="submit">Save fees</Button>
            </form>
            <div className="space-y-3">
              {dashboard.messages.map((item) => (
                <div key={item.id} className="rounded-[1.4rem] border border-line/70 bg-panel/92 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-ink">{item.subject}</p>
                    <StatusPill value={item.status} />
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">{item.email}</p>
                  <p className="mt-2 text-sm leading-6 text-ink">{item.message}</p>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}
