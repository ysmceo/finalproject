# CEO SALOON - Professional Salon Booking System

A modern, professional salon website with customer booking system and admin dashboard built with Node.js, Express, and vanilla JavaScript.

## Features

### Customer Website
- Professional hero section showcasing the salon
- Complete service catalog with Naira (₦) pricing
- Online appointment booking system
- Beautiful gallery section
- Team member profiles
- Contact form for inquiries
- Responsive design for all devices

### Admin Dashboard
- View all customer bookings
- Accept or decline booking requests
- Track booking status (Pending, Accepted, Declined, Completed)
- View and manage customer messages
- Mark messages as read
- Filter bookings and messages
- Real-time statistics and counters
- Delete bookings and messages

## Services Offered

All prices are in Nigerian Naira (₦):

- Hair Cut - ₦5,000 (30 minutes)
- Hair Coloring - ₦15,000 (60 minutes)
- Facial Treatment - ₦8,000 (45 minutes)
- Manicure - ₦4,000 (30 minutes)
- Pedicure - ₦5,000 (40 minutes)
- Hair Spa - ₦12,000 (60 minutes)
- Beard Trim - ₦3,000 (20 minutes)
- Full Body Massage - ₦18,000 (60 minutes)
- Wig Revamping - ₦15,000 (1 day)

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

### Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. The server will run on `http://localhost:3000`

4. Access the website:
   - Customer site: http://localhost:3000
   - Admin Dashboard: http://localhost:3000/admin.html

## Runtime Data Store Modes (JSON vs Prisma)

This project supports a staged migration strategy from `database.json` to Prisma/SQLite.

- `DATABASE_URL` enables Prisma connectivity (example: `file:./dev.db`).
- `DATA_STORE_MODE=json` → read/write using JSON only (Prisma disabled for runtime reads).
- `DATA_STORE_MODE=auto` → Prisma-primary read path with safe JSON fallback (recommended).
- `DATA_STORE_MODE=prisma` → force Prisma-primary read path.

### Recommended production setting

- Set `DATABASE_URL` and use `DATA_STORE_MODE=auto`.
- Keep JSON file present as fallback safety during rollout.

### Prisma maintenance commands

- `npm run prisma:generate` → regenerate Prisma client.
- `npm run prisma:push` → sync schema to SQLite database.
- `npm run prisma:sync-json` → import existing `database.json` records into Prisma.

## Vercel Deployment (Production)

This repository is prepared for Vercel serverless deployment using:

- `api/index.js` (serverless entrypoint)
- `vercel.json` (route config)

### Important production notes

- Do **not** rely on local file persistence in Vercel.
- `database.json` writes are not durable in serverless runtime.
- `public/uploads` local file uploads are not durable.
- For production, use a hosted database via `DATABASE_URL` (recommended: Postgres/Neon/Supabase).
- For uploads, use external object storage (for example Cloudinary or S3).

### Required Vercel environment variables

Set these in your Vercel Project → Settings → Environment Variables:

- `PUBLIC_BASE_URL` = your Vercel domain (for example `https://your-app.vercel.app`)
- `DATABASE_URL`
- `DATA_STORE_MODE=auto`
- `ADMIN_SECRET_PASSCODE`
- `INVOICE_ACCESS_TOKEN_SECRET`

Set payment/email variables as needed (`PAYSTACK_*`, `STRIPE_*`, `MONNIFY_*`, `SMTP_*`, etc.).

### Deploy steps

1. Import GitHub repo into Vercel.
2. Configure environment variables.
3. Deploy to production.
4. Validate key endpoints:
     - `/api/services`
     - `/api/bookings/available-slots?date=YYYY-MM-DD`
     - `/api/payments/paystack/status`

## Project Structure

```
finalproject/
├── server.js                  # Express server with API endpoints
├── package.json              # Dependencies
├── database.json             # Stores bookings, messages, services
└── public/
    ├── index.html           # Customer website
    ├── admin.html           # Admin dashboard
    ├── css/
    │   ├── style.css        # Main website styles
    │   └── admin.css        # Admin dashboard styles
    └── js/
        ├── main.js          # Customer website functionality
        └── admin.js         # Admin dashboard functionality
```

## API Endpoints

### Services
- `GET /api/services` - Get all available services

### Bookings
- `POST /api/bookings` - Create a new booking
- `GET /api/admin/bookings` - Get all bookings (Admin)
- `PUT /api/admin/bookings/:id` - Update booking status (Admin)
- `DELETE /api/admin/bookings/:id` - Delete booking (Admin)

### Messages
- `POST /api/messages` - Send a message
- `GET /api/admin/messages` - Get all messages (Admin)
- `PUT /api/admin/messages/:id` - Update message status (Admin)
- `DELETE /api/admin/messages/:id` - Delete message (Admin)

## Technologies Used

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **CORS** - Cross-origin resource sharing
- **UUID** - Unique ID generation
- **File System** - JSON-based data persistence

### Frontend
- **HTML5** - Markup
- **CSS3** - Styling with gradients and animations
- **Vanilla JavaScript** - No dependencies, pure JS
- **Fetch API** - HTTP requests

## Security Notes

This is a demo application. For production use:
- Add proper authentication/authorization
- Implement password hashing
- Use a proper database (MongoDB, PostgreSQL, etc.)
- Add input validation and sanitization
- Use HTTPS
- Implement rate limiting
- Add CSRF protection

## Color Scheme

- **Primary**: #ff1493 (Deep Pink)
- **Secondary**: #4a0e4e (Deep Purple)
- **Accent**: #ffd700 (Gold)
- **Success**: #28a745 (Green)
- **Danger**: #dc3545 (Red)

## Contact Information

**CEO SALOON**
- Address: 123 Beauty Lane, Lagos, Nigeria
- Phone: 07036939125
- Email: okontaysm@gmail.com
- Hours: Monday-Friday 9AM-7PM, Saturday 10AM-6PM, Sunday Closed

## License

MIT License - feel free to use this project for your own salon business!

## Release Docs

- `CHANGELOG.md` — Chronological history of notable project changes.
- `RELEASE_NOTES_UI_POLISH_2026-03-05.md` — Latest UI/UX professional polish release summary.

## Support

For issues, questions, or suggestions, please contact [okontaysm@gmail.com](mailto:okontaysm@gmail.com)

---

Transform Your Look with CEO SALOON - Where Beauty Meets Excellence ✨
