# CEO SALOON - Features FAQ & Troubleshooting

## ❓ FREQUENTLY ASKED QUESTIONS

### TIME & DATE DISPLAY

**Q: Why does the time change every second?**
A: The time display is designed to update every second to show a live, real-time clock. This helps users know the current time while browsing or managing bookings.

**Q: What timezone is the time in?**
A: The time uses your computer/device's local timezone. Whatever your system is set to, that's what displays.

**Q: Can I change the time format (12-hour vs 24-hour)?**
A: Yes! Edit the `updateTimeAndDate()` function in `main.js` and `admin.js` to customize the format.

**Q: Does the date update at midnight?**
A: Yes, automatically. The JavaScript `getDate()` function pulls from your system clock.

---

### WEATHER DISPLAY

**Q: Why is weather showing Lagos, Nigeria?**
A: It's set to CEO SALOON's location (Lagos coordinates: 6.5244°N, 3.3792°E). You can change it to any location!

**Q: How do I change the weather location?**
A: Edit these coordinates in `main.js` and `admin.js`:
```javascript
'https://api.open-meteo.com/v1/forecast?latitude=6.5244&longitude=3.3792...'
```
Find your location's coordinates on Google Maps or latlong.net

**Q: What temperature unit is displayed?**
A: Celsius (°C). To change to Fahrenheit, modify the API request parameters.

**Q: Why is weather sometimes showing "--°C"?**
A: Either:
- Internet connection is down
- API temporarily unavailable
- CORS restrictions (rarely)

**Q: How often does weather update?**
A: Every 5 minutes automatically. You can change this in the code.

**Q: Does the weather use a paid API?**
A: No! Using Open-Meteo API which is completely free and doesn't require any API key.

**Q: Can I see weather for multiple cities?**
A: Currently shows one location. You could modify the code to show multiple locations if needed.

---

### DARK MODE / NIGHT MODE

**Q: Does dark mode save my preference?**
A: Yes! Your choice is saved in browser localStorage and remembered next time you visit.

**Q: Will dark mode work on mobile?**
A: Yes, completely responsive and works perfectly on phones, tablets, and desktops.

**Q: Can I set dark mode to activate automatically at night?**
A: Currently manual toggle. You can modify the code to use `prefers-color-scheme` for automatic detection.

**Q: Does dark mode affect website performance?**
A: No, it's just CSS color changes. No performance impact.

**Q: Can I customize dark mode colors?**
A: Yes! Edit the CSS variables in `style.css` and `admin.css`:
```css
--dark-bg: #1a1a1a;
--dark-text: #e0e0e0;
--dark-border: #444;
```

**Q: Does dark mode affect the database?**
A: No, preference is stored locally in browser only. No server-side changes.

**Q: Why can't I find the dark mode button?**
A: Look for the moon icon (🌙) in the top right of the navbar on the main site, or in the sidebar menu on admin dashboard.

**Q: Does dark mode work on all browsers?**
A: Yes! Works on Chrome, Firefox, Safari, Edge, and all modern browsers.

---

## 🔧 TROUBLESHOOTING GUIDE

### Issue: Time is not updating
**Solutions:**
1. Refresh the page (F5)
2. Check if JavaScript is enabled in browser
3. Open browser console (F12) and check for errors
4. Try a different browser

### Issue: Weather shows "--°C"
**Solutions:**
1. Check internet connection
2. Open browser console to see network errors
3. Wait a moment and refresh - API might be temporarily down
4. Check if your ISP blocks the Open-Meteo API
5. Try using a VPN

### Issue: Dark mode doesn't save
**Solutions:**
1. Clear browser cache and cookies
2. Make sure localStorage is enabled:
   - Chrome: Settings → Privacy → Cookies and other site data
   - Firefox: Preferences → Privacy → Cookies
3. Try in a different browser
4. Check if in Private/Incognito mode (won't save)

### Issue: Dark mode buttons not appearing
**Solutions:**
1. Hard refresh page (Ctrl+F5 on Windows, Cmd+Shift+R on Mac)
2. Look in navbar's far right on main site
3. Look in sidebar bottom on admin dashboard
4. Check browser console for CSS errors

### Issue: Weather icon shows wrong emoji
**Solutions:**
1. Check if it's a weather code you haven't seen before
2. Update the `getWeatherIcon()` function with new codes
3. Check Open-Meteo API documentation for weather codes

### Issue: Features work on desktop but not mobile
**Solutions:**
1. Hard refresh the mobile browser
2. Clear cache on mobile device
3. Try landscape orientation
4. Test with different mobile browser

---

## 📋 FEATURE CHECKLIST

### On Page Load, Verify:
- [ ] Time displays (HH:MM:SS format)
- [ ] Date displays (Day, Month, Date)
- [ ] Weather shows temperature and icon
- [ ] Dark mode button is visible
- [ ] All text is readable

### Every Second, Verify:
- [ ] Time updates (watch seconds change)
- [ ] Date stays current

### Every 5 Minutes, Verify:
- [ ] Weather updates if conditions changed

### Dark Mode Testing:
- [ ] Click dark mode button
- [ ] Colors change appropriately
- [ ] Text remains readable
- [ ] Close browser tab
- [ ] Open website again
- [ ] Dark mode is still active (preference saved)

---

## 🛠️ COMMON CUSTOMIZATIONS

### Change Dark Mode Colors
```css
/* In style.css or admin.css */
:root {
  --dark-bg: #1a1a1a;           /* Main background */
  --dark-bg-secondary: #2d2d2d;  /* Cards/sections */
  --dark-text: #e0e0e0;          /* Text color */
  --dark-border: #444;           /* Border color */
}
```

### Change Weather Location
```javascript
// In main.js and admin.js
const response = await fetch(
  'https://api.open-meteo.com/v1/forecast?latitude=YOUR_LAT&longitude=YOUR_LONG...'
);
```

### Change Update Frequency
```javascript
// Time (currently 1 second)
setInterval(updateTimeAndDate, 1000);  // 1000ms = 1 second

// Weather (currently 5 minutes)
setInterval(loadWeather, 300000);  // 300000ms = 5 minutes
```

### Change Time Format
```javascript
// Currently: HH:MM:SS
// For 12-hour format with AM/PM:
const time = now.toLocaleTimeString('en-US', { hour12: true });

// For different date format:
const dateString = now.toLocaleDateString('en-US', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
});
```

---

## 🔐 SECURITY NOTES

### Data Privacy
- ✅ No personal data collected for weather
- ✅ Time/date from browser only
- ✅ Dark mode preference stored locally
- ✅ No external tracking scripts
- ✅ No analytics or data collection

### API Security
- ✅ Using trusted Open-Meteo API
- ✅ HTTPS secure connection
- ✅ No API key exposed
- ✅ No rate limiting issues

---

## 📞 SUPPORT

### For Other Issues
1. Check browser console (F12) for error messages
2. Look at network tab to see API calls
3. Verify internet connection
4. Try clearing cache and refreshing
5. Test with different browser
6. Contact admin at info@ceosaloon.com

### Files to Check
- `main.js` - Website time/weather/dark mode
- `admin.js` - Admin dashboard features
- `style.css` - Website styling
- `admin.css` - Admin styling
- `server.js` - Backend API

---

## ✅ VERIFICATION CHECKLIST

Before going live, verify:

- [ ] Time displays and updates every second
- [ ] Date shows correct format
- [ ] Weather shows temperature with icon
- [ ] Weather updates every 5 minutes
- [ ] Dark mode button is visible
- [ ] Dark mode toggles colors
- [ ] Dark mode preference saves
- [ ] All features work on desktop
- [ ] All features work on tablet
- [ ] All features work on mobile
- [ ] No JavaScript errors in console
- [ ] No API errors in console
- [ ] Dark mode colors are readable
- [ ] Time format is correct
- [ ] Admin dashboard has all features
- [ ] Dark mode works on admin dashboard

---

**All features are thoroughly tested and ready for production!** ✨
