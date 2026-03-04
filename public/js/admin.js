// CEO SALOON - Admin Dashboard JavaScript

const API_URL = '/api/admin';

let currentBookingId = null;
let currentMessageId = null;

function ensureToastContainer() {
  let container = document.querySelector('.toast-container');
  if (container) return container;

  container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

function showToast({ title, message, type = 'info', timeoutMs = 3500 }) {
  const container = ensureToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };

  toast.innerHTML = `
    <div class="toast-icon">${iconMap[type] || iconMap.info}</div>
    <div class="toast-body">
      <div class="toast-title">${String(title || '').trim() || 'Notice'}</div>
      <div class="toast-text">${String(message || '').trim() || ''}</div>
    </div>
  `;

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
  };

  toast.addEventListener('click', remove);
  container.appendChild(toast);

  if (timeoutMs > 0) {
    setTimeout(remove, timeoutMs);
  }
}

function getStoredAdminToken() {
  return localStorage.getItem('adminToken');
}

async function adminFetch(endpoint, options = {}) {
  const token = getStoredAdminToken();

  if (!token) {
    throw new Error('Admin authentication token is missing');
  }

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminName');
    window.location.href = '/';
    throw new Error('Unauthorized admin access');
  }

  return response;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Check for welcome message
  if (localStorage.getItem('adminWelcome') === 'true') {
    localStorage.removeItem('adminWelcome');
    showWelcomeMessage();
  }

  // Check authentication first
  const isAuthenticated = await checkAdminAuthentication();
  if (!isAuthenticated) {
    window.location.href = '/';
    return;
  }

  setupMenuListeners();
  loadBookings();
  setupFilterListeners();
  setupProductListeners();
  initializeClockAndWeather();
  initializeDarkMode();
});

// Check Admin Authentication
async function checkAdminAuthentication() {
  const token = localStorage.getItem('adminToken');
  
  if (!token) {
    return false;
  }
  
  try {
    const response = await fetch(`${API_URL}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });
    
    if (!response.ok) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminName');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Authentication check failed:', error);
    return false;
  }
}

// Logout Admin
function logoutAdmin() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminName');
    showLogoutMessage();
    setTimeout(() => {
      window.location.href = '/';
    }, 2500);
  }
}

// Initialize Clock and Weather
function initializeClockAndWeather() {
  // Update time and date
  updateAdminTimeAndDate();
  setInterval(updateAdminTimeAndDate, 1000);
  
  // Load weather
  loadAdminWeather();
  setInterval(loadAdminWeather, 300000); // Update every 5 minutes
}

// Update Admin Time and Date
function updateAdminTimeAndDate() {
  const now = new Date();
  
  // Time
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('adminTimeDisplay').textContent = `${hours}:${minutes}:${seconds}`;
  
  // Date
  const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  const dateString = now.toLocaleDateString('en-US', options);
  document.getElementById('adminDateDisplay').textContent = dateString;
}

// Load Admin Weather
async function loadAdminWeather() {
  try {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=6.5244&longitude=3.3792&current=temperature_2m,weather_code'
    );
    const data = await response.json();
    
    if (data.current) {
      const temp = Math.round(data.current.temperature_2m);
      const weatherCode = data.current.weather_code;
      const weatherIcon = getWeatherIcon(weatherCode);
      
      document.getElementById('adminWeatherIcon').textContent = weatherIcon;
      document.getElementById('adminWeatherInfo').textContent = `${temp}°C`;
    }
  } catch (error) {
    console.error('Weather loading error:', error);
    document.getElementById('adminWeatherIcon').textContent = '🌤️';
    document.getElementById('adminWeatherInfo').textContent = 'N/A';
  }
}

// Get Weather Icon based on Weather Code
function getWeatherIcon(code) {
  if (code === 0) return '☀️'; // Clear
  if (code === 1 || code === 2) return '⛅'; // Partly cloudy
  if (code === 3) return '☁️'; // Cloudy
  if (code === 45 || code === 48) return '🌫️'; // Foggy
  if (code >= 51 && code <= 67) return '🌧️'; // Drizzle/Rain
  if (code >= 71 && code <= 86) return '❄️'; // Snow
  if (code >= 80 && code <= 82) return '🌧️'; // Rain showers
  if (code === 85 || code === 86) return '🌨️'; // Snow showers
  if (code === 95 || code === 96 || code === 99) return '⛈️'; // Thunderstorm
  return '🌤️'; // Default
}

// Initialize Dark Mode
function initializeDarkMode() {
  const darkModeBtn = document.getElementById('adminDarkModeToggle');
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    darkModeBtn.innerHTML = '<span class="icon">☀️</span> Light Mode';
  }
  
  darkModeBtn.addEventListener('click', toggleAdminDarkMode);
}

// Toggle Admin Dark Mode
function toggleAdminDarkMode() {
  const darkModeBtn = document.getElementById('adminDarkModeToggle');
  const isDarkMode = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDarkMode);
  darkModeBtn.innerHTML = isDarkMode 
    ? '<span class="icon">☀️</span> Light Mode' 
    : '<span class="icon">🌙</span> Dark Mode';
}

// Setup Menu Listeners
function setupMenuListeners() {
  const menuItems = document.querySelectorAll('.menu-item');
  
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active class from all items
      menuItems.forEach(i => i.classList.remove('active'));
      
      // Add active class to clicked item
      item.classList.add('active');
      
      const tab = item.getAttribute('data-tab');
      if (tab) {
        showTab(tab);
      }
    });
  });
}

// Show Tab
function showTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Show selected tab
  const tabElement = document.getElementById(tabName + 'Tab');
  if (tabElement) {
    tabElement.classList.add('active');
  }
  
  // Update page title
  const titleMap = {
    'bookings': 'Bookings Management',
    'messages': 'Messages Management',
    'images': 'Style Images - Approval Report',
    'reports': 'Customer Service Reports',
    'products': 'Products Management',
    'productOrders': 'Product Orders Management'
  };
  document.getElementById('pageTitle').textContent = titleMap[tabName] || 'Dashboard';
  
  // Load content
  if (tabName === 'bookings') {
    loadBookings();
  } else if (tabName === 'messages') {
    loadMessages();
  } else if (tabName === 'images') {
    loadStyleImages();
  } else if (tabName === 'reports') {
    loadServiceReports();
  } else if (tabName === 'products') {
    loadProducts();
  } else if (tabName === 'productOrders') {
    loadProductOrders();
  }
}

function setupProductListeners() {
  const productForm = document.getElementById('productForm');
  if (!productForm) return;

  productForm.addEventListener('submit', handleProductSubmit);
}

async function handleProductSubmit(e) {
  e.preventDefault();

  const formData = new FormData();
  formData.append('name', document.getElementById('productName').value.trim());
  formData.append('category', document.getElementById('productCategory').value.trim());
  formData.append('price', document.getElementById('productPrice').value);
  formData.append('stock', document.getElementById('productStock').value);

  const imageFile = document.getElementById('productImage').files[0];
  if (imageFile) {
    formData.append('productImage', imageFile);
  }

  try {
    const response = await adminFetch('/products', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      showProductFormMessage(result.error || 'Failed to add product', 'error');
      return;
    }

    showProductFormMessage('Product added successfully', 'success');
    document.getElementById('productForm').reset();
    loadProducts();
  } catch (error) {
    console.error('Error adding product:', error);
    showProductFormMessage('Error adding product', 'error');
  }
}

function showProductFormMessage(message, type) {
  const messageEl = document.getElementById('productFormMessage');
  if (!messageEl) return;

  messageEl.textContent = message;
  messageEl.className = `message ${type}`;

  setTimeout(() => {
    messageEl.textContent = '';
    messageEl.className = 'message';
  }, 4000);
}

async function loadProducts() {
  try {
    const response = await adminFetch('/products');
    const products = await response.json();
    displayProducts(products);
  } catch (error) {
    console.error('Error loading products:', error);
    const list = document.getElementById('productsList');
    if (list) {
      list.innerHTML = '<div class="loading">Error loading products</div>';
    }
  }
}

function displayProducts(products) {
  const container = document.getElementById('productsList');
  if (!container) return;

  container.innerHTML = '';

  if (!Array.isArray(products) || products.length === 0) {
    container.innerHTML = '<div class="loading">No products found</div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'products-grid';

  products.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card-admin';

    const imageMarkup = product.image
      ? `<img src="${product.image}" alt="${product.name}" class="product-image-admin">`
      : '<div class="product-image-placeholder">No image</div>';

    card.innerHTML = `
      <div class="product-image-wrap">${imageMarkup}</div>
      <div class="product-content-admin">
        <h4>${product.name}</h4>
        <p><strong>Category:</strong> ${product.category}</p>
        <p><strong>Price:</strong> ₦${Number(product.price || 0).toLocaleString()}</p>
        <p><strong>Stock:</strong> ${product.stock}</p>
      </div>
      <div class="product-actions-admin">
        <label class="btn btn-accept upload-label" for="replace-image-${product.id}">Replace Image</label>
        <input type="file" id="replace-image-${product.id}" class="replace-image-input" accept="image/*" onchange="replaceProductImage('${product.id}', this)">
        <button class="btn btn-decline" onclick="deleteProduct('${product.id}')">Delete</button>
      </div>
    `;

    grid.appendChild(card);
  });

  container.appendChild(grid);
}

async function replaceProductImage(productId, input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('productImage', file);

  try {
    const response = await adminFetch(`/products/${productId}/image`, {
      method: 'PUT',
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || 'Failed to update product image');
      return;
    }

    loadProducts();
  } catch (error) {
    console.error('Error updating product image:', error);
    alert('Error updating product image');
  }
}

async function deleteProduct(productId) {
  if (!confirm('Are you sure you want to delete this product?')) {
    return;
  }

  try {
    const response = await adminFetch(`/products/${productId}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || 'Failed to delete product');
      return;
    }

    loadProducts();
  } catch (error) {
    console.error('Error deleting product:', error);
    alert('Error deleting product');
  }
}

// Setup Filter Listeners
function setupFilterListeners() {
  document.getElementById('statusFilter').addEventListener('change', () => {
    loadBookings();
  });
  
  document.getElementById('messageFilter').addEventListener('change', () => {
    loadMessages();
  });
  
  document.getElementById('imageFilter').addEventListener('change', () => {
    loadStyleImages();
  });
  
  document.getElementById('reportFilter').addEventListener('change', () => {
    loadServiceReports();
  });
}

// Load Bookings
async function loadBookings() {
  try {
    const response = await adminFetch('/bookings');
    const bookings = await response.json();
    
    // Apply status filter
    const filter = document.getElementById('statusFilter').value;
    const filtered = filter
      ? bookings.filter(b => normalizeBookingStatus(b.status) === filter)
      : bookings;
    
    displayBookings(filtered);
    updateStats(bookings);
  } catch (error) {
    console.error('Error loading bookings:', error);
    document.getElementById('bookingsList').innerHTML = '<div class="loading">Error loading bookings</div>';
  }
}

// Display Bookings
function displayBookings(bookings) {
  const container = document.getElementById('bookingsList');
  container.innerHTML = '';
  
  if (bookings.length === 0) {
    container.innerHTML = '<div class="loading">No bookings found</div>';
    return;
  }
  
  bookings.forEach(booking => {
    const normalizedStatus = normalizeBookingStatus(booking.status);
    const statusLabel = getStatusLabel(normalizedStatus);

    const isPending = normalizedStatus === 'pending';
    const isApproved = normalizedStatus === 'approved';
    const isCancelled = normalizedStatus === 'cancelled';
    const isCompleted = normalizedStatus === 'completed';
    const canRetryNotify = isApproved || isCancelled;
    const retryStatus = isApproved ? 'approved' : (isCancelled ? 'cancelled' : '');

    const approveDisabled = isApproved || isCancelled || isCompleted;
    const rejectDisabled = isApproved || isCancelled || isCompleted;

    const card = document.createElement('div');
    card.className = 'booking-card product-order-card';
    const requestedProducts = Array.isArray(booking.requestedProducts) ? booking.requestedProducts : [];
    const requestedProductsSummary = requestedProducts.length
      ? requestedProducts.map(item => `${item.name} × ${item.quantity}`).join(', ')
      : 'None';
    card.innerHTML = `
      <div class="booking-header">
        <h4>${booking.name}</h4>
        <span class="status-badge status-${normalizedStatus}">${statusLabel}</span>
      </div>
      <div class="booking-info">
        <div class="booking-field">
          <label>Service</label>
          <strong>${booking.serviceName}</strong>
        </div>
        <div class="booking-field">
          <label>Date & Time</label>
          <strong>${formatDate(booking.date)} at ${booking.time}</strong>
        </div>
        <div class="booking-field">
          <label>Price</label>
          <strong>₦${booking.price.toLocaleString()}</strong>
        </div>
        <div class="booking-field">
          <label>Contact</label>
          <strong>${booking.email}<br>${booking.phone}</strong>
        </div>
        <div class="booking-field">
          <label>Store Products</label>
          <strong>${requestedProductsSummary}</strong>
        </div>
      </div>
      <div class="booking-actions">
        <button class="btn btn-accept" ${approveDisabled ? 'disabled' : ''} onclick="updateBookingStatus('${booking.id}', 'accepted')">✓ Accept</button>
        <button class="btn btn-decline" ${rejectDisabled ? 'disabled' : ''} onclick="updateBookingStatus('${booking.id}', 'declined')">✗ Decline</button>
        <button class="btn btn-info" ${canRetryNotify ? '' : 'disabled'} onclick="retryBookingNotifications('${booking.id}', '${retryStatus}')">🔔 Retry Notify</button>
        <button class="btn btn-accept" onclick="openBookingModal('${booking.id}')">View Details</button>
        <button class="btn btn-decline" onclick="deleteBooking('${booking.id}')">Delete</button>
      </div>
      ${booking.styleImage ? `
        <div class="booking-field" style="margin-top:10px;">
          <label>Style Image</label>
          <div><a href="${booking.styleImage}" target="_blank" rel="noopener">🖼️ View uploaded style image</a></div>
        </div>
      ` : ''}
    `;
    container.appendChild(card);
  });
}

// Load Messages
async function loadMessages() {
  try {
    const response = await adminFetch('/messages');
    const messages = await response.json();
    
    // Apply filter
    const filter = document.getElementById('messageFilter').value;
    const filtered = filter ? messages.filter(m => m.status === filter) : messages;
    
    displayMessages(filtered);
    updateMessageCount(messages);
  } catch (error) {
    console.error('Error loading messages:', error);
    document.getElementById('messagesList').innerHTML = '<div class="loading">Error loading messages</div>';
  }
}

// Display Messages
function displayMessages(messages) {
  const container = document.getElementById('messagesList');
  container.innerHTML = '';
  
  if (messages.length === 0) {
    container.innerHTML = '<div class="loading">No messages found</div>';
    return;
  }
  
  messages.forEach(message => {
    const card = document.createElement('div');
    card.className = 'message-card';
    card.innerHTML = `
      <div class="message-header">
        <h4>${message.subject}</h4>
        <span class="status-badge status-${message.status}">${message.status}</span>
      </div>
      <div class="booking-info">
        <div class="booking-field">
          <label>From</label>
          <strong>${message.name}<br>${message.email}</strong>
        </div>
        <div class="booking-field">
          <label>Date</label>
          <strong>${formatDate(message.createdAt.split('T')[0])}</strong>
        </div>
        <div class="booking-field">
          <label>Message</label>
          <strong>${truncateText(message.message, 100)}</strong>
        </div>
      </div>
      <div class="message-actions">
        <button class="btn btn-accept" onclick="openMessageModal('${message.id}')">View Full</button>
        <button class="btn btn-decline" onclick="deleteMessage('${message.id}')">Delete</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// Open Booking Modal
async function openBookingModal(bookingId) {
  currentBookingId = bookingId;
  
  try {
    const response = await adminFetch('/bookings');
    const bookings = await response.json();
    const booking = bookings.find(b => b.id === bookingId);
    
    if (booking) {
      const requestedProducts = Array.isArray(booking.requestedProducts) ? booking.requestedProducts : [];
      const requestedProductsHtml = requestedProducts.length
        ? `<ul class="product-order-items">${requestedProducts.map(item => `<li>${item.name} × ${item.quantity} — ₦${Number(item.lineTotal || 0).toLocaleString()}</li>`).join('')}</ul>`
        : 'None';
      const modalBody = document.getElementById('modalBody');
      modalBody.innerHTML = `
        <div>
          <label>Customer Name</label>
          <div class="value">${booking.name}</div>
          
          <label>Email</label>
          <div class="value">${booking.email}</div>
          
          <label>Phone</label>
          <div class="value">${booking.phone}</div>
          
          <label>Service</label>
          <div class="value">${booking.serviceName}</div>
          
          <label>Date</label>
          <div class="value">${formatDate(booking.date)}</div>
          
          <label>Time</label>
          <div class="value">${booking.time}</div>
          
          <label>Price</label>
          <div class="value">₦${booking.price.toLocaleString()}</div>

          <label>Preferred Language</label>
          <div class="value">${booking.language || 'Not specified'}</div>

          <label>Payment Method</label>
          <div class="value">${booking.paymentMethod || 'Not specified'}</div>

          <label>Payment Plan</label>
          <div class="value">${booking.paymentPlan === 'deposit_50' ? '50% Deposit' : (booking.paymentPlan === 'full' ? 'Full Payment' : (booking.paymentPlan || 'Not specified'))}</div>

          <label>Amount Due Now</label>
          <div class="value">₦${Number(booking.amountDueNow || 0).toLocaleString()}</div>

          <label>Amount Remaining</label>
          <div class="value">₦${Number(booking.amountRemaining || 0).toLocaleString()}</div>

          <label>Payment Status</label>
          <div class="value">${booking.paymentStatus || 'pending'}</div>

          <label>Receipt Status</label>
          <div class="value">${booking.paymentReceiptStatus || 'N/A'}</div>

          <label>Payment Receipt</label>
          <div class="value">${booking.paymentReceiptFile ? `<a href="${booking.paymentReceiptFile}" target="_blank" rel="noopener">📎 View Receipt</a>` : 'No receipt uploaded'}</div>

          <label>Service Mode</label>
          <div class="value">${booking.serviceMode === 'home' ? 'Home Service' : 'In Salon'}</div>

          <label>Home Service Address</label>
          <div class="value">${booking.homeServiceAddress || 'N/A'}</div>

          <label>Refreshment</label>
          <div class="value">${booking.refreshment || 'Not specified'}</div>

          <label>Special Requests</label>
          <div class="value">${booking.specialRequests || 'None'}</div>

          <label>Store Products Requested</label>
          <div class="value">${requestedProductsHtml}</div>

          <label>Requested Products Total</label>
          <div class="value">₦${Number(booking.requestedProductsTotal || 0).toLocaleString()}</div>

          <label>Style Image</label>
          <div class="value">${booking.styleImage ? `<a href="${booking.styleImage}" target="_blank" rel="noopener">🖼️ View uploaded style image</a>` : 'No style image uploaded'}</div>

          <label>Current Status</label>
          <div class="value" style="text-transform: uppercase; color: var(--primary-color);">${getStatusLabel(normalizeBookingStatus(booking.status))}</div>
        </div>
      `;
      
      document.getElementById('bookingModal').classList.add('show');
      
      // Setup action buttons
      const normalizedStatus = normalizeBookingStatus(booking.status);
      const isApproved = normalizedStatus === 'approved';
      const isCancelled = normalizedStatus === 'cancelled';
      const isCompleted = normalizedStatus === 'completed';

      const acceptBtn = document.getElementById('acceptBtn');
      const declineBtn = document.getElementById('declineBtn');
      const retryNotifyBtn = document.getElementById('retryNotifyBtn');

      if (acceptBtn) {
        acceptBtn.disabled = isApproved || isCancelled || isCompleted;
        acceptBtn.onclick = () => updateBookingStatus(bookingId, 'accepted');
      }

      if (declineBtn) {
        declineBtn.disabled = isApproved || isCancelled || isCompleted;
        declineBtn.onclick = () => updateBookingStatus(bookingId, 'declined');
      }

      if (retryNotifyBtn) {
        const canRetryNotify = isApproved || isCancelled;
        const retryStatus = isApproved ? 'approved' : (isCancelled ? 'cancelled' : '');
        retryNotifyBtn.disabled = !canRetryNotify;
        retryNotifyBtn.onclick = () => retryBookingNotifications(bookingId, retryStatus, { skipCloseModal: true });
      }
    }
  } catch (error) {
    console.error('Error opening booking modal:', error);
  }
}

function formatNotificationResult(label, result) {
  if (!result) return `${label}: unknown`;
  if (result.sent === true) return `${label}: sent ✅`;
  if (result.skipped === true) return `${label}: skipped (${result.reason || 'n/a'})`;
  if (result.error === true) return `${label}: error (${result.reason || 'failed'})`;
  return `${label}: not sent`;
}

function buildNotificationSummary(notifications) {
  const emailRes = notifications && notifications.email ? notifications.email : null;
  const smsRes = notifications && notifications.sms ? notifications.sms : null;
  const adminEmailRes = notifications && notifications.adminEmail ? notifications.adminEmail : null;

  return `${formatNotificationResult('Customer Email', emailRes)} • ${formatNotificationResult('SMS', smsRes)} • ${formatNotificationResult('Admin Email', adminEmailRes)}`;
}

// Update Booking Status
async function updateBookingStatus(bookingId, status, options = {}) {
  try {
    const response = await adminFetch(`/bookings/${bookingId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      showToast({
        type: 'error',
        title: 'Booking update failed',
        message: (result && result.error) ? result.error : 'Unable to update booking status.'
      });
      return;
    }

    const normalized = normalizeBookingStatus(status);
    const actionLabel = normalized === 'approved'
      ? 'accepted'
      : (normalized === 'cancelled' ? 'declined' : 'updated');

    const statusChanged = Boolean(result && result.statusChanged === true);
    const currentStatus = normalizeBookingStatus((result && result.currentStatus) || normalized);

    const notif = result && result.notifications ? result.notifications : null;

    const shouldShowNotify = ['approved', 'cancelled'].includes(normalized);
    const notifySummary = shouldShowNotify
      ? buildNotificationSummary(notif)
      : '';

    if (statusChanged) {
      showToast({
        type: 'success',
        title: 'Booking updated',
        message: `Booking ${actionLabel} successfully.${notifySummary ? `\n${notifySummary}` : ''}`
      });
    } else {
      const currentLabel = currentStatus === 'approved'
        ? 'already accepted'
        : currentStatus === 'cancelled'
          ? 'already declined'
          : `already ${currentStatus}`;

      showToast({
        type: 'info',
        title: 'No status change',
        message: `This booking is ${currentLabel}.`
      });
    }

    if (!options.skipCloseModal) {
      closeBookingModal();
    }

    if (!options.skipReload) {
      loadBookings();
    }
  } catch (error) {
    console.error('Error updating booking:', error);

    showToast({
      type: 'error',
      title: 'Network error',
      message: 'Could not update booking. Please try again.'
    });
  }
}

async function retryBookingNotifications(bookingId, status, options = {}) {
  const normalizedStatus = normalizeBookingStatus(status);

  if (!['approved', 'cancelled'].includes(normalizedStatus)) {
    showToast({
      type: 'info',
      title: 'Retry unavailable',
      message: 'Only approved or declined bookings can retry notifications.'
    });
    return;
  }

  try {
    const response = await adminFetch(`/bookings/${bookingId}/test-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: normalizedStatus })
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      showToast({
        type: 'error',
        title: 'Retry failed',
        message: (result && result.error) ? result.error : 'Unable to retry notifications.'
      });
      return;
    }

    const notifySummary = buildNotificationSummary(result && result.notifications ? result.notifications : null);
    showToast({
      type: 'success',
      title: 'Notification retry completed',
      message: `${normalizedStatus === 'approved' ? 'Approved' : 'Declined'} booking notification retried.\n${notifySummary}`
    });

    if (!options.skipCloseModal) {
      closeBookingModal();
    }

    if (!options.skipReload) {
      loadBookings();
    }
  } catch (error) {
    console.error('Error retrying booking notification:', error);
    showToast({
      type: 'error',
      title: 'Network error',
      message: 'Could not retry notifications. Please try again.'
    });
  }
}

// Delete Booking
async function deleteBooking(bookingId) {
  if (confirm('Are you sure you want to delete this booking?')) {
    try {
      const response = await adminFetch(`/bookings/${bookingId}`, {
        method: 'DELETE'
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        showToast({
          type: 'error',
          title: 'Delete failed',
          message: (result && result.error) ? result.error : 'Unable to delete booking.'
        });
        return;
      }

      showToast({ type: 'success', title: 'Deleted', message: 'Booking deleted successfully.' });
      loadBookings();
    } catch (error) {
      console.error('Error deleting booking:', error);

      showToast({
        type: 'error',
        title: 'Network error',
        message: 'Could not delete booking. Please try again.'
      });
    }
  }
}

// Close Booking Modal
function closeBookingModal() {
  document.getElementById('bookingModal').classList.remove('show');
  currentBookingId = null;
}

// Open Message Modal
async function openMessageModal(messageId) {
  currentMessageId = messageId;
  
  try {
    const response = await adminFetch('/messages');
    const messages = await response.json();
    const message = messages.find(m => m.id === messageId);
    
    if (message) {
      const modalBody = document.getElementById('messageModalBody');
      const replies = Array.isArray(message.replies) ? message.replies : [];
      const repliesHtml = replies.length
        ? `
          <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color);">
            <label>Previous Replies</label>
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${replies.slice(-5).reverse().map(r => `
                <div style="padding:10px; border:1px solid var(--border-color); border-radius:8px; background: rgba(0,0,0,0.02);">
                  <div style="font-size:12px; opacity:0.85;"><strong>${(r.admin && r.admin.name) ? r.admin.name : 'Admin'}</strong> • ${new Date(r.sentAt).toLocaleString()}</div>
                  <div style="font-weight:700; margin-top:4px;">${String(r.subject || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
                  <div style="white-space: pre-wrap; margin-top:6px;">${String(r.message || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `
        : '';

      modalBody.innerHTML = `
        <div>
          <label>From</label>
          <div class="value">${message.name}</div>
          
          <label>Email</label>
          <div class="value">${message.email}</div>
          
          <label>Subject</label>
          <div class="value">${message.subject}</div>
          
          <label>Date</label>
          <div class="value">${formatDate(message.createdAt.split('T')[0])}</div>
          
          <label>Message</label>
          <div class="value" style="white-space: pre-wrap; line-height: 1.6;">${message.message}</div>
          
          <label>Status</label>
          <div class="value" style="text-transform: uppercase; color: var(--primary-color);">${message.status}</div>

          <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color);">
            <label>Reply via Email</label>
            <div class="value" style="margin-bottom: 10px;">Replying to: <strong>${message.email}</strong></div>
            <input id="replySubject" type="text" placeholder="Subject" value="Re: ${String(message.subject || '').replace(/"/g,'&quot;')}" style="width:100%; margin-bottom: 10px; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px;">
            <textarea id="replyMessage" placeholder="Type your reply..." style="width:100%; min-height: 120px; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px;"></textarea>
            <div style="display:flex; gap:10px; margin-top: 10px;">
              <button class="btn btn-accept" id="sendReplyBtn">Send Reply</button>
            </div>
          </div>

          ${repliesHtml}
        </div>
      `;
      
      // Mark as read
      await updateMessageStatus(messageId, 'read');
      
      document.getElementById('messageModal').classList.add('show');
      
      // Setup delete button
      document.getElementById('deleteMessageBtn').onclick = () => deleteMessage(messageId);

      const sendBtn = document.getElementById('sendReplyBtn');
      if (sendBtn) {
        sendBtn.onclick = () => sendMessageReplyEmail(messageId);
      }
    }
  } catch (error) {
    console.error('Error opening message modal:', error);
  }
}

async function sendMessageReplyEmail(messageId) {
  const subjectEl = document.getElementById('replySubject');
  const messageEl = document.getElementById('replyMessage');
  const sendBtn = document.getElementById('sendReplyBtn');

  const subject = subjectEl ? String(subjectEl.value || '').trim() : '';
  const message = messageEl ? String(messageEl.value || '').trim() : '';

  if (!subject || !message) {
    showToast({ type: 'error', title: 'Missing fields', message: 'Please enter a subject and reply message.' });
    return;
  }

  if (sendBtn) sendBtn.disabled = true;

  try {
    const response = await adminFetch(`/messages/${messageId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, message })
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      showToast({
        type: 'error',
        title: 'Reply failed',
        message: (result && result.error) ? result.error : 'Unable to send reply email.'
      });
      return;
    }

    showToast({ type: 'success', title: 'Reply sent', message: `Email sent to ${result.to || 'customer'}.` });
    // Reload messages so reply history shows
    closeMessageModal();
    loadMessages();
  } catch (error) {
    console.error('Error sending reply:', error);
    showToast({ type: 'error', title: 'Network error', message: 'Could not send reply. Please try again.' });
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

// Update Message Status
async function updateMessageStatus(messageId, status) {
  try {
    await adminFetch(`/messages/${messageId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
  } catch (error) {
    console.error('Error updating message status:', error);
  }
}

// Delete Message
async function deleteMessage(messageId) {
  if (confirm('Are you sure you want to delete this message?')) {
    try {
      const response = await adminFetch(`/messages/${messageId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        closeMessageModal();
        loadMessages();
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }
}

// Close Message Modal
function closeMessageModal() {
  document.getElementById('messageModal').classList.remove('show');
  currentMessageId = null;
}

// Load Style Images
async function loadStyleImages() {
  try {
    const response = await adminFetch('/bookings');
    const bookings = await response.json();
    
    // Filter bookings with images
    const bookingsWithImages = bookings.filter(b => b.styleImage);
    
    // Apply filter
    const filter = document.getElementById('imageFilter').value;
    let filtered = bookingsWithImages;
    
    if (filter === 'pending') {
      filtered = bookingsWithImages.filter(b => b.imageApproved === false);
    } else if (filter === 'approved') {
      filtered = bookingsWithImages.filter(b => b.imageApproved === true);
    }
    
    displayStyleImages(filtered);
  } catch (error) {
    console.error('Error loading style images:', error);
    document.getElementById('imagesList').innerHTML = '<div class="loading">Error loading images</div>';
  }
}

// Display Style Images
function displayStyleImages(bookings) {
  const container = document.getElementById('imagesList');
  container.innerHTML = '';
  
  if (bookings.length === 0) {
    container.innerHTML = '<div class="loading">No style images found</div>';
    return;
  }
  
  const grid = document.createElement('div');
  grid.className = 'images-grid';

  const getImageApprovalStatus = (booking) => {
    const explicit = String(booking.imageApprovalStatus || '').trim().toLowerCase();
    if (['pending', 'approved', 'rejected'].includes(explicit)) return explicit;
    if (booking.imageApproved === true) return 'approved';
    // Older data uses imageApprovedAt for both approve/reject; if set but not approved, treat as rejected.
    if (booking.imageApprovedAt) return 'rejected';
    return 'pending';
  };

  const getBookingStatus = (booking) => normalizeBookingStatus(booking.status);
  
  bookings.forEach(booking => {
    const card = document.createElement('div');
    card.className = 'image-card';

    const imageStatus = getImageApprovalStatus(booking);
    const statusBadge = imageStatus === 'approved'
      ? '<span class="status-badge status-approved">✓ Approved</span>'
      : imageStatus === 'rejected'
        ? '<span class="status-badge status-rejected">✗ Rejected</span>'
        : '<span class="status-badge status-pending">⏳ Pending</span>';

    const bookingStatus = getBookingStatus(booking);
    const bookingStatusBadge = bookingStatus === 'approved'
      ? '<span class="status-badge status-approved">✓ Service Approved</span>'
      : bookingStatus === 'cancelled'
        ? '<span class="status-badge status-cancelled">✗ Service Declined</span>'
        : '<span class="status-badge status-pending">⏳ Service Pending</span>';

    const canChangeService = !['completed'].includes(bookingStatus);
    const approveServiceDisabled = !canChangeService || bookingStatus === 'approved';
    const declineServiceDisabled = !canChangeService || bookingStatus === 'cancelled';

    const approveImageDisabled = imageStatus === 'approved';
    const rejectImageDisabled = imageStatus === 'rejected';
    
    card.innerHTML = `
      <div class="image-preview">
        <img src="${booking.styleImage}" alt="Style reference for ${booking.name}">
      </div>
      <div class="image-info">
        <div class="info-row">
          <label>Customer</label>
          <strong>${booking.name}</strong>
        </div>
        <div class="info-row">
          <label>Service</label>
          <strong>${booking.serviceName}</strong>
        </div>
        <div class="info-row">
          <label>Email</label>
          <strong>${booking.email}</strong>
        </div>
        <div class="info-row">
          <label>Phone</label>
          <strong>${booking.phone}</strong>
        </div>
        <div class="info-row">
          <label>Date</label>
          <strong>${formatDate(booking.date)}</strong>
        </div>
        <div class="status-row">
          ${statusBadge}
        </div>
        <div class="status-row">
          ${bookingStatusBadge}
        </div>
      </div>
        <div class="image-actions">
          <button class="btn btn-accept" data-action="image-approve" data-booking-id="${booking.id}" ${approveImageDisabled ? 'disabled' : ''}>✓ Approve Image</button>
          <button class="btn btn-decline" data-action="image-reject" data-booking-id="${booking.id}" ${rejectImageDisabled ? 'disabled' : ''}>✗ Reject Image</button>
        </div>
        <div class="image-actions image-actions-secondary">
          <button class="btn btn-accept" data-action="service-approve" data-booking-id="${booking.id}" ${approveServiceDisabled ? 'disabled' : ''}>✓ Approve Service</button>
          <button class="btn btn-decline" data-action="service-decline" data-booking-id="${booking.id}" ${declineServiceDisabled ? 'disabled' : ''}>✗ Decline Service</button>
        </div>
    `;
    
    grid.appendChild(card);
  });
  
  container.appendChild(grid);

  // Event delegation: reliable clicks even after re-render.
  grid.addEventListener('click', async (event) => {
    const button = event.target && event.target.closest ? event.target.closest('button[data-action]') : null;
    if (!button) return;
    if (button.disabled) return;

    const bookingId = String(button.getAttribute('data-booking-id') || '').trim();
    const action = String(button.getAttribute('data-action') || '').trim();
    if (!bookingId || !action) return;

    const setBusy = (busy) => {
      const parent = button.parentElement;
      const allButtons = parent ? parent.querySelectorAll('button') : [];
      allButtons.forEach(b => {
        if (busy) {
          b.dataset.prevDisabled = String(b.disabled);
          b.disabled = true;
        } else {
          if (b.dataset.prevDisabled === 'true') b.disabled = true;
          else b.disabled = false;
          delete b.dataset.prevDisabled;
        }
      });
    };

    try {
      setBusy(true);

      if (action === 'image-approve') {
        await approveStyleImage(bookingId, true, { silentReload: true });
        showToast({ type: 'success', title: 'Image approved', message: 'Style reference image approved.' });
      } else if (action === 'image-reject') {
        await approveStyleImage(bookingId, false, { silentReload: true });
        showToast({ type: 'success', title: 'Image rejected', message: 'Style reference image rejected.' });
      } else if (action === 'service-approve') {
        await updateBookingStatus(bookingId, 'accepted', { skipCloseModal: true, skipReload: true });
        await loadStyleImages();
      } else if (action === 'service-decline') {
        await updateBookingStatus(bookingId, 'declined', { skipCloseModal: true, skipReload: true });
        await loadStyleImages();
      }
    } finally {
      setBusy(false);
    }
  });
}

// Approve or Disapprove Style Image
async function approveStyleImage(bookingId, approved, options = {}) {
  try {
    const response = await adminFetch(`/bookings/${bookingId}/approve-image`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ approved })
    });

    const result = await response.json().catch(() => null);
    
    if (response.ok) {
      if (!options.silentReload) {
        showToast({
          type: 'success',
          title: approved ? 'Approved' : 'Rejected',
          message: approved ? 'Image approved successfully.' : 'Image rejected successfully.'
        });
      }
      await loadStyleImages();
    } else {
      showToast({
        type: 'error',
        title: 'Update failed',
        message: (result && result.error) ? result.error : 'Error updating image approval status.'
      });
    }
  } catch (error) {
    console.error('Error approving image:', error);
    showToast({ type: 'error', title: 'Network error', message: 'Could not update image approval. Please try again.' });
  }
}

// Load Service Reports
async function loadServiceReports() {
  try {
    const response = await adminFetch('/messages');
    const messages = await response.json();
    
    // Filter messages with report types or files
    const reports = messages.filter(m => m.reportType && m.reportType !== 'general_message');
    
    // Apply filter
    const filter = document.getElementById('reportFilter').value;
    let filtered = messages;
    
    if (filter) {
      filtered = messages.filter(m => m.reportType === filter || (filter === 'general_message' && !m.reportType));
    }
    
    displayServiceReports(filtered);
  } catch (error) {
    console.error('Error loading service reports:', error);
    document.getElementById('reportsList').innerHTML = '<div class="loading">Error loading reports</div>';
  }
}

// Display Service Reports
function displayServiceReports(messages) {
  const container = document.getElementById('reportsList');
  container.innerHTML = '';
  
  if (messages.length === 0) {
    container.innerHTML = '<div class="loading">No service reports found</div>';
    return;
  }
  
  const grid = document.createElement('div');
  grid.className = 'reports-grid';
  
  messages.forEach(msg => {
    const card = document.createElement('div');
    card.className = 'report-card';
    
    const reportTypeMap = {
      'service_feedback': '😊 Service Feedback',
      'complaint': '⚠️ Complaint',
      'suggestion': '💡 Suggestion',
      'experience': '✨ Experience',
      'general_message': '📧 General Message'
    };
    
    const reportType = reportTypeMap[msg.reportType] || msg.reportType;
    const fileSection = msg.reportFile ? `
      <div class="report-file">
        <a href="${msg.reportFile}" target="_blank" class="file-link">
          📎 View Attached File
        </a>
      </div>
    ` : '';
    
    card.innerHTML = `
      <div class="report-header">
        <div>
          <h4>${msg.subject}</h4>
          <small>${reportType}</small>
        </div>
        <span class="report-date">${new Date(msg.createdAt).toLocaleDateString()}</span>
      </div>
      
      <div class="report-info">
        <div class="info-item">
          <label>From</label>
          <strong>${msg.name}</strong>
        </div>
        <div class="info-item">
          <label>Email</label>
          <strong>${msg.email}</strong>
        </div>
      </div>
      
      <div class="report-message">
        <p>${msg.message.substring(0, 150)}${msg.message.length > 150 ? '...' : ''}</p>
      </div>
      
      ${fileSection}
      
      <div class="report-actions">
        <button class="btn btn-view" onclick="viewReportDetails('${msg.id}')">View Details</button>
        <button class="btn btn-delete" onclick="deleteReport('${msg.id}')">Delete</button>
      </div>
    `;
    
    grid.appendChild(card);
  });
  
  container.appendChild(grid);
}

// View Report Details
async function viewReportDetails(messageId) {
  try {
    const response = await adminFetch('/messages');
    const messages = await response.json();
    const msg = messages.find(m => m.id === messageId);
    
    if (msg) {
      const replies = Array.isArray(msg.replies) ? msg.replies : [];
      const reportTypeMap = {
        'service_feedback': '😊 Service Feedback',
        'complaint': '⚠️ Complaint',
        'suggestion': '💡 Suggestion',
        'experience': '✨ Experience',
        'general_message': '📧 General Message'
      };
      
      const fileSection = msg.reportFile ? `
        <div style="margin-top: 15px; padding: 10px; background: #f0f0f0; border-radius: 5px;">
          <strong>Attached File:</strong><br>
          <a href="${msg.reportFile}" target="_blank" class="file-link" style="color: var(--primary-color); text-decoration: underline;">
            📎 Download/View Attachment
          </a>
        </div>
      ` : '';
      
      const modalBody = document.getElementById('messageModalBody');
      modalBody.innerHTML = `
        <div>
          <label>Subject</label>
          <div class="value">${msg.subject}</div>
          
          <label>Report Type</label>
          <div class="value">${reportTypeMap[msg.reportType] || msg.reportType}</div>
          
          <label>From</label>
          <div class="value">${msg.name}</div>
          
          <label>Email</label>
          <div class="value">${msg.email}</div>
          
          <label>Message</label>
          <div class="value" style="white-space: pre-wrap; max-height: 300px; overflow-y: auto;">${msg.message}</div>
          
          ${fileSection}

          <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color);">
            <label>Reply via Email</label>
            <div class="value" style="margin-bottom: 10px;">Replying to: <strong>${msg.email}</strong></div>
            <input id="replySubject" type="text" placeholder="Subject" value="Re: ${String(msg.subject || '').replace(/"/g,'&quot;')}" style="width:100%; margin-bottom: 10px; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px;">
            <textarea id="replyMessage" placeholder="Type your reply..." style="width:100%; min-height: 120px; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px;"></textarea>
            <div style="display:flex; gap:10px; margin-top: 10px;">
              <button class="btn btn-accept" id="sendReplyBtn">Send Reply</button>
            </div>
          </div>

          ${replies.length ? `
            <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color);">
              <label>Previous Replies</label>
              <div style="display:flex; flex-direction:column; gap:10px;">
                ${replies.slice(-5).reverse().map(r => `
                  <div style="padding:10px; border:1px solid var(--border-color); border-radius:8px; background: rgba(0,0,0,0.02);">
                    <div style="font-size:12px; opacity:0.85;"><strong>${(r.admin && r.admin.name) ? r.admin.name : 'Admin'}</strong> • ${new Date(r.sentAt).toLocaleString()}</div>
                    <div style="font-weight:700; margin-top:4px;">${String(r.subject || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
                    <div style="white-space: pre-wrap; margin-top:6px;">${String(r.message || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <label>Submitted</label>
          <div class="value">${new Date(msg.createdAt).toLocaleString()}</div>
        </div>
      `;
      
      document.getElementById('messageModal').classList.add('show');
      document.getElementById('deleteMessageBtn').onclick = () => deleteReport(messageId);

      const sendBtn = document.getElementById('sendReplyBtn');
      if (sendBtn) {
        sendBtn.onclick = () => sendMessageReplyEmail(messageId);
      }
    }
  } catch (error) {
    console.error('Error loading report details:', error);
  }
}

// Delete Report
async function deleteReport(messageId) {
  if (confirm('Are you sure you want to delete this report?')) {
    try {
      const response = await adminFetch(`/messages/${messageId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        closeMessageModal();
        loadServiceReports();
      }
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  }
}

// Update Stats
async function updateStats(bookings) {
  const total = bookings.length;
  const pending = bookings.filter(b => normalizeBookingStatus(b.status) === 'pending').length;
  
  document.getElementById('totalBookings').textContent = total;
  document.getElementById('pendingBookings').textContent = pending;
}

// Update Message Count
async function updateMessageCount(messages) {
  const unread = messages.filter(m => m.status === 'unread').length;
  document.getElementById('unreadMessages').textContent = unread;
}

// Utility Functions
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function normalizeBookingStatus(status) {
  if (status === 'accepted') return 'approved';
  if (status === 'declined') return 'cancelled';
  return status;
}

function getStatusLabel(status) {
  const labels = {
    pending: '⏳ Pending',
    approved: '✓ Approved',
    processed: '🧾 Processed',
    shipped: '🚚 Shipped',
    cancelled: '✗ Declined',
    completed: '✓ Completed'
  };

  return labels[status] || status;
}

function truncateText(text, length) {
  if (text.length > length) {
    return text.substring(0, length) + '...';
  }
  return text;
}

// Product Orders (Admin)
async function loadProductOrders() {
  const container = document.getElementById('productOrdersList');
  if (!container) return;

  try {
    const response = await adminFetch('/product-orders');
    const orders = await response.json();
    displayProductOrders(Array.isArray(orders) ? orders : []);
  } catch (error) {
    console.error('Error loading product orders:', error);
    container.innerHTML = '<div class="loading">Error loading product orders</div>';
  }
}

function displayProductOrders(orders) {
  const container = document.getElementById('productOrdersList');
  if (!container) return;

  container.innerHTML = '';

  if (!orders.length) {
    container.innerHTML = '<div class="loading">No product orders found</div>';
    return;
  }

  orders.forEach(order => {
    const normalizedStatus = normalizeBookingStatus(order.status || 'pending');
    const statusLabel = getStatusLabel(normalizedStatus);
    const approveDisabled = normalizedStatus !== 'pending';
    const processDisabled = normalizedStatus !== 'approved';
    const shipDisabled = normalizedStatus !== 'processed';
    const completeDisabled = normalizedStatus !== 'shipped';
    const rejectDisabled = ['cancelled', 'completed'].includes(normalizedStatus);

    const itemsHtml = Array.isArray(order.items)
      ? order.items.map(i => `<li>${i.name} × ${i.quantity} — ₦${Number(i.lineTotal || 0).toLocaleString()}</li>`).join('')
      : '';

    const card = document.createElement('div');
    card.className = 'booking-card';
    card.innerHTML = `
      <div class="booking-header">
        <h4>${order.name}</h4>
        <span class="status-badge status-${normalizedStatus}">${statusLabel}</span>
      </div>
      <div class="booking-info">
        <div class="booking-field">
          <label>Order ID</label>
          <strong>${order.id}</strong>
        </div>
        <div class="booking-field">
          <label>Email / Phone</label>
          <strong>${order.email}<br>${order.phone}</strong>
        </div>
        <div class="booking-field">
          <label>Total</label>
          <strong>₦${Number(order.totalAmount || 0).toLocaleString()}</strong>
        </div>
        <div class="booking-field">
          <label>Payment</label>
          <strong>${order.paymentMethod || 'N/A'}<br>Status: ${order.paymentStatus || 'pending'}</strong>
        </div>
      </div>
      <div class="booking-field product-order-address" style="margin:10px 0;">
        <label>Items</label>
        <ul class="product-order-items">${itemsHtml || '<li>No items</li>'}</ul>
      </div>
      <div class="booking-field" style="margin-bottom:10px;">
        <label>Address</label>
        <strong>${order.address || 'N/A'}</strong>
      </div>
      <div class="booking-actions">
        <button class="btn btn-accept" ${approveDisabled ? 'disabled' : ''} onclick="updateProductOrderStatus('${order.id}', 'approved')">✓ Approve</button>
        <button class="btn btn-info" ${processDisabled ? 'disabled' : ''} onclick="updateProductOrderStatus('${order.id}', 'processed')">🧾 Processed</button>
        <button class="btn btn-info" ${shipDisabled ? 'disabled' : ''} onclick="updateProductOrderStatus('${order.id}', 'shipped')">🚚 Shipped</button>
        <button class="btn btn-accept" ${completeDisabled ? 'disabled' : ''} onclick="updateProductOrderStatus('${order.id}', 'completed')">🎉 Complete</button>
        <button class="btn btn-decline" ${rejectDisabled ? 'disabled' : ''} onclick="updateProductOrderStatus('${order.id}', 'cancelled')">✗ Reject</button>
        <button class="btn btn-decline" onclick="deleteProductOrder('${order.id}')">Delete</button>
      </div>
    `;

    container.appendChild(card);
  });
}

async function updateProductOrderStatus(orderId, status) {
  try {
    const response = await adminFetch(`/product-orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      showToast({
        type: 'error',
        title: 'Update failed',
        message: (result && result.error) ? result.error : 'Could not update product order status.'
      });
      return;
    }

    showToast({ type: 'success', title: 'Updated', message: 'Product order updated successfully.' });
    loadProductOrders();
  } catch (error) {
    console.error('Error updating product order:', error);
    showToast({ type: 'error', title: 'Network error', message: 'Could not update product order.' });
  }
}

async function deleteProductOrder(orderId) {
  if (!confirm('Are you sure you want to delete this product order?')) return;

  try {
    const response = await adminFetch(`/product-orders/${orderId}`, {
      method: 'DELETE'
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      showToast({
        type: 'error',
        title: 'Delete failed',
        message: (result && result.error) ? result.error : 'Could not delete product order.'
      });
      return;
    }

    showToast({ type: 'success', title: 'Deleted', message: 'Product order deleted successfully.' });
    loadProductOrders();
  } catch (error) {
    console.error('Error deleting product order:', error);
    showToast({ type: 'error', title: 'Network error', message: 'Could not delete product order.' });
  }
}

// Show Welcome Message
function showWelcomeMessage() {
  const welcomeDiv = document.createElement('div');
  welcomeDiv.id = 'welcomeMessage';
  welcomeDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #ff1493, #4a0e4e, #ffd700);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fadeIn 0.5s ease-in;
  `;

  welcomeDiv.innerHTML = `
    <div style="
      background: rgba(255, 255, 255, 0.95);
      padding: 40px;
      border-radius: 20px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 90%;
    ">
      <h1 style="
        color: #ff1493;
        font-size: 2.5em;
        margin-bottom: 20px;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
      ">🎉 Welcome Back!</h1>
      <p style="
        color: #4a0e4e;
        font-size: 1.2em;
        margin-bottom: 30px;
        line-height: 1.6;
      ">You have successfully logged into the CEO UNISEX SALON Admin Dashboard.</p>
      <div style="
        width: 50px;
        height: 50px;
        border: 4px solid #ff1493;
        border-top: 4px solid transparent;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto;
      "></div>
    </div>
  `;

  document.body.appendChild(welcomeDiv);

  setTimeout(() => {
    welcomeDiv.style.animation = 'fadeOut 0.5s ease-out';
    setTimeout(() => {
      if (welcomeDiv.parentNode) {
        welcomeDiv.parentNode.removeChild(welcomeDiv);
      }
    }, 500);
  }, 2500);
}

// Show Logout Message
function showLogoutMessage() {
  const logoutDiv = document.createElement('div');
  logoutDiv.id = 'logoutMessage';
  logoutDiv.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #ff1493, #4a0e4e, #ffd700);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fadeIn 0.5s ease-in;
  `;

  logoutDiv.innerHTML = `
    <div style="
      background: rgba(255, 255, 255, 0.95);
      padding: 40px;
      border-radius: 20px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 90%;
    ">
      <h1 style="
        color: #ff1493;
        font-size: 2.5em;
        margin-bottom: 20px;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
      ">👋 Goodbye!</h1>
      <p style="
        color: #4a0e4e;
        font-size: 1.2em;
        margin-bottom: 30px;
        line-height: 1.6;
      ">You have been successfully logged out of the CEO UNISEX SALON Admin Dashboard.</p>
      <p style="
        color: #666;
        font-size: 0.9em;
      ">Redirecting to homepage...</p>
    </div>
  `;

  document.body.appendChild(logoutDiv);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);
