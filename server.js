const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = 3000;
const ADMIN_SECRET_PASSCODE = process.env.ADMIN_SECRET_PASSCODE || 'CHANGE_ME_ADMIN_PASSCODE';
const ONE_TIME_CODE_TTL_MS = 10 * 60 * 1000;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

// Monnify (card/transfer/ussd) configuration
const MONNIFY_API_KEY = process.env.MONNIFY_API_KEY || '';
const MONNIFY_SECRET_KEY = process.env.MONNIFY_SECRET_KEY || '';
const MONNIFY_CONTRACT_CODE = process.env.MONNIFY_CONTRACT_CODE || '';
const MONNIFY_ENV = String(process.env.MONNIFY_ENV || 'live').trim().toLowerCase();
const MONNIFY_BASE_URL = process.env.MONNIFY_BASE_URL || (MONNIFY_ENV === 'sandbox' ? 'https://sandbox.monnify.com' : 'https://api.monnify.com');

const SALON_BANK_ACCOUNT_NUMBER = process.env.SALON_BANK_ACCOUNT_NUMBER || '0204661552';
const SALON_BANK_NAME = process.env.SALON_BANK_NAME || 'GTBank';
const SALON_BANK_ACCOUNT_NAME = process.env.SALON_BANK_ACCOUNT_NAME || 'CEO Saloon';

let monnifyAccessTokenCache = {
  token: '',
  expiresAtMs: 0
};

function getDefaultProducts() {
  return [
    { id: 1, name: 'Bread Oil', category: 'Grooming', price: 4500, stock: 35, image: '/images/bread oil.jpeg' },
    { id: 2, name: 'Hair Oil', category: 'Hair Care', price: 3500, stock: 42, image: '/images/hair oil.jpeg' },
    { id: 3, name: 'Face Cream', category: 'Skin Care', price: 5000, stock: 28, image: '/images/face cream.jpeg' },
    { id: 4, name: 'Hair Cream', category: 'Hair Care', price: 4000, stock: 40, image: '/images/hair cream.jpeg' },
    { id: 5, name: 'Prefume', category: 'Fragrance', price: 9000, stock: 22, image: '/images/prefume.jpeg' },
    { id: 6, name: 'Premium Wig', category: 'Wigs', price: 45000, stock: 12, image: '/images/premium wig.jpeg' },
    { id: 7, name: 'Wig Revampimg', category: 'Wig Service', price: 15000, stock: 999, image: '/images/wig revamping.jpeg' },
    { id: 9, name: 'Wig Frsh Oil', category: 'Wig Care', price: 6000, stock: 30, image: '/images/wig fresh oil.jpeg' }
  ];
}

function mergeProductDefaults(existingProducts) {
  const defaultProducts = getDefaultProducts();
  const mergedProducts = [...(existingProducts || [])];

  defaultProducts.forEach(defaultProduct => {
    const existingIndex = mergedProducts.findIndex(product => Number(product.id) === Number(defaultProduct.id));

    if (existingIndex === -1) {
      mergedProducts.push(defaultProduct);
      return;
    }

    const existingProduct = mergedProducts[existingIndex];
    mergedProducts[existingIndex] = {
      ...existingProduct,
      name: defaultProduct.name,
      category: defaultProduct.category,
      price: Number(existingProduct.price) || defaultProduct.price,
      stock: Number(existingProduct.stock) || defaultProduct.stock,
      image: existingProduct.image || defaultProduct.image
    };
  });

  return mergedProducts;
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

const uploadReceipt = multer({
  storage: storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB limit for receipts
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Upload an image or PDF receipt.'));
    }
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    // Keep raw body for providers that validate webhook signatures.
    req.rawBody = buf;
  }
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.get('/p1.webp', (req, res) => {
  res.sendFile(path.join(__dirname, 'images', 'p1.webp'));
});
app.get('/p2.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'images', 'p2 hair color.jpg'));
});
app.get('/p3.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'images', 'p3.jpg'));
});
app.get('/p4.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'p4.jpg'));
});
app.get('/p5.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'images', 'p5 relaxation services.jpg'));
});
app.get('/p6.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'images', 'p6 styling.jpg'));
});
app.get('/male-stylist.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'male baber sytlist.jpeg'));
});

// Database file path
const dbPath = path.join(__dirname, 'database.json');

// Initialize database
function initializeDatabase() {
  if (!fs.existsSync(dbPath)) {
    const initialData = {
      bookings: [],
      messages: [],
      admins: [],
      adminAccessCodes: [],
      products: getDefaultProducts(),
      services: [
        { id: 1, name: 'Hair Cut', price: 5000, duration: 30 },
        { id: 2, name: 'Hair Coloring', price: 15000, duration: 60 },
        { id: 3, name: 'Facial Treatment', price: 8000, duration: 45 },
        { id: 4, name: 'Manicure', price: 4000, duration: 30 },
        { id: 5, name: 'Pedicure', price: 5000, duration: 40 },
        { id: 6, name: 'Hair Spa', price: 12000, duration: 60 },
        { id: 7, name: 'Beard Trim', price: 3000, duration: 20 },
        { id: 8, name: 'Full Body Massage', price: 18000, duration: 60 }
      ]
    };
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
  }
}

// Helper functions to read/write database
function readDatabase() {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  if (!Array.isArray(db.bookings)) db.bookings = [];
  if (!Array.isArray(db.messages)) db.messages = [];
  if (!Array.isArray(db.services)) db.services = [];
  if (!Array.isArray(db.products)) db.products = [];
  if (!Array.isArray(db.admins)) db.admins = [];
  if (!Array.isArray(db.adminAccessCodes)) db.adminAccessCodes = [];
  if (!Array.isArray(db.bookingNotifications)) db.bookingNotifications = [];

  if (db.products.length === 0) {
    db.products = getDefaultProducts();
    writeDatabase(db);
  } else {
    const mergedProducts = mergeProductDefaults(db.products);
    const hasChanges = JSON.stringify(mergedProducts) !== JSON.stringify(db.products);

    if (hasChanges) {
      db.products = mergedProducts;
      writeDatabase(db);
    }
  }

  return db;
}

function addBookingNotification(db, booking, type, message) {
  if (!db.bookingNotifications) {
    db.bookingNotifications = [];
  }

  db.bookingNotifications.push({
    id: uuidv4(),
    bookingId: booking.id,
    email: booking.email,
    phone: booking.phone,
    type,
    message,
    createdAt: new Date().toISOString()
  });
}

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function buildBankTransferReference(bookingId) {
  const shortId = String(bookingId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  return `CEOSALOON-${shortId || 'BOOKING'}`;
}

function isPaystackConfigured() {
  return Boolean(String(PAYSTACK_SECRET_KEY || '').trim());
}

function isMonnifyConfigured() {
  return Boolean(String(MONNIFY_API_KEY || '').trim()) &&
    Boolean(String(MONNIFY_SECRET_KEY || '').trim()) &&
    Boolean(String(MONNIFY_CONTRACT_CODE || '').trim());
}

function getMonnifyBasicAuthHeader() {
  const apiKey = String(MONNIFY_API_KEY || '').trim();
  const secret = String(MONNIFY_SECRET_KEY || '').trim();
  const basicToken = Buffer.from(`${apiKey}:${secret}`).toString('base64');
  return `Basic ${basicToken}`;
}

async function monnifyGetAccessToken() {
  if (!isMonnifyConfigured()) {
    const err = new Error('Monnify credentials are not configured');
    err.code = 'MONNIFY_NOT_CONFIGURED';
    throw err;
  }

  const now = Date.now();
  // Keep a small buffer so we don't race with expiry.
  if (monnifyAccessTokenCache.token && monnifyAccessTokenCache.expiresAtMs > now + 30_000) {
    return monnifyAccessTokenCache.token;
  }

  const response = await fetch(`${MONNIFY_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      Authorization: getMonnifyBasicAuthHeader(),
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.requestSuccessful !== true || !data.responseBody || !data.responseBody.accessToken) {
    const err = new Error('Failed to authenticate with Monnify');
    err.code = 'MONNIFY_AUTH_FAILED';
    err.details = data;
    throw err;
  }

  const expiresInSeconds = Number(data.responseBody.expiresIn || 0);
  monnifyAccessTokenCache = {
    token: String(data.responseBody.accessToken),
    expiresAtMs: now + Math.max(0, expiresInSeconds) * 1000
  };

  return monnifyAccessTokenCache.token;
}

async function monnifyApiRequest(method, pathname, payload) {
  const token = await monnifyGetAccessToken();
  const url = `${MONNIFY_BASE_URL}${pathname}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: payload ? JSON.stringify(payload) : undefined
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, status: response.status, data };
  }

  return { ok: true, status: response.status, data };
}

async function monnifyQueryTransaction({ paymentReference, transactionReference }) {
  const token = await monnifyGetAccessToken();

  const ref = String(paymentReference || '').trim();
  const txRef = String(transactionReference || '').trim();
  if (!ref && !txRef) {
    const err = new Error('paymentReference or transactionReference is required');
    err.code = 'MONNIFY_MISSING_REFERENCE';
    throw err;
  }

  const query = ref
    ? `paymentReference=${encodeURIComponent(ref)}`
    : `transactionReference=${encodeURIComponent(txRef)}`;

  const response = await fetch(`${MONNIFY_BASE_URL}/api/v2/merchant/transactions/query?${query}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, status: response.status, data };
  }

  return { ok: true, status: response.status, data };
}

function computeMonnifyWebhookSignature(rawBodyBuffer) {
  const secret = String(MONNIFY_SECRET_KEY || '').trim();
  const raw = Buffer.isBuffer(rawBodyBuffer)
    ? rawBodyBuffer
    : Buffer.from(String(rawBodyBuffer || ''), 'utf8');

  return crypto.createHmac('sha512', secret).update(raw).digest('hex');
}

async function paystackRequest(pathname, payload) {
  if (!PAYSTACK_SECRET_KEY) {
    const err = new Error('Paystack secret key is not configured');
    err.code = 'PAYSTACK_NOT_CONFIGURED';
    throw err;
  }

  const response = await fetch(`https://api.paystack.co${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data
    };
  }

  return {
    ok: true,
    status: response.status,
    data
  };
}

function generateOneTimeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function extractAdminToken(req) {
  const authHeader = String(req.headers.authorization || '').trim();

  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  if (req.headers['x-admin-token']) {
    return String(req.headers['x-admin-token']).trim();
  }

  if (req.body && req.body.token) {
    return String(req.body.token).trim();
  }

  return '';
}

function validateAdminToken(token, db) {
  if (!token) {
    return null;
  }

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [email, id] = decoded.split(':');

    if (!email || !id) {
      return null;
    }

    const normalizedDecodedEmail = normalizeEmail(email);

    return db.admins.find(a => normalizeEmail(a.email) === normalizedDecodedEmail && String(a.id) === String(id)) || null;
  } catch (error) {
    return null;
  }
}

function requireAdminAuth(req, res, next) {
  const db = readDatabase();

  if (db.admins.length === 0) {
    return res.status(401).json({ error: 'No admin account configured yet' });
  }

  const token = extractAdminToken(req);
  const admin = validateAdminToken(token, db);

  if (!admin) {
    return res.status(401).json({ error: 'Unauthorized admin access' });
  }

  req.admin = {
    id: admin.id,
    email: admin.email,
    name: admin.name
  };

  next();
}

function writeDatabase(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Initialize database on startup
initializeDatabase();

// Routes

// Admin Dashboard Routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Get all services
app.get('/api/services', (req, res) => {
  const db = readDatabase();
  res.json(db.services);
});

// Get all products
app.get('/api/products', (req, res) => {
  const db = readDatabase();
  res.json(db.products);
});

// Get all products (Admin)
app.get('/api/admin/products', requireAdminAuth, (req, res) => {
  const db = readDatabase();
  res.json(db.products);
});

// Create product (Admin)
app.post('/api/admin/products', requireAdminAuth, upload.single('productImage'), (req, res) => {
  const { name, category, price, stock } = req.body;
  const normalizedName = String(name || '').trim();
  const normalizedCategory = String(category || '').trim();
  const normalizedPrice = Number(price);
  const normalizedStock = Number(stock);

  if (!normalizedName || !normalizedCategory || Number.isNaN(normalizedPrice) || Number.isNaN(normalizedStock)) {
    return res.status(400).json({ error: 'Name, category, price, and stock are required' });
  }

  const db = readDatabase();
  const nextId = db.products.length ? Math.max(...db.products.map(p => Number(p.id) || 0)) + 1 : 1;

  const product = {
    id: nextId,
    name: normalizedName,
    category: normalizedCategory,
    price: normalizedPrice,
    stock: normalizedStock,
    image: req.file ? `/uploads/${req.file.filename}` : null,
    createdAt: new Date().toISOString()
  };

  db.products.push(product);
  writeDatabase(db);

  res.status(201).json({ message: 'Product added successfully', product });
});

// Update product image (Admin)
app.put('/api/admin/products/:id/image', requireAdminAuth, upload.single('productImage'), (req, res) => {
  const productId = Number(req.params.id);

  if (!req.file) {
    return res.status(400).json({ error: 'Product image file is required' });
  }

  const db = readDatabase();
  const product = db.products.find(p => Number(p.id) === productId);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  product.image = `/uploads/${req.file.filename}`;
  product.updatedAt = new Date().toISOString();
  writeDatabase(db);

  res.json({ message: 'Product image updated successfully', product });
});

// Delete product (Admin)
app.delete('/api/admin/products/:id', requireAdminAuth, (req, res) => {
  const productId = Number(req.params.id);
  const db = readDatabase();
  const existingCount = db.products.length;

  db.products = db.products.filter(p => Number(p.id) !== productId);

  if (db.products.length === existingCount) {
    return res.status(404).json({ error: 'Product not found' });
  }

  writeDatabase(db);
  res.json({ message: 'Product deleted successfully' });
});

// Get Weather Data
app.get('/api/weather', async (req, res) => {
  try {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=6.5244&longitude=3.3792&current=temperature_2m,weather_code'
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
});

// Create booking
app.post('/api/bookings', upload.single('styleImage'), (req, res) => {
  const {
    name,
    email,
    phone,
    serviceId,
    date,
    time,
    language,
    paymentMethod,
    paymentPlan,
    homeServiceRequested,
    homeServiceAddress,
    refreshment,
    specialRequests
  } = req.body;

  const normalizedPaymentPlan = String(paymentPlan || '').trim();
  const normalizedHomeServiceRequested = String(homeServiceRequested || '').trim().toLowerCase();
  const isHomeServiceRequested = normalizedHomeServiceRequested === 'true' || normalizedHomeServiceRequested === '1' || normalizedHomeServiceRequested === 'yes';
  const normalizedHomeServiceAddress = String(homeServiceAddress || '').trim();

  if (!name || !email || !phone || !serviceId || !date || !time || !paymentMethod || !normalizedPaymentPlan) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['full', 'deposit_50'].includes(normalizedPaymentPlan)) {
    return res.status(400).json({ error: 'Invalid payment plan. Use full or deposit_50.' });
  }

  if (isHomeServiceRequested && !normalizedHomeServiceAddress) {
    return res.status(400).json({ error: 'Home service address is required when requesting home service' });
  }

  const db = readDatabase();
  const service = db.services.find(s => s.id === parseInt(serviceId));

  if (!service) {
    return res.status(400).json({ error: 'Service not found' });
  }

  const totalAmount = Number(service.price) || 0;
  const amountDueNow = normalizedPaymentPlan === 'deposit_50' ? Math.ceil(totalAmount * 0.5) : totalAmount;
  const amountRemaining = Math.max(0, totalAmount - amountDueNow);

  const booking = {
    id: uuidv4(),
    name,
    email,
    phone,
    serviceId: parseInt(serviceId),
    serviceName: service.name,
    price: service.price,
    date,
    time,
    language: language || '',
    paymentMethod: paymentMethod || '',
    paymentPlan: normalizedPaymentPlan,
    amountDueNow,
    amountRemaining,
    paymentStatus: 'pending',
    paymentProvider: '',
    paymentReference: '',
    paidAmount: 0,
    bankTransferReference: '',
    serviceMode: isHomeServiceRequested ? 'home' : 'in_salon',
    homeServiceAddress: isHomeServiceRequested ? normalizedHomeServiceAddress : '',
    refreshment: refreshment || 'No',
    specialRequests: specialRequests || '',
    styleImage: req.file ? `/uploads/${req.file.filename}` : null,
    imageApproved: false,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.bookings.push(booking);

  if (String(booking.paymentMethod || '').trim() === 'Bank Transfer') {
    booking.bankTransferReference = buildBankTransferReference(booking.id);
    addBookingNotification(
      db,
      booking,
      'payment_instructions',
      `🏦 Bank Transfer Details: ${SALON_BANK_NAME} ${SALON_BANK_ACCOUNT_NUMBER} (${SALON_BANK_ACCOUNT_NAME}). Use reference: ${booking.bankTransferReference}. Amount due now: ₦${Number(booking.amountDueNow || 0).toLocaleString()}.`
    );
  }

  writeDatabase(db);

  res.status(201).json({
    message: `Your service order has been made. A customer care representative will reach out to you via the email and phone number provided. Booking ID: ${booking.id}. Payment: ${normalizedPaymentPlan === 'deposit_50' ? '50% deposit' : 'full'} (₦${amountDueNow.toLocaleString()} due now).`,
    paymentBankDetails: String(booking.paymentMethod || '').trim() === 'Bank Transfer'
      ? {
          bankName: SALON_BANK_NAME,
          accountNumber: SALON_BANK_ACCOUNT_NUMBER,
          accountName: SALON_BANK_ACCOUNT_NAME,
          reference: booking.bankTransferReference,
          amountDueNow: booking.amountDueNow
        }
      : null,
    booking
  });
});

// Bank transfer payment details (Customer)
app.get('/api/payments/bank/details', (req, res) => {
  const bookingId = String(req.query.bookingId || '').trim();
  const email = normalizeEmail(req.query.email);

  if (!bookingId || !email) {
    return res.status(400).json({ error: 'bookingId and email are required' });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => String(b.id) === bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (normalizeEmail(booking.email) !== email) {
    return res.status(401).json({ error: 'Email does not match this booking' });
  }

  if (String(booking.paymentMethod || '').trim() !== 'Bank Transfer') {
    return res.status(400).json({ error: 'This booking is not set to Bank Transfer payment method' });
  }

  if (!booking.bankTransferReference) {
    booking.bankTransferReference = buildBankTransferReference(booking.id);
    writeDatabase(db);
  }

  res.json({
    bankName: SALON_BANK_NAME,
    accountNumber: SALON_BANK_ACCOUNT_NUMBER,
    accountName: SALON_BANK_ACCOUNT_NAME,
    reference: booking.bankTransferReference,
    amountDueNow: booking.amountDueNow,
    bookingId: booking.id
  });
});

// Paystack configuration status (Customer)
app.get('/api/payments/paystack/status', (req, res) => {
  const configured = isPaystackConfigured();
  const callbackUrl = `${PUBLIC_BASE_URL}/paystack-callback.html`;

  res.json({
    configured,
    callbackUrl,
    publicBaseUrl: PUBLIC_BASE_URL,
    message: configured
      ? 'Paystack is configured'
      : 'Paystack is not configured on the server. Set PAYSTACK_SECRET_KEY in .env and restart the server.'
  });
});

// Monnify configuration status (Customer)
app.get('/api/payments/monnify/status', (req, res) => {
  const configured = isMonnifyConfigured();
  const callbackUrl = `${PUBLIC_BASE_URL}/monnify-callback.html`;

  res.json({
    configured,
    callbackUrl,
    publicBaseUrl: PUBLIC_BASE_URL,
    baseUrl: MONNIFY_BASE_URL,
    message: configured
      ? 'Monnify is configured'
      : 'Monnify is not configured on the server. Set MONNIFY_API_KEY, MONNIFY_SECRET_KEY, and MONNIFY_CONTRACT_CODE in .env and restart the server.'
  });
});

// Initialize Monnify payment (Customer)
app.post('/api/payments/monnify/initialize', async (req, res) => {
  const { bookingId, email, paymentMethods } = req.body;
  const normalizedBookingId = String(bookingId || '').trim();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedBookingId || !normalizedEmail) {
    return res.status(400).json({ error: 'bookingId and email are required' });
  }

  if (!isMonnifyConfigured()) {
    return res.status(503).json({
      error: 'Monnify is not configured on the server',
      hint: 'Set MONNIFY_API_KEY, MONNIFY_SECRET_KEY, and MONNIFY_CONTRACT_CODE in .env and restart the server.'
    });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => String(b.id) === normalizedBookingId);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (normalizeEmail(booking.email) !== normalizedEmail) {
    return res.status(401).json({ error: 'Email does not match this booking' });
  }

  const amount = Math.max(0, Number(booking.amountDueNow || 0));
  if (!amount) {
    return res.status(400).json({ error: 'No payable amount found for this booking' });
  }

  const redirectUrl = `${PUBLIC_BASE_URL}/monnify-callback.html`;
  const generatedPaymentReference = `CEOSALOON-${String(booking.id).slice(0, 12)}-${Date.now()}`;

  const normalizedPaymentMethods = Array.isArray(paymentMethods)
    ? paymentMethods
        .map(m => String(m || '').trim().toUpperCase())
        .filter(Boolean)
    : [];

  try {
    const init = await monnifyApiRequest('POST', '/api/v1/merchant/transactions/init-transaction', {
      amount,
      customerName: booking.name,
      customerEmail: booking.email,
      paymentReference: generatedPaymentReference,
      paymentDescription: `CEO UNISEX SALON - ${booking.serviceName}`,
      currencyCode: 'NGN',
      contractCode: String(MONNIFY_CONTRACT_CODE || '').trim(),
      redirectUrl,
      paymentMethods: normalizedPaymentMethods.length ? normalizedPaymentMethods : undefined,
      metaData: {
        bookingId: booking.id,
        serviceName: booking.serviceName,
        paymentPlan: booking.paymentPlan,
        amountDueNow: booking.amountDueNow,
        phone: booking.phone
      }
    });

    if (!init.ok || !init.data || init.data.requestSuccessful !== true || !init.data.responseBody || !init.data.responseBody.checkoutUrl) {
      return res.status(502).json({ error: 'Failed to initialize Monnify payment', details: init.data });
    }

    booking.paymentProvider = 'monnify';
    booking.paymentReference = init.data.responseBody.paymentReference || generatedPaymentReference;
    booking.monnifyTransactionReference = init.data.responseBody.transactionReference || '';
    booking.paymentStatus = 'initiated';
    booking.paymentInitiatedAt = new Date().toISOString();
    writeDatabase(db);

    return res.json({
      message: 'Payment initialized',
      checkoutUrl: init.data.responseBody.checkoutUrl,
      paymentReference: booking.paymentReference,
      transactionReference: booking.monnifyTransactionReference
    });
  } catch (error) {
    if (error && error.code === 'MONNIFY_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'Monnify is not configured on the server' });
    }
    return res.status(500).json({ error: 'Failed to initialize Monnify payment' });
  }
});

// Verify Monnify payment (Customer)
app.get('/api/payments/monnify/verify', async (req, res) => {
  const paymentReference = String(req.query.paymentReference || '').trim();
  const transactionReference = String(req.query.transactionReference || '').trim();

  if (!paymentReference && !transactionReference) {
    return res.status(400).json({ error: 'paymentReference or transactionReference is required' });
  }

  if (!isMonnifyConfigured()) {
    return res.status(503).json({
      error: 'Monnify is not configured on the server',
      hint: 'Set MONNIFY_API_KEY, MONNIFY_SECRET_KEY, and MONNIFY_CONTRACT_CODE in .env and restart the server.'
    });
  }

  try {
    const result = await monnifyQueryTransaction({ paymentReference, transactionReference });
    if (!result.ok || !result.data || result.data.requestSuccessful !== true || !result.data.responseBody) {
      return res.status(502).json({ error: 'Failed to verify payment', details: result.data });
    }

    const body = result.data.responseBody;
    const status = String(body.paymentStatus || '').trim().toUpperCase();
    const paid = ['PAID', 'OVERPAID'].includes(status);
    const amountPaid = Math.round(Number(body.amountPaid || body.amount || 0));

    const db = readDatabase();
    const booking = db.bookings.find(b => String(b.paymentReference || '').trim() === String(body.paymentReference || paymentReference).trim())
      || db.bookings.find(b => String(b.monnifyTransactionReference || '').trim() === String(body.transactionReference || transactionReference).trim());

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found for this payment reference' });
    }

    booking.paymentProvider = 'monnify';
    booking.paymentReference = String(body.paymentReference || booking.paymentReference || '').trim();
    booking.monnifyTransactionReference = String(body.transactionReference || booking.monnifyTransactionReference || '').trim();
    booking.paidAmount = paid ? amountPaid : 0;
    booking.paymentStatus = paid ? 'paid' : 'failed';
    booking.paymentVerifiedAt = new Date().toISOString();

    if (paid) {
      booking.amountRemaining = Math.max(0, Number(booking.price || 0) - amountPaid);
      addBookingNotification(
        db,
        booking,
        'payment_received',
        `💳 Payment received successfully (₦${amountPaid.toLocaleString()}). Your booking remains ${booking.status}.`
      );
    }

    writeDatabase(db);

    return res.json({
      ok: true,
      paid,
      status,
      booking: {
        id: booking.id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        paymentPlan: booking.paymentPlan,
        amountDueNow: booking.amountDueNow,
        amountRemaining: booking.amountRemaining,
        paidAmount: booking.paidAmount,
        paymentReference: booking.paymentReference,
        transactionReference: booking.monnifyTransactionReference
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// Monnify webhook (server-to-server) for payment completion events
app.post('/api/payments/monnify/webhook', async (req, res) => {
  if (!isMonnifyConfigured()) {
    return res.status(503).json({ error: 'Monnify is not configured on the server' });
  }

  const signature = String(req.headers['monnify-signature'] || '').trim();
  const rawBody = req.rawBody;
  if (!signature || !rawBody) {
    return res.status(400).json({ error: 'Missing monnify-signature header or raw body' });
  }

  const computed = computeMonnifyWebhookSignature(rawBody);
  if (String(computed).toLowerCase() !== String(signature).toLowerCase()) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  // Best practice: query Monnify for the final status before updating records.
  const payload = req.body;
  const eventData = payload && payload.eventData ? payload.eventData : null;
  const paymentReference = eventData ? String(eventData.paymentReference || '').trim() : '';
  const transactionReference = eventData ? String(eventData.transactionReference || '').trim() : '';

  if (!paymentReference && !transactionReference) {
    return res.status(400).json({ error: 'Webhook missing paymentReference/transactionReference' });
  }

  try {
    const verified = await monnifyQueryTransaction({ paymentReference, transactionReference });
    if (!verified.ok || !verified.data || verified.data.requestSuccessful !== true || !verified.data.responseBody) {
      return res.status(202).json({ received: true, verified: false });
    }

    const body = verified.data.responseBody;
    const status = String(body.paymentStatus || '').trim().toUpperCase();
    const paid = ['PAID', 'OVERPAID'].includes(status);
    const amountPaid = Math.round(Number(body.amountPaid || body.amount || 0));

    const db = readDatabase();
    const booking = db.bookings.find(b => String(b.paymentReference || '').trim() === String(body.paymentReference || paymentReference).trim())
      || db.bookings.find(b => String(b.monnifyTransactionReference || '').trim() === String(body.transactionReference || transactionReference).trim());

    if (booking) {
      booking.paymentProvider = 'monnify';
      booking.paymentReference = String(body.paymentReference || booking.paymentReference || '').trim();
      booking.monnifyTransactionReference = String(body.transactionReference || booking.monnifyTransactionReference || '').trim();
      booking.paidAmount = paid ? amountPaid : 0;
      booking.paymentStatus = paid ? 'paid' : booking.paymentStatus;
      booking.paymentWebhookProcessedAt = new Date().toISOString();

      if (paid) {
        booking.amountRemaining = Math.max(0, Number(booking.price || 0) - amountPaid);
        addBookingNotification(
          db,
          booking,
          'payment_received',
          `💳 Payment received successfully (₦${amountPaid.toLocaleString()}). Your booking remains ${booking.status}.`
        );
      }

      writeDatabase(db);
    }

    return res.json({ received: true });
  } catch (error) {
    return res.status(202).json({ received: true, verified: false });
  }
});

// Initialize Paystack payment (Customer)
app.post('/api/payments/paystack/initialize', async (req, res) => {
  const { bookingId, email, paymentChannel } = req.body;
  const normalizedBookingId = String(bookingId || '').trim();
  const normalizedEmail = normalizeEmail(email);
  const normalizedChannel = String(paymentChannel || '').trim();

  if (!normalizedBookingId || !normalizedEmail) {
    return res.status(400).json({ error: 'bookingId and email are required' });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => String(b.id) === normalizedBookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (normalizeEmail(booking.email) !== normalizedEmail) {
    return res.status(401).json({ error: 'Email does not match this booking' });
  }

  const amountInKobo = Math.max(0, Number(booking.amountDueNow || 0)) * 100;
  if (!amountInKobo) {
    return res.status(400).json({ error: 'No payable amount found for this booking' });
  }

  const callbackUrl = `${PUBLIC_BASE_URL}/paystack-callback.html`;

  const channels = [];
  // Paystack supported channels include: card, bank, ussd, bank_transfer, mobile_money
  if (normalizedChannel) {
    channels.push(normalizedChannel);
  }

  try {
    const init = await paystackRequest('/transaction/initialize', {
      email: booking.email,
      amount: amountInKobo,
      callback_url: callbackUrl,
      channels: channels.length ? channels : undefined,
      metadata: {
        bookingId: booking.id,
        serviceName: booking.serviceName,
        paymentPlan: booking.paymentPlan,
        amountDueNow: booking.amountDueNow,
        phone: booking.phone
      }
    });

    if (!init.ok || !init.data || init.data.status !== true) {
      return res.status(502).json({
        error: 'Failed to initialize payment',
        details: init.data
      });
    }

    booking.paymentProvider = 'paystack';
    booking.paymentReference = init.data.data.reference;
    booking.paymentStatus = 'initiated';
    booking.paymentInitiatedAt = new Date().toISOString();
    writeDatabase(db);

    return res.json({
      message: 'Payment initialized',
      authorizationUrl: init.data.data.authorization_url,
      reference: init.data.data.reference
    });
  } catch (error) {
    if (error && error.code === 'PAYSTACK_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'Paystack is not configured on the server',
        hint: 'Set PAYSTACK_SECRET_KEY in .env and restart the server.'
      });
    }
    return res.status(500).json({ error: 'Failed to initialize payment' });
  }
});

// Verify Paystack payment (Customer)
app.get('/api/payments/paystack/verify/:reference', async (req, res) => {
  const reference = String(req.params.reference || '').trim();
  if (!reference) {
    return res.status(400).json({ error: 'reference is required' });
  }

  if (!isPaystackConfigured()) {
    return res.status(503).json({
      error: 'Paystack is not configured on the server',
      hint: 'Set PAYSTACK_SECRET_KEY in .env and restart the server.'
    });
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
      }
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.status !== true) {
      return res.status(502).json({ error: 'Failed to verify payment', details: data });
    }

    const payData = data.data;
    const bookingId = payData && payData.metadata ? String(payData.metadata.bookingId || '').trim() : '';
    const db = readDatabase();
    const booking = bookingId
      ? db.bookings.find(b => String(b.id) === bookingId)
      : db.bookings.find(b => String(b.paymentReference || '').trim() === reference);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found for this payment reference' });
    }

    const paid = payData.status === 'success';
    const paidAmount = Math.round(Number(payData.amount || 0) / 100);

    booking.paymentProvider = 'paystack';
    booking.paymentReference = reference;
    booking.paidAmount = paid ? paidAmount : 0;
    booking.paymentStatus = paid ? 'paid' : 'failed';
    booking.paymentVerifiedAt = new Date().toISOString();

    if (paid) {
      booking.amountRemaining = Math.max(0, Number(booking.price || 0) - paidAmount);
      addBookingNotification(
        db,
        booking,
        'payment_received',
        `💳 Payment received successfully (₦${paidAmount.toLocaleString()}). Your booking remains ${booking.status}.`
      );
    }

    writeDatabase(db);

    res.json({
      ok: true,
      paid,
      booking: {
        id: booking.id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        paymentPlan: booking.paymentPlan,
        amountDueNow: booking.amountDueNow,
        amountRemaining: booking.amountRemaining,
        paidAmount: booking.paidAmount,
        paymentReference: booking.paymentReference
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Track booking status + notifications (Customer)
app.get('/api/bookings/:id/track', (req, res) => {
  const bookingId = String(req.params.id || '').trim();
  const email = normalizeEmail(req.query.email);

  if (!bookingId || !email) {
    return res.status(400).json({ error: 'Booking id and email are required' });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => String(b.id) === bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (normalizeEmail(booking.email) !== email) {
    return res.status(401).json({ error: 'Email does not match this booking' });
  }

  const notifications = (db.bookingNotifications || [])
    .filter(n => String(n.bookingId) === bookingId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  res.json({
    booking: {
      id: booking.id,
      status: booking.status,
      serviceName: booking.serviceName,
      date: booking.date,
      time: booking.time,
      price: booking.price,
      paymentMethod: booking.paymentMethod,
      paymentPlan: booking.paymentPlan,
      amountDueNow: booking.amountDueNow,
      amountRemaining: booking.amountRemaining,
      paymentStatus: booking.paymentStatus,
      paymentProvider: booking.paymentProvider,
      paymentReference: booking.paymentReference,
      paidAmount: booking.paidAmount,
      bankTransferReference: booking.bankTransferReference,
      paymentReceiptFile: booking.paymentReceiptFile || null,
      paymentReceiptStatus: booking.paymentReceiptStatus || '',
      serviceMode: booking.serviceMode,
      homeServiceAddress: booking.homeServiceAddress
    },
    notifications
  });
});

// Upload bank transfer receipt (Customer)
app.post('/api/bookings/:id/upload-receipt', uploadReceipt.single('receipt'), (req, res) => {
  const bookingId = String(req.params.id || '').trim();
  const email = normalizeEmail(req.body.email);

  if (!bookingId || !email) {
    return res.status(400).json({ error: 'Booking id and email are required' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Receipt file is required' });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => String(b.id) === bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (normalizeEmail(booking.email) !== email) {
    return res.status(401).json({ error: 'Email does not match this booking' });
  }

  booking.paymentReceiptFile = `/uploads/${req.file.filename}`;
  booking.paymentReceiptUploadedAt = new Date().toISOString();
  booking.paymentReceiptStatus = 'submitted';

  if (booking.paymentStatus === 'pending' || booking.paymentStatus === 'initiated') {
    booking.paymentStatus = 'receipt_submitted';
  }

  addBookingNotification(
    db,
    booking,
    'receipt_uploaded',
    '📎 Payment receipt uploaded successfully. Our team will confirm your payment shortly.'
  );

  writeDatabase(db);

  res.status(201).json({
    message: 'Receipt uploaded successfully',
    receiptFile: booking.paymentReceiptFile,
    booking: {
      id: booking.id,
      paymentStatus: booking.paymentStatus,
      paymentReceiptStatus: booking.paymentReceiptStatus
    }
  });
});

// Get all bookings (Admin)
app.get('/api/admin/bookings', requireAdminAuth, (req, res) => {
  const db = readDatabase();
  res.json(db.bookings);
});

// Update booking status (Admin)
app.put('/api/admin/bookings/:id', requireAdminAuth, (req, res) => {
  const { status } = req.body;
  const bookingId = req.params.id;

  // Backward compatibility: map old status names to new ones
  const normalizedStatusMap = {
    accepted: 'approved',
    declined: 'cancelled'
  };
  const normalizedStatus = normalizedStatusMap[status] || status;

  if (!['pending', 'approved', 'cancelled', 'completed', 'accepted', 'declined'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const db = readDatabase();
  const booking = db.bookings.find(b => b.id === bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const previousStatus = booking.status;
  booking.status = normalizedStatus;
  booking.updatedAt = new Date().toISOString();

  if (previousStatus !== normalizedStatus && normalizedStatus === 'approved') {
    addBookingNotification(
      db,
      booking,
      'approved',
      '✅ Your booking has been approved! We will contact you shortly using the email and phone number you provided.'
    );
  }

  if (previousStatus !== normalizedStatus && normalizedStatus === 'cancelled') {
    addBookingNotification(
      db,
      booking,
      'cancelled',
      '❌ Your booking was cancelled. Please contact the salon if you believe this was a mistake.'
    );
  }

  writeDatabase(db);

  res.json({ message: 'Booking updated successfully', booking });
});

// Approve or disapprove booking image
app.put('/api/admin/bookings/:id/approve-image', requireAdminAuth, (req, res) => {
  const { approved } = req.body;
  const bookingId = req.params.id;

  const db = readDatabase();
  const booking = db.bookings.find(b => b.id === bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (!booking.styleImage) {
    return res.status(400).json({ error: 'No image to approve' });
  }

  booking.imageApproved = approved === true || approved === 'true';
  booking.imageApprovedAt = new Date().toISOString();
  writeDatabase(db);

  res.json({ message: 'Image approval updated successfully', booking });
});

// Send message
app.post('/api/messages', upload.single('reportFile'), (req, res) => {
  const { name, email, subject, message, reportType } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = readDatabase();
  const msg = {
    id: uuidv4(),
    name,
    email,
    subject,
    message,
    reportType: reportType || 'general_message',
    reportFile: req.file ? `/uploads/${req.file.filename}` : null,
    status: 'unread',
    createdAt: new Date().toISOString()
  };

  db.messages.push(msg);
  writeDatabase(db);

  res.status(201).json({ message: 'Message sent successfully', data: msg });
});

// Get all messages (Admin)
app.get('/api/admin/messages', requireAdminAuth, (req, res) => {
  const db = readDatabase();
  res.json(db.messages);
});

// Update message status (Admin)
app.put('/api/admin/messages/:id', requireAdminAuth, (req, res) => {
  const { status } = req.body;
  const messageId = req.params.id;

  const db = readDatabase();
  const msg = db.messages.find(m => m.id === messageId);

  if (!msg) {
    return res.status(404).json({ error: 'Message not found' });
  }

  msg.status = status;
  msg.updatedAt = new Date().toISOString();
  writeDatabase(db);

  res.json({ message: 'Message updated successfully', data: msg });
});

// Delete message (Admin)
app.delete('/api/admin/messages/:id', requireAdminAuth, (req, res) => {
  const messageId = req.params.id;
  const db = readDatabase();
  db.messages = db.messages.filter(m => m.id !== messageId);
  writeDatabase(db);

  res.json({ message: 'Message deleted successfully' });
});

// Delete booking (Admin)
app.delete('/api/admin/bookings/:id', requireAdminAuth, (req, res) => {
  const bookingId = req.params.id;
  const db = readDatabase();
  db.bookings = db.bookings.filter(b => b.id !== bookingId);
  writeDatabase(db);

  res.json({ message: 'Booking deleted successfully' });
});

// Admin Authentication Routes

// Request one-time admin login access code (requires secret passcode)
app.post('/api/admin/request-login-access', (req, res) => {
  const { email, secretPasscode } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedSecretPasscode = String(secretPasscode || '').trim();

  if (!normalizedEmail || !normalizedSecretPasscode) {
    return res.status(400).json({ error: 'Email and secret passcode are required' });
  }

  const db = readDatabase();

  if (db.admins.length === 0) {
    return res.status(400).json({ error: 'No admin account configured yet' });
  }

  const admin = db.admins.find(a => normalizeEmail(a.email) === normalizedEmail);

  if (!admin) {
    return res.status(401).json({ error: 'Admin account not found for this email' });
  }

  if (normalizedSecretPasscode !== ADMIN_SECRET_PASSCODE) {
    return res.status(401).json({ error: 'Invalid secret passcode' });
  }

  const now = Date.now();

  // Cleanup stale/used codes
  db.adminAccessCodes = db.adminAccessCodes.filter(code => {
    const isExpired = new Date(code.expiresAt).getTime() <= now;
    return !isExpired && !code.used;
  });

  const accessCode = generateOneTimeCode();
  const accessCodeRecord = {
    id: uuidv4(),
    email: admin.email,
    code: accessCode,
    used: false,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ONE_TIME_CODE_TTL_MS).toISOString()
  };

  db.adminAccessCodes.push(accessCodeRecord);
  writeDatabase(db);

  res.json({
    message: 'One-time access code generated successfully',
    accessCode,
    expiresInMinutes: 10
  });
});

// Admin registration status
app.get('/api/admin/registration-status', (req, res) => {
  const db = readDatabase();
  const registrationOpen = db.admins.length === 0;

  res.json({
    registrationOpen,
    message: registrationOpen
      ? 'Admin registration is open for initial setup'
      : 'Admin registration is closed. Contact the existing admin for access.'
  });
});

// Admin Registration
app.post('/api/admin/register', (req, res) => {
  const { email, password, name, secretPasscode } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || '').trim();
  const normalizedName = String(name || '').trim();
  const normalizedSecretPasscode = String(secretPasscode || '').trim();

  if (!normalizedEmail || !normalizedPassword || !normalizedName || !normalizedSecretPasscode) {
    return res.status(400).json({ error: 'Name, email, password, and secret passcode are required' });
  }

  const db = readDatabase();

  // Only one admin can ever self-register
  if (db.admins.length > 0) {
    return res.status(403).json({
      error: 'Admin registration is closed. Contact the existing admin for consent.'
    });
  }

  if (normalizedSecretPasscode !== ADMIN_SECRET_PASSCODE) {
    return res.status(401).json({ error: 'Invalid secret passcode for admin registration' });
  }
  
  // Check if admin already exists
  if (db.admins.some(a => normalizeEmail(a.email) === normalizedEmail)) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const newAdmin = {
    id: require('uuid').v4(),
    email: normalizedEmail,
    password: normalizedPassword,
    name: normalizedName,
    createdAt: new Date().toISOString()
  };

  db.admins.push(newAdmin);
  writeDatabase(db);

  res.status(201).json({ 
    message: 'Admin registered successfully',
    admin: { id: newAdmin.id, email: newAdmin.email, name: newAdmin.name }
  });
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { email, password, oneTimeCode, secretPasscode } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || '').trim();
  const normalizedOneTimeCode = String(oneTimeCode || '').trim();
  const normalizedSecretPasscode = String(secretPasscode || '').trim();

  if (!normalizedEmail || !normalizedPassword) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = readDatabase();
  const admin = db.admins.find(a => {
    const adminEmail = normalizeEmail(a.email);
    const adminPassword = String(a.password || '').trim();
    return adminEmail === normalizedEmail && adminPassword === normalizedPassword;
  });

  if (db.admins.length === 0) {
    return res.status(401).json({ error: 'No admin account found. Complete initial admin setup first.' });
  }

  if (!admin) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const usedSecretPasscodeForLogin = normalizedSecretPasscode === ADMIN_SECRET_PASSCODE;

  if (!usedSecretPasscodeForLogin && !normalizedOneTimeCode) {
    return res.status(400).json({
      error: 'Provide either a valid secret passcode or a one-time access code'
    });
  }

  if (!usedSecretPasscodeForLogin && normalizedSecretPasscode && normalizedSecretPasscode !== ADMIN_SECRET_PASSCODE) {
    return res.status(401).json({ error: 'Invalid secret passcode' });
  }

  if (usedSecretPasscodeForLogin) {
    return res.json({ 
      message: 'Login successful',
      admin: { 
        id: admin.id, 
        email: admin.email, 
        name: admin.name 
      },
      token: Buffer.from(`${admin.email}:${admin.id}`).toString('base64')
    });
  }

  const now = Date.now();
  const validAccessCode = db.adminAccessCodes.find(code => {
    return (
      normalizeEmail(code.email) === normalizeEmail(admin.email) &&
      String(code.code || '').trim() === normalizedOneTimeCode &&
      code.used !== true &&
      new Date(code.expiresAt).getTime() > now
    );
  });

  if (!validAccessCode) {
    return res.status(401).json({ error: 'Invalid or expired one-time access code' });
  }

  validAccessCode.used = true;
  validAccessCode.usedAt = new Date().toISOString();

  // Cleanup stale/used codes to keep DB tidy
  db.adminAccessCodes = db.adminAccessCodes.filter(code => {
    const isExpired = new Date(code.expiresAt).getTime() <= now;
    return !isExpired && !code.used;
  });
  writeDatabase(db);

  res.json({ 
    message: 'Login successful',
    admin: { 
      id: admin.id, 
      email: admin.email, 
      name: admin.name 
    },
    token: Buffer.from(`${admin.email}:${admin.id}`).toString('base64')
  });
});

// Verify Admin
app.post('/api/admin/verify', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const db = readDatabase();
    const admin = validateAdminToken(token, db);

    if (db.admins.length === 0) {
      return res.status(401).json({ error: 'No admin configured' });
    }

    if (!admin) {
      return res.status(401).json({ error: 'Admin not found' });
    }

    res.json({ 
      valid: true, 
      admin: { 
        id: admin.id, 
        email: admin.email, 
        name: admin.name 
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.listen(PORT, () => {
  console.log(`CEO UNISEX SALON Server running at http://localhost:${PORT}`);
});
