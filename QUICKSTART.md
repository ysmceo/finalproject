# CEO SALOON - Quick Start Guide

## How to Run the Application

### Option 1: Using Batch File (Windows)
1. Double-click `backend/start.bat` to start the backend
2. In a new terminal, run the React dev server:
   ```
   cd "c:\Users\Dell\Desktop\finalproject - Copy\frontend"
   npm run dev
   ```
3. Open your browser and visit: `http://localhost:5173`

### Option 2: Using Command Line
1. Open Command Prompt or PowerShell
2. Navigate to the project folder:
   ```
   cd "c:\Users\Dell\Desktop\finalproject - Copy\backend"
   ```
3. Start the server:
   ```
   npm start
   ```
4. Start the React dev server:
   ```
   cd "c:\Users\Dell\Desktop\finalproject - Copy\frontend"
   npm run dev
   ```
5. Open your browser and visit: `http://localhost:5173`

## Access the Application

### Customer Website
- **URL (dev)**: http://localhost:5173
- **Features**:
  - View all services with Naira pricing
  - Book appointments online
  - View gallery and team members
  - Send messages and contact inquiries

### Admin Dashboard
- **URL (dev)**: http://localhost:5173/admin
- **Features**:
  - View all booking requests
  - Accept or decline bookings
  - Track booking status
  - View customer messages
  - Delete bookings/messages

## Runtime Data Store Modes (JSON vs Prisma)

This project supports runtime datastore modes via `DATA_STORE_MODE`:

- `DATA_STORE_MODE=json` → read/write using JSON only.
- `DATA_STORE_MODE=auto` → Prisma-primary read path with safe JSON fallback (recommended).
- `DATA_STORE_MODE=prisma` → force Prisma-primary read path.

Recommended local/prod setup:

- Set `DATABASE_URL` and use `DATA_STORE_MODE=auto`.
- Keep JSON snapshots available for compatibility and fallback.

If needed, run Prisma maintenance commands:

- `npm run prisma:generate`
- `npm run prisma:push`
- `npm run prisma:sync-json`

## Sample Booking

To test the booking system:

1. Go to the home page
2. Scroll to "Book Your Appointment" section
3. Fill in your details:
   - Name: Your name
   - Email: your email
   - Phone: Your phone number
   - Service: Choose any service
   - Date: Select a future date
   - Time: Select a time
4. Click "Book Appointment"
5. Go to Admin Dashboard to see your booking

## Default Services & Prices (in Naira)

- Hair Cut: ₦5,000
- Hair Coloring: ₦15,000
- Facial Treatment: ₦8,000
- Manicure: ₦4,000
- Pedicure: ₦5,000
- Hair Spa: ₦12,000
- Beard Trim: ₦3,000
- Full Body Massage: ₦18,000
- Wig Revamping: ₦15,000

## Admin Booking Statuses

- **Pending**: New booking waiting for admin response
- **Accepted**: Admin has approved the booking
- **Declined**: Admin has rejected the booking
- **Completed**: Service has been completed

## Admin Message Statuses

- **Unread**: New message from customer
- **Read**: Admin has viewed the message

## Troubleshooting

### Port Already in Use
If port 3000 is already in use, modify `backend/server.js`:
- Change `const PORT = 3000;` to `const PORT = 3001;` (or any available port)
- Update URLs in `frontend/public/js/main.js` and `frontend/public/js/admin.js`

### CORS Errors
The application has CORS enabled for all origins. If you experience CORS issues:
- Check browser console for error messages
- Ensure the server is running
- Clear browser cache

### Data Not Persisting
Data is stored in `backend/database.json`. Delete this file to reset all bookings and messages.

## Features Overview

### Customer-Facing Website
✅ Modern, professional design
✅ Complete service listing with pricing in Naira
✅ Online booking system
✅ Contact form
✅ Team member profiles
✅ Service gallery
✅ Responsive for mobile, tablet, desktop
✅ Smooth navigation and animations

### Admin Dashboard
✅ Centralized booking management
✅ Accept/Decline booking requests
✅ View customer details
✅ Manage customer messages
✅ Real-time statistics
✅ Filter bookings by status
✅ Delete bookings/messages
✅ Professional interface

## Support

For questions or issues, please contact:
- Email: okontaysm@gmail.com
- Phone: 07036939125

---

Enjoy managing your salon with CEO SALOON! 💇‍♀️✨
