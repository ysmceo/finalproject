export type Service = {
  id: number;
  name: string;
  price: number;
  duration: number;
};

export type Booking = {
  id: string;
  status: string;
  name: string;
  email: string;
  phone: string;
  serviceId: number;
  serviceName: string;
  price: number;
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
