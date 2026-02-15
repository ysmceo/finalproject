# Mobile App (Expo / React Native)

This repo includes a hybrid mobile app in the `mobile/` folder.

## What you get

- **Website tab**: loads the existing website in a **WebView**.
- **Book tab (native)**: calls your existing API:
  - `GET /api/services`
  - `POST /api/bookings`
  - (optional) Paystack/Monnify init endpoints to open checkout URLs
- **Track tab (native)**: calls your existing API:
  - `GET /api/bookings/:id/track?email=...`
  - `GET /api/payments/bank/details?...`
  - `POST /api/bookings/:id/upload-receipt` (receipt upload)

## Run it (development)

1. Start the web server (from repo root):
   - `node server.js`

2. Start the mobile app (from `mobile/`):
   - `npm start`

## Base URL configuration

The app defaults to trying to infer your dev machine IP (so emulators/devices can reach it).

You can override with env vars in `mobile/.env`:

- `EXPO_PUBLIC_WEB_BASE_URL`
- `EXPO_PUBLIC_API_BASE_URL`

Common values:

- **Android emulator**: `http://10.0.2.2:3000`
- **iOS simulator**: `http://localhost:3000`
- **Physical phone**: `http://<YOUR-LAN-IP>:3000`
