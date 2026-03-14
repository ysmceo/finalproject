const fs = require('fs');
const net = require('net');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const DB_PATH = path.join(ROOT, 'database.json');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed.startsWith('#')) return acc;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) return acc;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, '');
    acc[key] = value;
    return acc;
  }, {});
}

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(true);
      }
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function run() {
  const warnings = [];
  const infos = [];

  infos.push('▶ Running backend preflight checks...');

  if (!fs.existsSync(DB_PATH)) {
    warnings.push('database.json not found yet. It will be created on first start.');
  }

  if (!fs.existsSync(ENV_PATH)) {
    warnings.push('.env file not found in backend/. Using code defaults where available.');
  }

  const env = {
    ...readEnvFile(ENV_PATH),
    ...process.env
  };

  const requestedPort = Number(env.PORT || 3000);
  const preferredPorts = Array.from(new Set([
    requestedPort,
    3002,
    3001,
    3000
  ].filter((value) => Number.isFinite(value) && value > 0)));

  const availablePorts = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const port of preferredPorts) {
    // eslint-disable-next-line no-await-in-loop
    const free = await checkPortAvailable(port);
    if (free) availablePorts.push(port);
  }

  if (!availablePorts.length) {
    warnings.push(`Preferred ports are busy: ${preferredPorts.join(', ')}. Server may fail to start until a port is freed.`);
  } else {
    infos.push(`Port availability looks good. First free preferred port: ${availablePorts[0]}.`);
  }

  const requiredPackages = ['express', 'cors', 'multer', 'uuid', 'dotenv'];
  requiredPackages.forEach((pkg) => {
    try {
      require.resolve(pkg, { paths: [ROOT] });
    } catch (error) {
      warnings.push(`Missing package "${pkg}". Run: npm install --prefix backend`);
    }
  });

  infos.forEach((line) => console.log(line));
  warnings.forEach((line) => console.warn(`⚠ ${line}`));

  if (!warnings.length) {
    console.log('✅ Preflight checks passed. Starting server...');
  } else {
    console.log('ℹ Preflight finished with warnings. Startup will continue.');
  }
}

run().catch((error) => {
  console.error('❌ Preflight check failed unexpectedly:', error && error.message ? error.message : error);
  process.exit(1);
});
