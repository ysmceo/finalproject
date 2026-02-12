// CEO SALOON - Admin Dashboard JavaScript

const API_URL = 'http://localhost:3000/api/admin';

let currentBookingId = null;
let currentMessageId = null;

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
    'reports': 'Customer Service Reports'
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

    const card = document.createElement('div');
    card.className = 'booking-card';
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
      </div>
      <div class="booking-actions">
        <button class="btn btn-accept" onclick="updateBookingStatus('${booking.id}', 'approved')">Approve</button>
        <button class="btn btn-decline" onclick="updateBookingStatus('${booking.id}', 'cancelled')">Cancel</button>
        <button class="btn btn-accept" onclick="openBookingModal('${booking.id}')">View Details</button>
        <button class="btn btn-decline" onclick="deleteBooking('${booking.id}')">Delete</button>
      </div>
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

          <label>Refreshment</label>
          <div class="value">${booking.refreshment || 'Not specified'}</div>

          <label>Special Requests</label>
          <div class="value">${booking.specialRequests || 'None'}</div>

          <label>Current Status</label>
          <div class="value" style="text-transform: uppercase; color: var(--primary-color);">${getStatusLabel(normalizeBookingStatus(booking.status))}</div>
        </div>
      `;
      
      document.getElementById('bookingModal').classList.add('show');
      
      // Setup action buttons
      document.getElementById('acceptBtn').onclick = () => updateBookingStatus(bookingId, 'approved');
      document.getElementById('declineBtn').onclick = () => updateBookingStatus(bookingId, 'cancelled');
    }
  } catch (error) {
    console.error('Error opening booking modal:', error);
  }
}

// Update Booking Status
async function updateBookingStatus(bookingId, status) {
  try {
    const response = await adminFetch(`/bookings/${bookingId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    
    if (response.ok) {
      closeBookingModal();
      loadBookings();
    }
  } catch (error) {
    console.error('Error updating booking:', error);
  }
}

// Delete Booking
async function deleteBooking(bookingId) {
  if (confirm('Are you sure you want to delete this booking?')) {
    try {
      const response = await adminFetch(`/bookings/${bookingId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        loadBookings();
      }
    } catch (error) {
      console.error('Error deleting booking:', error);
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
        </div>
      `;
      
      // Mark as read
      await updateMessageStatus(messageId, 'read');
      
      document.getElementById('messageModal').classList.add('show');
      
      // Setup delete button
      document.getElementById('deleteMessageBtn').onclick = () => deleteMessage(messageId);
    }
  } catch (error) {
    console.error('Error opening message modal:', error);
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
  
  bookings.forEach(booking => {
    const card = document.createElement('div');
    card.className = 'image-card';
    
    const statusBadge = booking.imageApproved ? 
      '<span class="status-badge status-approved">✓ Approved</span>' : 
      '<span class="status-badge status-pending">⏳ Pending</span>';
    
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
      </div>
      <div class="image-actions">
        <button class="btn btn-accept" onclick="approveStyleImage('${booking.id}', true)">✓ Approve</button>
        <button class="btn btn-decline" onclick="approveStyleImage('${booking.id}', false)">✗ Reject</button>
      </div>
    `;
    
    grid.appendChild(card);
  });
  
  container.appendChild(grid);
}

// Approve or Disapprove Style Image
async function approveStyleImage(bookingId, approved) {
  try {
    const response = await adminFetch(`/bookings/${bookingId}/approve-image`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ approved })
    });
    
    if (response.ok) {
      loadStyleImages();
    } else {
      alert('Error updating image approval status');
    }
  } catch (error) {
    console.error('Error approving image:', error);
    alert('Error updating image approval status');
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
          
          <label>Submitted</label>
          <div class="value">${new Date(msg.createdAt).toLocaleString()}</div>
        </div>
      `;
      
      document.getElementById('messageModal').classList.add('show');
      document.getElementById('deleteMessageBtn').onclick = () => deleteReport(messageId);
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
  const pending = bookings.filter(b => b.status === 'pending').length;
  
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
    pending: 'Pending',
    approved: 'Approved',
    cancelled: 'Cancelled',
    completed: 'Completed'
  };

  return labels[status] || status;
}

function truncateText(text, length) {
  if (text.length > length) {
    return text.substring(0, length) + '...';
  }
  return text;
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
