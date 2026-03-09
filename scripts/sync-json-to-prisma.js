const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const dbPath = path.join(__dirname, '..', 'database.json');

function toDateOrNull(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeJson(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch (error) {
    return '{}';
  }
}

function readJsonDatabase() {
  if (!fs.existsSync(dbPath)) {
    throw new Error('database.json not found');
  }
  const raw = fs.readFileSync(dbPath, 'utf8');
  return JSON.parse(raw);
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function buildPayload(db) {
  return {
    bookings: arrayOf(db.bookings).map((item) => ({
      id: String(item.id || ''),
      trackingCode: item.trackingCode ? String(item.trackingCode) : null,
      email: item.email ? String(item.email).toLowerCase() : null,
      status: item.status ? String(item.status) : null,
      createdAt: toDateOrNull(item.createdAt),
      updatedAt: toDateOrNull(item.updatedAt),
      raw: safeJson(item)
    })).filter((item) => item.id),
    productOrders: arrayOf(db.productOrders).map((item) => ({
      id: String(item.id || ''),
      orderCode: item.orderCode ? String(item.orderCode) : null,
      email: item.email ? String(item.email).toLowerCase() : null,
      status: item.status ? String(item.status) : null,
      createdAt: toDateOrNull(item.createdAt),
      updatedAt: toDateOrNull(item.updatedAt),
      raw: safeJson(item)
    })).filter((item) => item.id),
    messages: arrayOf(db.messages).map((item) => ({
      id: String(item.id || ''),
      email: item.email ? String(item.email).toLowerCase() : null,
      status: item.status ? String(item.status) : null,
      createdAt: toDateOrNull(item.createdAt),
      raw: safeJson(item)
    })).filter((item) => item.id),
    admins: arrayOf(db.admins).map((item) => ({
      id: String(item.id || ''),
      email: item.email ? String(item.email).toLowerCase() : null,
      name: item.name ? String(item.name) : null,
      createdAt: toDateOrNull(item.createdAt),
      raw: safeJson(item)
    })).filter((item) => item.id),
    services: arrayOf(db.services).map((item) => ({
      id: Number(item.id),
      name: String(item.name || ''),
      price: Number(item.price || 0),
      duration: Number.isFinite(Number(item.duration)) ? Number(item.duration) : null,
      raw: safeJson(item)
    })).filter((item) => Number.isFinite(item.id)),
    products: arrayOf(db.products).map((item) => ({
      id: Number(item.id),
      name: String(item.name || ''),
      category: item.category ? String(item.category) : null,
      price: Number(item.price || 0),
      stock: Number.isFinite(Number(item.stock)) ? Number(item.stock) : null,
      image: item.image ? String(item.image) : null,
      updatedAt: toDateOrNull(item.updatedAt),
      raw: safeJson(item)
    })).filter((item) => Number.isFinite(item.id)),
    bookingNotifications: arrayOf(db.bookingNotifications).map((item) => ({
      id: String(item.id || ''),
      bookingId: item.bookingId ? String(item.bookingId) : null,
      email: item.email ? String(item.email).toLowerCase() : null,
      type: item.type ? String(item.type) : null,
      createdAt: toDateOrNull(item.createdAt),
      raw: safeJson(item)
    })).filter((item) => item.id),
    productOrderNotifications: arrayOf(db.productOrderNotifications).map((item) => ({
      id: String(item.id || ''),
      orderId: item.orderId ? String(item.orderId) : null,
      email: item.email ? String(item.email).toLowerCase() : null,
      type: item.type ? String(item.type) : null,
      createdAt: toDateOrNull(item.createdAt),
      raw: safeJson(item)
    })).filter((item) => item.id),
    settingsRaw: safeJson(db.settings || {})
  };
}

async function replaceTable(prisma, tableName, rows) {
  await prisma[tableName].deleteMany();
  if (rows.length) {
    await prisma[tableName].createMany({ data: rows });
  }
}

async function main() {
  const db = readJsonDatabase();
  const payload = buildPayload(db);
  const prisma = new PrismaClient();

  try {
    await prisma.$transaction(async (tx) => {
      await replaceTable(tx, 'bookingRecord', payload.bookings);
      await replaceTable(tx, 'productOrderRecord', payload.productOrders);
      await replaceTable(tx, 'messageRecord', payload.messages);
      await replaceTable(tx, 'adminRecord', payload.admins);
      await replaceTable(tx, 'serviceRecord', payload.services);
      await replaceTable(tx, 'productRecord', payload.products);
      await replaceTable(tx, 'bookingNotificationRecord', payload.bookingNotifications);
      await replaceTable(tx, 'productOrderNotificationRecord', payload.productOrderNotifications);

      await tx.appSetting.upsert({
        where: { id: 1 },
        update: { raw: payload.settingsRaw },
        create: { id: 1, raw: payload.settingsRaw }
      });
    });

    console.log('✅ JSON database synced to Prisma successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('❌ Failed to sync JSON database to Prisma:', error && error.message ? error.message : error);
  process.exit(1);
});
