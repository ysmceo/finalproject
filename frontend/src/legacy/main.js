// CEO SALOON - Main Website JavaScript

const API_URL = '/api';
const SUNNY_MODE_KEY = 'sunnyMode';
let cachedServices = [];
let cachedProducts = [];
let paystackPaymentPageUrl = '';
let productDeliveryFees = { standard: 0, express: 0 };
const ONLINE_PRODUCT_PAYMENT_METHODS = ['Credit Card', 'Debit Card', 'USSD'];
const ADDRESS_LOOKUP_MIN_CHARS = 4;
const ADDRESS_LOOKUP_LIMIT = 5;
const LAST_PRODUCT_ORDER_CODE_KEY = 'lastProductOrderCode';
const LAST_PRODUCT_ORDER_ID_KEY = 'lastProductOrderId';
const LAST_PRODUCT_ORDER_EMAIL_KEY = 'lastProductOrderEmail';
const LAST_PRODUCT_PAYMENT_STATUS_KEY = 'lastProductPaymentStatus';
const LAST_PRODUCT_PAYMENT_ORDER_ID_KEY = 'lastProductPaymentOrderId';
const BOOKING_BANK_DETAILS_DEFAULT = {
  bankName: 'YSMBANK CEOS',
  accountNumber: '0204661552',
  accountName: 'CEO SALOON'
};
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
const ADDRESS_LOOKUP_CONFIG = [
  {
    inputId: 'homeServiceAddress',
    suggestionsId: 'homeServiceAddressSuggestions',
    statusId: 'homeServiceAddressLookupStatus',
    mapButtonId: 'homeServiceAddressMapBtn',
    messageTargetId: 'bookingMessage'
  },
  {
    inputId: 'productOrderAddress',
    suggestionsId: 'productOrderAddressSuggestions',
    statusId: 'productOrderAddressLookupStatus',
    mapButtonId: 'productOrderAddressMapBtn',
    messageTargetId: 'productOrderMessage'
  }
];
const addressLookupStateByInput = new Map();

function isValidEmailAddress(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized);
}

function markFieldInvalid(fieldEl) {
  if (!fieldEl) return;
  fieldEl.classList.add('field-error');
  fieldEl.setAttribute('aria-invalid', 'true');
}

function clearFieldInvalid(fieldEl) {
  if (!fieldEl) return;
  fieldEl.classList.remove('field-error');
  fieldEl.removeAttribute('aria-invalid');
}

function markFieldValid(fieldEl) {
  if (!fieldEl) return;
  fieldEl.classList.add('field-valid');
}

function clearFieldValid(fieldEl) {
  if (!fieldEl) return;
  fieldEl.classList.remove('field-valid');
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D+/g, '');
}

function isValidPhoneNumber(value) {
  const digits = normalizePhoneDigits(value);
  return digits.length >= 10 && digits.length <= 15;
}

function getInlineValidationElement(fieldEl) {
  if (!(fieldEl instanceof HTMLElement)) return null;
  const group = fieldEl.closest('.form-group');
  if (!group) return null;

  const fieldId = String(fieldEl.id || '').trim();
  if (!fieldId) return null;

  const hintId = `${fieldId}InlineValidationHint`;
  let hintEl = group.querySelector(`#${hintId}`);
  if (hintEl instanceof HTMLElement) {
    return hintEl;
  }

  hintEl = document.createElement('small');
  hintEl.id = hintId;
  hintEl.className = 'form-inline-validation is-neutral';
  hintEl.setAttribute('aria-live', 'polite');
  hintEl.textContent = '';

  const existingStaticHint = Array.from(group.querySelectorAll('.form-help-text-tight, .form-help-text'))
    .find(el => !String(el.id || '').endsWith('InlineValidationHint'));

  if (existingStaticHint && existingStaticHint.parentNode === group) {
    existingStaticHint.insertAdjacentElement('afterend', hintEl);
  } else {
    group.appendChild(hintEl);
  }

  return hintEl;
}

function setInlineValidationState(fieldEl, state, message) {
  const hintEl = getInlineValidationElement(fieldEl);
  if (!hintEl) return;

  hintEl.classList.remove('is-neutral', 'is-valid', 'is-invalid');
  hintEl.classList.add(state === 'valid' ? 'is-valid' : state === 'invalid' ? 'is-invalid' : 'is-neutral');
  hintEl.textContent = String(message || '').trim();
}

function validateBookingField(fieldEl) {
  if (!fieldEl) return true;
  const fieldId = String(fieldEl.id || '').trim();
  const rawValue = String(fieldEl.value || '').trim();

  if (!fieldId) return true;

  if (!rawValue) {
    clearFieldInvalid(fieldEl);
    clearFieldValid(fieldEl);
    setInlineValidationState(fieldEl, 'neutral', '');
    return false;
  }

  if (fieldId === 'name') {
    const isValid = rawValue.length >= 3;
    if (isValid) {
      clearFieldInvalid(fieldEl);
      markFieldValid(fieldEl);
      setInlineValidationState(fieldEl, 'valid', 'Looks good.');
      return true;
    }
    clearFieldValid(fieldEl);
    markFieldInvalid(fieldEl);
    setInlineValidationState(fieldEl, 'invalid', 'Please enter at least 3 characters.');
    return false;
  }

  if (fieldId === 'email') {
    const isValid = isValidEmailAddress(rawValue);
    if (isValid) {
      clearFieldInvalid(fieldEl);
      markFieldValid(fieldEl);
      setInlineValidationState(fieldEl, 'valid', 'Email format looks correct.');
      return true;
    }
    clearFieldValid(fieldEl);
    markFieldInvalid(fieldEl);
    setInlineValidationState(fieldEl, 'invalid', 'Enter a valid email like you@example.com.');
    return false;
  }

  if (fieldId === 'phone') {
    const isValid = isValidPhoneNumber(rawValue);
    if (isValid) {
      clearFieldInvalid(fieldEl);
      markFieldValid(fieldEl);
      setInlineValidationState(fieldEl, 'valid', 'Phone number looks valid.');
      return true;
    }
    clearFieldValid(fieldEl);
    markFieldInvalid(fieldEl);
    setInlineValidationState(fieldEl, 'invalid', 'Use a valid phone number (10–15 digits).');
    return false;
  }

  if (fieldId === 'date') {
    const selectedDate = new Date(`${rawValue}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isValid = !Number.isNaN(selectedDate.getTime()) && selectedDate >= today;

    if (isValid) {
      clearFieldInvalid(fieldEl);
      markFieldValid(fieldEl);
      setInlineValidationState(fieldEl, 'valid', 'Date selected.');
      return true;
    }

    clearFieldValid(fieldEl);
    markFieldInvalid(fieldEl);
    setInlineValidationState(fieldEl, 'invalid', 'Please choose today or a future date.');
    return false;
  }

  if (fieldId === 'time') {
    const isValid = /^\d{2}:\d{2}$/.test(rawValue);
    if (isValid) {
      clearFieldInvalid(fieldEl);
      markFieldValid(fieldEl);
      setInlineValidationState(fieldEl, 'valid', 'Time selected.');
      return true;
    }
    clearFieldValid(fieldEl);
    markFieldInvalid(fieldEl);
    setInlineValidationState(fieldEl, 'invalid', 'Please select a valid time.');
    return false;
  }

  return true;
}

function initializeBookingInlineValidation() {
  const bookingForm = document.getElementById('bookingForm');
  if (!(bookingForm instanceof HTMLFormElement)) return;

  const fields = ['name', 'email', 'phone', 'date', 'time']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  fields.forEach(fieldEl => {
    if (!(fieldEl instanceof HTMLInputElement)) return;
    if (fieldEl.dataset.inlineValidationBound === 'true') return;

    fieldEl.addEventListener('input', () => {
      validateBookingField(fieldEl);
    });

    fieldEl.addEventListener('blur', () => {
      validateBookingField(fieldEl);
    });

    fieldEl.dataset.inlineValidationBound = 'true';
  });
}

function getBookingRequiredReadinessFields() {
  return [
    document.getElementById('name'),
    document.getElementById('email'),
    document.getElementById('phone'),
    document.getElementById('service'),
    document.getElementById('date'),
    document.getElementById('time'),
    document.getElementById('paymentMethod'),
    document.getElementById('paymentPlan')
  ].filter(Boolean);
}

function isFilledBookingField(fieldEl) {
  if (!fieldEl) return false;
  const value = String(fieldEl.value || '').trim();
  return value.length > 0;
}

function updateBookingReadinessMeter() {
  const percentEl = document.getElementById('bookingReadinessPercent');
  const barEl = document.getElementById('bookingReadinessBar');
  const hintEl = document.getElementById('bookingReadinessHint');
  const trackEl = document.querySelector('.booking-readiness__track');
  const fields = getBookingRequiredReadinessFields();

  if (!percentEl || !barEl || !hintEl || !trackEl || !fields.length) return;

  const filled = fields.filter(isFilledBookingField).length;
  const percent = Math.round((filled / fields.length) * 100);

  percentEl.textContent = `${percent}%`;
  barEl.style.width = `${percent}%`;
  trackEl.setAttribute('aria-valuenow', String(percent));

  if (percent >= 100) {
    hintEl.textContent = 'Excellent. Your booking details are complete and ready to submit.';
  } else if (percent >= 70) {
    hintEl.textContent = 'Almost there — complete the remaining required fields.';
  } else if (percent >= 40) {
    hintEl.textContent = 'Good progress. Keep filling required details.';
  } else {
    hintEl.textContent = 'Complete required fields to continue smoothly.';
  }
}

function initializeBookingReadinessMeter() {
  const bookingForm = document.getElementById('bookingForm');
  if (!(bookingForm instanceof HTMLFormElement)) return;

  const fields = getBookingRequiredReadinessFields();
  fields.forEach(fieldEl => {
    if (!fieldEl || fieldEl.dataset.readinessBound === 'true') return;
    fieldEl.addEventListener('input', updateBookingReadinessMeter);
    fieldEl.addEventListener('change', updateBookingReadinessMeter);
    fieldEl.dataset.readinessBound = 'true';
  });

  updateBookingReadinessMeter();
}

function generateSupportTicketRef(prefix = 'CSR') {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${datePart}-${randomPart}`;
}

function renderContactTicketRef(ticketRef) {
  const refEl = document.getElementById('contactTicketRef');
  if (!refEl) return;

  const cleanRef = String(ticketRef || '').trim();
  if (!cleanRef) {
    refEl.innerHTML = '';
    return;
  }

  refEl.innerHTML = `<span class="customer-ticket-ref__chip">🎟️ Support Ticket: ${escapeHtmlText(cleanRef)}</span>`;
}

function escapeHtmlText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isProductOrderOnlinePaymentMethod(paymentMethod) {
  return ONLINE_PRODUCT_PAYMENT_METHODS.includes(String(paymentMethod || '').trim());
}

function inferProductOrderPaystackChannel(paymentMethod) {
  const method = String(paymentMethod || '').trim();
  if (method === 'USSD') return 'ussd';
  return 'card';
}

function getProductById(productId) {
  const id = Number(productId || 0);
  return cachedProducts.find(product => Number(product && product.id) === id) || null;
}

// Initialize
export function initMain() {
  if (window.__ceoMainInit) return;
  window.__ceoMainInit = true;
  // PWA: register service worker (installable app + basic offline support)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silent fail: app still works fine without SW.
    });
  }

  // Initialize language system
  initializeLanguage();
  
  loadServices();
  loadProducts();
  loadProductDeliveryFees();
  setupPaystackPaymentPageLink();
  showRecentPaymentResult();
  setupEventListeners();
  updateOnlinePaymentVisibility();
  setPayNowPanelVisible(false);
  setBankPayPanelVisible(false);
  initializePasswordVisibilityToggles();
  initializeTrackingLookup();
  initializeProductTrackingLookup();
  setMinDate();
  initializeClockAndWeather();
  initializeDarkMode();
  initializeSunnyMode();
  initializeProfessionalSpice();
  setupSmoothScroll();
}

function initializeProfessionalSpice() {
  setupScrollProgressBar();
  setupSectionRevealAnimations();
  setupActiveNavLinkSync();
  setupScrollAwareCtaPulse();
  setupHeroCounters();
  setupCardEntranceAnimations();
  setupFloatingBookingBar();
  setupCtaCopyVariants();
  setupSoftUrgencyChip();
  setupCtaRippleFeedback();
}

function setupCtaRippleFeedback() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const selector = '.cta-btn, .floating-book-bar__btn, .submit-btn, .paystack-pay-btn';

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const ctaElement = target.closest(selector);
    if (!(ctaElement instanceof HTMLElement)) return;

    const rect = ctaElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    ctaElement.style.setProperty('--ripple-x', `${Math.max(0, x)}px`);
    ctaElement.style.setProperty('--ripple-y', `${Math.max(0, y)}px`);
    ctaElement.classList.remove('is-rippling');
    void ctaElement.offsetWidth;
    ctaElement.classList.add('is-rippling');

    window.setTimeout(() => {
      ctaElement.classList.remove('is-rippling');
    }, 460);
  });
}

function getEstimatedPrioritySlots() {
  const now = new Date();
  const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const storageKey = `ceosalon:slotEstimate:${dateKey}`;

  const cached = localStorage.getItem(storageKey);
  if (cached) {
    const parsed = Number(cached);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  // Deterministic daily estimate with gentle hour-based taper.
  const daySeed = now.getDate() + (now.getMonth() + 1) * 3;
  const base = 8 + (daySeed % 5); // 8..12
  const hourTaper = Math.floor(now.getHours() / 4); // 0..5
  const estimate = Math.max(2, base - hourTaper);

  localStorage.setItem(storageKey, String(estimate));
  return estimate;
}

function setupSoftUrgencyChip() {
  const chip = document.getElementById('floatingUrgencyChip');
  if (!chip) return;

  const render = () => {
    const estimate = getEstimatedPrioritySlots();
    chip.textContent = `Est. slots today: ${estimate}`;
  };

  render();
  window.setInterval(render, 60 * 60 * 1000);
}

function setupFloatingBookingBar() {
  const bar = document.getElementById('floatingBookBar');
  const button = document.getElementById('floatingBookNowBtn');
  const bookingSection = document.getElementById('booking');
  if (!bar || !button || !bookingSection) return;

  button.addEventListener('click', () => {
    scrollToBooking();
  });

  const updateBarState = () => {
    const scrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    const bookingTop = bookingSection.getBoundingClientRect().top + scrollY;
    const bookingVisibleZoneStart = bookingTop - Math.max(120, Math.round(window.innerHeight * 0.25));

    const shouldShow = scrollY > 360 && scrollY < bookingVisibleZoneStart;
    bar.classList.toggle('is-visible', shouldShow);
    bar.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
  };

  updateBarState();
  window.addEventListener('scroll', updateBarState, { passive: true });
  window.addEventListener('resize', updateBarState);
}

function setupCtaCopyVariants() {
  const button = document.getElementById('floatingBookNowBtn');
  if (!(button instanceof HTMLElement)) return;

  const variants = [
    'Book now',
    'Reserve your glow-up',
    'Get your premium slot',
    'Start your makeover'
  ];

  let index = 0;
  const applyVariant = () => {
    const label = variants[index % variants.length];
    button.textContent = label;
    button.setAttribute('aria-label', label);
  };

  applyVariant();

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  window.setInterval(() => {
    index += 1;
    applyVariant();
  }, 4800);
}

function setupHeroCounters() {
  const counters = Array.from(document.querySelectorAll('.hero-stat-value[data-counter-target]'));
  if (!counters.length) return;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    counters.forEach(counter => {
      const target = Number(counter.getAttribute('data-counter-target') || 0);
      counter.textContent = Number.isFinite(target) ? target.toLocaleString() : '0';
    });
    return;
  }

  const runCounterAnimation = () => {
    counters.forEach(counter => {
      if (counter.dataset.animated === 'true') return;

      const target = Number(counter.getAttribute('data-counter-target') || 0);
      const safeTarget = Number.isFinite(target) ? Math.max(0, target) : 0;
      const start = performance.now();
      const duration = 1200;

      const tick = now => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(safeTarget * eased);
        counter.textContent = value.toLocaleString();

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          counter.dataset.animated = 'true';
        }
      };

      requestAnimationFrame(tick);
    });
  };

  const heroSection = document.getElementById('home');
  if (!heroSection || !('IntersectionObserver' in window)) {
    runCounterAnimation();
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          runCounterAnimation();
          observer.disconnect();
        }
      });
    },
    { threshold: 0.35 }
  );

  observer.observe(heroSection);
}

function setupCardEntranceAnimations() {
  const targets = Array.from(document.querySelectorAll('.service-card, .product-card, .team-member, .gallery-item, .ceo-card'));
  if (!targets.length) return;

  targets.forEach((card, index) => {
    if (card.dataset.entranceReady === 'true') return;
    card.dataset.entranceReady = 'true';
    card.classList.add('card-entrance');
    card.style.setProperty('--stagger-index', String(index % 10));
  });

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    targets.forEach(card => card.classList.add('is-visible'));
    return;
  }

  if (!('IntersectionObserver' in window)) {
    targets.forEach(card => card.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
  );

  targets.forEach(card => observer.observe(card));
}

function renderServicesLoadingSkeleton() {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;
  grid.innerHTML = Array.from({ length: 6 }).map(() => `
    <div class="service-card service-card-skeleton" aria-hidden="true">
      <div class="skeleton-line skeleton-line-title"></div>
      <div class="skeleton-line skeleton-line-price"></div>
      <div class="skeleton-line skeleton-line-meta"></div>
    </div>
  `).join('');
}

function renderProductsLoadingSkeleton() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;
  grid.innerHTML = Array.from({ length: 6 }).map(() => `
    <div class="product-card product-card-skeleton" aria-hidden="true">
      <div class="product-image-wrapper skeleton-block"></div>
      <div class="skeleton-line skeleton-line-title"></div>
      <div class="skeleton-line skeleton-line-meta"></div>
      <div class="skeleton-line skeleton-line-price"></div>
      <div class="skeleton-line skeleton-line-stock"></div>
    </div>
  `).join('');
}

function setupScrollAwareCtaPulse() {
  const ctaButton = document.querySelector('.cta-btn');
  if (!(ctaButton instanceof HTMLElement)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const updatePulse = () => {
    const scrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    if (scrollY < 220) {
      ctaButton.classList.add('cta-pulse-soft');
      ctaButton.classList.remove('cta-pulse-strong');
      return;
    }

    if (scrollY >= 220 && scrollY < 880) {
      ctaButton.classList.remove('cta-pulse-soft');
      ctaButton.classList.add('cta-pulse-strong');
      return;
    }

    ctaButton.classList.remove('cta-pulse-soft', 'cta-pulse-strong');
  };

  updatePulse();
  window.addEventListener('scroll', updatePulse, { passive: true });
  window.addEventListener('resize', updatePulse);
}

function setupScrollProgressBar() {
  const progressEl = document.getElementById('scrollProgress');
  if (!progressEl) return;

  const updateProgress = () => {
    const totalScrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scrolled = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    const ratio = Math.min(1, scrolled / totalScrollable);
    progressEl.style.transform = `scaleX(${ratio})`;
  };

  updateProgress();
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
}

function setupSectionRevealAnimations() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const sections = Array.from(document.querySelectorAll('section'));
  if (!sections.length) return;

  sections.forEach(section => {
    section.classList.add('reveal-on-scroll');
  });

  if (!('IntersectionObserver' in window)) {
    sections.forEach(section => section.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14, rootMargin: '0px 0px -40px 0px' }
  );

  sections.forEach(section => observer.observe(section));
}

function setupActiveNavLinkSync() {
  const navLinks = Array.from(document.querySelectorAll('.nav-menu a[href^="#"]'));
  if (!navLinks.length) return;

  const linkMap = navLinks
    .map(link => {
      const href = String(link.getAttribute('href') || '').trim();
      if (!href || href === '#') return null;
      const target = document.querySelector(href);
      if (!target) return null;
      return { link, target };
    })
    .filter(Boolean);

  if (!linkMap.length) return;

  const setActiveByScroll = () => {
    const scanLine = window.scrollY + 130;
    let active = linkMap[0];

    linkMap.forEach(pair => {
      if (pair.target.offsetTop <= scanLine) {
        active = pair;
      }
    });

    navLinks.forEach(link => link.classList.remove('is-active'));
    if (active && active.link) {
      active.link.classList.add('is-active');
    }
  };

  setActiveByScroll();
  window.addEventListener('scroll', setActiveByScroll, { passive: true });
  window.addEventListener('resize', setActiveByScroll);
}

function setupNavMenuToggle() {
  const toggleBtn = document.getElementById('navMenuToggle');
  const navMenu = document.getElementById('mainNavMenu');
  const navbar = document.querySelector('.navbar');
  if (!toggleBtn || !navMenu || !navbar) return;

  const closeMenu = () => {
    navMenu.classList.remove('is-open');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-label', 'Open navigation menu');
    toggleBtn.textContent = '☰';
  };

  const openMenu = () => {
    navMenu.classList.add('is-open');
    toggleBtn.setAttribute('aria-expanded', 'true');
    toggleBtn.setAttribute('aria-label', 'Close navigation menu');
    toggleBtn.textContent = '✕';
  };

  toggleBtn.addEventListener('click', () => {
    if (navMenu.classList.contains('is-open')) {
      closeMenu();
      return;
    }
    openMenu();
  });

  navMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeMenu());
  });

  document.addEventListener('click', (event) => {
    if (!navMenu.classList.contains('is-open')) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (!navbar.contains(target)) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navMenu.classList.contains('is-open')) {
      closeMenu();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMenu();
    }
  });
}

function showRecentPaymentResult() {
  try {
    const status = String(localStorage.getItem('lastPaymentStatus') || '').trim().toLowerCase();
    const bookingId = String(localStorage.getItem('lastPaymentBookingId') || '').trim();
    const productPaymentStatus = String(localStorage.getItem(LAST_PRODUCT_PAYMENT_STATUS_KEY) || '').trim().toLowerCase();
    const productOrderId = String(localStorage.getItem(LAST_PRODUCT_PAYMENT_ORDER_ID_KEY) || '').trim();

    if (!status) return;

    if (status === 'paid') {
      showMessage('bookingMessage', `✅ PAID: Payment verified successfully${bookingId ? ` (Booking ID: ${bookingId})` : ''}.`, 'success');
    } else if (status === 'failed') {
      showMessage('bookingMessage', '❌ Payment failed or was not completed.', 'error');
    }

    if (productPaymentStatus === 'paid') {
      showMessage('productOrderMessage', `✅ PAID: Product payment verified successfully${productOrderId ? ` (Order ID: ${productOrderId})` : ''}.`, 'success');
    } else if (productPaymentStatus === 'failed') {
      showMessage('productOrderMessage', '❌ Product payment failed or was not completed.', 'error');
    }

    localStorage.removeItem('lastPaymentStatus');
    localStorage.removeItem('lastPaymentBookingId');
    localStorage.removeItem(LAST_PRODUCT_PAYMENT_STATUS_KEY);
    localStorage.removeItem(LAST_PRODUCT_PAYMENT_ORDER_ID_KEY);
  } catch (e) {
    // ignore
  }
}

async function setupPaystackPaymentPageLink() {
  const blockEl = document.getElementById('paystackPaymentBlock');
  const linkEl = document.getElementById('paystackPaymentLink');
  if (!linkEl) return;

  try {
    const res = await fetch(`${API_URL}/payments/paystack/page-link`);
    const data = await res.json().catch(() => null);

    const url = data && data.url ? String(data.url) : '';
    paystackPaymentPageUrl = res.ok && url ? url : '';

    // Always keep hidden by default. We'll only show it when the Pay Now panel is visible.
    if (blockEl) blockEl.classList.add('hidden');

    if (paystackPaymentPageUrl) {
      linkEl.href = paystackPaymentPageUrl;
    } else {
      linkEl.removeAttribute('href');
    }
  } catch (e) {
    paystackPaymentPageUrl = '';
    if (blockEl) blockEl.classList.add('hidden');
  }
}

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
    document.documentElement.classList.add('dark');
    darkModeBtn.textContent = '☀️';
  }
  
  darkModeBtn.addEventListener('click', toggleDarkMode);
}

// Toggle Dark Mode
function toggleDarkMode() {
  const darkModeBtn = document.getElementById('darkModeToggle');
  const isDarkMode = document.body.classList.toggle('dark-mode');
  document.documentElement.classList.toggle('dark', isDarkMode);
  localStorage.setItem('darkMode', isDarkMode);
  darkModeBtn.textContent = isDarkMode ? '☀️' : '🌙';
}

function initializeSunnyMode() {
  const sunnyBtn = document.getElementById('sunnyModeToggle');
  if (!sunnyBtn) return;

  const storedMode = String(localStorage.getItem(SUNNY_MODE_KEY) || '').trim().toLowerCase();
  const mode = storedMode === 'bright' ? 'bright' : 'soft';
  applySunnyMode(mode);

  sunnyBtn.addEventListener('click', () => {
    const current = document.body.classList.contains('sunny-bright') ? 'bright' : 'soft';
    const next = current === 'bright' ? 'soft' : 'bright';
    applySunnyMode(next);
  });
}

function applySunnyMode(mode) {
  const normalized = String(mode || '').trim().toLowerCase() === 'bright' ? 'bright' : 'soft';
  const sunnyBtn = document.getElementById('sunnyModeToggle');

  document.body.classList.remove('sunny-soft', 'sunny-bright');
  document.body.classList.add(normalized === 'bright' ? 'sunny-bright' : 'sunny-soft');

  localStorage.setItem(SUNNY_MODE_KEY, normalized);

  if (sunnyBtn) {
    sunnyBtn.classList.remove('is-switching');
    void sunnyBtn.offsetWidth;
    sunnyBtn.classList.add('is-switching');

    const modeLabel = normalized === 'bright' ? 'Bright' : 'Soft';
    sunnyBtn.innerHTML = `<span class="sunny-toggle-inner"><span class="sunny-toggle-icon" aria-hidden="true">☀️</span><span class="sunny-toggle-label">${modeLabel}</span></span>`;
    sunnyBtn.title = normalized === 'bright'
      ? 'Switch to Soft Sunny background'
      : 'Switch to Bright Sunny background';
    sunnyBtn.setAttribute('aria-label', sunnyBtn.title);

    window.setTimeout(() => {
      sunnyBtn.classList.remove('is-switching');
    }, 280);
  }
}

// Load Services
async function loadServices() {
  try {
    renderServicesLoadingSkeleton();
    const response = await fetch(`${API_URL}/services`);
    const services = await response.json();
    cachedServices = services;

    displayServices(cachedServices);
    populateServiceSelect(cachedServices);
  } catch (error) {
    console.error('Error loading services:', error);
  }
}

// Load Products
async function loadProducts() {
  try {
    renderProductsLoadingSkeleton();
    const response = await fetch(`${API_URL}/products`);
    if (!response.ok) {
      throw new Error(`Failed to load products (${response.status})`);
    }

    const products = await response.json();
    cachedProducts = Array.isArray(products) ? products : [];
    displayProducts(cachedProducts);
    renderBookingProductPicker(cachedProducts);
    renderProductOrderPicker(cachedProducts);
  } catch (error) {
    console.error('Error loading products:', error);
    cachedProducts = [];
    displayProducts([]);
    const picker = document.getElementById('bookingProductPicker');
    if (picker) {
      picker.innerHTML = '<div class="booking-product-empty">Unable to load products right now. Please refresh and try again.</div>';
    }
    const orderPicker = document.getElementById('productOrderPicker');
    if (orderPicker) {
      orderPicker.innerHTML = '<div class="booking-product-empty">Unable to load products right now. Please refresh and try again.</div>';
    }
  }
}

async function loadProductDeliveryFees() {
  try {
    const response = await fetch(`${API_URL}/product-orders/delivery-fees`);
    const result = await response.json().catch(() => ({}));
    if (response.ok && result && result.fees) {
      productDeliveryFees = {
        standard: Math.max(0, Number(result.fees.standard || 0)),
        express: Math.max(0, Number(result.fees.express || 0))
      };
    }
  } catch (error) {
    console.error('Unable to load product delivery fees:', error);
  } finally {
    updateProductOrderSummary();
  }
}

function renderProductOrderPicker(products) {
  const picker = document.getElementById('productOrderPicker');
  if (!picker) return;

  if (!Array.isArray(products) || !products.length) {
    picker.innerHTML = '<div class="booking-product-empty">No products available right now.</div>';
    return;
  }

  picker.innerHTML = products.map(product => {
    const id = Number(product.id);
    const stock = Math.max(0, Number(product.stock || 0));
    return `
      <label class="booking-product-row">
        <input type="checkbox" class="product-order-check" data-product-id="${id}" ${stock <= 0 ? 'disabled' : ''}>
        <span class="booking-product-meta">
          <span class="booking-product-name">${String(product.name || '')}</span>
          <span class="booking-product-sub">${String(product.category || '')} • In stock: ${stock}</span>
        </span>
        <span class="booking-product-price">₦${Number(product.price || 0).toLocaleString()}</span>
        <input type="number" min="1" max="${Math.max(1, stock)}" value="1" class="product-order-qty" data-product-id="${id}" disabled>
      </label>
    `;
  }).join('');

  updateProductOrderSummary();
}

function collectProductOrderSelections() {
  const picker = document.getElementById('productOrderPicker');
  if (!picker) return [];

  const checks = picker.querySelectorAll('.product-order-check');
  const selected = [];

  checks.forEach(check => {
    if (!(check instanceof HTMLInputElement) || !check.checked) return;

    const productId = Number(check.dataset.productId || 0);
    const qtyInput = picker.querySelector(`.product-order-qty[data-product-id="${productId}"]`);
    const quantity = qtyInput instanceof HTMLInputElement ? Math.max(1, Number(qtyInput.value || 1)) : 1;

    if (Number.isFinite(productId) && productId > 0) {
      selected.push({ productId, quantity });
    }
  });

  return selected;
}

function updateProductOrderSummary() {
  const summaryEl = document.getElementById('productOrderSummary');
  const subtotalEl = document.getElementById('productOrderSubtotal');
  const deliveryFeeEl = document.getElementById('productOrderDeliveryFee');
  const grandTotalEl = document.getElementById('productOrderGrandTotal');
  const deliverySpeedEl = document.getElementById('productOrderDeliverySpeed');
  if (!summaryEl) return;

  const selectedDeliverySpeed = String(deliverySpeedEl && deliverySpeedEl.value ? deliverySpeedEl.value : 'standard').trim().toLowerCase();
  const deliveryFee = Math.max(0, Number(productDeliveryFees[selectedDeliverySpeed] || 0));

  const selected = collectProductOrderSelections();
  if (!selected.length) {
    summaryEl.textContent = 'Select product(s) to see your live total.';
    if (subtotalEl) subtotalEl.textContent = '₦0';
    if (deliveryFeeEl) deliveryFeeEl.textContent = '₦0';
    if (grandTotalEl) grandTotalEl.textContent = '₦0';
    return;
  }

  let totalAmount = 0;
  let itemCount = 0;

  selected.forEach(line => {
    const product = getProductById(line.productId);
    const unitPrice = Number(product && product.price ? product.price : 0);
    const quantity = Math.max(1, Number(line.quantity || 0));
    itemCount += quantity;
    totalAmount += unitPrice * quantity;
  });

  const grandTotal = Math.max(0, totalAmount + deliveryFee);
  if (subtotalEl) subtotalEl.textContent = `₦${Number(totalAmount || 0).toLocaleString()}`;
  if (deliveryFeeEl) deliveryFeeEl.textContent = `₦${Number(deliveryFee || 0).toLocaleString()}`;
  if (grandTotalEl) grandTotalEl.textContent = `₦${Number(grandTotal || 0).toLocaleString()}`;

  summaryEl.textContent = `Selected: ${selected.length} product(s) • Qty: ${itemCount} • Delivery: ${selectedDeliverySpeed.toUpperCase()} (₦${deliveryFee.toLocaleString()}).`;
}

async function handleProductOrderPayNow({ orderId, email, paymentMethod }) {
  const normalizedOrderId = String(orderId || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPaymentMethod = String(paymentMethod || '').trim();

  if (!normalizedOrderId || !normalizedEmail) {
    showMessage('productOrderMessage', 'Missing order details for payment. Please track the order and try again.', 'error');
    return;
  }

  if (!isProductOrderOnlinePaymentMethod(normalizedPaymentMethod)) {
    showMessage('productOrderMessage', 'This payment method is offline. Use the bank/cash instructions in your order details.', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/product-orders/payments/paystack/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: normalizedOrderId,
        email: normalizedEmail,
        paymentChannel: inferProductOrderPaystackChannel(normalizedPaymentMethod)
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const hint = result && result.hint ? ` ${result.hint}` : '';
      showMessage('productOrderMessage', (result.error || 'Failed to initialize product payment.') + hint, 'error');
      return;
    }

    if (result.authorizationUrl) {
      localStorage.setItem(LAST_PRODUCT_ORDER_ID_KEY, normalizedOrderId);
      localStorage.setItem(LAST_PRODUCT_ORDER_EMAIL_KEY, normalizedEmail);
      window.location.href = result.authorizationUrl;
      return;
    }

    showMessage('productOrderMessage', 'Payment initialization did not return a payment URL.', 'error');
  } catch (error) {
    console.error('Product payment initialization error:', error);
    showMessage('productOrderMessage', 'Error starting product payment. Please try again.', 'error');
  }
}

function renderProductOrderCreated(result) {
  const box = document.getElementById('productOrderResult');
  if (!box || !result || !result.order) return;

  const order = result.order;
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsHtml = items.length
    ? `<ul style="margin:8px 0 0 16px; color:#555;">${items.map(item => `<li>${escapeHtmlText(String(item.name || 'Product'))} × ${Number(item.quantity || 0)} — ₦${Number(item.lineTotal || 0).toLocaleString()}</li>`).join('')}</ul>`
    : '<div class="bank-pay-muted">No item details available.</div>';

  const bankDetails = result.paymentBankDetails;
  const paymentStatus = String(order.paymentStatus || 'pending').trim().toLowerCase();
  const canPayNow = isProductOrderOnlinePaymentMethod(order.paymentMethod) && ['pending', 'initiated', 'failed'].includes(paymentStatus) && Number(order.amountDueNow || 0) > 0;
  const bankHtml = bankDetails
    ? `
      <div class="bank-pay-card" style="margin-top:10px;">
        <h4 class="bank-pay-subheading">Bank Transfer Details</h4>
        <div class="bank-pay-grid">
          <div><div class="bank-pay-label">Bank</div><div class="bank-pay-value">${escapeHtmlText(String(bankDetails.bankName || 'N/A'))}</div></div>
          <div><div class="bank-pay-label">Account Number</div><div class="bank-pay-value">${escapeHtmlText(String(bankDetails.accountNumber || 'N/A'))}</div></div>
          <div><div class="bank-pay-label">Account Name</div><div class="bank-pay-value">${escapeHtmlText(String(bankDetails.accountName || 'N/A'))}</div></div>
          <div><div class="bank-pay-label">Amount Due</div><div class="bank-pay-value">₦${Number(bankDetails.amountDueNow || 0).toLocaleString()}</div></div>
          <div class="bank-pay-full-span"><div class="bank-pay-label">Reference</div><div class="bank-pay-ref">${escapeHtmlText(String(bankDetails.reference || 'N/A'))}</div></div>
        </div>
      </div>
    `
    : '';

  const paymentActionHtml = canPayNow
    ? `
      <div class="product-order-action-row">
        <button
          type="button"
          class="submit-btn product-order-pay-btn"
          data-order-id="${escapeHtmlText(String(order.id || ''))}"
          data-order-email="${escapeHtmlText(String(order.email || ''))}"
          data-payment-method="${escapeHtmlText(String(order.paymentMethod || ''))}">
          Pay Now (Paystack)
        </button>
        <small class="product-order-action-note">Secure payment opens in Paystack checkout.</small>
      </div>
    `
    : '';
  const invoiceActionHtml = order && order.orderCode && order.email
    ? `
      <div class="product-order-action-row">
        <button
          type="button"
          class="submit-btn product-invoice-download-btn"
          data-order-code="${escapeHtmlText(String(order.orderCode || ''))}"
          data-order-email="${escapeHtmlText(String(order.email || '').toLowerCase())}">
          Download Product Invoice (PDF)
        </button>
      </div>
    `
    : '';

  box.innerHTML = `
    <div class="bank-pay-card" style="margin-top:12px;">
      <h3 class="bank-pay-heading">Product Order Submitted</h3>
      <div class="bank-pay-grid">
        <div><div class="bank-pay-label">Order Code</div><div class="bank-pay-value">${escapeHtmlText(String(order.orderCode || 'N/A'))}</div></div>
        <div><div class="bank-pay-label">Status</div><div class="bank-pay-value">${escapeHtmlText(String(order.status || 'pending'))}</div></div>
        <div><div class="bank-pay-label">Payment Status</div><div class="bank-pay-value">${escapeHtmlText(String(order.paymentStatus || 'pending'))}</div></div>
        <div><div class="bank-pay-label">Delivery Speed</div><div class="bank-pay-value">${escapeHtmlText(String(order.deliverySpeed || 'standard').toUpperCase())}</div></div>
        <div><div class="bank-pay-label">Items Subtotal</div><div class="bank-pay-value">₦${Number(order.itemsSubtotal || order.totalAmount || 0).toLocaleString()}</div></div>
        <div><div class="bank-pay-label">Delivery Fee</div><div class="bank-pay-value">₦${Number(order.deliveryFee || 0).toLocaleString()}</div></div>
        <div><div class="bank-pay-label">Total</div><div class="bank-pay-value">₦${Number(order.totalAmount || 0).toLocaleString()}</div></div>
      </div>
      <div class="bank-pay-label" style="margin-top:6px;">Items</div>
      ${itemsHtml}
      ${bankHtml}
      ${paymentActionHtml}
      ${invoiceActionHtml}
    </div>
  `;
}

function clearProductOrderForm(resetMessage = true) {
  const form = document.getElementById('productOrderForm');
  if (form instanceof HTMLFormElement) {
    form.reset();
  }

  renderProductOrderPicker(cachedProducts);
  updateProductOrderSummary();

  const messageEl = document.getElementById('productOrderMessage');
  if (messageEl && resetMessage) {
    messageEl.textContent = '';
    messageEl.className = 'message';
  }

  if (resetMessage) {
    const resultEl = document.getElementById('productOrderResult');
    if (resultEl) resultEl.innerHTML = '';
  }

  const productAddressConfig = getAddressLookupConfigByInputId('productOrderAddress');
  if (productAddressConfig) {
    clearAddressLookupUi(productAddressConfig);
  }
}

async function handleProductOrderSubmit(e) {
  if (e) e.preventDefault();

  const nameEl = document.getElementById('productOrderName');
  const emailEl = document.getElementById('productOrderEmail');
  const phoneEl = document.getElementById('productOrderPhone');
  const addressEl = document.getElementById('productOrderAddress');
  const paymentMethodEl = document.getElementById('productOrderPaymentMethod');
  const deliverySpeedEl = document.getElementById('productOrderDeliverySpeed');

  const name = String(nameEl && nameEl.value ? nameEl.value : '').trim();
  const email = String(emailEl && emailEl.value ? emailEl.value : '').trim().toLowerCase();
  const phone = String(phoneEl && phoneEl.value ? phoneEl.value : '').trim();
  const address = String(addressEl && addressEl.value ? addressEl.value : '').trim();
  const paymentMethod = String(paymentMethodEl && paymentMethodEl.value ? paymentMethodEl.value : '').trim();
  const deliverySpeed = String(deliverySpeedEl && deliverySpeedEl.value ? deliverySpeedEl.value : 'standard').trim().toLowerCase();
  const items = collectProductOrderSelections();

  if (!name || !email || !phone || !address || !paymentMethod) {
    showMessage('productOrderMessage', 'Please complete all required fields.', 'error');
    return;
  }

  if (!isValidEmailAddress(email)) {
    markFieldInvalid(emailEl);
    emailEl.focus();
    showMessage('productOrderMessage', 'Please enter a valid email address.', 'error');
    return;
  }
  clearFieldInvalid(emailEl);

  if (!items.length) {
    showMessage('productOrderMessage', 'Please select at least one product to order.', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/product-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        phone,
        address,
        paymentMethod,
        deliverySpeed,
        items
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showMessage('productOrderMessage', result.error || 'Failed to place product order.', 'error');
      return;
    }

    if (result && result.order && result.order.orderCode) {
      const orderCode = String(result.order.orderCode).toUpperCase();
      localStorage.setItem(LAST_PRODUCT_ORDER_CODE_KEY, orderCode);
      if (result.order.id) {
        localStorage.setItem(LAST_PRODUCT_ORDER_ID_KEY, String(result.order.id));
      }
      localStorage.setItem(LAST_PRODUCT_ORDER_EMAIL_KEY, email);

      const codeInput = document.getElementById('trackProductCode');
      const emailInput = document.getElementById('trackProductEmail');
      if (codeInput) codeInput.value = orderCode;
      if (emailInput) emailInput.value = email;
    }

    showMessage('productOrderMessage', result.message || 'Product order created successfully.', 'success');
    renderProductOrderCreated(result);
    clearProductOrderForm(false);
  } catch (error) {
    console.error('Product order submit error:', error);
    showMessage('productOrderMessage', 'Error placing product order. Please try again.', 'error');
  }
}

function renderBookingProductPicker(products) {
  const picker = document.getElementById('bookingProductPicker');
  if (!picker) return;

  if (!Array.isArray(products) || !products.length) {
    picker.innerHTML = '<div class="booking-product-empty">No products available right now.</div>';
    return;
  }

  picker.innerHTML = products.map(product => {
    const id = Number(product.id);
    const stock = Math.max(0, Number(product.stock || 0));
    return `
      <label class="booking-product-row">
        <input type="checkbox" class="booking-product-check" data-product-id="${id}" ${stock <= 0 ? 'disabled' : ''}>
        <span class="booking-product-meta">
          <span class="booking-product-name">${String(product.name || '')}</span>
          <span class="booking-product-sub">${String(product.category || '')} • In stock: ${stock}</span>
        </span>
        <span class="booking-product-price">₦${Number(product.price || 0).toLocaleString()}</span>
        <input type="number" min="1" max="${Math.max(1, stock)}" value="1" class="booking-product-qty" data-product-id="${id}" disabled>
      </label>
    `;
  }).join('');
}

function collectBookingProductSelections() {
  const picker = document.getElementById('bookingProductPicker');
  if (!picker) return [];

  const checks = picker.querySelectorAll('.booking-product-check');
  const selected = [];

  checks.forEach(check => {
    if (!(check instanceof HTMLInputElement) || !check.checked) return;

    const productId = Number(check.dataset.productId || 0);
    const qtyInput = picker.querySelector(`.booking-product-qty[data-product-id="${productId}"]`);
    const quantity = qtyInput instanceof HTMLInputElement ? Math.max(1, Number(qtyInput.value || 1)) : 1;

    if (Number.isFinite(productId) && productId > 0) {
      selected.push({ productId, quantity });
    }
  });

  return selected;
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

  setupCardEntranceAnimations();
}

// Display Products
function displayProducts(products) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  grid.innerHTML = '';

  if (!Array.isArray(products) || products.length === 0) {
    grid.innerHTML = '<div class="message error">No products available right now.</div>';
    return;
  }

  products.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';

    const imageMarkup = product.image
      ? `<img src="${product.image}" alt="${product.name}" class="product-image">`
      : '<div class="product-image-fallback">🛍️</div>';

    card.innerHTML = `
      <div class="product-image-wrapper">${imageMarkup}</div>
      <h3>${product.name}</h3>
      <div class="product-meta">${product.category}</div>
      <div class="product-price">₦${Number(product.price || 0).toLocaleString()}</div>
      <div class="product-stock">In stock: ${product.stock}</div>
    `;
    grid.appendChild(card);
  });

  setupCardEntranceAnimations();
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
  setupNavMenuToggle();
  document.getElementById('bookingForm').addEventListener('submit', handleBooking);
  document.getElementById('contactForm').addEventListener('submit', handleContact);
  const trackForm = document.getElementById('trackBookingForm');
  if (trackForm) {
    trackForm.addEventListener('submit', handleTrackingLookup);
  }
  const trackProductForm = document.getElementById('trackProductForm');
  if (trackProductForm) {
    trackProductForm.addEventListener('submit', handleProductTrackingLookup);
  }
  const productOrderForm = document.getElementById('productOrderForm');
  if (productOrderForm) {
    productOrderForm.addEventListener('submit', handleProductOrderSubmit);
  }
  const clearProductOrderBtn = document.getElementById('clearProductOrderBtn');
  if (clearProductOrderBtn) {
    clearProductOrderBtn.addEventListener('click', () => clearProductOrderForm());
  }
  const productOrderDeliverySpeed = document.getElementById('productOrderDeliverySpeed');
  if (productOrderDeliverySpeed) {
    productOrderDeliverySpeed.addEventListener('change', updateProductOrderSummary);
  }
  const productOrderResult = document.getElementById('productOrderResult');
  if (productOrderResult && !productOrderResult.dataset.bindingsReady) {
    productOrderResult.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.classList.contains('product-order-pay-btn')) {
        handleProductOrderPayNow({
          orderId: target.dataset.orderId || '',
          email: target.dataset.orderEmail || '',
          paymentMethod: target.dataset.paymentMethod || ''
        });
        return;
      }

      if (target.classList.contains('product-invoice-download-btn')) {
        handleInvoiceDownload({
          resourceType: 'product',
          code: target.dataset.orderCode || '',
          email: target.dataset.orderEmail || '',
          messageTargetId: 'productOrderMessage'
        });
      }
    });
    productOrderResult.dataset.bindingsReady = 'true';
  }

  const trackResult = document.getElementById('trackResult');
  if (trackResult && !trackResult.dataset.bindingsReady) {
    trackResult.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.classList.contains('booking-invoice-download-btn')) return;

      handleInvoiceDownload({
        resourceType: 'booking',
        code: target.dataset.bookingCode || '',
        email: target.dataset.bookingEmail || '',
        messageTargetId: 'trackMessage'
      });
    });
    trackResult.dataset.bindingsReady = 'true';
  }

  const trackProductResult = document.getElementById('trackProductResult');
  if (trackProductResult && !trackProductResult.dataset.bindingsReady) {
    trackProductResult.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.classList.contains('product-invoice-download-btn')) return;

      handleInvoiceDownload({
        resourceType: 'product',
        code: target.dataset.orderCode || '',
        email: target.dataset.orderEmail || '',
        messageTargetId: 'trackProductMessage'
      });
    });
    trackProductResult.dataset.bindingsReady = 'true';
  }
  document.getElementById('adminLoginBtn').addEventListener('click', openAdminModal);
  document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
  document.getElementById('adminRegisterForm').addEventListener('submit', handleAdminRegister);
  document.getElementById('requestAccessCodeBtn').addEventListener('click', handleRequestAccessCode);
  document.getElementById('showForgotPasswordBtn').addEventListener('click', toggleForgotPasswordPanel);
  document.getElementById('requestPasswordResetCodeBtn').addEventListener('click', handleRequestPasswordResetCode);
  document.getElementById('resetPasswordBtn').addEventListener('click', handleResetPassword);

  const serviceSelect = document.getElementById('service');
  const paymentPlanSelect = document.getElementById('paymentPlan');
  const homeServiceCheckbox = document.getElementById('homeServiceRequested');

  if (serviceSelect) {
    serviceSelect.addEventListener('change', updatePaymentSummary);
  }

  if (paymentPlanSelect) {
    paymentPlanSelect.addEventListener('change', updatePaymentSummary);
  }

  if (homeServiceCheckbox) {
    homeServiceCheckbox.addEventListener('change', toggleHomeServiceAddress);
  }

  const paymentMethodSelect = document.getElementById('paymentMethod');
  if (paymentMethodSelect) {
    paymentMethodSelect.addEventListener('change', updateOnlinePaymentVisibility);
  }

  const payNowBtn = document.getElementById('payNowBtn');
  if (payNowBtn) {
    payNowBtn.addEventListener('click', handlePayNow);
  }

  const uploadReceiptBtn = document.getElementById('uploadReceiptBtn');
  if (uploadReceiptBtn) {
    uploadReceiptBtn.addEventListener('click', handleUploadReceipt);
  }

  const bookingProductPicker = document.getElementById('bookingProductPicker');
  if (bookingProductPicker && !bookingProductPicker.dataset.bindingsReady) {
    bookingProductPicker.addEventListener('change', event => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      if (target.classList.contains('booking-product-check')) {
        const productId = target.dataset.productId;
        const qtyInput = bookingProductPicker.querySelector(`.booking-product-qty[data-product-id="${productId}"]`);
        if (qtyInput instanceof HTMLInputElement) {
          qtyInput.disabled = !target.checked || target.disabled;
        }
      }
    });
    bookingProductPicker.dataset.bindingsReady = 'true';
  }

  const productOrderPicker = document.getElementById('productOrderPicker');
  if (productOrderPicker && !productOrderPicker.dataset.bindingsReady) {
    productOrderPicker.addEventListener('change', event => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      if (target.classList.contains('product-order-check')) {
        const productId = target.dataset.productId;
        const qtyInput = productOrderPicker.querySelector(`.product-order-qty[data-product-id="${productId}"]`);
        if (qtyInput instanceof HTMLInputElement) {
          qtyInput.disabled = !target.checked || target.disabled;
        }
        updateProductOrderSummary();
      }

      if (target.classList.contains('product-order-qty')) {
        updateProductOrderSummary();
      }
    });
    productOrderPicker.addEventListener('input', event => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.classList.contains('product-order-qty')) {
        updateProductOrderSummary();
      }
    });
    productOrderPicker.dataset.bindingsReady = 'true';
  }
  
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

  initializeAddressLookupAssist();
  initializeBookingInlineValidation();
  initializeBookingReadinessMeter();
}

function initializeTrackingLookup() {
  const trackCodeInput = document.getElementById('trackCode');
  const trackEmailInput = document.getElementById('trackEmail');
  if (!trackCodeInput || !trackEmailInput) return;

  const lastTrackingCode = String(localStorage.getItem('lastTrackingCode') || '').trim();
  const lastBookingEmail = String(localStorage.getItem('lastBookingEmail') || '').trim();

  if (!trackCodeInput.value && lastTrackingCode) {
    trackCodeInput.value = lastTrackingCode;
  }

  if (!trackEmailInput.value && lastBookingEmail) {
    trackEmailInput.value = lastBookingEmail;
  }
}

function initializeProductTrackingLookup() {
  const codeInput = document.getElementById('trackProductCode');
  const emailInput = document.getElementById('trackProductEmail');
  if (!codeInput || !emailInput) return;

  const lastCode = String(localStorage.getItem(LAST_PRODUCT_ORDER_CODE_KEY) || '').trim();
  const lastEmail = String(localStorage.getItem(LAST_PRODUCT_ORDER_EMAIL_KEY) || '').trim();

  if (!codeInput.value && lastCode) {
    codeInput.value = lastCode;
  }

  if (!emailInput.value && lastEmail) {
    emailInput.value = lastEmail;
  }
}

function getAddressLookupConfigByInputId(inputId) {
  return ADDRESS_LOOKUP_CONFIG.find(config => config.inputId === inputId) || null;
}

function getAddressLookupElements(config) {
  const inputEl = document.getElementById(config.inputId);
  const suggestionsEl = document.getElementById(config.suggestionsId);
  const statusEl = document.getElementById(config.statusId);
  const mapBtnEl = document.getElementById(config.mapButtonId);

  return { inputEl, suggestionsEl, statusEl, mapBtnEl };
}

function setAddressLookupStatus(statusEl, message, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = String(message || '').trim();
  statusEl.classList.toggle('error-hint', Boolean(isError && statusEl.textContent));
}

function clearAddressLookupUi(config) {
  const { suggestionsEl, statusEl } = getAddressLookupElements(config);
  if (suggestionsEl) {
    suggestionsEl.innerHTML = '';
    suggestionsEl.classList.add('hidden');
  }
  setAddressLookupStatus(statusEl, '');
}

function openMapSearchForAddress(rawAddress, config) {
  const query = String(rawAddress || '').trim();
  if (!query) {
    showMessage(config.messageTargetId, 'Please type an address first.', 'error');
    return;
  }

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  window.open(mapUrl, '_blank', 'noopener');
}

function renderAddressSuggestions(config, suggestions) {
  const { inputEl, suggestionsEl, statusEl } = getAddressLookupElements(config);
  if (!suggestionsEl || !inputEl) return;

  suggestionsEl.innerHTML = '';

  if (!Array.isArray(suggestions) || !suggestions.length) {
    suggestionsEl.classList.add('hidden');
    setAddressLookupStatus(statusEl, 'No address matches found. Keep typing for better results.');
    return;
  }

  suggestions.forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'address-suggestion-item';

    const title = document.createElement('span');
    title.className = 'address-suggestion-title';
    title.textContent = String(item.displayName || '').trim();

    const meta = document.createElement('span');
    meta.className = 'address-suggestion-meta';
    meta.textContent = `Lat ${item.lat} • Lng ${item.lon}`;

    button.appendChild(title);
    button.appendChild(meta);
    button.addEventListener('click', () => {
      inputEl.value = String(item.displayName || '').trim();

      const state = addressLookupStateByInput.get(config.inputId);
      if (state) {
        state.suppressNextLookup = true;
      }

      clearAddressLookupUi(config);
    });

    suggestionsEl.appendChild(button);
  });

  suggestionsEl.classList.remove('hidden');
  setAddressLookupStatus(statusEl, 'Select an address suggestion or keep typing.');
}

async function fetchAddressSuggestions(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${ADDRESS_LOOKUP_LIMIT}&addressdetails=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Address lookup failed (${response.status})`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) return [];

  return payload
    .map(item => ({
      displayName: String(item && item.display_name ? item.display_name : '').trim(),
      lat: String(item && item.lat ? item.lat : '').trim(),
      lon: String(item && item.lon ? item.lon : '').trim()
    }))
    .filter(item => item.displayName);
}

function scheduleAddressLookup(config) {
  const { inputEl, statusEl } = getAddressLookupElements(config);
  if (!(inputEl instanceof HTMLTextAreaElement || inputEl instanceof HTMLInputElement)) return;

  const state = addressLookupStateByInput.get(config.inputId) || {
    timer: null,
    suppressNextLookup: false
  };
  addressLookupStateByInput.set(config.inputId, state);

  if (state.timer) {
    window.clearTimeout(state.timer);
  }

  const query = String(inputEl.value || '').trim();
  if (query.length < ADDRESS_LOOKUP_MIN_CHARS) {
    clearAddressLookupUi(config);
    if (query.length > 0) {
      setAddressLookupStatus(statusEl, `Type at least ${ADDRESS_LOOKUP_MIN_CHARS} characters for address suggestions.`);
    }
    return;
  }

  if (state.suppressNextLookup) {
    state.suppressNextLookup = false;
    return;
  }

  setAddressLookupStatus(statusEl, 'Searching address suggestions…');

  state.timer = window.setTimeout(async () => {
    try {
      const suggestions = await fetchAddressSuggestions(query);
      renderAddressSuggestions(config, suggestions);
    } catch (error) {
      console.error('Address lookup error:', error);
      clearAddressLookupUi(config);
      setAddressLookupStatus(statusEl, error instanceof Error ? error.message : 'Could not fetch address suggestions.', true);
    }
  }, 380);
}

function initializeAddressLookupAssist() {
  ADDRESS_LOOKUP_CONFIG.forEach(config => {
    const { inputEl, suggestionsEl, mapBtnEl } = getAddressLookupElements(config);
    if (!inputEl || !suggestionsEl) return;

    if (!addressLookupStateByInput.has(config.inputId)) {
      addressLookupStateByInput.set(config.inputId, { timer: null, suppressNextLookup: false });
    }

    if (!inputEl.dataset.addressLookupBound) {
      inputEl.addEventListener('input', () => scheduleAddressLookup(config));
      inputEl.dataset.addressLookupBound = 'true';
    }

    if (mapBtnEl && !mapBtnEl.dataset.addressLookupBound) {
      mapBtnEl.addEventListener('click', () => openMapSearchForAddress(inputEl.value, config));
      mapBtnEl.dataset.addressLookupBound = 'true';
    }
  });
}

function normalizeTrackStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (['approved', 'accepted'].includes(s)) return 'approved';
  if (['cancelled', 'declined', 'rejected'].includes(s)) return 'cancelled';
  if (s === 'completed') return 'completed';
  return 'pending';
}

function isBookingPaidForCustomerNotice(paymentStatus, paidAmount) {
  const normalizedPaymentStatus = String(paymentStatus || '').trim().toLowerCase();
  const numericPaidAmount = Number(paidAmount || 0);
  if (numericPaidAmount > 0) return true;
  return ['paid', 'partial', 'partially_paid', 'partial_paid', 'part_paid'].includes(normalizedPaymentStatus);
}

function getTrackStatusMeta(status, paymentStatus, paidAmount) {
  const normalized = normalizeTrackStatus(status);
  if (normalized === 'approved') {
    return {
      normalized,
      label: '✅ Approved',
      summary: 'Your booking has been approved by admin.'
    };
  }

  if (normalized === 'cancelled') {
    const paidBooking = isBookingPaidForCustomerNotice(paymentStatus, paidAmount);
    return {
      normalized,
      label: '❌ Rejected / Declined',
      summary: paidBooking
        ? 'Your booking request was declined. If payment was made, your refund will be processed to your original payment method within 3 to 7 business days (bank timelines may vary slightly).'
        : 'Your booking request was declined by admin. You may contact the salon to reschedule another available date.'
    };
  }

  if (normalized === 'completed') {
    return {
      normalized,
      label: '🎉 Completed',
      summary: 'Your booking has been completed.'
    };
  }

  return {
    normalized,
    label: '⏳ Pending',
    summary: 'Your booking is still pending admin review.'
  };
}

function buildTrackStatusSteps(status) {
  const current = normalizeTrackStatus(status);
  const pendingClass = current === 'pending' ? 'is-current' : 'is-done';
  const approvedClass = current === 'approved' || current === 'completed' ? 'is-done' : current === 'pending' ? '' : '';
  const rejectedClass = current === 'cancelled' ? 'is-done' : '';
  const completedClass = current === 'completed' ? 'is-done' : '';

  return `
    <div class="track-status-steps">
      <div class="track-step ${pendingClass}">Pending</div>
      <div class="track-step ${approvedClass}">Approved</div>
      <div class="track-step ${rejectedClass}">Rejected / Declined</div>
      <div class="track-step ${completedClass}">Completed</div>
    </div>
  `;
}

function normalizeProductOrderStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'approved') return 'approved';
  if (s === 'processed') return 'processed';
  if (s === 'shipped') return 'shipped';
  if (s === 'on_the_way') return 'on_the_way';
  if (s === 'cancelled') return 'cancelled';
  if (s === 'delivered' || s === 'completed') return 'delivered';
  return 'pending';
}

function getProductOrderStatusMeta(status) {
  const normalized = normalizeProductOrderStatus(status);
  if (normalized === 'approved') {
    return {
      normalized,
      label: '✅ Approved',
      summary: 'Your product order has been approved and is being processed.'
    };
  }

  if (normalized === 'processed') {
    return {
      normalized,
      label: '🧾 Processed',
      summary: 'Your order has been processed and is being prepared for shipment.'
    };
  }

  if (normalized === 'shipped') {
    return {
      normalized,
      label: '🚚 Shipped',
      summary: 'Your order has been shipped and is with the courier network.'
    };
  }

  if (normalized === 'on_the_way') {
    return {
      normalized,
      label: '🛵 On the way',
      summary: 'Your order is currently on the way with the courier rider.'
    };
  }

  if (normalized === 'cancelled') {
    return {
      normalized,
      label: '❌ Cancelled',
      summary: 'Your product order was cancelled.'
    };
  }

  if (normalized === 'delivered') {
    return {
      normalized,
      label: '📦 Delivered',
      summary: 'Your product order has been delivered.'
    };
  }

  return {
    normalized,
    label: '⏳ Pending',
    summary: 'Your product order is pending admin review.'
  };
}

function buildProductTrackStatusSteps(status) {
  const current = normalizeProductOrderStatus(status);
  const pendingClass = current === 'pending' ? 'is-current' : 'is-done';
  const approvedClass = ['approved', 'processed', 'shipped', 'on_the_way', 'delivered'].includes(current) ? 'is-done' : '';
  const processedClass = ['processed', 'shipped', 'on_the_way', 'delivered'].includes(current) ? 'is-done' : '';
  const shippedClass = ['shipped', 'on_the_way', 'delivered'].includes(current) ? 'is-done' : '';
  const onTheWayClass = ['on_the_way', 'delivered'].includes(current) ? 'is-done' : '';
  const cancelledClass = current === 'cancelled' ? 'is-done' : '';
  const deliveredClass = current === 'delivered' ? 'is-done' : '';

  return `
    <div class="track-status-steps">
      <div class="track-step ${pendingClass}">Pending</div>
      <div class="track-step ${approvedClass}">Approved</div>
      <div class="track-step ${processedClass}">Processed</div>
      <div class="track-step ${shippedClass}">Shipped</div>
      <div class="track-step ${onTheWayClass}">On the way</div>
      <div class="track-step ${cancelledClass}">Cancelled</div>
      <div class="track-step ${deliveredClass}">Delivered</div>
    </div>
  `;
}

async function handleInvoiceDownload({ resourceType, code, email, messageTargetId }) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedCode || !normalizedEmail) {
    showMessage(messageTargetId, 'Invoice download needs a valid code and email.', 'error');
    return;
  }

  if (!isValidEmailAddress(normalizedEmail)) {
    showMessage(messageTargetId, 'Please provide a valid email to download the invoice.', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/invoices/access-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceType,
        code: normalizedCode,
        email: normalizedEmail
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      showMessage(messageTargetId, result.error || 'Unable to generate secure invoice link.', 'error');
      return;
    }

    const endpoint = String(result && result.secureInvoiceUrl ? result.secureInvoiceUrl : '').trim();
    if (!endpoint) {
      showMessage(messageTargetId, 'Invoice link was not generated. Please try again.', 'error');
      return;
    }

    const opened = window.open(endpoint, '_blank', 'noopener');
    if (!opened) {
      window.location.href = endpoint;
    }
  } catch (error) {
    showMessage(messageTargetId, 'Failed to request invoice link. Please try again.', 'error');
  }
}

function renderTrackResult(payload, bookingEmail = '') {
  const box = document.getElementById('trackResult');
  if (!box) return;

  const booking = payload && payload.booking ? payload.booking : null;
  const notifications = payload && Array.isArray(payload.notifications) ? payload.notifications : [];

  if (!booking) {
    box.innerHTML = '<div class="message error">No booking data found.</div>';
    return;
  }

  const latestNote = notifications.length ? notifications[notifications.length - 1] : null;
  const latestNoteText = latestNote ? String(latestNote.message || '') : 'No update yet. Please check again later.';
  const statusMeta = getTrackStatusMeta(booking.status, booking.paymentStatus, booking.paidAmount);
  const invoiceLookupCode = String(booking.trackingCode || booking.id || '').trim().toUpperCase();
  const invoiceEmail = String(bookingEmail || booking.email || localStorage.getItem('lastBookingEmail') || '').trim().toLowerCase();
  const invoiceActionHtml = invoiceLookupCode && invoiceEmail
    ? `
      <div class="product-order-action-row">
        <button
          type="button"
          class="submit-btn booking-invoice-download-btn"
          data-booking-code="${escapeHtmlText(invoiceLookupCode)}"
          data-booking-email="${escapeHtmlText(invoiceEmail)}">
          Download Booking Invoice (PDF)
        </button>
        <small class="product-order-action-note">Invoice opens in a new tab and downloads as PDF.</small>
      </div>
    `
    : '';

  box.innerHTML = `
    <div class="bank-pay-card" style="margin-top:12px;">
      <h3 class="bank-pay-heading">Tracking Result</h3>
      <div class="bank-pay-grid">
        <div><div class="bank-pay-label">Tracking Code</div><div class="bank-pay-value">${String(booking.trackingCode || '').trim() || 'N/A'}</div></div>
        <div><div class="bank-pay-label">Status</div><div class="bank-pay-value">${statusMeta.label}</div></div>
        <div><div class="bank-pay-label">Service</div><div class="bank-pay-value">${String(booking.serviceName || 'N/A')}</div></div>
        <div><div class="bank-pay-label">Date / Time</div><div class="bank-pay-value">${String(booking.date || '')} ${String(booking.time || '')}</div></div>
      </div>
      <div class="track-status-summary">${statusMeta.summary}</div>
      ${buildTrackStatusSteps(booking.status)}
      <div class="bank-pay-muted" style="margin-top:10px;"><strong>Latest update:</strong> ${latestNoteText}</div>
      ${invoiceActionHtml}
    </div>
  `;
}

async function handleTrackingLookup(e) {
  if (e) e.preventDefault();

  const trackCodeInput = document.getElementById('trackCode');
  const trackEmailInput = document.getElementById('trackEmail');

  const trackingCode = String(trackCodeInput && trackCodeInput.value ? trackCodeInput.value : '').trim().toUpperCase();
  const email = String(trackEmailInput && trackEmailInput.value ? trackEmailInput.value : '').trim().toLowerCase();

  if (!trackingCode || !email) {
    showMessage('trackMessage', 'Enter your tracking code and booking email.', 'error');
    return;
  }

  if (!isValidEmailAddress(email)) {
    markFieldInvalid(trackEmailInput);
    trackEmailInput.focus();
    showMessage('trackMessage', 'Please enter a valid booking email address.', 'error');
    return;
  }
  clearFieldInvalid(trackEmailInput);

  try {
    const response = await fetch(`${API_URL}/bookings/track?trackingCode=${encodeURIComponent(trackingCode)}&email=${encodeURIComponent(email)}`);
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showMessage('trackMessage', result.error || 'Unable to track booking right now.', 'error');
      return;
    }

    localStorage.setItem('lastTrackingCode', trackingCode);
    localStorage.setItem('lastBookingEmail', email);
    renderTrackResult(result, email);
    showMessage('trackMessage', 'Tracking result loaded successfully.', 'success');
  } catch (error) {
    console.error('Tracking lookup error:', error);
    showMessage('trackMessage', 'Error checking tracking status. Please try again.', 'error');
  }
}

function renderProductTrackResult(payload, orderEmail = '') {
  const box = document.getElementById('trackProductResult');
  if (!box) return;

  const order = payload && payload.order ? payload.order : null;
  const notifications = payload && Array.isArray(payload.notifications) ? payload.notifications : [];
  if (!order) {
    box.innerHTML = '<div class="message error">No product order data found.</div>';
    return;
  }

  const statusMeta = getProductOrderStatusMeta(order.status);
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsHtml = items.length
    ? `<ul style="margin:8px 0 0 16px; color:#555;">${items.map(item => `<li>${escapeHtmlText(String(item.name || 'Product'))} × ${Number(item.quantity || 0)} — ₦${Number(item.lineTotal || 0).toLocaleString()}</li>`).join('')}</ul>`
    : '<div class="bank-pay-muted">No item details available.</div>';
  const latestNote = notifications.length ? notifications[notifications.length - 1] : null;
  const latestNoteText = latestNote ? String(latestNote.message || '') : 'No delivery updates yet. Please check again later.';
  const paymentStatus = String(order.paymentStatus || 'pending').trim().toLowerCase();
  const canPayNow = isProductOrderOnlinePaymentMethod(order.paymentMethod) && ['pending', 'initiated', 'failed'].includes(paymentStatus) && Number(order.amountDueNow || 0) > 0;
  const cachedOrderEmail = String(localStorage.getItem(LAST_PRODUCT_ORDER_EMAIL_KEY) || '').trim().toLowerCase();
  const invoiceLookupCode = String(order.orderCode || order.id || '').trim().toUpperCase();
  const invoiceEmail = String(orderEmail || order.email || cachedOrderEmail || '').trim().toLowerCase();
  const paymentActionHtml = canPayNow && cachedOrderEmail
    ? `
      <div class="product-order-action-row">
        <button
          type="button"
          class="submit-btn product-order-pay-btn"
          data-order-id="${escapeHtmlText(String(order.id || ''))}"
          data-order-email="${escapeHtmlText(cachedOrderEmail)}"
          data-payment-method="${escapeHtmlText(String(order.paymentMethod || ''))}">
          Pay Remaining Amount (Paystack)
        </button>
        <small class="product-order-action-note">Use the same order email to continue secure payment.</small>
      </div>
    `
    : '';
  const invoiceActionHtml = invoiceLookupCode && invoiceEmail
    ? `
      <div class="product-order-action-row">
        <button
          type="button"
          class="submit-btn product-invoice-download-btn"
          data-order-code="${escapeHtmlText(invoiceLookupCode)}"
          data-order-email="${escapeHtmlText(invoiceEmail)}">
          Download Product Invoice (PDF)
        </button>
        <small class="product-order-action-note">Use your order code + email invoice copy anytime.</small>
      </div>
    `
    : '';

  box.innerHTML = `
    <div class="bank-pay-card" style="margin-top:12px;">
      <h3 class="bank-pay-heading">Product Order Tracking Result</h3>
      <div class="bank-pay-grid">
        <div><div class="bank-pay-label">Order Code</div><div class="bank-pay-value">${String(order.orderCode || '').trim() || 'N/A'}</div></div>
        <div><div class="bank-pay-label">Status</div><div class="bank-pay-value">${statusMeta.label}</div></div>
        <div><div class="bank-pay-label">Payment Status</div><div class="bank-pay-value">${String(order.paymentStatus || 'pending')}</div></div>
        <div><div class="bank-pay-label">Payment Method</div><div class="bank-pay-value">${String(order.paymentMethod || 'N/A')}</div></div>
        <div><div class="bank-pay-label">Delivery Speed</div><div class="bank-pay-value">${String(order.deliverySpeed || 'standard').toUpperCase()}</div></div>
        <div><div class="bank-pay-label">Items Subtotal</div><div class="bank-pay-value">₦${Number(order.itemsSubtotal || order.totalAmount || 0).toLocaleString()}</div></div>
        <div><div class="bank-pay-label">Delivery Fee</div><div class="bank-pay-value">₦${Number(order.deliveryFee || 0).toLocaleString()}</div></div>
        <div><div class="bank-pay-label">Total</div><div class="bank-pay-value">₦${Number(order.totalAmount || 0).toLocaleString()}</div></div>
        <div><div class="bank-pay-label">Amount Remaining</div><div class="bank-pay-value">₦${Number(order.amountRemaining || 0).toLocaleString()}</div></div>
      </div>
      <div class="track-status-summary">${statusMeta.summary}</div>
      ${buildProductTrackStatusSteps(order.status)}
      <div class="bank-pay-muted" style="margin-top:10px;"><strong>Latest update:</strong> ${escapeHtmlText(latestNoteText)}</div>
      <div class="bank-pay-label" style="margin-top:6px;">Items</div>
      ${itemsHtml}
      ${paymentActionHtml}
      ${invoiceActionHtml}
    </div>
  `;
}

async function handleProductTrackingLookup(e) {
  if (e) e.preventDefault();

  const codeInput = document.getElementById('trackProductCode');
  const emailInput = document.getElementById('trackProductEmail');

  const orderCode = String(codeInput && codeInput.value ? codeInput.value : '').trim().toUpperCase();
  const email = String(emailInput && emailInput.value ? emailInput.value : '').trim().toLowerCase();

  if (!orderCode || !email) {
    showMessage('trackProductMessage', 'Enter your product order code and order email.', 'error');
    return;
  }

  if (!isValidEmailAddress(email)) {
    markFieldInvalid(emailInput);
    emailInput.focus();
    showMessage('trackProductMessage', 'Please enter a valid order email address.', 'error');
    return;
  }
  clearFieldInvalid(emailInput);

  try {
    const response = await fetch(`${API_URL}/product-orders/track?orderCode=${encodeURIComponent(orderCode)}&email=${encodeURIComponent(email)}`);
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      showMessage('trackProductMessage', result.error || 'Unable to track product order right now.', 'error');
      return;
    }

    localStorage.setItem(LAST_PRODUCT_ORDER_CODE_KEY, orderCode);
    localStorage.setItem(LAST_PRODUCT_ORDER_EMAIL_KEY, email);
    renderProductTrackResult(result, email);
    showMessage('trackProductMessage', 'Product order tracking result loaded successfully.', 'success');
  } catch (error) {
    console.error('Product tracking lookup error:', error);
    showMessage('trackProductMessage', 'Error checking product order status. Please try again.', 'error');
  }
}

async function handleUploadReceipt() {
  const bookingId = localStorage.getItem('lastBookingId');
  const email = localStorage.getItem('lastBookingEmail');
  const fileInput = document.getElementById('paymentReceiptFile');
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;

  if (!bookingId || !email) {
    showMessage('bookingMessage', 'No booking found. Please book a service first.', 'error');
    return;
  }

  if (!file) {
    showMessage('bookingMessage', 'Please choose a receipt file (image or PDF).', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('email', email);
  formData.append('receipt', file);

  try {
    const response = await fetch(`${API_URL}/bookings/${encodeURIComponent(bookingId)}/upload-receipt`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      showMessage('bookingMessage', result.error || 'Failed to upload receipt', 'error');
      return;
    }

    showMessage('bookingMessage', result.message || 'Receipt uploaded successfully', 'success');
    if (fileInput) fileInput.value = '';
  } catch (error) {
    console.error('Receipt upload error:', error);
    showMessage('bookingMessage', 'Error uploading receipt', 'error');
  }
}

function updateOnlinePaymentVisibility() {
  const paymentMethod = String(document.getElementById('paymentMethod')?.value || '').trim();
  const onlineGroup = document.getElementById('onlinePaymentChannelGroup');
  const providerSelect = document.getElementById('paymentProvider');
  const channelSelect = document.getElementById('paymentChannel');
  const isBankTransfer = paymentMethod === 'Bank Transfer';

  const isOnline = ['Credit Card', 'Debit Card', 'USSD', 'Paystack Bank Transfer'].includes(paymentMethod);
  if (onlineGroup) {
    onlineGroup.style.display = isOnline ? '' : 'none';
  }

  // Only show bank transfer panel when bank transfer payment method is selected.
  if (isBankTransfer) {
    const draftDetails = {
      bankName: BOOKING_BANK_DETAILS_DEFAULT.bankName,
      accountNumber: BOOKING_BANK_DETAILS_DEFAULT.accountNumber,
      accountName: BOOKING_BANK_DETAILS_DEFAULT.accountName,
      amountDueNow: inferCurrentBookingAmountDueNow(),
      reference: 'Will be generated after booking submission'
    };
    fillBankPayPanel(draftDetails);
    setBankPayPanelVisible(true);
    setPayNowPanelVisible(false);
  } else {
    setBankPayPanelVisible(false);
  }

  // If user explicitly chooses Paystack bank transfer, lock in Paystack + bank_transfer.
  if (paymentMethod === 'Paystack Bank Transfer') {
    if (providerSelect) providerSelect.value = 'paystack';
    if (channelSelect) channelSelect.value = 'bank_transfer';
  }
}

function inferCurrentBookingAmountDueNow() {
  const serviceId = Number(document.getElementById('service')?.value || 0);
  const paymentPlan = String(document.getElementById('paymentPlan')?.value || '').trim();
  const service = cachedServices.find(s => Number(s.id) === serviceId);

  if (!service) return 0;

  const total = Number(service.price || 0);
  if (paymentPlan === 'deposit_50') {
    return Math.ceil(total * 0.5);
  }

  return total;
}

function setPayNowPanelVisible(visible) {
  const panel = document.getElementById('payNowPanel');
  if (!panel) return;
  panel.style.display = visible ? '' : 'none';

  // If a Paystack payment link is configured, only show it during the payment step.
  const blockEl = document.getElementById('paystackPaymentBlock');
  const linkEl = document.getElementById('paystackPaymentLink');
  const canShowLink = Boolean(visible && paystackPaymentPageUrl);

  if (blockEl) {
    if (canShowLink) blockEl.classList.remove('hidden');
    else blockEl.classList.add('hidden');
  }

  if (linkEl && canShowLink) {
    linkEl.href = paystackPaymentPageUrl;
  }
}

async function refreshPayNowAvailability() {
  const payNowBtn = document.getElementById('payNowBtn');
  const payNowHint = document.getElementById('payNowHint');
  const providerSelect = document.getElementById('paymentProvider');
  const channelSelect = document.getElementById('paymentChannel');
  if (!payNowBtn) return;

  // Default optimistic state.
  payNowBtn.disabled = false;
  payNowBtn.classList.remove('disabled');
  if (payNowHint) {
    payNowHint.textContent = 'You will be redirected to a secure payment page.';
  }

  if (payNowBtn) {
    payNowBtn.textContent = 'Pay Now';
  }

  const normalizeProviderValue = (v) => String(v || '').trim().toLowerCase();
  const desiredProvider = normalizeProviderValue(providerSelect?.value);
  const desiredChannel = String(channelSelect?.value || '').trim().toLowerCase();

  const fetchStatus = async (provider) => {
    const res = await fetch(`${API_URL}/payments/${provider}/status`);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };

  try {
    const [paystack, monnify, stripe] = await Promise.all([
      fetchStatus('paystack'),
      fetchStatus('monnify'),
      fetchStatus('stripe')
    ]);

    const paystackOk = paystack.ok && paystack.data && paystack.data.configured === true;
    const monnifyOk = monnify.ok && monnify.data && monnify.data.configured === true;
    const stripeOk = stripe.ok && stripe.data && stripe.data.configured === true;

    const pickAuto = () => {
      if (paystackOk) return 'paystack';
      if (stripeOk) return 'stripe';
      if (monnifyOk) return 'monnify';
      return '';
    };

    const chosen = desiredProvider || pickAuto();

    if (providerSelect && !desiredProvider && chosen) {
      providerSelect.value = chosen;
    }

    const configuredForChosen = chosen === 'paystack'
      ? paystackOk
      : chosen === 'monnify'
        ? monnifyOk
        : chosen === 'stripe'
          ? stripeOk
          : (paystackOk || monnifyOk || stripeOk);

    if (!configuredForChosen) {
      payNowBtn.disabled = true;
      payNowBtn.classList.add('disabled');
      if (payNowHint) {
        const providerMsg = chosen === 'paystack'
          ? (paystack.data && paystack.data.message)
          : chosen === 'monnify'
            ? (monnify.data && monnify.data.message)
            : chosen === 'stripe'
              ? (stripe.data && stripe.data.message)
              : null;

        payNowHint.textContent = providerMsg
          ? providerMsg
          : 'Online payments are not available right now. Please choose Bank Transfer or Cash.';
      }
      return;
    }

    if (payNowBtn) {
      if (chosen === 'paystack') payNowBtn.textContent = 'Pay Now (Paystack)';
      if (chosen === 'monnify') payNowBtn.textContent = 'Pay Now (Monnify)';
      if (chosen === 'stripe') payNowBtn.textContent = 'Pay Now (Stripe)';
    }

    if (payNowHint) {
      if (chosen === 'monnify') {
        payNowHint.textContent = 'You will be redirected to Monnify secure checkout.';
      } else if (chosen === 'paystack' && desiredChannel === 'bank_transfer') {
        payNowHint.textContent = 'You will be redirected to Paystack checkout where a temporary bank account will be generated for you to transfer into.';
      } else {
        payNowHint.textContent = 'You will be redirected to a secure payment page.';
      }
    }
  } catch (e) {
    // If status check fails (offline/server down), disable to avoid a confusing experience.
    payNowBtn.disabled = true;
    payNowBtn.classList.add('disabled');
    if (payNowHint) {
      payNowHint.textContent = 'Unable to reach payment service right now. Please try again later or use Bank Transfer.';
    }
  }
}

function inferMonnifyPaymentMethods(paymentMethod) {
  const method = String(paymentMethod || '').trim();
  if (method === 'USSD') {
    return ['USSD'];
  }

  // Credit/Debit: prioritize card, but allow transfer as fallback.
  return ['CARD', 'ACCOUNT_TRANSFER'];
}

async function handlePayNowMonnify({ bookingId, email }) {
  const paymentMethod = String(document.getElementById('paymentMethod')?.value || '').trim();
  const paymentMethods = inferMonnifyPaymentMethods(paymentMethod);

  const response = await fetch(`${API_URL}/payments/monnify/initialize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId, email, paymentMethods })
  });

  const result = await response.json();

  if (!response.ok) {
    const hint = result && result.hint ? ` ${result.hint}` : '';
    showMessage('bookingMessage', (result.error || 'Failed to start payment') + hint, 'error');
    return;
  }

  if (result.checkoutUrl) {
    window.location.href = result.checkoutUrl;
    return;
  }

  showMessage('bookingMessage', 'Payment initialization did not return a checkout URL.', 'error');
}

function setBankPayPanelVisible(visible) {
  const panel = document.getElementById('bankPayPanel');
  if (!panel) return;
  panel.style.display = visible ? '' : 'none';
}

function fillBankPayPanel(details) {
  if (!details) return;
  const bankEl = document.getElementById('bankPayBank');
  const acctEl = document.getElementById('bankPayAccount');
  const nameEl = document.getElementById('bankPayName');
  const amountEl = document.getElementById('bankPayAmount');
  const refEl = document.getElementById('bankPayRef');

  if (bankEl) bankEl.textContent = details.bankName || '—';
  if (acctEl) acctEl.textContent = details.accountNumber || '—';
  if (nameEl) nameEl.textContent = details.accountName || '—';
  if (amountEl) amountEl.textContent = `₦${Number(details.amountDueNow || 0).toLocaleString()}`;
  if (refEl) refEl.textContent = details.reference || '—';
}

async function loadBankPaymentDetailsForLastBooking() {
  const bookingId = localStorage.getItem('lastBookingId');
  const email = localStorage.getItem('lastBookingEmail');

  if (!bookingId || !email) return null;

  const response = await fetch(`${API_URL}/payments/bank/details?bookingId=${encodeURIComponent(bookingId)}&email=${encodeURIComponent(email)}`);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to load bank payment details');
  }

  return result;
}

function setLastBookingForPayment(booking) {
  if (!booking) return;
  localStorage.setItem('lastBookingId', booking.id);
  localStorage.setItem('lastBookingEmail', booking.email);
  if (booking.trackingCode) {
    localStorage.setItem('lastTrackingCode', booking.trackingCode);
  }

  const trackCodeInput = document.getElementById('trackCode');
  const trackEmailInput = document.getElementById('trackEmail');
  if (trackCodeInput && booking.trackingCode) {
    trackCodeInput.value = booking.trackingCode;
  }
  if (trackEmailInput && booking.email) {
    trackEmailInput.value = booking.email;
  }
}

async function handlePayNow() {
  const bookingId = localStorage.getItem('lastBookingId');
  const email = localStorage.getItem('lastBookingEmail');
  const paymentChannel = String(document.getElementById('paymentChannel')?.value || '').trim();
  const paymentProvider = String(document.getElementById('paymentProvider')?.value || '').trim().toLowerCase();

  if (!bookingId || !email) {
    showMessage('bookingMessage', 'No booking found to pay for. Please book a service first.', 'error');
    return;
  }

  try {
    if (paymentProvider === 'monnify') {
      await handlePayNowMonnify({ bookingId, email });
      return;
    }

    if (paymentProvider === 'stripe') {
      const response = await fetch(`${API_URL}/payments/stripe/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, email })
      });

      const result = await response.json();

      if (!response.ok) {
        const hint = result && result.hint ? ` ${result.hint}` : '';
        showMessage('bookingMessage', (result.error || 'Failed to start payment') + hint, 'error');
        return;
      }

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      showMessage('bookingMessage', 'Stripe payment initialization did not return a checkout URL.', 'error');
      return;
    }

    const response = await fetch(`${API_URL}/payments/paystack/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, email, paymentChannel })
    });

    const result = await response.json();

    if (!response.ok) {
      const hint = result && result.hint ? ` ${result.hint}` : '';
      showMessage('bookingMessage', (result.error || 'Failed to start payment') + hint, 'error');
      return;
    }

    if (result.authorizationUrl) {
      window.location.href = result.authorizationUrl;
      return;
    }

    showMessage('bookingMessage', 'Payment initialization did not return a payment URL.', 'error');
  } catch (error) {
    console.error('Payment init error:', error);
    showMessage('bookingMessage', 'Error starting payment', 'error');
  }
}

function toggleHomeServiceAddress() {
  const checkbox = document.getElementById('homeServiceRequested');
  const addressGroup = document.getElementById('homeServiceAddressGroup');
  const addressInput = document.getElementById('homeServiceAddress');

  if (!checkbox || !addressGroup) return;

  const show = checkbox.checked === true;
  addressGroup.style.display = show ? '' : 'none';

  if (!show && addressInput) {
    addressInput.value = '';
    const homeAddressConfig = getAddressLookupConfigByInputId('homeServiceAddress');
    if (homeAddressConfig) {
      clearAddressLookupUi(homeAddressConfig);
    }
  }

  updateBookingReadinessMeter();
}

function updatePaymentSummary() {
  const summaryEl = document.getElementById('paymentSummary');
  const serviceSelect = document.getElementById('service');
  const planSelect = document.getElementById('paymentPlan');

  if (!summaryEl || !serviceSelect || !planSelect) return;

  const serviceId = Number(serviceSelect.value);
  const plan = String(planSelect.value || '').trim();
  const service = cachedServices.find(s => Number(s.id) === serviceId);

  if (!service) {
    summaryEl.textContent = 'Select a service to see payment details.';
    return;
  }

  const total = Number(service.price || 0);
  const dueNow = plan === 'deposit_50' ? Math.ceil(total * 0.5) : total;
  const remaining = Math.max(0, total - dueNow);

  if (!plan) {
    summaryEl.textContent = `Total: ₦${total.toLocaleString()}. Choose a payment option (full or 50% deposit).`;
    return;
  }

  summaryEl.textContent = `Total: ₦${total.toLocaleString()} | Pay now: ₦${dueNow.toLocaleString()} | Remaining: ₦${remaining.toLocaleString()}`;
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

  const sensitiveInputIds = ['loginPassword', 'loginSecretPasscode', 'resetNewPassword', 'registerPassword', 'registerSecretPasscode'];

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

function toggleForgotPasswordPanel() {
  const panel = document.getElementById('forgotPasswordPanel');
  const toggleBtn = document.getElementById('showForgotPasswordBtn');
  const toggleLabel = document.getElementById('forgotToggleLabel');
  const toggleIcon = document.getElementById('forgotToggleIcon');
  if (!panel) return;

  const isHidden = panel.classList.toggle('is-initially-hidden');
  const expanded = !isHidden;

  if (toggleBtn) {
    toggleBtn.setAttribute('aria-expanded', String(expanded));
  }
  if (toggleLabel) {
    toggleLabel.textContent = expanded
      ? 'Hide password reset options'
      : 'Forgot password? Tap to reset';
  }
  if (toggleIcon) {
    toggleIcon.textContent = expanded ? '▴' : '▾';
  }
}

// Handle Booking Submission
async function handleBooking(e) {
  e.preventDefault();

  const bookingNameInput = document.getElementById('name');
  const bookingEmailInput = document.getElementById('email');
  const bookingPhoneInput = document.getElementById('phone');
  const bookingDateInput = document.getElementById('date');
  const bookingTimeInput = document.getElementById('time');

  const inlineValidationTargets = [
    bookingNameInput,
    bookingEmailInput,
    bookingPhoneInput,
    bookingDateInput,
    bookingTimeInput
  ].filter(Boolean);

  const hasInlineValidationError = inlineValidationTargets
    .map(field => validateBookingField(field))
    .some(isValid => !isValid);

  if (hasInlineValidationError) {
    const firstInvalid = inlineValidationTargets.find(field => field.classList && field.classList.contains('field-error'));
    if (firstInvalid && typeof firstInvalid.focus === 'function') {
      firstInvalid.focus();
    }
    showMessage('bookingMessage', 'Please fix the highlighted booking fields and try again.', 'error');
    return;
  }

  const selectedProducts = collectBookingProductSelections();
  const homeServiceRequested = document.getElementById('homeServiceRequested').checked;
  const homeServiceAddress = document.getElementById('homeServiceAddress').value;

  if (homeServiceRequested && !String(homeServiceAddress || '').trim()) {
    showMessage('bookingMessage', 'Please enter your home service address.', 'error');
    return;
  }

  const refreshmentSelection = document.querySelector('input[name="refreshment"]:checked');
  const emailValue = String(bookingEmailInput.value || '').trim().toLowerCase();

  if (!isValidEmailAddress(emailValue)) {
    markFieldInvalid(bookingEmailInput);
    bookingEmailInput.focus();
    showMessage('bookingMessage', 'Please enter a valid email address before booking.', 'error');
    return;
  }
  clearFieldInvalid(bookingEmailInput);
  
  const formData = new FormData();
  formData.append('name', document.getElementById('name').value);
  formData.append('email', emailValue);
  formData.append('phone', document.getElementById('phone').value);
  formData.append('serviceId', document.getElementById('service').value);
  formData.append('date', document.getElementById('date').value);
  formData.append('time', document.getElementById('time').value);
  formData.append('language', document.getElementById('language').value);
  formData.append('paymentMethod', document.getElementById('paymentMethod').value);
  formData.append('paymentPlan', document.getElementById('paymentPlan').value);
  formData.append('homeServiceRequested', String(homeServiceRequested));
  formData.append('homeServiceAddress', homeServiceAddress);
  formData.append('refreshment', refreshmentSelection ? refreshmentSelection.value : 'No');
  formData.append('specialRequests', document.getElementById('specialRequests').value);
  formData.append('productSelections', JSON.stringify(selectedProducts));
  
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
    const result = await response.json().catch(() => ({}));
    
    if (response.ok) {
      const successMessage = result.message || languageManager.translate('booking_success');
      showMessage('bookingMessage', successMessage, 'success');

      setLastBookingForPayment(result.booking);
      updateOnlinePaymentVisibility();
      const paymentMethod = String(document.getElementById('paymentMethod').value || '').trim();

      // Reset panels
      setPayNowPanelVisible(false);
      setBankPayPanelVisible(false);

      // Online redirect payments (Paystack)
      const wantsOnline = ['Credit Card', 'Debit Card', 'USSD', 'Paystack Bank Transfer'].includes(paymentMethod);
      if (wantsOnline) {
        setPayNowPanelVisible(true);
        refreshPayNowAvailability();
      }

      // Bank transfer (salon account + per-booking reference)
      if (paymentMethod === 'Bank Transfer') {
        try {
          const details = result.paymentBankDetails || await loadBankPaymentDetailsForLastBooking();
          fillBankPayPanel(details);
          setBankPayPanelVisible(true);
        } catch (e) {
          console.error(e);
        }
      }

      document.getElementById('bookingForm').reset();
      document.getElementById('imagePreview').innerHTML = '';
      renderBookingProductPicker(cachedProducts);
      updateOnlinePaymentVisibility();
      updateBookingReadinessMeter();
    } else {
      showMessage('bookingMessage', result.error || languageManager.translate('booking_error'), 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('bookingMessage', languageManager.translate('booking_error'), 'error');
  }
}

// Handle Contact Form
async function handleContact(e) {
  e.preventDefault();

  const contactEmailInput = document.getElementById('contactEmail');
  const contactEmail = String(contactEmailInput.value || '').trim().toLowerCase();
  if (!isValidEmailAddress(contactEmail)) {
    markFieldInvalid(contactEmailInput);
    contactEmailInput.focus();
    showMessage('contactMessage', 'Please enter a valid email address.', 'error');
    return;
  }
  clearFieldInvalid(contactEmailInput);
  
  const supportTicketRef = generateSupportTicketRef();

  const formData = new FormData();
  const supportPriority = String(document.getElementById('customerCarePriority')?.value || 'normal').trim();
  const preferredReplyChannel = String(document.getElementById('preferredContactChannel')?.value || 'email').trim();
  const contactSubjectEl = document.getElementById('contactSubject');
  const subjectRaw = String(contactSubjectEl && contactSubjectEl.value ? contactSubjectEl.value : '').trim();
  const subjectPrefix = supportPriority === 'urgent'
    ? '[URGENT] '
    : supportPriority === 'priority'
      ? '[PRIORITY] '
      : '';

  formData.append('name', document.getElementById('contactName').value);
  formData.append('email', contactEmail);
  formData.append('subject', `${subjectPrefix}${subjectRaw}`);
  formData.append('message', document.getElementById('contactMessageText').value);
  formData.append('reportType', document.getElementById('reportType').value || '');
  formData.append('supportPriority', supportPriority);
  formData.append('preferredReplyChannel', preferredReplyChannel);
  formData.append('supportTicketRef', supportTicketRef);
  
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
      showMessage('contactMessage', `${languageManager.translate('contact_success')} Ticket: ${supportTicketRef}`, 'success');
      renderContactTicketRef(supportTicketRef);
      document.getElementById('contactForm').reset();
      document.getElementById('reportFilePreview').innerHTML = '';
    } else {
      showMessage('contactMessage', languageManager.translate('contact_error'), 'error');
      renderContactTicketRef('');
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('contactMessage', languageManager.translate('contact_error'), 'error');
    renderContactTicketRef('');
  }
}

// Show Message
function showMessage(elementId, message, type) {
  const messageEl = document.getElementById(elementId);
  if (!messageEl) return;
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
  
  const loginEmailInput = document.getElementById('loginEmail');
  const email = loginEmailInput.value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value.trim();
  const oneTimeCode = String(document.getElementById('loginAccessCode').value || '').replace(/\D/g, '').trim();
  const secretPasscode = document.getElementById('loginSecretPasscode').value.trim();

  if (!isValidEmailAddress(email)) {
    markFieldInvalid(loginEmailInput);
    loginEmailInput.focus();
    showAdminMessage('loginMessage', 'Please enter a valid email address.', 'error');
    return;
  }
  clearFieldInvalid(loginEmailInput);
  
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
  const loginEmailInput = document.getElementById('loginEmail');
  const email = loginEmailInput.value.trim().toLowerCase();
  const secretPasscode = document.getElementById('loginSecretPasscode').value.trim();

  if (!email || !secretPasscode) {
    showAdminMessage('loginMessage', 'Enter admin email and secret passcode first.', 'error');
    return;
  }

  if (!isValidEmailAddress(email)) {
    markFieldInvalid(loginEmailInput);
    loginEmailInput.focus();
    showAdminMessage('loginMessage', 'Please enter a valid admin email address.', 'error');
    return;
  }
  clearFieldInvalid(loginEmailInput);

  try {
    const response = await fetch(`${API_URL}/admin/request-login-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, secretPasscode })
    });

    const rawText = await response.text();
    let result = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch {
      result = {
        error: rawText || `Server returned an unexpected response (${response.status})`
      };
    }

    if (!response.ok) {
      const hint = result && result.hint ? ` ${result.hint}` : '';
      const delivery = result && result.delivery ? result.delivery : null;
      const parts = [];

      if (delivery && delivery.email && delivery.email.reason) {
        parts.push(`Email: ${delivery.email.reason}`);
      }

      if (delivery && delivery.sms && delivery.sms.reason) {
        parts.push(`SMS: ${delivery.sms.reason}`);
      }

      const details = parts.length ? ` (${parts.join(' | ')})` : '';
      showAdminMessage('loginMessage', (result.error || 'Failed to generate access code') + hint + details, 'error');
      return;
    }

    const deliveredByRaw = result && result.deliveredBy ? result.deliveredBy : [];
    const deliveredByList = Array.isArray(deliveredByRaw)
      ? deliveredByRaw.map(item => String(item || '').trim().toLowerCase()).filter(Boolean)
      : [String(deliveredByRaw || '').trim().toLowerCase()].filter(Boolean);
    const expires = result && result.expiresInMinutes ? result.expiresInMinutes : 10;

    if (deliveredByList.includes('email') && deliveredByList.includes('sms')) {
      showAdminMessage('loginMessage', `OTP successfully sent to email/phone number. Enter it below (valid ${expires} minutes).`, 'success');
      return;
    }

    if (deliveredByList.includes('email')) {
      showAdminMessage('loginMessage', `OTP successfully sent to email. Enter it below (valid ${expires} minutes).`, 'success');
      return;
    }

    if (deliveredByList.includes('sms')) {
      showAdminMessage('loginMessage', `OTP successfully sent to phone number. Enter it below (valid ${expires} minutes).`, 'success');
      return;
    }

    // Backward compatibility if email OTP is disabled.
    if (result && result.accessCode) {
      document.getElementById('loginAccessCode').value = result.accessCode;
      showAdminMessage('loginMessage', `One-time code generated: ${result.accessCode} (valid ${expires} minutes).`, 'success');
      return;
    }

    showAdminMessage('loginMessage', `OTP requested successfully. Enter the code (valid ${expires} minutes).`, 'success');
  } catch (error) {
    const message = error && error.message
      ? `Unable to reach server while generating access code. ${error.message}`
      : 'Unable to reach server while generating access code.';
    showAdminMessage('loginMessage', message, 'error');
  }
}

async function handleRequestPasswordResetCode() {
  const loginEmailInput = document.getElementById('loginEmail');
  const email = loginEmailInput.value.trim().toLowerCase();
  const secretPasscode = document.getElementById('loginSecretPasscode').value.trim();

  if (!email || !secretPasscode) {
    showAdminMessage('loginMessage', 'Enter admin email and secret passcode first.', 'error');
    return;
  }

  if (!isValidEmailAddress(email)) {
    markFieldInvalid(loginEmailInput);
    loginEmailInput.focus();
    showAdminMessage('loginMessage', 'Please enter a valid admin email address.', 'error');
    return;
  }
  clearFieldInvalid(loginEmailInput);

  try {
    const response = await fetch(`${API_URL}/admin/request-login-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, secretPasscode })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      showAdminMessage('loginMessage', result.error || 'Failed to send password reset OTP', 'error');
      return;
    }

    showAdminMessage('loginMessage', 'Password reset OTP sent. Enter it below with your new password.', 'success');
  } catch (error) {
    showAdminMessage('loginMessage', 'Unable to send password reset OTP right now.', 'error');
  }
}

async function handleResetPassword() {
  const loginEmailInput = document.getElementById('loginEmail');
  const resetCodeInput = document.getElementById('resetAccessCode');
  const resetPasswordInput = document.getElementById('resetNewPassword');
  const secretPasscodeInput = document.getElementById('loginSecretPasscode');

  const email = String(loginEmailInput && loginEmailInput.value ? loginEmailInput.value : '').trim().toLowerCase();
  const oneTimeCode = String(resetCodeInput && resetCodeInput.value ? resetCodeInput.value : '').replace(/\D/g, '').trim();
  const newPassword = String(resetPasswordInput && resetPasswordInput.value ? resetPasswordInput.value : '').trim();
  const secretPasscode = String(secretPasscodeInput && secretPasscodeInput.value ? secretPasscodeInput.value : '').trim();

  if (!email || !oneTimeCode || !newPassword || !secretPasscode) {
    showAdminMessage('loginMessage', 'Enter email, reset OTP, new password, and secret passcode.', 'error');
    return;
  }

  if (!isValidEmailAddress(email)) {
    markFieldInvalid(loginEmailInput);
    loginEmailInput.focus();
    showAdminMessage('loginMessage', 'Please enter a valid admin email address.', 'error');
    return;
  }
  clearFieldInvalid(loginEmailInput);

  if (newPassword.length < 6) {
    markFieldInvalid(resetPasswordInput);
    resetPasswordInput.focus();
    showAdminMessage('loginMessage', 'New password must be at least 6 characters long.', 'error');
    return;
  }
  clearFieldInvalid(resetPasswordInput);

  try {
    const response = await fetch(`${API_URL}/admin/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        oneTimeCode,
        newPassword,
        secretPasscode
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      showAdminMessage('loginMessage', result.error || 'Failed to reset password', 'error');
      return;
    }

    const loginPasswordInput = document.getElementById('loginPassword');
    if (loginPasswordInput) {
      loginPasswordInput.value = newPassword;
    }

    if (resetCodeInput) resetCodeInput.value = '';
    if (resetPasswordInput) resetPasswordInput.value = '';

    showAdminMessage('loginMessage', 'Password reset successful. You can now login with your new password.', 'success');
  } catch (error) {
    showAdminMessage('loginMessage', 'Unable to reset password right now.', 'error');
  }
}

async function handleAdminRegister(e) {
  e.preventDefault();
  
  const name = document.getElementById('registerName').value;
  const registerEmailInput = document.getElementById('registerEmail');
  const email = registerEmailInput.value.trim().toLowerCase();
  const password = document.getElementById('registerPassword').value;
  const secretPasscode = document.getElementById('registerSecretPasscode').value.trim();

  if (!isValidEmailAddress(email)) {
    markFieldInvalid(registerEmailInput);
    registerEmailInput.focus();
    showAdminMessage('registerMessage', 'Please enter a valid email address.', 'error');
    return;
  }
  clearFieldInvalid(registerEmailInput);
  
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
function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

if (typeof window !== 'undefined') {
  window.scrollToBooking = scrollToBooking;
  window.closeAdminModal = closeAdminModal;
  window.toggleAuthForm = toggleAuthForm;
  window.closeLanguageModal = closeLanguageModal;
  window.setLanguageAndClose = setLanguageAndClose;
}
