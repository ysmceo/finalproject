# CEO SALOON - Quick Start Guide

## How to Run the Application

### Option 1: Using Batch File (Windows)
1. Double-click `start.bat` in the project folder
2. The server will start automatically
3. Open your browser and visit: `http://localhost:3000`

### Option 2: Using Command Line
1. Open Command Prompt or PowerShell
2. Navigate to the project folder:
   ```
   cd c:\Users\Dell\Desktop\finalproject
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open your browser and visit: `http://localhost:3000`

## Access the Application

### Customer Website
- **URL**: http://localhost:3000
- **Features**:
  - View all services with Naira pricing
  - Book appointments online
  - View gallery and team members
  - Send messages and contact inquiries

### Admin Dashboard
- **URL**: http://localhost:3000/admin.html
- **Features**:
  - View all booking requests
  - Accept or decline bookings
  - Track booking status
  - View customer messages
  - Delete bookings/messages

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
If port 3000 is already in use, modify `server.js`:
- Change `const PORT = 3000;` to `const PORT = 3001;` (or any available port)
- Update URLs in `public/js/main.js` and `public/js/admin.js`

### CORS Errors
The application has CORS enabled for all origins. If you experience CORS issues:
- Check browser console for error messages
- Ensure the server is running
- Clear browser cache

### Data Not Persisting
Data is stored in `database.json`. Delete this file to reset all bookings and messages.

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
- Email: info@ceosaloon.com
- Phone: +234 (0) 701 SALOON

---

Enjoy managing your salon with CEO SALOON! 💇‍♀️✨
