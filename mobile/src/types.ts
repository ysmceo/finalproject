export type Service = {
  id: number;
  name: string;
  price: number;
  duration: number;
};

export type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  image?: string | null;
};

export type BookingSelectedService = {
  id: number;
  name: string;
  price: number;
  duration: number;
};

export type BookingRequestedProduct = {
  productId: number;
  name: string;
  category: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type Booking = {
  id: string;
  trackingCode?: string;
  status: string;
  name: string;
  email: string;
  phone: string;
  serviceId: number;
  serviceIds?: number[];
  selectedServices?: BookingSelectedService[];
  serviceName: string;
  price: number;
  totalDuration?: number;
  date: string;
  time: string;
  language: string;
  paymentMethod: string;
  paymentPlan: 'full' | 'deposit_50';
  amountDueNow: number;
  amountRemaining: number;
  paymentStatus: string;
  paymentProvider: string;
  paymentReference: string;
  paidAmount: number;
  bankTransferReference: string;
  serviceMode: 'home' | 'in_salon';
  homeServiceAddress: string;
  requestedProducts?: BookingRequestedProduct[];
  requestedProductsTotal?: number;
  hasProductRequest?: boolean;
};

export type BookingNotification = {
  id: string;
  bookingId: string;
  type: string;
  message: string;
  createdAt: string;
};

export type TrackResponse = {
  booking: Booking & {
    paymentReceiptFile?: string | null;
    paymentReceiptStatus?: string;
  };
  notifications: BookingNotification[];
};

export type ProductOrderItem = {
  productId: number;
  name: string;
  category: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type ProductOrder = {
  id: string;
  orderCode: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalAmount: number;
  amountDueNow: number;
  amountRemaining: number;
  paidAmount: number;
  paymentProvider: string;
  paymentReference: string;
  bankTransferReference: string;
  items: ProductOrderItem[];
  createdAt: string;
  updatedAt?: string | null;
};

export type ProductOrderTrackResponse = {
  order: ProductOrder;
};

export type PaystackStatusResponse = {
  configured: boolean;
  callbackUrl: string;
  publicBaseUrl: string;
  message: string;
};

export type MonnifyStatusResponse = {
  configured: boolean;
  callbackUrl: string;
  publicBaseUrl: string;
  baseUrl: string;
  message: string;
};
