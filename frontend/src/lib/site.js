const moneyFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
});

export function formatCurrency(value) {
  return moneyFormatter.format(Number(value || 0));
}

export function formatDateTime(value) {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function getErrorMessage(error) {
  const payload = error && typeof error === "object" ? error.payload : null;
  const payloadCode = payload && typeof payload === "object" ? String(payload.code || "").trim().toUpperCase() : "";
  const rawMessage = error instanceof Error && error.message ? String(error.message) : "";
  const normalizedMessage = rawMessage.toLowerCase();

  if (payloadCode === "SMTP_NOT_CONFIGURED") {
    return "Email sending is not configured on the backend yet. Add SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, and SMTP_FROM in your backend environment, then restart/redeploy the backend.";
  }

  if (
    normalizedMessage.includes("invalid login") ||
    normalizedMessage.includes("bad credentials") ||
    normalizedMessage.includes("username and password") ||
    normalizedMessage.includes("authentication failed")
  ) {
    return "Email login failed on the backend SMTP server. Re-check SMTP_USER and SMTP_PASS (for Gmail, use an App Password), then restart/redeploy the backend.";
  }

  if (
    normalizedMessage.includes("greeting never received") ||
    normalizedMessage.includes("etimedout") ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("econnection")
  ) {
    return "Email server connection timed out. Check SMTP host/port/security settings and allow outbound SMTP traffic from your hosting provider.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
