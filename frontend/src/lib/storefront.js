import { apiGet, resolveApiUrl, resolveBackendAssetUrl } from "@/lib/api";

export const PAYMENT_METHODS = ["Bank Transfer", "Credit Card", "Debit Card", "USSD", "Cash"];

export async function loadCatalog() {
  const [services, products, delivery] = await Promise.all([
    apiGet("/api/services"),
    apiGet("/api/products"),
    apiGet("/api/product-orders/delivery-fees")
  ]);

  return {
    services: Array.isArray(services) ? services : [],
    products: Array.isArray(products) ? products : [],
    fees: delivery && delivery.fees ? delivery.fees : { standard: 0, express: 0 }
  };
}

export function buildSelectedItems(products, quantities) {
  return products
    .filter((product) => Number(quantities[product.id] || 0) > 0)
    .map((product) => ({
      productId: product.id,
      quantity: Number(quantities[product.id] || 0)
    }));
}

export function getSelectionTotal(products, quantities) {
  return products.reduce(
    (sum, product) => sum + Number(product.price || 0) * Number(quantities[product.id] || 0),
    0
  );
}

export function resolveMediaSrc(source) {
  if (!source) {
    return null;
  }

  const value = String(source).trim();

  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (/^\/?uploads\//i.test(value)) {
    return encodeURI(resolveBackendAssetUrl(value.startsWith("/") ? value : `/${value}`));
  }

  if (value.startsWith("/")) {
    return encodeURI(value);
  }

  return encodeURI(resolveApiUrl(value));
}

export function getTodayDateInputValue() {
  return new Date().toISOString().split("T")[0];
}
