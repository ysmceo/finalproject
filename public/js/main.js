// CEO SALOON - Main Website JavaScript

const API_URL = 'http://localhost:3000/api';
let cachedServices = [];
const serviceNameKeyMap = {
  1: 'service_hair_cut',
  2: 'service_hair_coloring',
  3: 'service_facial_treatment',
  4: 'service_manicure',
  5: 'service_pedicure',
  6: 'service_hair_spa',
  7: 'service_beard_trim',
  8: 'service_full_body_massage'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Initialize language system
  initializeLanguage();
  
  loadServices();
  setupEventListeners();
  initializePasswordVisibilityToggles();
  setMinDate();
  initializeClockAndWeather();
  initializeDarkMode();
});

// Initialize Clock and Weather
function initializeClockAndWeather() {
  // Update time and date
  updateTimeAndDate();
  setInterval(updateTimeAndDate, 1000);
  
  // Load weather
  loadWeather();
  setInterval(loadWeather, 300000); // Update every 5 minutes
}

// Update Time and Date
function updateTimeAndDate() {
  const now = new Date();
  
  // Time
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('timeDisplay').textContent = `${hours}:${minutes}:${seconds}`;
  
  // Date
  const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  const dateString = now.toLocaleDateString('en-US', options);
  document.getElementById('dateDisplay').textContent = dateString;
}

// Load Weather
async function loadWeather() {
  try {
    // Using Open-Meteo API (free, no API key required)
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=6.5244&longitude=3.3792&current=temperature_2m,weather_code'
    );
    const data = await response.json();
    
    if (data.current) {
      const temp = Math.round(data.current.temperature_2m);
      const weatherCode = data.current.weather_code;
      const weatherIcon = getWeatherIcon(weatherCode);
      
      document.getElementById('weatherIcon').textContent = weatherIcon;
      document.getElementById('weatherInfo').textContent = `${temp}°C`;
    }
  } catch (error) {
    console.error('Weather loading error:', error);
    document.getElementById('weatherIcon').textContent = '🌤️';
    document.getElementById('weatherInfo').textContent = 'N/A';
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

// Initialize Language System
function initializeLanguage() {
  // Check if first visit
  const hasVisited = localStorage.getItem('salonVisited');
  if (!hasVisited) {
    // Show language selection modal on first visit
    document.getElementById('languageModal').classList.add('show');
    localStorage.setItem('salonVisited', 'true');
  }
  
  // Apply current language translations
  languageManager.applyTranslations();
  
  // Add language selector button listener
  document.getElementById('languageSelectorBtn').addEventListener('click', openLanguageModal);
}

// Open Language Modal
function openLanguageModal() {
  document.getElementById('languageModal').classList.add('show');
}

// Close Language Modal
function closeLanguageModal() {
  document.getElementById('languageModal').classList.remove('show');
}

// Set Language and Close Modal
function setLanguageAndClose(lang) {
  languageManager.setLanguage(lang);
  closeLanguageModal();
}

// Listen for language changes to update dynamic content
window.addEventListener('languageChanged', () => {
  if (cachedServices.length) {
    displayServices(cachedServices);
    populateServiceSelect(cachedServices);
  }
});

// Initialize Dark Mode
function initializeDarkMode() {
  const darkModeBtn = document.getElementById('darkModeToggle');
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    darkModeBtn.textContent = '☀️';
  }
  
  darkModeBtn.addEventListener('click', toggleDarkMode);
}

// Toggle Dark Mode
function toggleDarkMode() {
  const darkModeBtn = document.getElementById('darkModeToggle');
  const isDarkMode = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDarkMode);
  darkModeBtn.textContent = isDarkMode ? '☀️' : '🌙';
}

// Load Services
async function loadServices() {
  try {
    const response = await fetch(`${API_URL}/services`);
    const services = await response.json();
    cachedServices = services;

    displayServices(cachedServices);
    populateServiceSelect(cachedServices);
  } catch (error) {
    console.error('Error loading services:', error);
  }
}

function getTranslatedServiceName(service) {
  const key = serviceNameKeyMap[service.id];
  return key ? languageManager.translate(key) : service.name;
}

// Display Services
function displayServices(services) {
  const grid = document.getElementById('servicesGrid');
  grid.innerHTML = '';
  
  services.forEach(service => {
    const translatedName = getTranslatedServiceName(service);
    const card = document.createElement('div');
    card.className = 'service-card';
    card.innerHTML = `
      <h3>${translatedName}</h3>
      <div class="service-price">₦${service.price.toLocaleString()}</div>
      <div class="service-duration">${languageManager.translate('service_duration_label')} ${service.duration} ${languageManager.translate('service_duration_minutes')}</div>
    `;
    card.onclick = () => scrollToBooking();
    grid.appendChild(card);
  });
}

// Populate Service Select
function populateServiceSelect(services) {
  const select = document.getElementById('service');
  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = languageManager.translate('booking_choose_service');
  select.appendChild(placeholder);

  services.forEach(service => {
    const translatedName = getTranslatedServiceName(service);
    const option = document.createElement('option');
    option.value = service.id;
    option.textContent = `${translatedName} - ₦${service.price.toLocaleString()}`;
    select.appendChild(option);
  });
}

// Set Minimum Date
function setMinDate() {
  const dateInput = document.getElementById('date');
  const today = new Date().toISOString().split('T')[0];
  dateInput.setAttribute('min', today);
}

// Setup Event Listeners
function setupEventListeners() {
  document.getElementById('bookingForm').addEventListener('submit', handleBooking);
  document.getElementById('contactForm').addEventListener('submit', handleContact);
  document.getElementById('adminLoginBtn').addEventListener('click', openAdminModal);
  document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
  document.getElementById('adminRegisterForm').addEventListener('submit', handleAdminRegister);
  document.getElementById('requestAccessCodeBtn').addEventListener('click', handleRequestAccessCode);
  
  // Add report file preview listener
  document.getElementById('reportFile').addEventListener('change', function(e) {
    const preview = document.getElementById('reportFilePreview');
    const file = this.files[0];
    
    if (file) {
      const isImage = file.type.startsWith('image/');
      if (isImage) {
        const reader = new FileReader();
        reader.onload = function(event) {
          preview.innerHTML = `
            <div style="position: relative; width: 150px;">
              <img src="${event.target.result}" alt="Report Preview" style="width: 100%; border-radius: 5px; border: 2px solid var(--primary-color);">
              <small style="display: block; margin-top: 5px; color: #666;">${file.name}</small>
            </div>
          `;
        };
        reader.readAsDataURL(file);
      } else {
        preview.innerHTML = `
          <div style="padding: 10px; background: #f0f0f0; border-radius: 5px; border-left: 4px solid var(--primary-color);">
            <strong>📎 ${file.name}</strong>
            <small style="display: block; color: #666; margin-top: 3px;">${(file.size / 1024).toFixed(2)} KB</small>
          </div>
        `;
      }
    } else {
      preview.innerHTML = '';
    }
  });
  
  // Add image preview listener
  document.getElementById('styleImage').addEventListener('change', function(e) {
    const preview = document.getElementById('imagePreview');
    const file = this.files[0];
    
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        preview.innerHTML = `
          <div style="position: relative; width: 150px;">
            <img src="${event.target.result}" alt="Style Preview" style="width: 100%; border-radius: 5px; border: 2px solid var(--primary-color);">
            <small style="display: block; margin-top: 5px; color: #666;">Preview: ${file.name}</small>
          </div>
        `;
      };
      reader.readAsDataURL(file);
    } else {
      preview.innerHTML = '';
    }
  });
}

function initializePasswordVisibilityToggles() {
  const getEyeIconSvg = () => `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="visibility-icon">
      <path d="M12 5c5.5 0 9.5 4.5 10.8 6.3.3.4.3 1 0 1.4C21.5 14.5 17.5 19 12 19S2.5 14.5 1.2 12.7a1.2 1.2 0 0 1 0-1.4C2.5 9.5 6.5 5 12 5Zm0 2C7.8 7 4.5 10.3 3.3 12 4.5 13.7 7.8 17 12 17s7.5-3.3 8.7-5C19.5 10.3 16.2 7 12 7Zm0 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" fill="currentColor"/>
    </svg>
  `;

  const getEyeOffIconSvg = () => `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="visibility-icon">
      <path d="M3.3 2.3 2 3.6l2.8 2.8A18.9 18.9 0 0 0 1.2 11.3a1.2 1.2 0 0 0 0 1.4C2.5 14.5 6.5 19 12 19c2.1 0 4-.6 5.7-1.5l2.7 2.7 1.3-1.3L3.3 2.3Zm8.7 14.7c-4.2 0-7.5-3.3-8.7-5 1-1.3 3.2-3.6 6.1-4.6l1.8 1.8a2.5 2.5 0 0 0 3.6 3.6l1.4 1.4A8.8 8.8 0 0 1 12 17Zm0-10c5.5 0 9.5 4.5 10.8 6.3.3.4.3 1 0 1.4a20 20 0 0 1-2.6 2.9l-1.4-1.4c.7-.7 1.3-1.5 1.9-2.2-1.2-1.7-4.5-5-8.7-5-.8 0-1.6.1-2.3.3L8 7.7c1.2-.4 2.5-.7 4-.7Z" fill="currentColor"/>
    </svg>
  `;

  const sensitiveInputIds = ['loginPassword', 'loginSecretPasscode', 'registerPassword', 'registerSecretPasscode'];

  sensitiveInputIds.forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;

    const parent = input.parentElement;
    if (!parent || parent.querySelector('.password-visibility-toggle')) return;

    parent.classList.add('password-input-group');

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'password-visibility-toggle';
    toggleBtn.setAttribute('aria-label', 'Show password');
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.title = 'Show password';
    toggleBtn.innerHTML = getEyeIconSvg();

    toggleBtn.addEventListener('click', () => {
      const shouldShow = input.type === 'password';
      input.type = shouldShow ? 'text' : 'password';
      toggleBtn.innerHTML = shouldShow ? getEyeOffIconSvg() : getEyeIconSvg();
      toggleBtn.setAttribute('aria-pressed', String(shouldShow));
      toggleBtn.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');
      toggleBtn.title = shouldShow ? 'Hide password' : 'Show password';
    });

    parent.appendChild(toggleBtn);
  });
}

// Handle Booking Submission
async function handleBooking(e) {
  e.preventDefault();
  
  const formData = new FormData();
  formData.append('name', document.getElementById('name').value);
  formData.append('email', document.getElementById('email').value);
  formData.append('phone', document.getElementById('phone').value);
  formData.append('serviceId', document.getElementById('service').value);
  formData.append('date', document.getElementById('date').value);
  formData.append('time', document.getElementById('time').value);
  formData.append('language', document.getElementById('language').value);
  formData.append('paymentMethod', document.getElementById('paymentMethod').value);
  formData.append('refreshment', document.querySelector('input[name="refreshment"]:checked').value);
  formData.append('specialRequests', document.getElementById('specialRequests').value);
  
  // Add file if selected
  const styleImageFile = document.getElementById('styleImage').files[0];
  if (styleImageFile) {
    formData.append('styleImage', styleImageFile);
  }
  
  try {
    const response = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      const result = await response.json();
      const successMessage = result.message || languageManager.translate('booking_success');
      showMessage('bookingMessage', successMessage, 'success');
      document.getElementById('bookingForm').reset();
      document.getElementById('imagePreview').innerHTML = '';
    } else {
      showMessage('bookingMessage', languageManager.translate('booking_error'), 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('bookingMessage', languageManager.translate('booking_error'), 'error');
  }
}

// Handle Contact Form
async function handleContact(e) {
  e.preventDefault();
  
  const formData = new FormData();
  formData.append('name', document.getElementById('contactName').value);
  formData.append('email', document.getElementById('contactEmail').value);
  formData.append('subject', document.getElementById('contactSubject').value);
  formData.append('message', document.getElementById('contactMessage').value);
  formData.append('reportType', document.getElementById('reportType').value || '');
  
  // Add file if selected
  const reportFile = document.getElementById('reportFile').files[0];
  if (reportFile) {
    formData.append('reportFile', reportFile);
  }
  
  try {
    const response = await fetch(`${API_URL}/messages`, {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      showMessage('contactMessage', languageManager.translate('contact_success'), 'success');
      document.getElementById('contactForm').reset();
      document.getElementById('reportFilePreview').innerHTML = '';
    } else {
      showMessage('contactMessage', languageManager.translate('contact_error'), 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('contactMessage', languageManager.translate('contact_error'), 'error');
  }
}

// Show Message
function showMessage(elementId, message, type) {
  const messageEl = document.getElementById(elementId);
  messageEl.textContent = message;
  messageEl.className = `message ${type}`;
  
  // Hide after 5 seconds
  setTimeout(() => {
    messageEl.textContent = '';
    messageEl.className = 'message';
  }, 5000);
}

// Admin Authentication Functions
async function openAdminModal() {
  const existingToken = localStorage.getItem('adminToken');

  if (existingToken) {
    try {
      const verifyResponse = await fetch(`${API_URL}/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: existingToken })
      });

      if (verifyResponse.ok) {
        window.location.href = '/admin';
        return;
      }
    } catch (error) {
      console.error('Auto-login verification failed:', error);
    }
  }

  await refreshAdminRegistrationState();
  document.getElementById('adminModal').classList.add('show');
}

function closeAdminModal() {
  document.getElementById('adminModal').classList.remove('show');
  document.getElementById('adminLoginForm').reset();
  document.getElementById('adminRegisterForm').reset();
}

function toggleAuthForm() {
  document.getElementById('loginForm').style.display = document.getElementById('loginForm').style.display === 'none' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = document.getElementById('registerForm').style.display === 'none' ? 'block' : 'none';
}

async function refreshAdminRegistrationState() {
  const loginToggleText = document.querySelector('#loginForm .toggle-text');
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');

  try {
    const response = await fetch(`${API_URL}/admin/registration-status`);
    const result = await response.json();

    if (response.ok && result.registrationOpen) {
      if (loginToggleText) {
        loginToggleText.style.display = '';
      }
      return;
    }

    // Registration closed: hide public sign-up path
    if (loginToggleText) {
      loginToggleText.style.display = 'none';
    }

    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
  } catch (error) {
    console.error('Failed to load registration status:', error);
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value.trim();
  const oneTimeCode = document.getElementById('loginAccessCode').value.trim();
  const secretPasscode = document.getElementById('loginSecretPasscode').value.trim();
  
  try {
    const response = await fetch(`${API_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, oneTimeCode, secretPasscode })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      localStorage.setItem('adminToken', result.token);
      localStorage.setItem('adminName', result.admin.name);
      localStorage.setItem('adminWelcome', 'true');
      showAdminMessage('loginMessage', 'Login successful! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = '/admin';
      }, 1500);
    } else {
      showAdminMessage('loginMessage', result.error || 'Login failed', 'error');
    }
  } catch (error) {
    showAdminMessage('loginMessage', 'Error during login', 'error');
  }
}

async function handleRequestAccessCode() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const secretPasscode = document.getElementById('loginSecretPasscode').value.trim();

  if (!email || !secretPasscode) {
    showAdminMessage('loginMessage', 'Enter admin email and secret passcode first.', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/admin/request-login-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, secretPasscode })
    });

    const result = await response.json();

    if (!response.ok) {
      showAdminMessage('loginMessage', result.error || 'Failed to generate access code', 'error');
      return;
    }

    document.getElementById('loginAccessCode').value = result.accessCode;
    showAdminMessage('loginMessage', `One-time code generated: ${result.accessCode} (valid ${result.expiresInMinutes} minutes).`, 'success');
  } catch (error) {
    showAdminMessage('loginMessage', 'Error generating one-time access code', 'error');
  }
}

async function handleAdminRegister(e) {
  e.preventDefault();
  
  const name = document.getElementById('registerName').value;
  const email = document.getElementById('registerEmail').value.trim().toLowerCase();
  const password = document.getElementById('registerPassword').value;
  const secretPasscode = document.getElementById('registerSecretPasscode').value.trim();
  
  try {
    const response = await fetch(`${API_URL}/admin/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, secretPasscode })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showAdminMessage('registerMessage', 'Registration successful! Switching to login...', 'success');
      setTimeout(() => {
        toggleAuthForm();
        document.getElementById('loginEmail').value = email;
        document.getElementById('loginPassword').value = password;
      }, 1500);
    } else {
      if (response.status === 403) {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
      }
      showAdminMessage('registerMessage', result.error || 'Registration failed', 'error');
    }
  } catch (error) {
    showAdminMessage('registerMessage', 'Error during registration', 'error');
  }
}

function showAdminMessage(elementId, message, type) {
  const messageEl = document.getElementById(elementId);
  messageEl.textContent = message;
  messageEl.className = `message ${type}`;
  
  setTimeout(() => {
    messageEl.textContent = '';
    messageEl.className = 'message';
  }, 5000);
}

// Scroll to Booking
function scrollToBooking() {
  document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
}

// Smooth scroll for navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
