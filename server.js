const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = 3000;
const ADMIN_SECRET_PASSCODE = process.env.ADMIN_SECRET_PASSCODE || 'CHANGE_ME_ADMIN_PASSCODE';
const ONE_TIME_CODE_TTL_MS = 10 * 60 * 1000;

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

// Middleware
app.use(cors());
app.use(bodyParser.json());
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
  if (!Array.isArray(db.admins)) db.admins = [];
  if (!Array.isArray(db.adminAccessCodes)) db.adminAccessCodes = [];

  return db;
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
  const { name, email, phone, serviceId, date, time, language, paymentMethod, refreshment, specialRequests } = req.body;

  if (!name || !email || !phone || !serviceId || !date || !time || !paymentMethod) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = readDatabase();
  const service = db.services.find(s => s.id === parseInt(serviceId));

  if (!service) {
    return res.status(400).json({ error: 'Service not found' });
  }

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
    refreshment: refreshment || 'No',
    specialRequests: specialRequests || '',
    styleImage: req.file ? `/uploads/${req.file.filename}` : null,
    imageApproved: false,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.bookings.push(booking);
  writeDatabase(db);

  res.status(201).json({
    message: 'Your service order has been made. A customer care representative will reach out to you via the email and phone number provided.',
    booking
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

  booking.status = normalizedStatus;
  booking.updatedAt = new Date().toISOString();
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
