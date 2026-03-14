import { useEffect, useMemo, useState } from "react";
import CollapsibleDashboardBox from "@/components/site/shared/CollapsibleDashboardBox";
import { Link } from "react-router-dom";
import { CalendarCheck2, Eye, EyeOff, MessageSquareText, PackageSearch, ShoppingBag } from "lucide-react";

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
import { resolveMediaSrc } from "@/lib/storefront";

const TOKEN_KEY = "ceo-salon-admin-token";
const BOOKING_STATUSES = ["pending", "approved", "cancelled", "completed"];
const ORDER_STATUSES = ["pending", "approved", "processed", "shipped", "on_the_way", "delivered", "cancelled"];
const ADMIN_BACKGROUND_VIDEO_URL = "https://cdn.dribbble.com/userupload/44652968/file/313877bf29b8434b808c8aaad3f89a21.mp4";
const ADMIN_BACKGROUND_FALLBACK_IMAGE_URL = "/images/p1.webp";
const ADMIN_BACKGROUND_INTERCHANGE_IMAGE_URL = "https://cdn.dribbble.com/userupload/46843023/file/c8ecfc7f661d1ee36316579ecc740df8.png?resize=1504x859&vertical=center";
const ADMIN_BACKGROUND_INTERCHANGE_IMAGE_URL_2 = "https://cdn.dribbble.com/userupload/28418169/file/original-f7ba68fe4b600723f4f39a77f5594366.jpg?resize=1504x1128&vertical=center";
const ADMIN_BACKGROUND_SWAP_MS = 6200;
const ADMIN_OPS_SETTINGS_KEY = "ceo-admin-ops-settings";
const ADMIN_OPS_ASSIGNMENTS_KEY = "ceo-admin-ops-assignments";
const DEFAULT_STAFF_INPUT = "Amina, Tunde, Grace";
const WEATHER_CODE_LABELS = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Heavy thunderstorm with hail"
};
const ADMIN_PANEL_CONFIG = [
  { key: "bookings", title: "Bookings", description: "Appointments, reschedules, and confirmations.", icon: CalendarCheck2 },
  { key: "orders", title: "Orders", description: "Dispatch, delivery updates, and customer follow-ups.", icon: ShoppingBag },
  { key: "messages", title: "Messages", description: "Complaints, inbox triage, and replies.", icon: MessageSquareText },
  { key: "products", title: "Products", description: "Catalog management, stock, and pricing.", icon: PackageSearch }
];

function toDateKey(value) {
  const parsed = new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeMessageReportType(value) {
  return String(value || "general_message").trim().toLowerCase();
}

function isComplaintReportType(value) {
  const normalized = normalizeMessageReportType(value);
  return normalized.includes("complaint") || normalized.includes("issue") || normalized.includes("report");
}

function readJsonFromStorage(key, fallbackValue) {
  if (typeof window === "undefined") return fallbackValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallbackValue;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallbackValue : parsed;
  } catch {
    return fallbackValue;
  }
}

function resolveWeatherLabel(code) {
  if (!Number.isFinite(Number(code))) {
    return "Weather unavailable";
  }

  return WEATHER_CODE_LABELS[Number(code)] || "Weather update";
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n") || text.includes("\"")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename, rows) {
  if (!rows.length || typeof window === "undefined") return;
  const keys = Object.keys(rows[0]);
  const header = keys.join(",");
  const lines = rows.map((row) => keys.map((key) => escapeCsv(row[key])).join(","));
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

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
// Pagination state
    const [bookingsPage, setBookingsPage] = useState(1);
    const [ordersPage, setOrdersPage] = useState(1);
  const [newRequestsPage, setNewRequestsPage] = useState(1);
  const [newRequestsPageSize, setNewRequestsPageSize] = useState(8);
    const BOOKINGS_PER_PAGE = 5;
    const ORDERS_PER_PAGE = 5;
  const [token, setToken] = useState(() => (typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) || "" : ""));
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [authNotice, setAuthNotice] = useState(null);
  const [dashboardNotice, setDashboardNotice] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [savingFees, setSavingFees] = useState(false);
  const [dashboard, setDashboard] = useState({ bookings: [], orders: [], messages: [], products: [], fees: { standard: 0, express: 0 } });
  const [login, setLogin] = useState({ email: "", password: "", secretPasscode: "" });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showLoginPasscode, setShowLoginPasscode] = useState(false);
  const [register, setRegister] = useState({ name: "", email: "", password: "", secretPasscode: "" });
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterPasscode, setShowRegisterPasscode] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", category: "", price: "", stock: "", image: null });
  const [productImagePreview, setProductImagePreview] = useState(null);
  const [feeForm, setFeeForm] = useState({ standard: 0, express: 0 });
  const [viewMode, setViewMode] = useState("cards");
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");
  const [bookingDateFilter, setBookingDateFilter] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderDateFilter, setOrderDateFilter] = useState("");
  const [selectedBookingIds, setSelectedBookingIds] = useState([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [bulkBookingStatus, setBulkBookingStatus] = useState("approved");
  const [bulkOrderStatus, setBulkOrderStatus] = useState("processed");
  const [activePanel, setActivePanel] = useState(null);
  const [activeBookingReplyId, setActiveBookingReplyId] = useState(null);
  const [activeBookingHistoryId, setActiveBookingHistoryId] = useState(null);
  const [bookingReplyDrafts, setBookingReplyDrafts] = useState({});
  const [bookingHistorySearch, setBookingHistorySearch] = useState({});
  const [activeOrderReplyId, setActiveOrderReplyId] = useState(null);
  const [orderReplyDrafts, setOrderReplyDrafts] = useState({});
  const [backgroundVideoFailed, setBackgroundVideoFailed] = useState(false);
  const [activeBackgroundLayer, setActiveBackgroundLayer] = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [adminNow, setAdminNow] = useState(() => new Date());
  const [adminWeather, setAdminWeather] = useState({
    loading: true,
    temperature: null,
    weatherCode: null,
    label: "Weather unavailable"
  });
  const [messageStatusFilter, setMessageStatusFilter] = useState("all");
  const [messageTypeFilter, setMessageTypeFilter] = useState("all");
  const [messageSearch, setMessageSearch] = useState("");
  const [activeMessageReplyId, setActiveMessageReplyId] = useState(null);
  const [messageReplyDrafts, setMessageReplyDrafts] = useState({});
  const [operationsDate, setOperationsDate] = useState(() => todayDateKey());
  const [operationsChairCapacity, setOperationsChairCapacity] = useState(() => {
    const saved = readJsonFromStorage(ADMIN_OPS_SETTINGS_KEY, null);
    const capacity = Number(saved && saved.chairCapacity);
    return Number.isFinite(capacity) && capacity > 0 ? capacity : 4;
  });
  const [operationsStaffInput, setOperationsStaffInput] = useState(() => {
    const saved = readJsonFromStorage(ADMIN_OPS_SETTINGS_KEY, null);
    const staffInput = String(saved && saved.staffInput ? saved.staffInput : "").trim();
    return staffInput || DEFAULT_STAFF_INPUT;
  });
  const [bookingAssignments, setBookingAssignments] = useState(() => {
    const saved = readJsonFromStorage(ADMIN_OPS_ASSIGNMENTS_KEY, {});
    return saved && typeof saved === "object" ? saved : {};
  });
  const [assignmentNotifyBusyByBookingId, setAssignmentNotifyBusyByBookingId] = useState({});

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
        setLastRefreshedAt(new Date().toISOString());
      })
      .catch((error) => {
        setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
        setToken("");
        if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
      });
  }, [token]);

  useEffect(() => {
    setBookingsPage(1);
    setSelectedBookingIds([]);
  }, [bookingSearch, bookingStatusFilter, bookingDateFilter]);

  useEffect(() => {
    setOrdersPage(1);
    setSelectedOrderIds([]);
  }, [orderSearch, orderStatusFilter, orderDateFilter]);

  useEffect(() => {
    setNewRequestsPage(1);
  }, [dashboard.bookings.length, dashboard.orders.length]);

  useEffect(() => {
    setNewRequestsPage(1);
  }, [newRequestsPageSize]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ADMIN_OPS_SETTINGS_KEY, JSON.stringify({
      chairCapacity: operationsChairCapacity,
      staffInput: operationsStaffInput
    }));
  }, [operationsChairCapacity, operationsStaffInput]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ADMIN_OPS_ASSIGNMENTS_KEY, JSON.stringify(bookingAssignments));
  }, [bookingAssignments]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setActiveBackgroundLayer((prev) => {
        if (backgroundVideoFailed) {
          // When video is unavailable, rotate between image layers only.
          return prev === 1 ? 2 : 1;
        }
        return (prev + 1) % 3;
      });
    }, ADMIN_BACKGROUND_SWAP_MS);

    return () => clearInterval(intervalId);
  }, [backgroundVideoFailed]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setAdminNow(new Date());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadWeather() {
      try {
        const data = await apiGet("/api/weather");
        if (!active) return;

        const current = data && typeof data === "object" ? data.current : null;
        const nextCode = Number(current && current.weather_code);
        const nextTemp = Number(current && current.temperature_2m);

        setAdminWeather({
          loading: false,
          temperature: Number.isFinite(nextTemp) ? nextTemp : null,
          weatherCode: Number.isFinite(nextCode) ? nextCode : null,
          label: resolveWeatherLabel(nextCode)
        });
      } catch {
        if (!active) return;
        setAdminWeather((prev) => ({
          ...prev,
          loading: false,
          label: "Weather unavailable"
        }));
      }
    }

    loadWeather();
    const refreshTimerId = setInterval(loadWeather, 10 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(refreshTimerId);
    };
  }, []);

  async function refreshDashboard() {
    if (!token) return;

    try {
      setLoadingDashboard(true);
      const data = await loadDashboard(token);
      setDashboard(data);
      setFeeForm({ standard: data.fees.standard || 0, express: data.fees.express || 0 });
      setLastRefreshedAt(new Date().toISOString());
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
      setToken("");
      if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    try {
      const data = await apiPost("/api/admin/login", login);
      setToken(data.token || "");
      setAuthNotice({ tone: "success", message: data.message || "Login successful." });
      if (typeof window !== "undefined" && data.token) window.localStorage.setItem(TOKEN_KEY, data.token);
    } catch (error) {
      const message = getErrorMessage(error);
      const isNetworkFetchError = /failed to fetch|network|unable to connect/i.test(String(message));
      setAuthNotice({
        tone: "error",
        message: isNetworkFetchError
          ? "Login failed because the backend API is not reachable. Start backend server (common local ports: 3000/3001/3002/3100) and try again."
          : message
      });
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
      const formData = new FormData();
      formData.append("name", productForm.name);
      formData.append("category", productForm.category);
      formData.append("price", productForm.price);
      formData.append("stock", productForm.stock);
      if (productForm.image) formData.append("productImage", productForm.image);

      await apiRequest("/api/admin/products", {
        method: "POST",
        token,
        body: formData,
        headers: { "Content-Type": "multipart/form-data" }
      });
      setDashboardNotice({ tone: "success", message: "Product added." });
      setProductForm({ name: "", category: "", price: "", stock: "", image: null });
      setProductImagePreview(null);
      await refreshDashboard();
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  async function saveBooking(id, status) {
    try {
      await apiPut(`/api/admin/bookings/${encodeURIComponent(id)}`, { status }, { token });
      await refreshDashboard();
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  async function saveOrder(id, status) {
    try {
      await apiPut(`/api/admin/product-orders/${encodeURIComponent(id)}`, { status }, { token });
      await refreshDashboard();
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  async function saveFees(event) {
    event.preventDefault();

    const standard = Number(String(feeForm.standard ?? "").replace(/,/g, "").trim());
    const express = Number(String(feeForm.express ?? "").replace(/,/g, "").trim());

    if (!Number.isFinite(standard) || !Number.isFinite(express)) {
      setDashboardNotice({ tone: "error", message: "Enter valid numbers for standard and express fees." });
      return;
    }

    if (standard < 0 || express < 0) {
      setDashboardNotice({ tone: "error", message: "Delivery fees cannot be negative." });
      return;
    }

    try {
      setSavingFees(true);
      const response = await apiPut(
        "/api/admin/product-orders/delivery-fees",
        { standard, express },
        { token }
      );

      const updatedFees = response && response.fees
        ? {
          standard: Number(response.fees.standard) || 0,
          express: Number(response.fees.express) || 0
        }
        : { standard, express };

      setFeeForm(updatedFees);
      setDashboard((prev) => ({
        ...prev,
        fees: updatedFees
      }));
      setDashboardNotice({
        tone: "success",
        message: `Delivery fees saved. Standard: ₦${updatedFees.standard.toLocaleString()} · Express: ₦${updatedFees.express.toLocaleString()}`
      });
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setSavingFees(false);
    }
  }

  async function copyContactValue(value, label) {
    const text = String(value || "").trim();
    if (!text) {
      setDashboardNotice({ tone: "error", message: `No ${label.toLowerCase()} available to copy.` });
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setDashboardNotice({ tone: "error", message: "Clipboard access is not available in this browser." });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setDashboardNotice({ tone: "success", message: `${label} copied.` });
    } catch {
      setDashboardNotice({ tone: "error", message: `Could not copy ${label.toLowerCase()}.` });
    }
  }

  function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getItemDate(item) {
    return String(item?.date || item?.createdAt || "");
  }

  function toggleSelection(id, setter) {
    setter((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function applyBulkBookingStatus() {
    if (!selectedBookingIds.length) {
      setDashboardNotice({ tone: "error", message: "Select at least one booking first." });
      return;
    }

    try {
      setLoadingDashboard(true);
      await Promise.all(
        selectedBookingIds.map((id) => apiPut(`/api/admin/bookings/${encodeURIComponent(id)}`, { status: bulkBookingStatus }, { token }))
      );
      setDashboardNotice({ tone: "success", message: `Updated ${selectedBookingIds.length} booking(s).` });
      setSelectedBookingIds([]);
      await refreshDashboard();
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function applyBulkOrderStatus() {
    if (!selectedOrderIds.length) {
      setDashboardNotice({ tone: "error", message: "Select at least one order first." });
      return;
    }

    try {
      setLoadingDashboard(true);
      await Promise.all(
        selectedOrderIds.map((id) => apiPut(`/api/admin/product-orders/${encodeURIComponent(id)}`, { status: bulkOrderStatus }, { token }))
      );
      setDashboardNotice({ tone: "success", message: `Updated ${selectedOrderIds.length} order(s).` });
      setSelectedOrderIds([]);
      await refreshDashboard();
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setLoadingDashboard(false);
    }
  }

  function getBookingReplyDefaults(booking) {
    const customerName = String(booking?.name || "Customer");
    return {
      subject: `Booking follow-up from CEO Unisex Salon`,
      message: `Hello ${customerName},\n\nThank you for your booking. This is an update regarding your appointment.\n\nBest regards,\nCEO Unisex Salon`
    };
  }

  function getBookingRescheduleTemplate(booking) {
    const customerName = String(booking?.name || "Customer");
    const bookingId = String(booking?.id || "").trim();
    const serviceName = String(booking?.serviceName || "your appointment").trim();
    const when = `${String(booking?.date || "").trim()} ${String(booking?.time || "").trim()}`.trim() || "your scheduled time";
    return {
      subject: `Reschedule request${bookingId ? ` (${bookingId})` : ""}`,
      message: `Hello ${customerName},\n\nWe need to reschedule ${serviceName} that was planned for ${when}.\n\nPlease reply with your preferred new date and time so we can confirm your next appointment.\n\nBest regards,\nCEO Unisex Salon`
    };
  }

  function getBookingReminderTemplate(booking) {
    const customerName = String(booking?.name || "Customer");
    const serviceName = String(booking?.serviceName || "appointment").trim();
    const when = `${String(booking?.date || "").trim()} ${String(booking?.time || "").trim()}`.trim() || "your scheduled time";
    return {
      subject: `Appointment reminder - ${when}`,
      message: `Hello ${customerName},\n\nThis is a friendly reminder for your ${serviceName} appointment scheduled for ${when}.\n\nIf you need to adjust your schedule, kindly reply to this email as soon as possible.\n\nWe look forward to seeing you.\n\nBest regards,\nCEO Unisex Salon`
    };
  }

  function toggleBookingReply(booking) {
    const bookingId = String(booking?.id || "");
    if (!bookingId) return;

    setBookingReplyDrafts((prev) => {
      if (prev[bookingId]) return prev;
      return { ...prev, [bookingId]: getBookingReplyDefaults(booking) };
    });

    setActiveBookingReplyId((prev) => (prev === bookingId ? null : bookingId));
  }

  function updateBookingReplyDraft(bookingId, field, value) {
    setBookingReplyDrafts((prev) => ({
      ...prev,
      [bookingId]: {
        ...(prev[bookingId] || {}),
        [field]: value
      }
    }));
  }

  function applyBookingTemplate(booking, templateType) {
    const bookingId = String(booking?.id || "");
    if (!bookingId) return;

    const nextDraft = templateType === "reschedule"
      ? getBookingRescheduleTemplate(booking)
      : templateType === "reminder"
        ? getBookingReminderTemplate(booking)
        : getBookingReplyDefaults(booking);

    setBookingReplyDrafts((prev) => ({
      ...prev,
      [bookingId]: nextDraft
    }));
    setActiveBookingReplyId(bookingId);
  }

  function toggleBookingHistory(bookingId) {
    setActiveBookingHistoryId((prev) => (prev === bookingId ? null : bookingId));
  }

  function updateBookingHistorySearch(bookingId, value) {
    setBookingHistorySearch((prev) => ({
      ...prev,
      [bookingId]: value
    }));
  }

  async function sendBookingReply(booking) {
    const bookingId = String(booking?.id || "");
    if (!bookingId) return;

    const draft = bookingReplyDrafts[bookingId] || getBookingReplyDefaults(booking);
    const subject = String(draft.subject || "").trim();
    const message = String(draft.message || "").trim();

    if (!subject || !message) {
      setDashboardNotice({ tone: "error", message: "Reply subject and message are required." });
      return;
    }

    try {
      await apiPost(`/api/admin/bookings/${encodeURIComponent(bookingId)}/reply`, { subject, message }, { token });
      setDashboardNotice({ tone: "success", message: `Reply sent to ${booking.email || booking.name || "customer"}.` });
      setActiveBookingReplyId(null);
      await refreshDashboard();
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  function getOrderReplyDefaults(order) {
    const customerName = String(order?.name || "Customer");
    const orderCode = String(order?.orderCode || order?.id || "").trim();
    return {
      subject: `Order update from CEO Unisex Salon${orderCode ? ` (${orderCode})` : ""}`,
      message: `Hello ${customerName},\n\nThank you for your order. This is an update regarding your order status and fulfilment.\n\nBest regards,\nCEO Unisex Salon`
    };
  }

  function getOrderDeliveryTemplate(order) {
    const customerName = String(order?.name || "Customer");
    const orderCode = String(order?.orderCode || order?.id || "").trim();
    const total = Number(order?.totalAmount || 0);
    return {
      subject: `Delivery update${orderCode ? ` (${orderCode})` : ""}`,
      message: `Hello ${customerName},\n\nYour order${orderCode ? ` (${orderCode})` : ""} is currently in delivery processing.\n\nOrder total: ${formatCurrency(total)}\n\nWe will notify you again as soon as it is out for delivery or delivered.\n\nBest regards,\nCEO Unisex Salon`
    };
  }

  function toggleOrderReply(order) {
    const orderId = String(order?.id || "");
    if (!orderId) return;

    setOrderReplyDrafts((prev) => {
      if (prev[orderId]) return prev;
      return { ...prev, [orderId]: getOrderReplyDefaults(order) };
    });

    setActiveOrderReplyId((prev) => (prev === orderId ? null : orderId));
  }

  function updateOrderReplyDraft(orderId, field, value) {
    setOrderReplyDrafts((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        [field]: value
      }
    }));
  }

  function applyOrderTemplate(order, templateType) {
    const orderId = String(order?.id || "");
    if (!orderId) return;

    const nextDraft = templateType === "delivery"
      ? getOrderDeliveryTemplate(order)
      : getOrderReplyDefaults(order);

    setOrderReplyDrafts((prev) => ({
      ...prev,
      [orderId]: nextDraft
    }));
    setActiveOrderReplyId(orderId);
  }

  async function sendOrderReply(order) {
    const orderId = String(order?.id || "");
    if (!orderId) return;

    const draft = orderReplyDrafts[orderId] || getOrderReplyDefaults(order);
    const subject = String(draft.subject || "").trim();
    const message = String(draft.message || "").trim();

    if (!subject || !message) {
      setDashboardNotice({ tone: "error", message: "Reply subject and message are required." });
      return;
    }

    try {
      await apiPost(`/api/admin/product-orders/${encodeURIComponent(orderId)}/reply`, { subject, message }, { token });
      setDashboardNotice({ tone: "success", message: `Reply sent to ${order.email || order.name || "customer"}.` });
      setActiveOrderReplyId(null);
      await refreshDashboard();
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  function getMessageReplyDefaults(item) {
    return {
      subject: `Re: ${String(item?.subject || "Your message").trim()}`,
      message: `Hello ${String(item?.name || "Customer")},\n\nThank you for your message. We have reviewed your complaint/inquiry and will support you promptly.\n\nBest regards,\nCEO Unisex Salon`
    };
  }

  function toggleMessageReply(item) {
    const messageId = String(item?.id || "");
    if (!messageId) return;

    setMessageReplyDrafts((prev) => {
      if (prev[messageId]) return prev;
      return { ...prev, [messageId]: getMessageReplyDefaults(item) };
    });

    setActiveMessageReplyId((prev) => (prev === messageId ? null : messageId));
  }

  function updateMessageReplyDraft(messageId, field, value) {
    setMessageReplyDrafts((prev) => ({
      ...prev,
      [messageId]: {
        ...(prev[messageId] || {}),
        [field]: value
      }
    }));
  }

  async function saveMessageStatus(id, status) {
    try {
      await apiPut(`/api/admin/messages/${encodeURIComponent(id)}`, { status }, { token });
      await refreshDashboard();
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  async function sendMessageReply(item) {
    const messageId = String(item?.id || "");
    if (!messageId) return;

    const draft = messageReplyDrafts[messageId] || getMessageReplyDefaults(item);
    const subject = String(draft.subject || "").trim();
    const message = String(draft.message || "").trim();

    if (!subject || !message) {
      setDashboardNotice({ tone: "error", message: "Reply subject and message are required." });
      return;
    }

    try {
      await apiPost(`/api/admin/messages/${encodeURIComponent(messageId)}/reply`, { subject, message }, { token });
      setDashboardNotice({ tone: "success", message: `Reply sent to ${item.email || "customer"}.` });
      setActiveMessageReplyId(null);
      await refreshDashboard();
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
    }
  }

  const pendingBookings = dashboard.bookings.filter((item) => ["pending", "new"].includes(String(item.status || "").toLowerCase()));
  const pendingOrders = dashboard.orders.filter((item) => ["pending", "new"].includes(String(item.status || "").toLowerCase()));
  const newRequestEntries = useMemo(() => {
    const bookingEntries = pendingBookings.map((item) => ({
      kind: "booking",
      id: item.id,
      createdAt: item.createdAt || `${item.date || ""}T${item.time || "00:00"}`,
      data: item
    }));

    const orderEntries = pendingOrders.map((item) => ({
      kind: "order",
      id: item.id,
      createdAt: item.createdAt || item.date || "",
      data: item
    }));

    return [...bookingEntries, ...orderEntries].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [pendingBookings, pendingOrders]);
  const filteredBookings = useMemo(() => {
    const query = bookingSearch.trim().toLowerCase();
    return dashboard.bookings.filter((item) => {
      const statusValue = normalizeStatus(item.status);
      const statusMatch = bookingStatusFilter === "all" || statusValue === bookingStatusFilter;
      const searchable = [item.id, item.name, item.phone, item.serviceName, item.date, item.time].join(" ").toLowerCase();
      const queryMatch = !query || searchable.includes(query);
      const itemDate = getItemDate(item);
      const dateMatch = !bookingDateFilter || itemDate.includes(bookingDateFilter);
      return statusMatch && queryMatch && dateMatch;
    });
  }, [dashboard.bookings, bookingDateFilter, bookingSearch, bookingStatusFilter]);

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    return dashboard.orders.filter((item) => {
      const statusValue = normalizeStatus(item.status);
      const statusMatch = orderStatusFilter === "all" || statusValue === orderStatusFilter;
      const searchable = [item.id, item.orderCode, item.name, item.email, item.phone, item.deliverySpeed, item.address, item.date].join(" ").toLowerCase();
      const queryMatch = !query || searchable.includes(query);
      const itemDate = getItemDate(item);
      const dateMatch = !orderDateFilter || itemDate.includes(orderDateFilter);
      return statusMatch && queryMatch && dateMatch;
    });
  }, [dashboard.orders, orderDateFilter, orderSearch, orderStatusFilter]);

  const filteredMessages = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    return dashboard.messages.filter((item) => {
      const statusValue = normalizeStatus(item.status);
      const statusMatch = messageStatusFilter === "all" || statusValue === messageStatusFilter;
      const typeMatch = messageTypeFilter === "all"
        ? true
        : messageTypeFilter === "complaints"
          ? isComplaintReportType(item.reportType)
          : !isComplaintReportType(item.reportType);
      const searchable = [item.id, item.name, item.email, item.subject, item.message, item.reportType].join(" ").toLowerCase();
      const queryMatch = !query || searchable.includes(query);
      return statusMatch && typeMatch && queryMatch;
    });
  }, [dashboard.messages, messageSearch, messageStatusFilter, messageTypeFilter]);

  const bookingPages = Math.max(1, Math.ceil(filteredBookings.length / BOOKINGS_PER_PAGE));
  const orderPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
  const newRequestPages = Math.max(1, Math.ceil(newRequestEntries.length / newRequestsPageSize));
  const bookingSlice = filteredBookings.slice((bookingsPage - 1) * BOOKINGS_PER_PAGE, bookingsPage * BOOKINGS_PER_PAGE);
  const orderSlice = filteredOrders.slice((ordersPage - 1) * ORDERS_PER_PAGE, ordersPage * ORDERS_PER_PAGE);
  const newRequestSlice = newRequestEntries.slice((newRequestsPage - 1) * newRequestsPageSize, newRequestsPage * newRequestsPageSize);

  useEffect(() => {
    setBookingsPage((prev) => Math.min(prev, bookingPages));
  }, [bookingPages]);

  useEffect(() => {
    setOrdersPage((prev) => Math.min(prev, orderPages));
  }, [orderPages]);

  useEffect(() => {
    setNewRequestsPage((prev) => Math.min(prev, newRequestPages));
  }, [newRequestPages]);

  const dueNowTotal = useMemo(
    () => dashboard.bookings.reduce((sum, item) => sum + Number(item.amountDueNow || 0), 0),
    [dashboard.bookings]
  );

  const overduePendingCount = useMemo(() => {
    const now = Date.now();
    const thresholdMs = 24 * 60 * 60 * 1000;

    const isOverduePending = (item) => {
      const status = String(item?.status || "").trim().toLowerCase();
      if (!status || !["pending", "new"].includes(status)) return false;
      const createdAtMs = Date.parse(String(item?.createdAt || ""));
      if (!Number.isFinite(createdAtMs)) return false;
      return (now - createdAtMs) >= thresholdMs;
    };

    const overdueBookings = dashboard.bookings.filter(isOverduePending).length;
    const overdueOrders = dashboard.orders.filter(isOverduePending).length;
    return overdueBookings + overdueOrders;
  }, [dashboard.bookings, dashboard.orders]);

  const unreadMessagesCount = useMemo(
    () => dashboard.messages.filter((item) => normalizeStatus(item.status) === "unread").length,
    [dashboard.messages]
  );

  const orderRevenueTotal = useMemo(
    () => dashboard.orders.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
    [dashboard.orders]
  );

  const operationsDateBookings = useMemo(() => {
    return dashboard.bookings
      .filter((item) => {
        const bookingDate = String(item?.date || "").trim();
        if (bookingDate) return bookingDate === operationsDate;
        return toDateKey(item?.createdAt) === operationsDate;
      })
      .sort((a, b) => String(a?.time || "").localeCompare(String(b?.time || "")));
  }, [dashboard.bookings, operationsDate]);

  const operationsDateOrders = useMemo(() => {
    return dashboard.orders
      .filter((item) => toDateKey(item?.createdAt || item?.date) === operationsDate)
      .sort((a, b) => new Date(String(a?.createdAt || 0)).getTime() - new Date(String(b?.createdAt || 0)).getTime());
  }, [dashboard.orders, operationsDate]);

  const operationsDateMessages = useMemo(() => {
    return dashboard.messages.filter((item) => toDateKey(item?.createdAt) === operationsDate);
  }, [dashboard.messages, operationsDate]);

  const operationsRevenue = useMemo(() => {
    const bookingValue = operationsDateBookings.reduce((sum, item) => sum + Number(item?.amountDueNow || 0), 0);
    const orderValue = operationsDateOrders.reduce((sum, item) => sum + Number(item?.totalAmount || 0), 0);
    return bookingValue + orderValue;
  }, [operationsDateBookings, operationsDateOrders]);

  const operationsCompletionRate = useMemo(() => {
    const completedBookings = operationsDateBookings.filter((item) => ["approved", "completed"].includes(String(item?.status || "").toLowerCase())).length;
    const completedOrders = operationsDateOrders.filter((item) => ["delivered", "completed", "on_the_way", "shipped"].includes(String(item?.status || "").toLowerCase())).length;
    const total = operationsDateBookings.length + operationsDateOrders.length;
    if (!total) return 0;
    return Math.round(((completedBookings + completedOrders) / total) * 100);
  }, [operationsDateBookings, operationsDateOrders]);

  const operationsStaffOptions = useMemo(() => {
    const values = String(operationsStaffInput || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return values.length ? values : DEFAULT_STAFF_INPUT.split(",").map((item) => item.trim());
  }, [operationsStaffInput]);

  const operationsAssignmentValidation = useMemo(() => {
    const issuesByBookingId = {};
    const staffSlotMap = new Map();
    const chairSlotMap = new Map();
    let missingAssignments = 0;

    operationsDateBookings.forEach((item) => {
      const bookingId = String(item?.id || "").trim();
      if (!bookingId) return;

      const assignment = bookingAssignments[bookingId] || {};
      const staff = String(assignment?.staff || "").trim();
      const chair = String(assignment?.chair || "").trim();
      const time = String(item?.time || "unscheduled").trim() || "unscheduled";

      if (!staff || !chair) {
        missingAssignments += 1;
        issuesByBookingId[bookingId] = [
          ...(issuesByBookingId[bookingId] || []),
          !staff && !chair
            ? "Assign both staff and chair"
            : !staff
              ? "Assign a staff member"
              : "Assign a chair"
        ];
      }

      if (staff) {
        const staffKey = `${time}__${staff.toLowerCase()}`;
        staffSlotMap.set(staffKey, [...(staffSlotMap.get(staffKey) || []), bookingId]);
      }

      if (chair) {
        const chairKey = `${time}__${chair}`;
        chairSlotMap.set(chairKey, [...(chairSlotMap.get(chairKey) || []), bookingId]);
      }
    });

    let staffConflicts = 0;
    let chairConflicts = 0;

    staffSlotMap.forEach((bookingIds) => {
      if (bookingIds.length <= 1) return;
      staffConflicts += bookingIds.length;
      bookingIds.forEach((bookingId) => {
        issuesByBookingId[bookingId] = [
          ...(issuesByBookingId[bookingId] || []),
          "Staff conflict at same time"
        ];
      });
    });

    chairSlotMap.forEach((bookingIds) => {
      if (bookingIds.length <= 1) return;
      chairConflicts += bookingIds.length;
      bookingIds.forEach((bookingId) => {
        issuesByBookingId[bookingId] = [
          ...(issuesByBookingId[bookingId] || []),
          "Chair conflict at same time"
        ];
      });
    });

    const uniqueIssuesByBookingId = Object.fromEntries(
      Object.entries(issuesByBookingId).map(([bookingId, issues]) => [
        bookingId,
        [...new Set(issues)]
      ])
    );

    const bookingsWithIssues = Object.keys(uniqueIssuesByBookingId).length;

    return {
      issuesByBookingId: uniqueIssuesByBookingId,
      missingAssignments,
      staffConflicts,
      chairConflicts,
      bookingsWithIssues,
      isHealthy: bookingsWithIssues === 0
    };
  }, [bookingAssignments, operationsDateBookings]);

  const slotLoadSummary = useMemo(() => {
    const slotCounts = new Map();
    operationsDateBookings.forEach((item) => {
      const timeKey = String(item?.time || "unscheduled").trim() || "unscheduled";
      slotCounts.set(timeKey, (slotCounts.get(timeKey) || 0) + 1);
    });

    let peakSlotTime = "--";
    let peakSlotLoad = 0;
    slotCounts.forEach((count, time) => {
      if (count > peakSlotLoad) {
        peakSlotLoad = count;
        peakSlotTime = time;
      }
    });

    const capacity = Math.max(1, Number(operationsChairCapacity || 1));
    const peakUtilization = peakSlotLoad > 0 ? Math.round((peakSlotLoad / capacity) * 100) : 0;

    return {
      peakSlotTime,
      peakSlotLoad,
      peakUtilization
    };
  }, [operationsDateBookings, operationsChairCapacity]);

  const customerPulse = useMemo(() => {
    const aggregate = new Map();

    const addEntry = ({ email, name, amount }) => {
      const key = String(email || "").trim().toLowerCase();
      if (!key) return;
      const existing = aggregate.get(key) || { email: key, name: String(name || "Customer").trim() || "Customer", visits: 0, value: 0 };
      existing.visits += 1;
      existing.value += Number(amount || 0);
      if (!existing.name || existing.name === "Customer") {
        existing.name = String(name || "Customer").trim() || "Customer";
      }
      aggregate.set(key, existing);
    };

    dashboard.bookings.forEach((item) => {
      addEntry({ email: item?.email, name: item?.name, amount: item?.amountDueNow || 0 });
    });

    dashboard.orders.forEach((item) => {
      addEntry({ email: item?.email, name: item?.name, amount: item?.totalAmount || 0 });
    });

    return Array.from(aggregate.values())
      .sort((a, b) => (b.visits - a.visits) || (b.value - a.value))
      .slice(0, 5);
  }, [dashboard.bookings, dashboard.orders]);

  const selectedBookingCount = selectedBookingIds.length;
  const selectedOrderCount = selectedOrderIds.length;
  const activePanelTitle = ADMIN_PANEL_CONFIG.find((item) => item.key === activePanel)?.title || "None";
  const getPanelButtonClass = (panel) => `text-left rounded-[1.2rem] transition-all duration-200 ${activePanel === panel
    ? "scale-[1.01] ring-2 ring-brand/70 shadow-lg shadow-brand/20"
    : "opacity-95 hover:opacity-100 hover:translate-y-[-1px]"}`;

  function renderBookingReplyComposer(item) {
    const bookingId = String(item?.id || "");
    if (!bookingId) return null;

    const isOpen = activeBookingReplyId === bookingId;
    const historyOpen = activeBookingHistoryId === bookingId;
    const draft = bookingReplyDrafts[bookingId] || getBookingReplyDefaults(item);
    const replyHistory = Array.isArray(item.replies) ? [...item.replies].sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime()) : [];
    const historyQuery = String(bookingHistorySearch[bookingId] || "").trim().toLowerCase();
    const filteredHistory = !historyQuery
      ? replyHistory
      : replyHistory.filter((reply) => {
        const text = [reply.subject, reply.message, reply.admin?.name, reply.admin?.email].join(" ").toLowerCase();
        return text.includes(historyQuery);
      });
    const phoneDigits = String(item.phone || "").replace(/[^\d+]/g, "");
    const callHref = phoneDigits ? `tel:${phoneDigits}` : "";
    const phoneText = String(item.phone || "").trim();
    const emailAddress = String(item.email || "").trim();
    const bookingCode = String(item.id || "").trim();
    const emailHref = emailAddress
      ? `mailto:${emailAddress}?subject=${encodeURIComponent(`Booking update ${bookingCode ? `(${bookingCode})` : ""}`.trim())}`
      : "";
    const whatsappDigits = String(item.phone || "").replace(/\D/g, "");
    const whatsappMessage = encodeURIComponent(`Hello ${String(item.name || "")}, this is CEO Unisex Salon regarding your booking (${String(item.id || "")}).`);
    const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}?text=${whatsappMessage}` : "";

    return (
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => toggleBookingReply(item)}>
              {isOpen ? "Close reply" : "Reply to booking"}
            </Button>
            <Button type="button" variant="outline" onClick={() => toggleBookingHistory(bookingId)}>
              {historyOpen ? "Hide reply history" : `View reply history (${replyHistory.length})`}
            </Button>
            {callHref ? (
              <a href={callHref} className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-panel/92 px-4 text-sm font-semibold text-ink hover:bg-brand-light/20">
                Call booker
              </a>
            ) : null}
            {phoneText ? (
              <Button type="button" variant="outline" onClick={() => copyContactValue(phoneText, "Phone number")}>
                Copy phone
              </Button>
            ) : null}
            {emailHref ? (
              <a href={emailHref} className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-panel/92 px-4 text-sm font-semibold text-ink hover:bg-brand-light/20">
                Email booker
              </a>
            ) : null}
            {emailAddress ? (
              <Button type="button" variant="outline" onClick={() => copyContactValue(emailAddress, "Email address")}>
                Copy email
              </Button>
            ) : null}
            {whatsappHref ? (
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-panel/92 px-4 text-sm font-semibold text-ink hover:bg-brand-light/20">
                WhatsApp
              </a>
            ) : null}
          </div>
          {item.lastRepliedAt ? (
            <span className="text-xs text-ink-soft">Last reply: {new Date(item.lastRepliedAt).toLocaleString()}</span>
          ) : null}
        </div>

        {historyOpen ? (
          <div className="space-y-2 rounded-[1.1rem] border border-line/70 bg-panel/85 p-3">
            {replyHistory.length > 0 ? (
              <input
                className="h-10 w-full rounded-2xl border border-line bg-panel/92 px-3 text-sm text-ink"
                placeholder="Search reply history by subject, message, or admin..."
                value={bookingHistorySearch[bookingId] || ""}
                onChange={(event) => updateBookingHistorySearch(bookingId, event.target.value)}
              />
            ) : null}
            {replyHistory.length === 0 ? (
              <EmptyState title="No replies yet" description="Replies you send from admin will appear here." />
            ) : filteredHistory.length === 0 ? (
              <EmptyState title="No matching replies" description="Try another keyword for this booking's reply history." />
            ) : (
              filteredHistory.map((reply, index) => (
                <div key={reply.id || `${bookingId}-reply-${index}`} className="rounded-xl border border-line/70 bg-panel/92 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{reply.subject || "Booking reply"}</p>
                    <span className="text-xs text-ink-soft">{reply.sentAt ? new Date(reply.sentAt).toLocaleString() : "Unknown time"}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{reply.message || ""}</p>
                  <p className="mt-2 text-xs text-ink-soft">
                    By {reply.admin?.name || "Admin"}{reply.admin?.email ? ` (${reply.admin.email})` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        ) : null}

        {isOpen ? (
          <div className="space-y-3 rounded-[1.1rem] border border-line/70 bg-panel/80 p-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => applyBookingTemplate(item, "reschedule")}>Reschedule template</Button>
              <Button type="button" variant="outline" onClick={() => applyBookingTemplate(item, "reminder")}>Appointment reminder</Button>
            </div>
            <TextField
              label="Reply subject"
              id={`booking-reply-subject-${bookingId}`}
              value={draft.subject || ""}
              onChange={(event) => updateBookingReplyDraft(bookingId, "subject", event.target.value)}
            />
            <div>
              <label htmlFor={`booking-reply-message-${bookingId}`} className="mb-2 block text-sm font-semibold text-ink">Reply message</label>
              <textarea
                id={`booking-reply-message-${bookingId}`}
                rows={4}
                autoFocus
                className="w-full rounded-2xl border border-line bg-panel/92 px-3 py-2 text-sm text-ink"
                value={draft.message || ""}
                onChange={(event) => updateBookingReplyDraft(bookingId, "message", event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => sendBookingReply(item)}>Send reply email</Button>
              <Button type="button" variant="outline" onClick={() => setActiveBookingReplyId(null)}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderMessageReplyComposer(item) {
    const messageId = String(item?.id || "");
    if (!messageId) return null;
    const isOpen = activeMessageReplyId === messageId;
    const draft = messageReplyDrafts[messageId] || getMessageReplyDefaults(item);

    return (
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => toggleMessageReply(item)}>
            {isOpen ? "Close reply" : "Reply via email"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => saveMessageStatus(item.id, normalizeStatus(item.status) === "read" ? "unread" : "read")}
          >
            Mark as {normalizeStatus(item.status) === "read" ? "unread" : "read"}
          </Button>
        </div>

        {isOpen ? (
          <div className="space-y-3 rounded-[1.1rem] border border-line/70 bg-panel/80 p-3">
            <TextField
              label="Reply subject"
              id={`message-reply-subject-${messageId}`}
              value={draft.subject || ""}
              onChange={(event) => updateMessageReplyDraft(messageId, "subject", event.target.value)}
            />
            <div>
              <label htmlFor={`message-reply-body-${messageId}`} className="mb-2 block text-sm font-semibold text-ink">Reply message</label>
              <textarea
                id={`message-reply-body-${messageId}`}
                rows={4}
                className="w-full rounded-2xl border border-line bg-panel/92 px-3 py-2 text-sm text-ink"
                value={draft.message || ""}
                onChange={(event) => updateMessageReplyDraft(messageId, "message", event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => sendMessageReply(item)}>Send complaint reply</Button>
              <Button type="button" variant="outline" onClick={() => setActiveMessageReplyId(null)}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderOrderContactActions(item) {
    const phoneDigits = String(item?.phone || "").replace(/[^\d+]/g, "");
    const callHref = phoneDigits ? `tel:${phoneDigits}` : "";
    const phoneText = String(item?.phone || "").trim();
    const emailAddress = String(item?.email || "").trim();
    const orderCode = String(item?.orderCode || item?.id || "").trim();
    const emailHref = emailAddress
      ? `mailto:${emailAddress}?subject=${encodeURIComponent(`Order update ${orderCode ? `(${orderCode})` : ""}`.trim())}`
      : "";
    const whatsappDigits = String(item?.phone || "").replace(/\D/g, "");
    const whatsappMessage = encodeURIComponent(`Hello ${String(item?.name || "")}, this is CEO Unisex Salon regarding your order (${orderCode}).`);
    const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}?text=${whatsappMessage}` : "";

    if (!callHref && !emailHref && !whatsappHref) {
      return null;
    }

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {callHref ? (
          <a href={callHref} className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-panel/92 px-4 text-sm font-semibold text-ink hover:bg-brand-light/20">
            Call customer
          </a>
        ) : null}
        {phoneText ? (
          <Button type="button" variant="outline" onClick={() => copyContactValue(phoneText, "Phone number")}>
            Copy phone
          </Button>
        ) : null}
        {emailHref ? (
          <Button type="button" variant="outline" onClick={() => toggleOrderReply(item)}>
            {activeOrderReplyId === String(item?.id || "") ? "Close email" : "Email customer"}
          </Button>
        ) : null}
        {emailAddress ? (
          <Button type="button" variant="outline" onClick={() => copyContactValue(emailAddress, "Email address")}>
            Copy email
          </Button>
        ) : null}
        {emailHref ? (
          <a href={emailHref} className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-panel/92 px-4 text-sm font-semibold text-ink hover:bg-brand-light/20">
            Open mail app
          </a>
        ) : null}
        {whatsappHref ? (
          <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-panel/92 px-4 text-sm font-semibold text-ink hover:bg-brand-light/20">
            WhatsApp
          </a>
        ) : null}
      </div>
    );
  }

  function renderOrderReplyComposer(item) {
    const orderId = String(item?.id || "");
    if (!orderId || activeOrderReplyId !== orderId) return null;

    const draft = orderReplyDrafts[orderId] || getOrderReplyDefaults(item);
    const replyHistory = Array.isArray(item.replies)
      ? [...item.replies].sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime())
      : [];

    return (
      <div className="mt-3 space-y-3 rounded-[1.1rem] border border-line/70 bg-panel/80 p-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => applyOrderTemplate(item, "delivery")}>Delivery update template</Button>
        </div>
        <TextField
          label="Reply subject"
          id={`order-reply-subject-${orderId}`}
          value={draft.subject || ""}
          onChange={(event) => updateOrderReplyDraft(orderId, "subject", event.target.value)}
        />
        <div>
          <label htmlFor={`order-reply-message-${orderId}`} className="mb-2 block text-sm font-semibold text-ink">Reply message</label>
          <textarea
            id={`order-reply-message-${orderId}`}
            rows={4}
            autoFocus
            className="w-full rounded-2xl border border-line bg-panel/92 px-3 py-2 text-sm text-ink"
            value={draft.message || ""}
            onChange={(event) => updateOrderReplyDraft(orderId, "message", event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => sendOrderReply(item)}>Send order email</Button>
          <Button type="button" variant="outline" onClick={() => setActiveOrderReplyId(null)}>Cancel</Button>
        </div>
        {replyHistory.length > 0 ? (
          <div className="rounded-xl border border-line/70 bg-panel/92 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">Recent replies</p>
            <div className="mt-2 space-y-2">
              {replyHistory.slice(0, 3).map((reply, index) => (
                <div key={reply.id || `${orderId}-reply-${index}`} className="rounded-lg border border-line/70 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{reply.subject || "Order reply"}</p>
                    <span className="text-xs text-ink-soft">{reply.sentAt ? new Date(reply.sentAt).toLocaleString() : "Unknown time"}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-soft whitespace-pre-wrap">{reply.message || ""}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function focusPendingBookings() {
    setActivePanel("bookings");
    setBookingStatusFilter("pending");
    setBookingsPage(1);
  }

  function focusPendingOrders() {
    setActivePanel("orders");
    setOrderStatusFilter("pending");
    setOrdersPage(1);
  }

  function focusUnreadMessages() {
    setActivePanel("messages");
    setMessageStatusFilter("unread");
  }

  function focusProductsManagement() {
    setActivePanel("products");
  }

  function updateBookingAssignment(bookingId, field, value) {
    const normalizedId = String(bookingId || "").trim();
    if (!normalizedId) return;

    setBookingAssignments((prev) => ({
      ...prev,
      [normalizedId]: {
        ...(prev[normalizedId] || {}),
        [field]: value
      }
    }));
  }

  async function notifyBookingAssignment(item) {
    const bookingId = String(item?.id || "").trim();
    if (!bookingId) return;

    if (!token) {
      setDashboardNotice({ tone: "error", message: "Admin session is missing. Please login again." });
      return;
    }

    const assignment = bookingAssignments[bookingId] || {};
    const staff = String(assignment?.staff || "").trim();
    const chair = String(assignment?.chair || "").trim();
    const date = String(item?.date || operationsDate || "").trim();
    const time = String(item?.time || "").trim();

    if (!staff || !chair) {
      setDashboardNotice({ tone: "error", message: "Assign both staff and chair before notifying the customer." });
      return;
    }

    setAssignmentNotifyBusyByBookingId((prev) => ({ ...prev, [bookingId]: true }));
    try {
      const response = await apiPost(
        `/api/admin/bookings/${encodeURIComponent(bookingId)}/assignment-notify`,
        { staff, chair, date, time, sendSms: true, sendEmail: true },
        { token }
      );

      const responseAssignment = response && typeof response.assignment === "object"
        ? response.assignment
        : null;
      const assignmentDate = String(responseAssignment?.date || date || String(item?.date || operationsDate || "")).trim();
      const assignmentTime = String(responseAssignment?.time || time || String(item?.time || "")).trim();
      const assignmentStaff = String(responseAssignment?.staff || staff).trim();
      const assignmentChair = String(responseAssignment?.chair || chair).trim();
      const responseStatus = String(response?.bookingStatus || "").trim().toLowerCase();
      const currentStatus = String(item?.status || "").trim().toLowerCase();
      const nextStatus = responseStatus || (["pending", "new"].includes(currentStatus) ? "approved" : currentStatus || "pending");
      const nowIso = new Date().toISOString();

      setDashboard((prev) => ({
        ...prev,
        bookings: Array.isArray(prev.bookings)
          ? prev.bookings.map((booking) => {
            if (String(booking?.id || "") !== bookingId) return booking;
            return {
              ...booking,
              status: nextStatus,
              updatedAt: nowIso,
              lastAssignment: {
                staff: assignmentStaff,
                chair: assignmentChair,
                date: assignmentDate,
                time: assignmentTime,
                notifiedAt: nowIso
              }
            };
          })
          : prev.bookings
      }));

      const smsNotice = response?.notifications?.sms?.sent
        ? "SMS sent"
        : `SMS: ${String(response?.notifications?.sms?.reason || "not sent")}`;
      const emailNotice = response?.notifications?.email?.sent
        ? "Email sent"
        : `Email: ${String(response?.notifications?.email?.reason || "not sent")}`;

      setDashboardNotice({
        tone: "success",
        message: `Assignment shared with ${String(item?.name || "customer")}. ${smsNotice}. ${emailNotice}.`
      });
    } catch (error) {
      setDashboardNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setAssignmentNotifyBusyByBookingId((prev) => ({ ...prev, [bookingId]: false }));
    }
  }

  function renderAnimatedAdminBackground() {
    const imageLayerActive = activeBackgroundLayer === 1;
    const imageLayerTwoActive = activeBackgroundLayer === 2;
    const videoLayerActive = activeBackgroundLayer === 0;

    return (
      <>
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${ADMIN_BACKGROUND_FALLBACK_IMAGE_URL}')` }}
          aria-hidden="true"
        />

        <div
          className={`pointer-events-none absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out ${imageLayerActive ? "opacity-100" : "opacity-0"}`}
          style={{
            backgroundImage: `url('${ADMIN_BACKGROUND_INTERCHANGE_IMAGE_URL}')`,
            transform: imageLayerActive ? "scale(1.03)" : "scale(1.06)"
          }}
          aria-hidden="true"
        />

        <div
          className={`pointer-events-none absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out ${imageLayerTwoActive ? "opacity-100" : "opacity-0"}`}
          style={{
            backgroundImage: `url('${ADMIN_BACKGROUND_INTERCHANGE_IMAGE_URL_2}')`,
            transform: imageLayerTwoActive ? "scale(1.03)" : "scale(1.06)"
          }}
          aria-hidden="true"
        />

        {!backgroundVideoFailed ? (
          <video
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${videoLayerActive ? "opacity-100" : "opacity-0"}`}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setBackgroundVideoFailed(true)}
            aria-hidden="true"
          >
            <source src={ADMIN_BACKGROUND_VIDEO_URL} type="video/mp4" />
          </video>
        ) : null}

        <div className="pointer-events-none absolute inset-0 bg-black/46" />
      </>
    );
  }

  if (!token) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-canvas px-4 py-6 text-ink sm:px-6 sm:py-10">
        <div className="pointer-events-none absolute -left-24 top-16 h-56 w-56 rounded-full bg-white/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-20 h-64 w-64 rounded-full bg-brand-light/35 blur-3xl" />
        {renderAnimatedAdminBackground()}

        <div className="relative z-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-deep/75">Admin</p>
              <h1 className="font-display text-4xl text-ink sm:text-5xl">Admin command center</h1>
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
                <div className="space-y-2">
                  <label htmlFor="login-password" className="text-sm font-semibold text-ink">Password *</label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      required
                      value={login.password}
                      onChange={(event) => setLogin((prev) => ({ ...prev, password: event.target.value }))}
                      className="h-11 w-full rounded-[1.35rem] border border-line bg-panel/88 px-4 pr-12 text-sm text-ink shadow-sm backdrop-blur-sm transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-ink-soft transition hover:text-ink"
                      aria-label={showLoginPassword ? "Hide password" : "Show password"}
                      title={showLoginPassword ? "Hide password" : "Show password"}
                    >
                      {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="login-passcode" className="text-sm font-semibold text-ink">Secret passcode</label>
                  <div className="relative">
                    <input
                      id="login-passcode"
                      type={showLoginPasscode ? "text" : "password"}
                      value={login.secretPasscode}
                      onChange={(event) => setLogin((prev) => ({ ...prev, secretPasscode: event.target.value }))}
                      className="h-11 w-full rounded-[1.35rem] border border-line bg-panel/88 px-4 pr-12 text-sm text-ink shadow-sm backdrop-blur-sm transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPasscode((prev) => !prev)}
                      className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-ink-soft transition hover:text-ink"
                      aria-label={showLoginPasscode ? "Hide secret passcode" : "Show secret passcode"}
                      title={showLoginPasscode ? "Hide secret passcode" : "Show secret passcode"}
                    >
                      {showLoginPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs leading-5 text-ink-soft">Optional if password-only login is enabled.</p>
                </div>
                <Button className="w-full sm:w-auto" type="submit">Login</Button>
              </form>
            </Surface>
            <Surface className="space-y-5">
              <SectionHeading eyebrow="Register" title="Initial admin setup" description="Visible only while admin registration is still open." />
              {registrationOpen ? (
                <form className="space-y-4" onSubmit={handleRegister}>
                  <TextField label="Name" id="register-name" required value={register.name} onChange={(event) => setRegister((prev) => ({ ...prev, name: event.target.value }))} />
                  <TextField label="Email" id="register-email" type="email" required value={register.email} onChange={(event) => setRegister((prev) => ({ ...prev, email: event.target.value }))} />
                  <div className="space-y-2">
                    <label htmlFor="register-password" className="text-sm font-semibold text-ink">Password *</label>
                    <div className="relative">
                      <input
                        id="register-password"
                        type={showRegisterPassword ? "text" : "password"}
                        required
                        value={register.password}
                        onChange={(event) => setRegister((prev) => ({ ...prev, password: event.target.value }))}
                        className="h-11 w-full rounded-[1.35rem] border border-line bg-panel/88 px-4 pr-12 text-sm text-ink shadow-sm backdrop-blur-sm transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-ink-soft transition hover:text-ink"
                        aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                        title={showRegisterPassword ? "Hide password" : "Show password"}
                      >
                        {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="register-passcode" className="text-sm font-semibold text-ink">Secret passcode *</label>
                    <div className="relative">
                      <input
                        id="register-passcode"
                        type={showRegisterPasscode ? "text" : "password"}
                        required
                        value={register.secretPasscode}
                        onChange={(event) => setRegister((prev) => ({ ...prev, secretPasscode: event.target.value }))}
                        className="h-11 w-full rounded-[1.35rem] border border-line bg-panel/88 px-4 pr-12 text-sm text-ink shadow-sm backdrop-blur-sm transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPasscode((prev) => !prev)}
                        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-ink-soft transition hover:text-ink"
                        aria-label={showRegisterPasscode ? "Hide secret passcode" : "Show secret passcode"}
                        title={showRegisterPasscode ? "Hide secret passcode" : "Show secret passcode"}
                      >
                        {showRegisterPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button className="w-full sm:w-auto" type="submit">Register admin</Button>
                </form>
              ) : (
                <EmptyState title="Registration closed" description="An admin already exists. Use the login form instead." />
              )}
            </Surface>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-brand-light/40 via-brand-dark/10 to-brand-deep/10 px-4 py-6 text-ink sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute -left-24 top-16 h-56 w-56 rounded-full bg-white/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-20 h-64 w-64 rounded-full bg-brand-light/35 blur-3xl" />
      {renderAnimatedAdminBackground()}

      <div className="relative z-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-brand-deep/75">Admin</p>
            <h1 className="font-display text-4xl text-ink sm:text-5xl">Salon operations</h1>
            <p className="mt-2 text-sm text-ink-soft">Monitor bookings, fulfil orders, and keep every customer touchpoint polished from one professional workspace.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ThemeToggle />
            <Button type="button" variant="outline" onClick={refreshDashboard}>
              {loadingDashboard ? "Refreshing..." : "Refresh data"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Back to site</Link>
            </Button>
            <Button type="button" onClick={() => { setToken(""); if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY); }}>
              Logout
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-line/70 bg-panel/90 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">Date</p>
            <p className="mt-2 text-lg font-semibold text-ink">{adminNow.toLocaleDateString()}</p>
          </div>
          <div className="rounded-2xl border border-line/70 bg-panel/90 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">Time</p>
            <p className="mt-2 text-lg font-semibold text-ink">{adminNow.toLocaleTimeString()}</p>
          </div>
          <div className="rounded-2xl border border-line/70 bg-panel/90 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">Weather (Lagos)</p>
            <p className="mt-2 text-lg font-semibold text-ink">
              {adminWeather.loading
                ? "Loading..."
                : adminWeather.temperature != null
                  ? `${Math.round(adminWeather.temperature)}°C · ${adminWeather.label}`
                  : adminWeather.label}
            </p>
          </div>
        </div>

        <Notice tone={dashboardNotice?.tone} message={dashboardNotice?.message} />

        <Surface className="space-y-3 border-white/30 bg-panel/88 shadow-xl backdrop-blur-md">
          <SectionHeading
            eyebrow="Operations focus"
            title="Fast actions for daily workflow"
            description="Jump directly to priority queues and keep service quality tight during busy hours."
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={focusPendingBookings}>Pending bookings ({pendingBookings.length})</Button>
            <Button type="button" variant="outline" onClick={focusPendingOrders}>Pending orders ({pendingOrders.length})</Button>
            <Button type="button" variant="outline" onClick={focusUnreadMessages}>Unread messages ({unreadMessagesCount})</Button>
            <Button type="button" variant="outline" onClick={focusProductsManagement}>Manage products</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            <span className="inline-flex rounded-full bg-panel px-3 py-1 font-semibold tracking-[0.15em] text-ink-soft">SERVICE QUALITY</span>
            <span>Overdue pending items (&gt;24h): <strong className={overduePendingCount > 0 ? "text-warning" : "text-success"}>{overduePendingCount}</strong></span>
            <span className="hidden h-1 w-1 rounded-full bg-ink-soft/60 sm:inline-block" />
            <span>Queue now: <strong className="text-ink">{pendingBookings.length + pendingOrders.length}</strong></span>
          </div>
        </Surface>

        <Surface className="space-y-4 border-white/30 bg-panel/88 shadow-xl backdrop-blur-md">
          <SectionHeading
            eyebrow="Daily operations board"
            title="Calendar-first execution"
            description="Track today's workflow by date, monitor service load, and keep throughput under control."
          />
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="operations-date" className="mb-2 block text-sm font-semibold text-ink">Operations date</label>
              <input
                id="operations-date"
                type="date"
                className="h-11 rounded-[1.2rem] border border-line bg-panel/92 px-4 text-sm text-ink"
                value={operationsDate}
                onChange={(event) => setOperationsDate(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="operations-chairs" className="mb-2 block text-sm font-semibold text-ink">Chair capacity</label>
              <input
                id="operations-chairs"
                type="number"
                min={1}
                className="h-11 w-28 rounded-[1.2rem] border border-line bg-panel/92 px-4 text-sm text-ink"
                value={operationsChairCapacity}
                onChange={(event) => setOperationsChairCapacity(Math.max(1, Number(event.target.value) || 1))}
              />
            </div>
            <div className="min-w-65 flex-1">
              <label htmlFor="operations-staff" className="mb-2 block text-sm font-semibold text-ink">Staff roster (comma separated)</label>
              <input
                id="operations-staff"
                type="text"
                className="h-11 w-full rounded-[1.2rem] border border-line bg-panel/92 px-4 text-sm text-ink"
                value={operationsStaffInput}
                onChange={(event) => setOperationsStaffInput(event.target.value)}
                placeholder="Amina, Tunde, Grace"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => setOperationsDate(todayDateKey())}>Jump to today</Button>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <StatCard label="Bookings (day)" value={operationsDateBookings.length} />
            <StatCard label="Orders (day)" value={operationsDateOrders.length} />
            <StatCard label="Messages (day)" value={operationsDateMessages.length} />
            <StatCard label="Completion" value={`${operationsCompletionRate}%`} helper="approved/completed throughput" />
            <StatCard label="Peak slot load" value={`${slotLoadSummary.peakSlotLoad}/${Math.max(1, operationsChairCapacity)}`} helper={slotLoadSummary.peakSlotTime === "--" ? "no active slot" : `${slotLoadSummary.peakSlotTime} · ${slotLoadSummary.peakUtilization}% utilized`} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            <span className="inline-flex rounded-full bg-panel px-3 py-1 font-semibold tracking-[0.15em] text-ink-soft">FLOOR LOAD</span>
            <span>Current staff listed: <strong className="text-ink">{operationsStaffOptions.length}</strong></span>
            <span className="hidden h-1 w-1 rounded-full bg-ink-soft/60 sm:inline-block" />
            <span>Peak slot utilization: <strong className={slotLoadSummary.peakUtilization > 100 ? "text-danger" : slotLoadSummary.peakUtilization >= 85 ? "text-warning" : "text-success"}>{slotLoadSummary.peakUtilization}%</strong></span>
          </div>

          <div className={`rounded-2xl border px-3 py-2 text-xs ${operationsAssignmentValidation.isHealthy ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning"}`}>
            {operationsAssignmentValidation.isHealthy
              ? "Assignment validation: all bookings have valid staff/chair allocations for their time slots."
              : `Assignment validation: ${operationsAssignmentValidation.bookingsWithIssues} booking(s) need attention · missing=${operationsAssignmentValidation.missingAssignments} · staff conflicts=${operationsAssignmentValidation.staffConflicts} · chair conflicts=${operationsAssignmentValidation.chairConflicts}`}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[1.2rem] border border-line/70 bg-panel/90 p-4">
              <p className="text-sm font-semibold text-ink">Appointment timeline</p>
              <div className="mt-3 space-y-2">
                {operationsDateBookings.length === 0 ? (
                  <EmptyState title="No bookings on this date" description="Select another date to inspect salon appointment flow." />
                ) : (
                  operationsDateBookings.map((item) => {
                    const assignment = bookingAssignments[String(item.id) || ""] || {};
                    const bookingIssues = operationsAssignmentValidation.issuesByBookingId[String(item.id) || ""] || [];
                    const notifyBusy = Boolean(assignmentNotifyBusyByBookingId[String(item.id) || ""]);
                    const bookingStatus = String(item?.status || "").trim().toLowerCase();
                    return (
                      <div key={`ops-booking-${item.id}`} className="rounded-xl border border-line/70 bg-panel/92 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink">{item.time || "--:--"} · {item.name || "Customer"}</p>
                          <StatusPill value={item.status || "pending"} />
                        </div>
                        <p className="mt-1 text-xs text-ink-soft">{item.serviceName || "Service"} · {item.phone || item.email || "No contact"}</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <select
                            className="h-10 rounded-xl border border-line bg-panel/92 px-3 text-xs text-ink"
                            value={assignment.staff || ""}
                            onChange={(event) => updateBookingAssignment(item.id, "staff", event.target.value)}
                          >
                            <option value="">Assign staff</option>
                            {operationsStaffOptions.map((staff) => (
                              <option key={`${item.id}-${staff}`} value={staff}>{staff}</option>
                            ))}
                          </select>
                          <select
                            className="h-10 rounded-xl border border-line bg-panel/92 px-3 text-xs text-ink"
                            value={assignment.chair || ""}
                            onChange={(event) => updateBookingAssignment(item.id, "chair", event.target.value)}
                          >
                            <option value="">Assign chair</option>
                            {Array.from({ length: Math.max(1, operationsChairCapacity) }, (_, index) => index + 1).map((chairNo) => (
                              <option key={`${item.id}-chair-${chairNo}`} value={String(chairNo)}>Chair {chairNo}</option>
                            ))}
                          </select>
                        </div>
                        {bookingIssues.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {bookingIssues.map((issue) => (
                              <span key={`${item.id}-${issue}`} className="inline-flex rounded-full bg-warning/15 px-2 py-1 text-[10px] font-semibold text-warning">
                                {issue}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-[11px] text-success">Assignment valid for this booking.</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={notifyBusy || !assignment.staff || !assignment.chair}
                            onClick={() => notifyBookingAssignment(item)}
                          >
                            {notifyBusy
                              ? "Sending notice..."
                              : ["pending", "new"].includes(bookingStatus)
                                ? "Notify + Approve"
                                : "Notify customer"}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-line/70 bg-panel/90 p-4">
              <p className="text-sm font-semibold text-ink">Order fulfilment timeline</p>
              <div className="mt-3 space-y-2">
                {operationsDateOrders.length === 0 ? (
                  <div className="rounded-xl border border-line/70 bg-panel/92 p-4">
                    <p className="text-sm font-semibold text-ink">No orders found for this date</p>
                    <p className="mt-1 text-xs text-ink-soft">{new Date(`${operationsDate}T00:00:00`).toLocaleDateString()} · Orders created on this date will appear here in dispatch sequence.</p>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-lg border border-line/70 bg-panel px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">Orders (date)</p>
                        <p className="mt-1 text-sm font-semibold text-ink">0</p>
                      </div>
                      <div className="rounded-lg border border-line/70 bg-panel px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">Pending dispatch</p>
                        <p className="mt-1 text-sm font-semibold text-ink">0</p>
                      </div>
                      <div className="rounded-lg border border-line/70 bg-panel px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">Revenue (date)</p>
                        <p className="mt-1 text-sm font-semibold text-ink">{formatCurrency(0)}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => setOperationsDate(todayDateKey())}>View today</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setActivePanel("orders");
                          setOrderStatusFilter("pending");
                          setOrderDateFilter(operationsDate);
                          setOrdersPage(1);
                        }}
                      >
                        Open pending orders
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setActivePanel("orders");
                          setOrderStatusFilter("all");
                          setOrderDateFilter("");
                          setOrdersPage(1);
                        }}
                      >
                        Clear filters
                      </Button>
                    </div>
                  </div>
                ) : (
                  operationsDateOrders.map((item) => (
                    <div key={`ops-order-${item.id}`} className="rounded-xl border border-line/70 bg-panel/92 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">{item.orderCode || item.id} · {item.name || "Customer"}</p>
                        <StatusPill value={item.status || "pending"} />
                      </div>
                      <p className="mt-1 text-xs text-ink-soft">{formatCurrency(item.totalAmount || 0)} · {item.deliverySpeed || "standard"}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            <span className="inline-flex rounded-full bg-panel px-3 py-1 font-semibold tracking-[0.15em] text-ink-soft">DAILY REVENUE SIGNAL</span>
            <span>Estimated booked/order value: <strong className="text-ink">{formatCurrency(operationsRevenue)}</strong></span>
          </div>
        </Surface>

        <Surface className="space-y-4 border-white/30 bg-panel/88 shadow-xl backdrop-blur-md">
          <SectionHeading
            eyebrow="Customer pulse"
            title="Top returning customers"
            description="Spot loyal clients and high-value relationships quickly from booking and order activity."
          />
          <div className="space-y-2">
            {customerPulse.length === 0 ? (
              <EmptyState title="No customer activity yet" description="Customer insights will appear as bookings and orders come in." />
            ) : (
              customerPulse.map((customer, index) => (
                <div key={`${customer.email}-${index}`} className="rounded-xl border border-line/70 bg-panel/92 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{customer.name}</p>
                    <span className="text-xs text-ink-soft">{customer.visits} interactions</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">{customer.email}</p>
                  <p className="mt-1 text-xs text-ink-soft">Estimated value: <strong className="text-ink">{formatCurrency(customer.value)}</strong></p>
                </div>
              ))
            )}
          </div>
        </Surface>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <button type="button" className={getPanelButtonClass("bookings")} onClick={() => setActivePanel("bookings")}>
            <StatCard label="Bookings" value={dashboard.bookings.length} helper="Click to open" accent={activePanel === "bookings" ? "text-brand-deep" : ""} />
          </button>
          <button type="button" className={getPanelButtonClass("orders")} onClick={() => setActivePanel("orders")}>
            <StatCard label="Orders" value={dashboard.orders.length} helper="Click to open" accent={activePanel === "orders" ? "text-brand-deep" : ""} />
          </button>
          <button type="button" className={getPanelButtonClass("messages")} onClick={() => setActivePanel("messages")}>
            <StatCard
              label="Messages"
              value={dashboard.messages.length}
              helper={unreadMessagesCount > 0 ? `${unreadMessagesCount} unread complaint(s)` : "All messages read"}
              accent={activePanel === "messages" || unreadMessagesCount > 0 ? "text-brand-deep" : ""}
            />
          </button>
          <button type="button" className={getPanelButtonClass("products")} onClick={() => setActivePanel("products")}>
            <StatCard label="Products" value={dashboard.products.length} helper="Click to open" accent={activePanel === "products" ? "text-brand-deep" : ""} />
          </button>
          <StatCard label="Due now" value={formatCurrency(dueNowTotal)} />
          <StatCard label="Order value" value={formatCurrency(orderRevenueTotal)} />
        </div>

        <Surface className="space-y-4 border-white/35 bg-panel/90 shadow-xl backdrop-blur-md">
          <SectionHeading
            eyebrow="Workspace structure"
            title="Professional admin areas"
            description="Use dedicated sections for each workflow to keep operations clean, mature, and accountable."
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {ADMIN_PANEL_CONFIG.map((panel) => (
              (() => {
                const Icon = panel.icon;
                return (
                  <button
                    key={panel.key}
                    type="button"
                    className={`rounded-[1.2rem] border px-4 py-3 text-left transition-all ${activePanel === panel.key
                      ? "border-brand/70 bg-brand-light/25 shadow-md"
                      : "border-line/70 bg-panel/85 hover:bg-panel"}`}
                    onClick={() => setActivePanel(panel.key)}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`inline-flex rounded-xl p-2 ${activePanel === panel.key ? "bg-brand/20 text-brand-deep" : "bg-panel-strong/70 text-ink-soft"}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink">{panel.title}</p>
                        <p className="mt-1 text-xs leading-5 text-ink-soft">{panel.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })()
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            <span className="inline-flex rounded-full bg-panel px-3 py-1 font-semibold tracking-[0.18em] text-ink-soft">ACTIVE</span>
            <span>Section: <strong className="text-ink">{activePanelTitle}</strong></span>
            <span className="hidden h-1 w-1 rounded-full bg-ink-soft/60 sm:inline-block" />
            <span>Last refreshed: {lastRefreshedAt ? new Date(lastRefreshedAt).toLocaleString() : "Not yet"}</span>
          </div>
        </Surface>

        {!activePanel ? (
          <EmptyState title="Pick a section" description="Click Bookings, Orders, Messages, or Products above to open management details." />
        ) : null}

        <Surface className="space-y-4">
          <SectionHeading
            eyebrow="Operational snapshot"
            title="Priorities requiring attention"
            description="Quick status indicators for incoming work and team follow-through."
          />
          <div className="flex flex-wrap gap-3">
            <StatusPill value={`${pendingBookings.length} pending bookings`} />
            <StatusPill value={`${pendingOrders.length} pending orders`} />
            <StatusPill value={`${dashboard.messages.length} inbox messages`} />
            <StatusPill value={`${dashboard.products.length} active products`} />
          </div>
        </Surface>

        <Surface className="space-y-4">
          <SectionHeading
            eyebrow="Productivity"
            title="Workspace tools"
            description="Switch between cards and compact rows, and export the currently filtered data."
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant={viewMode === "cards" ? "default" : "outline"} onClick={() => setViewMode("cards")}>Cards view</Button>
            <Button type="button" variant={viewMode === "compact" ? "default" : "outline"} onClick={() => setViewMode("compact")}>Compact view</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!filteredBookings.length) {
                  setDashboardNotice({ tone: "error", message: "No filtered bookings available to export." });
                  return;
                }
                downloadCsv("bookings-export.csv", filteredBookings.map((item) => ({
                  id: item.id,
                  name: item.name,
                  phone: item.phone,
                  service: item.serviceName,
                  date: item.date,
                  time: item.time,
                  amountDueNow: item.amountDueNow,
                  status: item.status
                })));
                setDashboardNotice({ tone: "success", message: "Bookings CSV exported." });
              }}
            >
              Export bookings CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!filteredOrders.length) {
                  setDashboardNotice({ tone: "error", message: "No filtered orders available to export." });
                  return;
                }
                downloadCsv("orders-export.csv", filteredOrders.map((item) => ({
                  id: item.id,
                  orderCode: item.orderCode,
                  customer: item.name,
                  deliverySpeed: item.deliverySpeed,
                  totalAmount: item.totalAmount,
                  status: item.status
                })));
                setDashboardNotice({ tone: "success", message: "Orders CSV exported." });
              }}
            >
              Export orders CSV
            </Button>
          </div>
        </Surface>

        <div className="grid gap-6 xl:grid-cols-2">
          <CollapsibleDashboardBox
                      className={activePanel === "bookings" ? "" : "hidden"}
                      title="New Bookings"
                      count={pendingBookings.length + pendingOrders.length}
                      color="bg-brand-light/20"
                      headerColor="bg-brand-light/90"
                      icon="🆕"
                    >
            <SectionHeading eyebrow="New Bookings & Orders" title="Incoming bookings and orders" description="Easily review new requests." />
                      {newRequestEntries.length > 0 ? (
                        <div className="mb-3 flex items-center justify-end gap-2">
                          <label className="text-sm text-ink-soft" htmlFor="new-requests-page-size">Per page</label>
                          <select
                            id="new-requests-page-size"
                            className="h-10 rounded-2xl border border-line bg-panel/92 px-3 text-sm text-ink"
                            value={newRequestsPageSize}
                            onChange={(event) => setNewRequestsPageSize(Number(event.target.value) || 8)}
                          >
                            {[5, 10, 20].map((size) => (
                              <option key={size} value={size}>{size}</option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      <div className="space-y-3">
                        {newRequestEntries.length === 0 && <EmptyState title="No new bookings/orders" description="All caught up!" />}
                        {newRequestSlice.map((entry) => {
                          if (entry.kind === "booking") {
                            const item = entry.data;
                            return (
                              <div key={`new-booking-${item.id}`} className="rounded-[1.4rem] border border-brand-light bg-panel/92 p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <label className="inline-flex items-center gap-3">
                                    <input type="checkbox" checked={selectedBookingIds.includes(item.id)} onChange={() => toggleSelection(item.id, setSelectedBookingIds)} />
                                    <p className="font-semibold text-brand-dark">{item.name}</p>
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center rounded-full bg-danger px-2 py-1 text-[10px] font-extrabold tracking-[0.18em] text-white shadow-sm">NEW</span>
                                    <StatusPill value={item.status} />
                                  </div>
                                </div>
                                <div className="mt-3 space-y-2">
                                  <DetailRow label="Service" value={item.serviceName} />
                                  <DetailRow label="When" value={`${item.date} ${item.time}`} />
                                  <DetailRow label="Email" value={item.email || "N/A"} />
                                  <DetailRow label="Phone" value={item.phone || "N/A"} />
                                  <DetailRow label="Due now" value={formatCurrency(item.amountDueNow)} />
                                </div>
                                {renderBookingReplyComposer(item)}
                              </div>
                            );
                          }

                          const item = entry.data;
                          return (
                            <div key={`new-order-${item.id}`} className="rounded-[1.4rem] border border-brand-dark bg-panel/92 p-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <label className="inline-flex items-center gap-3">
                                  <input type="checkbox" checked={selectedOrderIds.includes(item.id)} onChange={() => toggleSelection(item.id, setSelectedOrderIds)} />
                                  <p className="font-semibold text-brand-dark">{item.orderCode}</p>
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center rounded-full bg-danger px-2 py-1 text-[10px] font-extrabold tracking-[0.18em] text-white shadow-sm">NEW</span>
                                  <StatusPill value={item.status} />
                                </div>
                              </div>
                              <div className="mt-3 space-y-2">
                                <DetailRow label="Customer" value={item.name} />
                                <DetailRow label="Email" value={item.email || "N/A"} />
                                <DetailRow label="Phone" value={item.phone || "N/A"} />
                                <DetailRow label="Delivery speed" value={item.deliverySpeed} />
                                <DetailRow label="Total" value={formatCurrency(item.totalAmount)} />
                              </div>
                              {renderOrderContactActions(item)}
                              {renderOrderReplyComposer(item)}
                            </div>
                          );
                        })}
                        {newRequestEntries.length > 0 ? (
                          <div className="flex justify-between items-center mt-4">
                            <Button type="button" variant="outline" disabled={newRequestsPage === 1} onClick={() => setNewRequestsPage(newRequestsPage - 1)}>Previous</Button>
                            <span className="text-sm">Page {newRequestsPage} of {newRequestPages}</span>
                            <Button type="button" variant="outline" disabled={newRequestsPage >= newRequestPages} onClick={() => setNewRequestsPage(newRequestsPage + 1)}>Next</Button>
                          </div>
                        ) : null}
                      </div>
                    </CollapsibleDashboardBox>
          <CollapsibleDashboardBox
            className={activePanel === "bookings" ? "" : "hidden"}
            title="Bookings"
            count={dashboard.bookings.length}
            color="bg-brand-light/10"
            headerColor="bg-brand-light/80"
            icon="📖"
          >
              <SectionHeading eyebrow="Bookings" title="Update booking status" description="Each card is rendered directly in React." />
            <div className="grid gap-3 md:grid-cols-3">
              <input
                className="h-11 rounded-[1.2rem] border border-line bg-panel/92 px-4 text-sm text-ink"
                placeholder="Search by name, phone, service, ID"
                value={bookingSearch}
                onChange={(event) => setBookingSearch(event.target.value)}
              />
              <select className="h-11 rounded-[1.2rem] border border-line bg-panel/92 px-4 text-sm text-ink" value={bookingStatusFilter} onChange={(event) => setBookingStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                {BOOKING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <input
                type="date"
                className="h-11 rounded-[1.2rem] border border-line bg-panel/92 px-4 text-sm text-ink"
                value={bookingDateFilter}
                onChange={(event) => setBookingDateFilter(event.target.value)}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const pageIds = bookingSlice.map((item) => item.id);
                  const hasUnselected = pageIds.some((id) => !selectedBookingIds.includes(id));
                  setSelectedBookingIds((prev) => (hasUnselected ? [...new Set([...prev, ...pageIds])] : prev.filter((id) => !pageIds.includes(id))));
                }}
              >
                {bookingSlice.some((item) => !selectedBookingIds.includes(item.id)) ? "Select page" : "Unselect page"}
              </Button>
              <select className="h-11 rounded-[1.2rem] border border-line bg-panel/92 px-4 text-sm text-ink" value={bulkBookingStatus} onChange={(event) => setBulkBookingStatus(event.target.value)}>
                {BOOKING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <Button type="button" onClick={applyBulkBookingStatus} disabled={loadingDashboard || !selectedBookingCount}>
                Apply to {selectedBookingCount || 0} booking(s)
              </Button>
            </div>
            {bookingSlice.length === 0 ? <EmptyState title="No bookings yet" description="Bookings will appear here as customers submit requests." /> : null}
            {viewMode === "cards" ? bookingSlice.map((item) => (
              <div key={item.id} className="rounded-[1.4rem] border border-line/70 bg-panel/92 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="inline-flex items-center gap-3">
                    <input type="checkbox" checked={selectedBookingIds.includes(item.id)} onChange={() => toggleSelection(item.id, setSelectedBookingIds)} />
                    <p className="font-semibold text-ink">{item.name}</p>
                  </label>
                  <StatusPill value={item.status} />
                </div>
                <div className="mt-3 space-y-2">
                  <DetailRow label="Service" value={item.serviceName} />
                  <DetailRow label="When" value={`${item.date} ${item.time}`} />
                  <DetailRow label="Email" value={item.email || "N/A"} />
                  <DetailRow label="Phone" value={item.phone || "N/A"} />
                  <DetailRow label="Due now" value={formatCurrency(item.amountDueNow)} />
                </div>
                <div className="mt-4 flex gap-3">
                  <select className="h-11 flex-1 rounded-[1.4rem] border border-line bg-panel/92 px-4 text-ink" value={item.status} onChange={(event) => saveBooking(item.id, event.target.value)}>
                    {BOOKING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
                {renderBookingReplyComposer(item)}
              </div>
            )) : (
              <div className="mt-3 space-y-2">
                {bookingSlice.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-[1.1rem] border border-line/70 bg-panel/92 p-3 md:grid-cols-[auto,1fr,auto,auto] md:items-center">
                    <input type="checkbox" checked={selectedBookingIds.includes(item.id)} onChange={() => toggleSelection(item.id, setSelectedBookingIds)} />
                    <div>
                      <p className="font-semibold text-ink">{item.name} · {item.serviceName}</p>
                      <p className="text-sm text-ink-soft">{item.date} {item.time} · {formatCurrency(item.amountDueNow)}</p>
                      <p className="text-xs text-ink-soft">{item.email || "N/A"} · {item.phone || "N/A"}</p>
                    </div>
                    <StatusPill value={item.status} />
                    <select className="h-10 rounded-[0.9rem] border border-line bg-panel/92 px-3 text-sm text-ink" value={item.status} onChange={(event) => saveBooking(item.id, event.target.value)}>
                      {BOOKING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <div className="md:col-span-4">
                      {renderBookingReplyComposer(item)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center mt-4">
              <Button type="button" variant="outline" disabled={bookingsPage === 1} onClick={() => setBookingsPage(bookingsPage - 1)}>Previous</Button>
              <span className="text-sm">Page {bookingsPage} of {bookingPages}</span>
              <Button type="button" variant="outline" disabled={bookingsPage >= bookingPages} onClick={() => setBookingsPage(bookingsPage + 1)}>Next</Button>
            </div>
          </CollapsibleDashboardBox>

          <CollapsibleDashboardBox
            className={activePanel === "orders" ? "" : "hidden"}
            title="Orders"
            count={dashboard.orders.length}
            color="bg-brand-dark/10"
            headerColor="bg-brand-dark/80"
            icon="🛒"
          >
              <SectionHeading eyebrow="Orders" title="Update order status" description="Dispatch state is handled from React without the old sidebar markup." />
            <div className="grid gap-3 md:grid-cols-3">
              <input
                className="h-11 rounded-[1.2rem] border border-line bg-panel/92 px-4 text-sm text-ink"
                placeholder="Search by order code, customer, speed"
                value={orderSearch}
                onChange={(event) => setOrderSearch(event.target.value)}
              />
              <select className="h-11 rounded-[1.2rem] border border-line bg-panel/92 px-4 text-sm text-ink" value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                {ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <input
                type="date"
                className="h-11 rounded-[1.2rem] border border-line bg-panel/92 px-4 text-sm text-ink"
                value={orderDateFilter}
                onChange={(event) => setOrderDateFilter(event.target.value)}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const pageIds = orderSlice.map((item) => item.id);
                  const hasUnselected = pageIds.some((id) => !selectedOrderIds.includes(id));
                  setSelectedOrderIds((prev) => (hasUnselected ? [...new Set([...prev, ...pageIds])] : prev.filter((id) => !pageIds.includes(id))));
                }}
              >
                {orderSlice.some((item) => !selectedOrderIds.includes(item.id)) ? "Select page" : "Unselect page"}
              </Button>
              <select className="h-11 rounded-[1.2rem] border border-line bg-panel/92 px-4 text-sm text-ink" value={bulkOrderStatus} onChange={(event) => setBulkOrderStatus(event.target.value)}>
                {ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <Button type="button" onClick={applyBulkOrderStatus} disabled={loadingDashboard || !selectedOrderCount}>
                Apply to {selectedOrderCount || 0} order(s)
              </Button>
            </div>
            {orderSlice.length === 0 ? <EmptyState title="No orders yet" description="Product orders will appear here once customers place them." /> : null}
            {viewMode === "cards" ? orderSlice.map((item) => (
              <div key={item.id} className="rounded-[1.4rem] border border-line/70 bg-panel/92 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="inline-flex items-center gap-3">
                    <input type="checkbox" checked={selectedOrderIds.includes(item.id)} onChange={() => toggleSelection(item.id, setSelectedOrderIds)} />
                    <p className="font-semibold text-ink">{item.orderCode}</p>
                  </label>
                  <StatusPill value={item.status} />
                </div>
                <div className="mt-3 space-y-2">
                  <DetailRow label="Customer" value={item.name} />
                  <DetailRow label="Email" value={item.email || "N/A"} />
                  <DetailRow label="Phone" value={item.phone || "N/A"} />
                  <DetailRow label="Delivery speed" value={item.deliverySpeed} />
                  <DetailRow label="Total" value={formatCurrency(item.totalAmount)} />
                </div>
                <div className="mt-4 flex gap-3">
                  <select className="h-11 flex-1 rounded-[1.4rem] border border-line bg-panel/92 px-4 text-ink" value={item.status} onChange={(event) => saveOrder(item.id, event.target.value)}>
                    {ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
                {renderOrderContactActions(item)}
                {renderOrderReplyComposer(item)}
              </div>
            )) : (
              <div className="mt-3 space-y-2">
                {orderSlice.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-[1.1rem] border border-line/70 bg-panel/92 p-3 md:grid-cols-[auto,1fr,auto,auto] md:items-center">
                    <input type="checkbox" checked={selectedOrderIds.includes(item.id)} onChange={() => toggleSelection(item.id, setSelectedOrderIds)} />
                    <div>
                      <p className="font-semibold text-ink">{item.orderCode} · {item.name}</p>
                      <p className="text-sm text-ink-soft">{item.deliverySpeed} · {formatCurrency(item.totalAmount)}</p>
                      <p className="text-xs text-ink-soft">{item.email || "N/A"} · {item.phone || "N/A"}</p>
                    </div>
                    <StatusPill value={item.status} />
                    <select className="h-10 rounded-[0.9rem] border border-line bg-panel/92 px-3 text-sm text-ink" value={item.status} onChange={(event) => saveOrder(item.id, event.target.value)}>
                      {ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <div className="md:col-span-4">
                      {renderOrderContactActions(item)}
                      {renderOrderReplyComposer(item)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center mt-4">
              <Button type="button" variant="outline" disabled={ordersPage === 1} onClick={() => setOrdersPage(ordersPage - 1)}>Previous</Button>
              <span className="text-sm">Page {ordersPage} of {orderPages}</span>
              <Button type="button" variant="outline" disabled={ordersPage >= orderPages} onClick={() => setOrdersPage(ordersPage + 1)}>Next</Button>
            </div>
          </CollapsibleDashboardBox>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <CollapsibleDashboardBox
            className={activePanel === "products" ? "" : "hidden"}
            title="Products"
            count={dashboard.products.length}
            color="bg-brand-light/10"
            headerColor="bg-brand-light/80"
            icon="📦"
          >
            <SectionHeading eyebrow="Products" title="Add a product" description="Simple React form for product creation." />
            <form className="space-y-4" onSubmit={handleAddProduct}>
              <TextField label="Name" id="product-name" required placeholder="e.g. Premium Hair Serum" value={productForm.name} onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))} />
              <TextField label="Category" id="product-category" required placeholder="e.g. Hair care" value={productForm.category} onChange={(event) => setProductForm((prev) => ({ ...prev, category: event.target.value }))} />
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Price" id="product-price" type="number" required placeholder="0.00" value={productForm.price} onChange={(event) => setProductForm((prev) => ({ ...prev, price: event.target.value }))} />
                <TextField label="Stock" id="product-stock" type="number" required placeholder="0" value={productForm.stock} onChange={(event) => setProductForm((prev) => ({ ...prev, stock: event.target.value }))} />
              </div>
              <div>
                <label htmlFor="product-image" className="block font-semibold mb-2">Product Image</label>
                <input
                  id="product-image"
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files[0];
                    setProductForm(prev => ({ ...prev, image: file }));
                    setProductImagePreview(file ? URL.createObjectURL(file) : null);
                  }}
                  className="block w-full border border-line rounded-[1.4rem] px-3 py-2 bg-panel/92"
                />
                {productImagePreview && (
                  <img src={productImagePreview} alt="Preview" className="mt-3 rounded-lg max-h-40 object-contain border border-line" />
                )}
              </div>
              <Button className="w-full sm:w-auto" type="submit">Add product</Button>
            </form>
            <div className="space-y-3">
              {dashboard.products.length === 0 ? <EmptyState title="No products yet" description="Add a product to publish it in your storefront." /> : null}
              {dashboard.products.map((item) => (
                <div key={item.id} className="rounded-[1.4rem] border border-line/70 bg-panel/92 p-4 flex gap-4 items-center">
                  {item.image && (
                    <img
                      src={resolveMediaSrc(item.image) || undefined}
                      alt={item.name}
                      className="w-20 h-20 object-cover rounded-lg border border-line"
                      style={{ background: '#f8f8f8' }}
                    />
                  )}
                  <div className="flex-1">
                    <DetailRow label={item.name} value={formatCurrency(item.price)} />
                    <p className="mt-2 text-sm text-ink-soft">{item.category} | Stock: {item.stock}</p>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleDashboardBox>

          <CollapsibleDashboardBox
            className={activePanel === "messages" ? "" : "hidden"}
            title="Messages & Settings"
            count={dashboard.messages.length}
            color="bg-brand-deep/10"
            headerColor="bg-brand-deep/80"
            icon="💬"
          >
            <SectionHeading eyebrow="Settings" title="Delivery fees and messages" description="Current admin essentials without the legacy panel layout." />
            <form className="space-y-4" onSubmit={saveFees}>
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Standard fee" id="fee-standard" type="number" min="0" step="100" required value={feeForm.standard} onChange={(event) => setFeeForm((prev) => ({ ...prev, standard: event.target.value }))} />
                <TextField label="Express fee" id="fee-express" type="number" min="0" step="100" required value={feeForm.express} onChange={(event) => setFeeForm((prev) => ({ ...prev, express: event.target.value }))} />
              </div>
              <Button className="w-full sm:w-auto" type="submit" disabled={savingFees}>{savingFees ? "Saving fees..." : "Save fees"}</Button>
            </form>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                className="h-11 rounded-[1.2rem] border border-line bg-panel/92 px-4 text-sm text-ink"
                placeholder="Search complaints/messages"
                value={messageSearch}
                onChange={(event) => setMessageSearch(event.target.value)}
              />
              <select className="h-11 rounded-[1.2rem] border border-line bg-panel/92 px-4 text-sm text-ink" value={messageTypeFilter} onChange={(event) => setMessageTypeFilter(event.target.value)}>
                <option value="all">All types</option>
                <option value="complaints">Complaints only</option>
                <option value="messages">Messages only</option>
              </select>
              <select className="h-11 rounded-[1.2rem] border border-line bg-panel/92 px-4 text-sm text-ink" value={messageStatusFilter} onChange={(event) => setMessageStatusFilter(event.target.value)}>
                <option value="all">All</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
            </div>
            <div className="space-y-3">
              {filteredMessages.length === 0 ? <EmptyState title="Inbox clear" description="No records match this message/complaint filter." /> : null}
              {filteredMessages.map((item) => (
                <div key={item.id} className="rounded-[1.4rem] border border-line/70 bg-panel/92 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-ink">{item.subject}</p>
                    <StatusPill value={item.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusPill value={item.reportType || "general_message"} />
                    <span className="text-xs text-ink-soft">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</span>
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">{item.email}</p>
                  <p className="mt-2 text-sm leading-6 text-ink">{item.message}</p>
                  {item.reportFile ? (
                    <p className="mt-2 text-sm">
                      <a className="font-semibold text-brand-deep underline" href={item.reportFile} target="_blank" rel="noreferrer">Open complaint attachment</a>
                    </p>
                  ) : null}
                  {renderMessageReplyComposer(item)}
                </div>
              ))}
            </div>
          </CollapsibleDashboardBox>
        </div>
      </div>
      </div>
    </div>
  );
}
