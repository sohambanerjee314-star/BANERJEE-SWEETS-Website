import { supabase } from './supabase.js';
import { jsPDF } from 'jspdf';
import {
  getProducts,
  createProduct,
  updateProduct,
  toggleProductStock,
  toggleProductVisibility,
  toggleProductBadge,
  deleteProduct,
  uploadProductImage,
  uploadAvatarImage,
  removeAvatarImage,
  getCategories
} from './collections.js';

// Configuration Constants
const TOTAL_FRAMES = 240;
const DESKTOP_FRAME_PATH = '/frames/ezgif-frame-';
const MOBILE_FRAME_PATH = '/frames-mobile/ezgif-frame-';

// App State
const state = {
  frames: [],
  desktopFrames: [],
  mobileFrames: [],
  loadedFrames: 0,
  currentFrameIndex: 0,
  targetFrameIndex: 0,
  isLoaded: false,
  isAnimationFrozen: false,
  currentUser: null,
  currentUserRole: 'Customer',
  allOrders: [],
  userOrders: [],
  orderQuantities: {
    rossogolla: 1,
    sandesh: 0,
    mishtidoi: 0
  },
  lastOrderDoc: null,
  lastOrderId: null,
  isPhoneVerified: false,
  generatedOtp: null,
  otpCountdownTimer: null
};

// Helper: Format frame filename with 3-digit zero padding
function getFrameUrl(index, isMobile = false) {
  const paddedNumber = String(index).padStart(3, '0');
  const basePath = isMobile ? MOBILE_FRAME_PATH : DESKTOP_FRAME_PATH;
  return `${basePath}${paddedNumber}.jpg`;
}

// DOM Element References
const elements = {
  preloader: document.getElementById('preloader'),
  loaderProgressBar: document.getElementById('loaderProgressBar'),
  loaderPercentText: document.getElementById('loaderPercentText'),
  loaderRingProgress: document.getElementById('loaderRingProgress'),
  canvas: document.getElementById('animationCanvas'),
  canvasContainer: document.getElementById('canvasContainer'),
  welcomeHeading: document.getElementById('welcomeHeading'),
  sequenceSection: document.getElementById('sequence'),
  navMenuItems: document.querySelectorAll('.nav-menu-item'),

  // Auth UI Elements
  openAuthModalBtn: document.getElementById('openAuthModalBtn'),
  closeAuthModalBtn: document.getElementById('closeAuthModalBtn'),
  authModal: document.getElementById('authModal'),
  tabSignInBtn: document.getElementById('tabSignInBtn'),
  tabSignUpBtn: document.getElementById('tabSignUpBtn'),
  signInForm: document.getElementById('signInForm'),
  signUpForm: document.getElementById('signUpForm'),
  authAlert: document.getElementById('authAlert'),
  userProfileNav: document.getElementById('userProfileNav'),
  userEmailText: document.getElementById('userEmailText'),
  userRoleBadge: document.getElementById('userRoleBadge'),
  adminPortalBtn: document.getElementById('adminPortalBtn'),
  myOrdersBtn: document.getElementById('myOrdersBtn'),
  signOutBtn: document.getElementById('signOutBtn'),

  // Password Visibility Toggle Elements
  toggleSignInPasswordBtn: document.getElementById('toggleSignInPasswordBtn'),
  signInPassword: document.getElementById('signInPassword'),
  signInEyeIcon: document.getElementById('signInEyeIcon'),
  toggleSignUpPasswordBtn: document.getElementById('toggleSignUpPasswordBtn'),
  signUpPassword: document.getElementById('signUpPassword'),
  signUpEyeIcon: document.getElementById('signUpEyeIcon'),
  toggleAdminCodePasswordBtn: document.getElementById('toggleAdminCodePasswordBtn'),
  signUpAdminCode: document.getElementById('signUpAdminCode'),
  adminCodeEyeIcon: document.getElementById('adminCodeEyeIcon'),

  // Forgot Password Elements
  openForgotPassBtn: document.getElementById('openForgotPassBtn'),
  forgotPasswordForm: document.getElementById('forgotPasswordForm'),
  forgotPassEmail: document.getElementById('forgotPassEmail'),
  forgotPassSubmitBtn: document.getElementById('forgotPassSubmitBtn'),
  backToSignInBtn: document.getElementById('backToSignInBtn'),

  // Reset Password Elements
  openResetModalBtn: document.getElementById('openResetModalBtn'),
  resetPasswordModal: document.getElementById('resetPasswordModal'),
  closeResetModalBtn: document.getElementById('closeResetModalBtn'),
  resetPasswordForm: document.getElementById('resetPasswordForm'),
  newResetPassword: document.getElementById('newResetPassword'),
  confirmResetPassword: document.getElementById('confirmResetPassword'),
  toggleNewResetPasswordBtn: document.getElementById('toggleNewResetPasswordBtn'),
  newResetEyeIcon: document.getElementById('newResetEyeIcon'),
  toggleConfirmResetPasswordBtn: document.getElementById('toggleConfirmResetPasswordBtn'),
  confirmResetEyeIcon: document.getElementById('confirmResetEyeIcon'),
  resetPasswordSubmitBtn: document.getElementById('resetPasswordSubmitBtn'),
  resetAlert: document.getElementById('resetAlert'),

  // Admin Dashboard Elements
  adminDashboardModal: document.getElementById('adminDashboardModal'),
  closeAdminModalBtn: document.getElementById('closeAdminModalBtn'),
  refreshAdminOrdersBtn: document.getElementById('refreshAdminOrdersBtn'),
  adminOrdersTableBody: document.getElementById('adminOrdersTableBody'),
  adminTotalOrders: document.getElementById('adminTotalOrders'),
  adminTotalRevenue: document.getElementById('adminTotalRevenue'),
  adminPendingOrders: document.getElementById('adminPendingOrders'),

  // Customer My Orders Elements
  myOrdersModal: document.getElementById('myOrdersModal'),
  closeMyOrdersModalBtn: document.getElementById('closeMyOrdersModalBtn'),
  myOrdersContainer: document.getElementById('myOrdersContainer'),

  // Order UI Elements
  orderNowNavBtn: document.getElementById('orderNowNavBtn'),
  orderModal: document.getElementById('orderModal'),
  closeOrderModalBtn: document.getElementById('closeOrderModalBtn'),
  checkoutForm: document.getElementById('checkoutForm'),
  checkoutTotalText: document.getElementById('checkoutTotalText'),
  orderSuccessModal: document.getElementById('orderSuccessModal'),
  closeSuccessModalBtn: document.getElementById('closeSuccessModalBtn'),
  downloadPdfBtn: document.getElementById('downloadPdfBtn'),
  successOrderId: document.getElementById('successOrderId'),
  successOrderTotal: document.getElementById('successOrderTotal'),
  itemOrderBtns: document.querySelectorAll('.item-order-btn'),
  orderAlert: document.getElementById('orderAlert'),
  phoneError: document.getElementById('phoneError'),
  phoneNumberInput: document.getElementById('phoneNumber'),
  mobileMenuToggleBtn: document.getElementById('mobileMenuToggleBtn')
};

// Initialize Canvas Context
const ctx = elements.canvas.getContext('2d');

// Canvas Size Adjustment
function resizeCanvas() {
  if (!elements.canvasContainer) return;
  const isMobile = window.innerWidth < 768;
  // Cap the Device Pixel Ratio on mobile. Phones often have DPR of 3 or 4, 
  // which forces the canvas to draw at massive 4K+ resolutions on every scroll frame, causing severe lag.
  const maxDpr = isMobile ? 1.25 : 2; 
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  
  const width = elements.canvasContainer.clientWidth;
  const height = elements.canvasContainer.clientHeight;

  elements.canvas.width = width * dpr;
  elements.canvas.height = height * dpr;
  elements.canvas.style.width = `${width}px`;
  elements.canvas.style.height = `${height}px`;

  ctx.scale(dpr, dpr);
  renderFrame(Math.round(state.currentFrameIndex));
}

// Render Specific Frame onto Canvas
function renderFrame(frameIndex) {
  const isMobile = window.innerWidth < 768;
  const frameArray = isMobile ? state.mobileFrames : state.desktopFrames;
  const img = frameArray[frameIndex] || state.desktopFrames[frameIndex];
  if (!img || !img.complete) return;

  const canvasWidth = elements.canvasContainer.clientWidth;
  const canvasHeight = elements.canvasContainer.clientHeight;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const CROP_ZOOM = isMobile ? 1.0 : 1.15;
  const imgRatio = img.width / img.height;
  const canvasRatio = canvasWidth / canvasHeight;

  let baseWidth, baseHeight;

  if (canvasRatio > imgRatio) {
    baseWidth = canvasWidth;
    baseHeight = canvasWidth / imgRatio;
  } else {
    baseHeight = canvasHeight;
    baseWidth = canvasHeight * imgRatio;
  }

  const drawWidth = baseWidth * CROP_ZOOM;
  const drawHeight = baseHeight * CROP_ZOOM;

  const drawX = (canvasWidth - drawWidth) / 2;
  const drawY = (canvasHeight - drawHeight) / 2;

  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

// Preload Images Engine
function preloadFrames() {
  return new Promise((resolve) => {
    let loadedCount = 0;
    const isMobile = window.innerWidth < 768;
    const totalToLoad = TOTAL_FRAMES;
    const batchSize = 10;
    let currentIndex = 1;

    const checkComplete = () => {
      loadedCount++;
      state.loadedFrames = loadedCount;
      const percent = Math.floor((loadedCount / totalToLoad) * 100);
      updatePreloaderUI(percent, loadedCount);
      
      if (loadedCount === totalToLoad) {
        state.isLoaded = true;
        resolve();
      }
    };

    const loadNextBatch = () => {
      let currentBatchCount = 0;
      const targetForBatch = Math.min(batchSize, totalToLoad - currentIndex + 1);
      
      if (targetForBatch <= 0) return;

      for (let i = 0; i < targetForBatch; i++) {
        const frameId = currentIndex++;
        const img = new Image();
        img.src = getFrameUrl(frameId, isMobile);
        
        const onFrameComplete = () => {
          checkComplete();
          currentBatchCount++;
          if (currentBatchCount === targetForBatch) {
            loadNextBatch();
          }
        };

        img.onload = onFrameComplete;
        img.onerror = onFrameComplete;
        
        if (isMobile) {
          state.mobileFrames[frameId] = img;
        } else {
          state.desktopFrames[frameId] = img;
        }
      }
    };

    // Initialize arrays with empty slots so indices match frameId
    if (isMobile) {
      state.mobileFrames = new Array(totalToLoad + 1);
    } else {
      state.desktopFrames = new Array(totalToLoad + 1);
    }

    // Start loading
    loadNextBatch();
    
    // Safety fallback: if tunnel completely hangs, unlock the page after 8 seconds
    setTimeout(() => {
      if (!state.isLoaded) {
        console.warn('Preloader timed out waiting for tunnel. Forcing unlock.');
        state.isLoaded = true;
        resolve();
      }
    }, 8000);
  });
}

function updatePreloaderUI(percent, loadedCount) {
  if (elements.loaderPercentText) elements.loaderPercentText.textContent = `${percent}%`;
  if (elements.loaderProgressBar) elements.loaderProgressBar.style.width = `${percent}%`;
  if (elements.loaderRingProgress) {
    const offset = 264 - (264 * percent) / 100;
    elements.loaderRingProgress.style.strokeDashoffset = offset;
  }
}

// Scroll Interpolation Sync Engine
function updateScrollSync() {
  if (state.isAnimationFrozen) return;
  if (!elements.sequenceSection) return;

  const rect = elements.sequenceSection.getBoundingClientRect();
  const sectionHeight = elements.sequenceSection.offsetHeight - window.innerHeight;

  if (sectionHeight > 0) {
    const scrolled = Math.max(0, -rect.top);
    const scrollFraction = Math.min(1, Math.max(0, scrolled / sectionHeight));

    const targetFrame = Math.min(TOTAL_FRAMES - 1, Math.floor(scrollFraction * TOTAL_FRAMES));
    state.targetFrameIndex = targetFrame;

    if (elements.welcomeHeading) {
      const FADE_LIMIT = 0.30;
      const fadeRatio = Math.min(1, scrollFraction / FADE_LIMIT);
      const opacity = Math.max(0, 1 - fadeRatio);
      const translateY = -fadeRatio * 30;

      elements.welcomeHeading.style.opacity = opacity.toFixed(3);
      elements.welcomeHeading.style.transform = `translate3d(0, ${translateY}px, 0)`;
    }
  }

  updateActiveNavMenu();
}

function updateActiveNavMenu() {
  const sections = ['sequence', 'signature-delights', 'our-story', 'visit-us'];
  const scrollPosition = window.scrollY + 120;

  sections.forEach(sectionId => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const top = section.offsetTop;
    const height = section.offsetHeight;

    if (scrollPosition >= top && scrollPosition < top + height) {
      elements.navMenuItems.forEach(item => {
        if (item.getAttribute('href') === `#${sectionId}`) {
          item.classList.add('text-secondary', 'border-b-2', 'border-secondary', 'pb-1');
          item.classList.remove('text-on-surface-variant');
        } else {
          item.classList.remove('text-secondary', 'border-b-2', 'border-secondary', 'pb-1');
          item.classList.add('text-on-surface-variant');
        }
      });
    }
  });
}

function setupSmoothNavigation() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function animationLoop() {
  if (state.isLoaded && !state.isAnimationFrozen) {
    const diff = state.targetFrameIndex - state.currentFrameIndex;
    if (Math.abs(diff) > 0.01) {
      state.currentFrameIndex += diff * 0.25;
      renderFrame(Math.round(state.currentFrameIndex));
    }
  }
  requestAnimationFrame(animationLoop);
}

// Automatically Freeze Background Animation & Page Scrolling when any section/modal/drawer is open
function setupBackgroundFreezeObserver() {
  const modalIds = [
    'userProfileModal',
    'adminDashboardModal',
    'mobileNavDrawer',
    'authModal',
    'myOrdersModal',
    'resetPasswordModal',
    'orderModal',
    'orderSuccessModal'
  ];

  const checkAndFreeze = () => {
    const isAnyModalOpen = modalIds.some(id => {
      const el = document.getElementById(id);
      return el && !el.classList.contains('hidden');
    });

    if (isAnyModalOpen) {
      state.isAnimationFrozen = true;
      document.body.classList.add('overflow-hidden');
    } else {
      state.isAnimationFrozen = false;
      document.body.classList.remove('overflow-hidden');
    }
  };

  const observer = new MutationObserver(() => {
    checkAndFreeze();
  });

  modalIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    }
  });

  // Initial check
  checkAndFreeze();
}

// ================= AUTOMATIC SESSION TIMEOUT MANAGER (CUSTOMERS ONLY) =================

const SessionTimeoutConfig = {
  // Configurable Inactivity Duration: Default 15 minutes (900,000 ms)
  timeoutMs: 15 * 60 * 1000,
  // Warning Dialog Window: 60 seconds (60,000 ms)
  warningMs: 60 * 1000,
  // Throttle activity resets to once per second
  throttleMs: 1000
};

const sessionChannel = typeof BroadcastChannel !== 'undefined' 
  ? new BroadcastChannel('bs_customer_session_channel') 
  : null;

let inactivityState = {
  lastActivityTime: Date.now(),
  checkIntervalId: null,
  countdownIntervalId: null,
  isWarningShown: false,
  lastThrottleTime: 0,
  isActive: false
};

function initMultiTabSync() {
  if (sessionChannel) {
    sessionChannel.onmessage = (event) => {
      if (!event.data) return;
      if (event.data.type === 'ACTIVITY_RESET') {
        resetInactivityTimer(false);
      } else if (event.data.type === 'LOGOUT') {
        performInactivityLogout('multi_tab', false);
      }
    };
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'bs_session_event') {
      try {
        const payload = JSON.parse(event.newValue);
        if (!payload) return;
        if (payload.type === 'ACTIVITY_RESET') {
          resetInactivityTimer(false);
        } else if (payload.type === 'LOGOUT') {
          performInactivityLogout('multi_tab', false);
        }
      } catch (e) {}
    }
  });
}

function broadcastSessionEvent(type, data = {}) {
  const payload = { type, timestamp: Date.now(), ...data };
  if (sessionChannel) {
    sessionChannel.postMessage(payload);
  }
  try {
    localStorage.setItem('bs_session_event', JSON.stringify(payload));
  } catch (e) {}
}

function handleUserActivity(e) {
  if (!inactivityState.isActive) return;
  if (inactivityState.isWarningShown) return;

  const now = Date.now();
  if (now - inactivityState.lastThrottleTime > SessionTimeoutConfig.throttleMs) {
    inactivityState.lastThrottleTime = now;
    resetInactivityTimer(true);
  }
}

function resetInactivityTimer(shouldBroadcast = true) {
  inactivityState.lastActivityTime = Date.now();

  if (inactivityState.isWarningShown) {
    hideSessionExpiringModal();
  }

  if (shouldBroadcast) {
    broadcastSessionEvent('ACTIVITY_RESET');
  }
}

function showSessionExpiringModal(remainingSeconds) {
  const modal = document.getElementById('sessionExpiringModal');
  const countdownEl = document.getElementById('sessionCountdownText');
  if (!modal) return;

  inactivityState.isWarningShown = true;
  modal.classList.remove('hidden');

  let secsLeft = Math.max(1, Math.min(60, remainingSeconds));
  if (countdownEl) countdownEl.textContent = secsLeft;

  if (inactivityState.countdownIntervalId) clearInterval(inactivityState.countdownIntervalId);

  inactivityState.countdownIntervalId = setInterval(() => {
    secsLeft--;
    if (countdownEl) countdownEl.textContent = Math.max(0, secsLeft);

    if (secsLeft <= 0) {
      clearInterval(inactivityState.countdownIntervalId);
      inactivityState.countdownIntervalId = null;
      performInactivityLogout('inactivity', true);
    }
  }, 1000);
}

function hideSessionExpiringModal() {
  inactivityState.isWarningShown = false;
  const modal = document.getElementById('sessionExpiringModal');
  if (modal) modal.classList.add('hidden');

  if (inactivityState.countdownIntervalId) {
    clearInterval(inactivityState.countdownIntervalId);
    inactivityState.countdownIntervalId = null;
  }
}

async function performInactivityLogout(reason = 'inactivity', shouldBroadcast = true) {
  stopInactivityMonitor();
  hideSessionExpiringModal();

  if (shouldBroadcast) {
    broadcastSessionEvent('LOGOUT', { reason });
  }

  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error('Logout error:', err);
  }

  try {
    localStorage.removeItem('supabase.auth.token');
    sessionStorage.clear();
  } catch (e) {}

  updateUserUI(null);

  const modalsToClose = [
    elements.orderModal,
    elements.myOrdersModal,
    elements.userProfileModal,
    elements.adminDashboardModal
  ];
  modalsToClose.forEach(m => { if (m) m.classList.add('hidden'); });

  openAuthModal('You have been logged out due to inactivity.');
}

function checkInactivityStatus() {
  if (!inactivityState.isActive) return;
  if (document.hidden) return;

  const now = Date.now();
  const elapsed = now - inactivityState.lastActivityTime;
  const warningThreshold = SessionTimeoutConfig.timeoutMs - SessionTimeoutConfig.warningMs;

  if (elapsed >= SessionTimeoutConfig.timeoutMs) {
    performInactivityLogout('inactivity', true);
  } else if (elapsed >= warningThreshold) {
    if (!inactivityState.isWarningShown) {
      const remainingSecs = Math.ceil((SessionTimeoutConfig.timeoutMs - elapsed) / 1000);
      showSessionExpiringModal(remainingSecs);
    }
  }
}

function handleVisibilityChange() {
  if (!inactivityState.isActive) return;
  if (!document.hidden) {
    checkInactivityStatus();
  }
}

function startInactivityMonitor() {
  stopInactivityMonitor();
  inactivityState.isActive = true;
  inactivityState.lastActivityTime = Date.now();

  const events = ['mousemove', 'mousedown', 'click', 'keydown', 'touchstart', 'touchmove', 'scroll', 'pointerdown'];
  events.forEach(evt => {
    window.addEventListener(evt, handleUserActivity, { passive: true });
  });

  document.addEventListener('visibilitychange', handleVisibilityChange);

  inactivityState.checkIntervalId = setInterval(checkInactivityStatus, 1000);
}

function stopInactivityMonitor() {
  inactivityState.isActive = false;

  const events = ['mousemove', 'mousedown', 'click', 'keydown', 'touchstart', 'touchmove', 'scroll', 'pointerdown'];
  events.forEach(evt => {
    window.removeEventListener(evt, handleUserActivity);
  });

  document.removeEventListener('visibilitychange', handleVisibilityChange);

  if (inactivityState.checkIntervalId) {
    clearInterval(inactivityState.checkIntervalId);
    inactivityState.checkIntervalId = null;
  }

  hideSessionExpiringModal();
}

window.setSessionTimeoutMinutes = function(minutes) {
  if (typeof minutes === 'number' && minutes > 0) {
    SessionTimeoutConfig.timeoutMs = minutes * 60 * 1000;
    console.log(`[SessionTimeout] Inactivity timeout set to ${minutes} minutes.`);
    if (inactivityState.isActive) {
      resetInactivityTimer(true);
    }
  }
};

// ================= SUPABASE AUTHENTICATION & ORDER ENGINE =================

async function checkAuthSession() {
  const { data: { session } } = await supabase.auth.getSession();
  updateUserUI(session?.user || null);

  if (window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token=')) {
    if (elements.resetPasswordModal) {
      elements.resetPasswordModal.classList.remove('hidden');
    }
  }

  supabase.auth.onAuthStateChange((event, session) => {
    updateUserUI(session?.user || null);
    if (event === 'PASSWORD_RECOVERY') {
      if (elements.resetPasswordModal) {
        elements.resetPasswordModal.classList.remove('hidden');
      }
    }
  });
}

function updateUserUI(user) {
  state.currentUser = user;
  const isMobile = window.innerWidth < 768;

  if (user) {
    elements.openAuthModalBtn.classList.add('hidden');
    elements.userProfileNav.classList.remove('hidden');
    elements.userProfileNav.classList.add('flex');
    elements.userEmailText.textContent = user.email;

    const role = user.user_metadata?.role || 'Customer';
    state.currentUserRole = role;

    // Session inactivity timeout monitor: ONLY for Customer accounts (Admin excluded)
    if (role === 'Admin') {
      stopInactivityMonitor();
    } else {
      startInactivityMonitor();
    }

    if (elements.userRoleBadge) {
      elements.userRoleBadge.textContent = role;
      if (role === 'Admin') {
        elements.userRoleBadge.className = 'hidden md:inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-400/40';
        if (elements.adminPortalBtn) {
          elements.adminPortalBtn.classList.remove('hidden');
          elements.adminPortalBtn.classList.add('flex');
        }
        const pAdminBtn = document.getElementById('profileAdminPortalBtn');
        if (pAdminBtn) {
          pAdminBtn.classList.remove('hidden');
          pAdminBtn.classList.add('flex');
        }

        // Hide Order Now and My Orders header buttons for Admin
        if (elements.myOrdersBtn) {
          elements.myOrdersBtn.classList.add('hidden');
          elements.myOrdersBtn.classList.remove('flex');
        }
        if (elements.orderNowNavBtn) {
          elements.orderNowNavBtn.classList.add('hidden');
          elements.orderNowNavBtn.classList.remove('flex');
        }
        const gOrderBtn = document.getElementById('guestOrderNowNavBtn');
        if (gOrderBtn) {
          gOrderBtn.classList.add('hidden');
          gOrderBtn.classList.remove('flex');
        }
        const pMyOrdersBtn = document.getElementById('profileMyOrdersBtn');
        if (pMyOrdersBtn) pMyOrdersBtn.classList.add('hidden');

        // Hide Order section buttons on product cards for Admin
        document.querySelectorAll('.item-order-btn').forEach(btn => btn.classList.add('hidden'));

      } else {
        elements.userRoleBadge.className = 'hidden md:inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300/40';
        if (elements.adminPortalBtn) {
          elements.adminPortalBtn.classList.add('hidden');
          elements.adminPortalBtn.classList.remove('flex');
        }
        const pAdminBtn = document.getElementById('profileAdminPortalBtn');
        if (pAdminBtn) {
          pAdminBtn.classList.add('hidden');
          pAdminBtn.classList.remove('flex');
        }

        // Show Order History (My Orders) and Order Now for Customer
        if (elements.myOrdersBtn) {
          if (isMobile) {
            elements.myOrdersBtn.classList.add('hidden');
            elements.myOrdersBtn.classList.remove('flex');
          } else {
            elements.myOrdersBtn.classList.remove('hidden');
            elements.myOrdersBtn.classList.add('flex');
          }
        }

        if (elements.orderNowNavBtn) {
          if (isMobile) {
            elements.orderNowNavBtn.classList.add('hidden');
            elements.orderNowNavBtn.classList.remove('flex');
          } else {
            elements.orderNowNavBtn.classList.remove('hidden');
            elements.orderNowNavBtn.classList.add('flex');
          }
        }

        const gOrderBtn = document.getElementById('guestOrderNowNavBtn');
        if (gOrderBtn) {
          gOrderBtn.classList.add('hidden');
          gOrderBtn.classList.remove('flex');
        }

        const pMyOrdersBtn = document.getElementById('profileMyOrdersBtn');
        if (pMyOrdersBtn) pMyOrdersBtn.classList.remove('hidden');
      }

      if (elements.mobileMenuToggleBtn) {
        elements.mobileMenuToggleBtn.classList.remove('hidden');
      }

      document.querySelectorAll('.item-order-btn').forEach(btn => btn.classList.remove('hidden'));
    }

    // Update Mobile Nav Drawer User Section
    const mobileGuestAuthBtn = document.getElementById('mobileGuestAuthBtn');
    const mobileUserInfo = document.getElementById('mobileUserInfo');
    const mobileUserEmail = document.getElementById('mobileUserEmail');
    const mobileUserRole = document.getElementById('mobileUserRole');
    const mobileSignOutBtn = document.getElementById('mobileSignOutBtn');
    const mobileMyOrdersBtn = document.getElementById('mobileMyOrdersBtn');
    const mobileAdminPortalBtn = document.getElementById('mobileAdminPortalBtn');

    if (mobileGuestAuthBtn) mobileGuestAuthBtn.classList.add('hidden');
    if (mobileUserInfo && mobileUserEmail && mobileUserRole && mobileSignOutBtn) {
      mobileUserInfo.classList.remove('hidden');
      mobileSignOutBtn.classList.remove('hidden');
      mobileUserEmail.textContent = user.email || 'User';
      mobileUserRole.textContent = role;

      if (role === 'Admin') {
        if (mobileMyOrdersBtn) mobileMyOrdersBtn.classList.add('hidden');
        if (mobileAdminPortalBtn) {
          mobileAdminPortalBtn.classList.remove('hidden');
          mobileAdminPortalBtn.classList.add('flex');
        }
      } else {
        if (mobileMyOrdersBtn) mobileMyOrdersBtn.classList.remove('hidden');
        if (mobileAdminPortalBtn) {
          mobileAdminPortalBtn.classList.add('hidden');
          mobileAdminPortalBtn.classList.remove('flex');
        }
      }
    }

    // Update User Profile Modal Details & Avatar Images
    const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    const userPhone = user.user_metadata?.phone_number || 'Not provided';
    const avatarUrl = user.user_metadata?.avatar_url || null;

    const pNameHead = document.getElementById('profileNameHeading');
    const pNameVal = document.getElementById('profileNameVal');
    const pEmailVal = document.getElementById('profileEmailVal');
    const pRoleVal = document.getElementById('profileRoleVal');
    const pPhoneVal = document.getElementById('profilePhoneVal');

    const headerAvatarImg = document.getElementById('headerUserAvatarImg');
    const headerAvatarIcon = document.getElementById('headerUserAvatarIcon');
    const profileAvatarImg = document.getElementById('profileAvatarImg');
    const profileAvatarIcon = document.getElementById('profileAvatarIcon');
    const viewerAvatarImg = document.getElementById('viewerAvatarImg');
    const viewerAvatarIcon = document.getElementById('viewerAvatarIcon');
    const viewerRemoveBtn = document.getElementById('viewerRemoveAvatarBtn');

    const removeAvatarBtn = document.getElementById('removeProfileAvatarBtn');

    if (avatarUrl) {
      if (headerAvatarImg) {
        headerAvatarImg.src = avatarUrl;
        headerAvatarImg.classList.remove('hidden');
      }
      if (headerAvatarIcon) headerAvatarIcon.classList.add('hidden');

      if (profileAvatarImg) {
        profileAvatarImg.src = avatarUrl;
        profileAvatarImg.classList.remove('hidden');
      }
      if (profileAvatarIcon) profileAvatarIcon.classList.add('hidden');

      if (viewerAvatarImg) {
        viewerAvatarImg.src = avatarUrl;
        viewerAvatarImg.classList.remove('hidden');
      }
      if (viewerAvatarIcon) viewerAvatarIcon.classList.add('hidden');
      if (viewerRemoveBtn) {
        viewerRemoveBtn.classList.remove('hidden');
        viewerRemoveBtn.classList.add('flex');
      }

      if (removeAvatarBtn) {
        removeAvatarBtn.classList.remove('hidden');
        removeAvatarBtn.classList.add('flex');
      }
    } else {
      if (headerAvatarImg) headerAvatarImg.classList.add('hidden');
      if (headerAvatarIcon) headerAvatarIcon.classList.remove('hidden');

      if (profileAvatarImg) profileAvatarImg.classList.add('hidden');
      if (profileAvatarIcon) profileAvatarIcon.classList.remove('hidden');

      if (viewerAvatarImg) viewerAvatarImg.classList.add('hidden');
      if (viewerAvatarIcon) viewerAvatarIcon.classList.remove('hidden');
      if (viewerRemoveBtn) {
        viewerRemoveBtn.classList.add('hidden');
        viewerRemoveBtn.classList.remove('flex');
      }

      if (removeAvatarBtn) {
        removeAvatarBtn.classList.add('hidden');
        removeAvatarBtn.classList.remove('flex');
      }
    }

    if (pNameHead) pNameHead.textContent = fullName;
    if (pNameVal) pNameVal.textContent = fullName;
    if (pEmailVal) pEmailVal.textContent = user.email || 'N/A';
    if (pRoleVal) {
      pRoleVal.textContent = role;
      pRoleVal.className = role === 'Admin' 
        ? 'text-xs font-bold text-amber-900 bg-amber-200 border border-amber-400 px-2 py-0.5 rounded-full inline-block uppercase' 
        : 'text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full inline-block uppercase';
    }
    if (pPhoneVal) pPhoneVal.textContent = userPhone;

    // Autofill Phone Number in Checkout Form if user registered with mandatory phone
    if (userPhone && userPhone !== 'Not provided' && document.getElementById('phoneNumber')) {
      document.getElementById('phoneNumber').value = userPhone;
    }
  } else {
    stopInactivityMonitor();
    state.currentUserRole = 'Customer';
    elements.openAuthModalBtn.classList.remove('hidden');
    elements.userProfileNav.classList.add('hidden');
    elements.userProfileNav.classList.remove('flex');
    if (elements.adminPortalBtn) {
      elements.adminPortalBtn.classList.add('hidden');
      elements.adminPortalBtn.classList.remove('flex');
    }

    const mobileGuestAuthBtn = document.getElementById('mobileGuestAuthBtn');
    const mobileUserInfo = document.getElementById('mobileUserInfo');
    const mobileSignOutBtn = document.getElementById('mobileSignOutBtn');

    if (mobileGuestAuthBtn) mobileGuestAuthBtn.classList.remove('hidden');
    if (mobileUserInfo) mobileUserInfo.classList.add('hidden');
    if (mobileSignOutBtn) mobileSignOutBtn.classList.add('hidden');

    // Guests can see Order Now button on desktop, but not My Orders
    if (elements.myOrdersBtn) elements.myOrdersBtn.classList.add('hidden');
    if (elements.orderNowNavBtn) {
      elements.orderNowNavBtn.classList.add('hidden');
      elements.orderNowNavBtn.classList.remove('flex');
    }
    const guestOrderBtn = document.getElementById('guestOrderNowNavBtn');
    if (guestOrderBtn) {
      if (isMobile) {
        guestOrderBtn.classList.add('hidden');
        guestOrderBtn.classList.remove('flex');
      } else {
        guestOrderBtn.classList.remove('hidden');
        guestOrderBtn.classList.add('flex');
      }
    }
    document.querySelectorAll('.item-order-btn').forEach(btn => btn.classList.remove('hidden'));
  }
}

// Phone Number Validation Helper
function isValidPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  
  // Extract digits only
  const digitsOnly = trimmed.replace(/\D/g, '');

  // Length must be between 10 and 15 digits
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return false;
  }

  // Reject numbers with all identical digits (e.g., 0000000000)
  if (/^(\d)\1+$/.test(digitsOnly)) {
    return false;
  }

  return true;
}

function showOrderAlert(message) {
  if (elements.orderAlert) {
    elements.orderAlert.textContent = message;
    elements.orderAlert.classList.remove('hidden');
  }
}

function hideOrderAlert() {
  if (elements.orderAlert) {
    elements.orderAlert.textContent = '';
    elements.orderAlert.classList.add('hidden');
  }
  if (elements.phoneError) {
    elements.phoneError.textContent = '';
    elements.phoneError.classList.add('hidden');
  }
  if (elements.phoneNumberInput) {
    elements.phoneNumberInput.classList.remove('border-error', 'border-red-500');
    elements.phoneNumberInput.classList.add('border-outline-variant');
  }
}

function formatAlertMessage(msg) {
  if (!msg) return 'An error occurred. Please check your information and try again.';
  if (typeof msg === 'string') {
    const trimmed = msg.trim();
    if (trimmed === '{}' || trimmed === '[object Object]' || trimmed === 'Error' || !trimmed) {
      return 'An error occurred. Please verify your details and try again.';
    }
    return trimmed;
  }
  if (typeof msg === 'object') {
    if (msg.message && typeof msg.message === 'string' && msg.message.trim() !== '{}') {
      return msg.message.trim();
    }
    if (msg.error_description && typeof msg.error_description === 'string' && msg.error_description.trim() !== '{}') {
      return msg.error_description.trim();
    }
    if (msg.error && typeof msg.error === 'string' && msg.error.trim() !== '{}') {
      return msg.error.trim();
    }
  }
  return 'An error occurred. Please verify your details and try again.';
}

function showAuthAlert(message, type = 'error') {
  if (!elements.authAlert) return;

  const displayMessage = formatAlertMessage(message);

  elements.authAlert.className = 'mb-4 p-3.5 rounded-xl text-xs font-medium border flex items-start gap-2.5 transition-all shadow-sm';

  if (type === 'error') {
    elements.authAlert.classList.add('bg-red-50', 'text-red-900', 'border-red-200');
    elements.authAlert.innerHTML = `
      <span class="material-symbols-outlined text-red-600 text-lg flex-shrink-0 select-none">error</span>
      <div class="flex-1 leading-snug font-semibold">${displayMessage}</div>
    `;
  } else {
    elements.authAlert.classList.add('bg-emerald-50', 'text-emerald-900', 'border-emerald-200');
    elements.authAlert.innerHTML = `
      <span class="material-symbols-outlined text-emerald-600 text-lg flex-shrink-0 select-none">check_circle</span>
      <div class="flex-1 leading-snug font-semibold">${displayMessage}</div>
    `;
  }

  elements.authAlert.classList.remove('hidden');
  elements.authAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAuthAlert() {
  if (elements.authAlert) {
    elements.authAlert.classList.add('hidden');
    elements.authAlert.innerHTML = '';
  }
}

// Handle Sign In (Email & Password only)
async function handleSignIn(e) {
  e.preventDefault();
  const email = document.getElementById('signInEmail').value.trim();
  const password = document.getElementById('signInPassword').value;
  const submitBtn = document.getElementById('signInSubmitBtn');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';
  hideAuthAlert();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Sign In';

  if (error) {
    let msg = error.message || 'Failed to sign in.';
    if (msg.toLowerCase().includes('failed to fetch')) {
      msg = 'Connection error: Unable to reach authentication server. Please check your internet connection or try again.';
    }
    showAuthAlert(msg, 'error');
  } else {
    // If owner email or registered as admin, ensure role is set to Admin
    if (data?.user && (email.toLowerCase() === 'sohambanerjee314@gmail.com' || data.user.user_metadata?.role === 'Admin')) {
      if (data.user.user_metadata?.role !== 'Admin') {
        await supabase.auth.updateUser({ data: { role: 'Admin' } });
      }
      state.currentUserRole = 'Admin';
    }
    showAuthAlert('Successfully signed in!', 'success');
    setTimeout(() => {
      elements.authModal.classList.add('hidden');
      hideAuthAlert();
    }, 600);
  }
}

// Handle Sign Up (Name, Email, MANDATORY Phone, Password)
async function handleSignUp(e) {
  e.preventDefault();
  const name = document.getElementById('signUpName').value.trim();
  const email = document.getElementById('signUpEmail').value.trim();
  const phone = document.getElementById('signUpPhone').value.trim();
  const password = document.getElementById('signUpPassword').value;
  const submitBtn = document.getElementById('signUpSubmitBtn');
  const adminCodeInput = document.getElementById('signUpAdminCode');

  if (!name) {
    showAuthAlert('Please enter your full name.', 'error');
    return;
  }

  if (!email) {
    showAuthAlert('Please enter a valid email address.', 'error');
    return;
  }

  if (!phone) {
    showAuthAlert('Phone Number is mandatory for registration!', 'error');
    return;
  }

  if (!isValidPhoneNumber(phone)) {
    showAuthAlert('Please enter a valid 10-digit phone number (e.g. +91 7001832118)!', 'error');
    return;
  }

  if (!password || password.length < 6) {
    showAuthAlert('Password must be at least 6 characters long.', 'error');
    return;
  }

  // Automatic Admin role for owner email or valid Admin Security Passcode
  let role = 'Customer';
  if (email.toLowerCase() === 'sohambanerjee314@gmail.com') {
    role = 'Admin';
  } else if (adminCodeInput && adminCodeInput.value.trim() !== '') {
    const code = adminCodeInput.value.trim();
    if (code === 'SOHAM2004') {
      role = 'Admin';
    } else {
      showAuthAlert('Invalid Admin Passcode! Public registration is restricted to Customer accounts.', 'error');
      return;
    }
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';
  hideAuthAlert();

  try {
    let signUpSuccess = false;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          phone_number: phone,
          role: role
        }
      }
    });

    if (!error && data?.user && data.user.identities && data.user.identities.length > 0) {
      signUpSuccess = true;
    }

    // Fallback to direct DB registration if standard auth.signUp failed (e.g. due to broken custom SMTP server)
    if (!signUpSuccess) {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('register_user_direct', {
        p_email: email,
        p_password: password,
        p_full_name: name,
        p_phone_number: phone,
        p_role: role
      });

      if (rpcErr) {
        console.error('Direct Registration RPC Error:', rpcErr);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
        showAuthAlert(rpcErr.message || error?.message || 'Registration failed. Please check your details.', 'error');
        return;
      }
    }

    // Authenticate user session immediately
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Account';

    if (signInErr) {
      showAuthAlert(`Account created as ${role}! Please switch to "Sign In" with your password.`, 'success');
    } else {
      showAuthAlert(`Account created successfully as ${role}! You are now logged in.`, 'success');
    }

    setTimeout(() => {
      elements.authModal.classList.add('hidden');
      hideAuthAlert();
    }, 800);

  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Account';
    console.error('Sign Up Exception:', err);
    showAuthAlert(err.message || 'An unexpected error occurred during registration.', 'error');
  }
}

let currentResetEmail = '';

// Handle Forgot Password
async function handleForgotPassword(e) {
  e.preventDefault();
  const email = elements.forgotPassEmail ? elements.forgotPassEmail.value.trim() : '';
  const submitBtn = elements.forgotPassSubmitBtn;

  if (!email) {
    showAuthAlert('Please enter a valid registered email address.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing...';
  hideAuthAlert();

  try {
    // 1. Try standard Supabase reset link email
    let emailSent = false;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}#reset-password`
    });

    if (!error) {
      emailSent = true;
    }

    if (emailSent) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Reset Link';
      showAuthAlert('Password reset email sent! Please check your inbox/spam folder.', 'success');
      return;
    }

    // 2. Fallback: If Supabase email service failed (SMTP 500 error / rate limit), verify user in DB and allow direct password reset
    const { data: userExists, error: checkErr } = await supabase.rpc('check_user_exists', { p_email: email });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Reset Link';

    if (checkErr || !userExists) {
      showAuthAlert('No registered account was found with this email address. Please check your email or sign up.', 'error');
      return;
    }

    currentResetEmail = email;

    // Transition to Reset Password Modal so user can directly set their new password
    elements.authModal.classList.add('hidden');
    if (elements.resetPasswordModal) {
      elements.resetPasswordModal.classList.remove('hidden');
      if (elements.newResetPassword) elements.newResetPassword.focus();
      showResetAlert(`Account verified for ${email}! Enter your new password below.`, 'success');
    }
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Reset Link';
    console.error('Forgot password exception:', err);
    showAuthAlert('An error occurred. Please check your email and try again.', 'error');
  }
}

// Handle Reset Password
async function handleResetPassword(e) {
  e.preventDefault();
  const newPass = elements.newResetPassword ? elements.newResetPassword.value : '';
  const confirmPass = elements.confirmResetPassword ? elements.confirmResetPassword.value : '';
  const submitBtn = elements.resetPasswordSubmitBtn;

  if (!newPass || newPass.length < 6) {
    showResetAlert('Password must be at least 6 characters long.', 'error');
    return;
  }

  if (newPass !== confirmPass) {
    showResetAlert('Passwords do not match!', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Updating...';
  hideResetAlert();

  try {
    // Attempt standard Supabase update user if session exists
    const { error: authUpdateErr } = await supabase.auth.updateUser({ password: newPass });

    if (!authUpdateErr) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Update Password';
      showResetAlert('Password updated successfully!', 'success');
      setTimeout(() => {
        elements.resetPasswordModal.classList.add('hidden');
        openAuthModal('Password updated successfully! Please sign in with your new password.');
        if (elements.signInEmail && currentResetEmail) {
          elements.signInEmail.value = currentResetEmail;
        }
      }, 1200);
      return;
    }

    // Fallback: Direct password reset via RPC for non-email-link flows
    const emailToReset = currentResetEmail || (elements.forgotPassEmail ? elements.forgotPassEmail.value.trim() : '');

    if (!emailToReset) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Update Password';
      showResetAlert('Session expired or email missing. Please try Forgot Password again.', 'error');
      return;
    }

    const { data, error: rpcErr } = await supabase.rpc('reset_password_direct', {
      p_email: emailToReset,
      p_new_password: newPass
    });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Update Password';

    if (rpcErr) {
      console.error('Reset Password Direct RPC Error:', rpcErr);
      showResetAlert(rpcErr.message || 'Failed to update password. Please try again.', 'error');
    } else {
      showResetAlert('Password updated successfully!', 'success');
      setTimeout(() => {
        elements.resetPasswordModal.classList.add('hidden');
        openAuthModal('Password updated successfully! Please sign in with your new password.');
        if (elements.signInEmail) {
          elements.signInEmail.value = emailToReset;
        }
      }, 1200);
    }
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Update Password';
    console.error('Reset Password Exception:', err);
    showResetAlert(err.message || 'An error occurred while updating password.', 'error');
  }
}

function showResetAlert(message, type = 'error') {
  if (!elements.resetAlert) return;

  elements.resetAlert.className = 'mb-4 p-3.5 rounded-xl text-xs font-medium border flex items-start gap-2.5 transition-all shadow-sm';

  if (type === 'error') {
    elements.resetAlert.classList.add('bg-red-50', 'text-red-900', 'border-red-200');
    elements.resetAlert.innerHTML = `
      <span class="material-symbols-outlined text-red-600 text-lg flex-shrink-0 select-none">error</span>
      <div class="flex-1 leading-snug font-semibold">${message}</div>
    `;
  } else {
    elements.resetAlert.classList.add('bg-emerald-50', 'text-emerald-900', 'border-emerald-200');
    elements.resetAlert.innerHTML = `
      <span class="material-symbols-outlined text-emerald-600 text-lg flex-shrink-0 select-none">check_circle</span>
      <div class="flex-1 leading-snug font-semibold">${message}</div>
    `;
  }

  elements.resetAlert.classList.remove('hidden');
  elements.resetAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideResetAlert() {
  if (elements.resetAlert) {
    elements.resetAlert.classList.add('hidden');
    elements.resetAlert.innerHTML = '';
  }
}

// ================= ADMIN DASHBOARD & ORDERS ENGINE =================

async function loadAdminDashboard() {
  if (state.currentUserRole !== 'Admin') {
    alert('Access Denied: Admin privileges required.');
    return;
  }

  elements.adminOrdersTableBody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-on-surface-variant">Fetching latest orders & profiles...</td></tr>';
  elements.adminDashboardModal.classList.remove('hidden');

  let orders = [];
  const { data: rpcOrders, error: rpcErr } = await supabase.rpc('get_admin_orders_with_profiles');

  if (!rpcErr && rpcOrders) {
    orders = rpcOrders;
  } else {
    console.warn('RPC get_admin_orders_with_profiles fallback to direct table query:', rpcErr);
    const { data: tableOrders, error: tableErr } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (tableErr) {
      console.error('Error fetching admin orders:', tableErr);
      elements.adminOrdersTableBody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-error">Failed to load orders: ${tableErr.message}</td></tr>`;
      return;
    }
    orders = tableOrders || [];
  }

  state.allOrders = orders;
  renderAdminOrders();
}

function renderAdminOrders() {
  const orders = state.allOrders;
  elements.adminTotalOrders.textContent = orders.length;

  const totalRev = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  elements.adminTotalRevenue.textContent = `₹${totalRev}`;

  const pendingCount = orders.filter(o => o.status === 'pending' || !o.status).length;
  elements.adminPendingOrders.textContent = pendingCount;

  if (orders.length === 0) {
    elements.adminOrdersTableBody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-on-surface-variant">No orders found in database.</td></tr>';
    return;
  }

  elements.adminOrdersTableBody.innerHTML = orders.map(order => {
    const itemsSummary = Array.isArray(order.items) 
      ? order.items.map(i => `${i.qty}x ${i.name}`).join(', ')
      : 'Items';
    
    const status = (order.status || 'pending').toLowerCase();
    let statusClass = 'bg-amber-100 text-amber-900 border-amber-300';
    if (status === 'confirmed') statusClass = 'bg-blue-100 text-blue-900 border-blue-300';
    if (status === 'processing') statusClass = 'bg-purple-100 text-purple-900 border-purple-300';
    if (status === 'out_for_delivery') statusClass = 'bg-indigo-100 text-indigo-900 border-indigo-300';
    if (status === 'completed' || status === 'delivered' || status === 'successful') statusClass = 'bg-emerald-100 text-emerald-900 border-emerald-300';
    if (status === 'cancelled') statusClass = 'bg-red-100 text-red-900 border-red-300';

    const displayStatus = status.replace(/_/g, ' ');

    const customerName = order.full_name || order.user_email?.split('@')[0] || 'Customer';
    const avatarUrl = order.avatar_url;

    const avatarHtml = avatarUrl
      ? `<img src="${avatarUrl}" class="w-8 h-8 rounded-full object-cover border border-primary/40 shadow-2xs shrink-0" alt="${customerName}" />`
      : `<div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0"><span class="material-symbols-outlined text-lg">account_circle</span></div>`;

    return `
      <tr class="hover:bg-surface-container/60 border-b border-outline-variant/20 transition-colors cursor-pointer admin-order-row" data-order-id="${order.order_id}">
        <td class="p-3 font-bold text-primary">${order.order_id || '#'}</td>
        <td class="p-3">
          <div class="flex items-center gap-2">
            ${avatarHtml}
            <div class="truncate max-w-[140px]">
              <div class="font-bold text-on-background text-xs truncate" title="${customerName}">${customerName}</div>
              <div class="text-[10px] text-on-surface-variant truncate" title="${order.user_email || ''}">${order.user_email || 'Guest'}</div>
            </div>
          </div>
        </td>
        <td class="p-3 font-mono text-xs">${order.phone_number || 'N/A'}</td>
        <td class="p-3 max-w-[180px] truncate" title="${itemsSummary}">${itemsSummary}</td>
        <td class="p-3 font-bold text-secondary">₹${order.total_amount || 0}</td>
        <td class="p-3">
          <span class="px-2.5 py-0.5 text-[10px] font-bold rounded-full border uppercase ${statusClass}">
            ${displayStatus}
          </span>
        </td>
        <td class="p-3" onclick="event.stopPropagation();">
          <button class="view-order-details-btn bg-primary/10 text-primary hover:bg-primary/20 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer" data-order-id="${order.order_id}">
            <span class="material-symbols-outlined text-sm">visibility</span>
            <span>View Profile & Order</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('.admin-order-row, .view-order-details-btn').forEach(elem => {
    elem.addEventListener('click', () => {
      const orderId = elem.dataset.orderId || elem.closest('[data-order-id]')?.dataset.orderId;
      if (orderId) {
        openAdminOrderDetailModal(orderId);
      }
    });
  });
}

function openAdminOrderDetailModal(orderId) {
  const order = state.allOrders.find(o => o.order_id === orderId);
  if (!order) return;

  const modal = document.getElementById('adminOrderDetailModal');
  if (!modal) return;

  const mOrderId = document.getElementById('adminModalOrderId');
  const mCustName = document.getElementById('adminCustomerName');
  const mCustEmail = document.getElementById('adminCustomerEmail');
  const mCustPhone = document.getElementById('adminCustomerPhone');
  const mAvatarImg = document.getElementById('adminCustomerAvatarImg');
  const mAvatarIcon = document.getElementById('adminCustomerAvatarIcon');
  const mItemsBody = document.getElementById('adminOrderItemsTableBody');
  const mTotal = document.getElementById('adminOrderTotalAmount');
  const mAddress = document.getElementById('adminOrderAddress');
  const mStatusSelect = document.getElementById('adminModalStatusSelect');
  const mOrderDate = document.getElementById('adminOrderDate');
  const closeBtn = document.getElementById('closeAdminOrderDetailBtn');

  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.add('hidden');
  }

  if (mOrderId) mOrderId.textContent = `Order #${order.order_id}`;
  if (mCustName) mCustName.textContent = order.full_name || order.user_email?.split('@')[0] || 'Customer';
  if (mCustEmail) mCustEmail.textContent = order.user_email || 'Guest User';
  if (mCustPhone) mCustPhone.textContent = order.phone_number || 'Not provided';

  if (order.avatar_url && mAvatarImg && mAvatarIcon) {
    mAvatarImg.src = order.avatar_url;
    mAvatarImg.classList.remove('hidden');
    mAvatarIcon.classList.add('hidden');
  } else if (mAvatarImg && mAvatarIcon) {
    mAvatarImg.classList.add('hidden');
    mAvatarIcon.classList.remove('hidden');
  }

  if (mAddress) mAddress.innerHTML = formatDeliveryAddressHtml(order.delivery_address);
  if (mTotal) mTotal.textContent = `₹${order.total_amount || 0}`;

  if (mOrderDate) {
    const d = order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A';
    mOrderDate.textContent = `Ordered on: ${d}`;
  }

  if (mStatusSelect) {
    const status = (order.status || 'pending').toLowerCase();
    mStatusSelect.value = status === 'delivered' || status === 'successful' ? 'completed' : status;
    mStatusSelect.onchange = async () => {
      const newStat = mStatusSelect.value;
      await updateOrderStatus(order.order_id, newStat);
    };
  }

  // Render items list table
  if (mItemsBody) {
    if (Array.isArray(order.items) && order.items.length > 0) {
      mItemsBody.innerHTML = order.items.map(item => {
        const itemQty = item.qty || 1;
        const itemPrice = item.price || 0;
        const itemTotal = itemQty * itemPrice;
        return `
          <tr class="hover:bg-surface-container/40">
            <td class="p-2.5 font-semibold text-primary">${item.name}</td>
            <td class="p-2.5 text-center text-on-surface-variant font-mono">₹${itemPrice}</td>
            <td class="p-2.5 text-center font-bold text-secondary">${itemQty}</td>
            <td class="p-2.5 text-right font-bold text-primary font-mono">₹${itemTotal}</td>
          </tr>
        `;
      }).join('');
    } else {
      mItemsBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-on-surface-variant">No items found in this order.</td></tr>';
    }
  }

  modal.classList.remove('hidden');
}

async function updateOrderStatus(orderId, newStatus) {
  const { error } = await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('order_id', orderId);

  if (error) {
    alert(`Failed to update order status: ${error.message}`);
  } else {
    const order = state.allOrders.find(o => o.order_id === orderId);
    if (order) order.status = newStatus;
    renderAdminOrders();
  }
}

// ================= ADMIN PRODUCT INVENTORY & STOCK CONTROLS =================

async function loadAdminProductsTable() {
  const tbody = document.getElementById('adminProductsTableBody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-on-surface-variant">Fetching inventory products...</td></tr>';

  const [products, categories] = await Promise.all([
    getProducts(false),
    getCategories()
  ]);

  state.allProducts = products || [];
  state.categoriesList = categories || [];

  // Populate categories dropdown in Add Product form
  const catSelect = document.getElementById('newProdCategory');
  if (catSelect && categories) {
    catSelect.innerHTML = '<option value="">Select Category</option>' + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  renderAdminProductsTable();
}

function renderAdminProductsTable() {
  const tbody = document.getElementById('adminProductsTableBody');
  if (!tbody) return;

  const products = state.allProducts;
  const categories = state.categoriesList || [];

  if (!products || products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-on-surface-variant">No products found in inventory. Click "Add New Product" to create one.</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(prod => {
    const isAvail = prod.is_available !== false;
    const isHidden = prod.is_hidden === true;
    const currentCatId = prod.category_id || '';
    const imgUrl = prod.image_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDSgXSbgG4O-vHwX2nnPLQQNJUjy19q7na2Ru1L8kMiNLQuIKupiWlPusxh0J_re16_QNi6jDS9HaW2gsVYnY5PKHxgtCKTx4-srHUe1BHE7_09Jolu-hFbDT90K0tqrEAfZRpwATZ2UqBKIaZ4lj4rYvTvHKR7BCk8Yvk_hxu1ThNUZlOulICL6hkVWC0JtTv5S2kreKzBb6cLLhYibw8H8lbcUBKBR4zDXbf7ByAM6xB2k3pi3knW';

    const categoryOptionsHtml = '<option value="">Uncategorized</option>' + categories.map(c => `
      <option value="${c.id}" ${c.id === currentCatId ? 'selected' : ''}>${c.name}</option>
    `).join('');

    return `
      <tr class="hover:bg-surface-container/50 border-b border-outline-variant/20" data-prod-id="${prod.id}">
        <td class="p-3">
          <div class="flex items-start gap-2.5">
            <div class="flex flex-col items-center flex-shrink-0">
              <img src="${imgUrl}" alt="${prod.name}" class="w-10 h-10 rounded-lg object-cover border border-outline-variant/40 mt-1 admin-prod-img-preview" />
              <label class="cursor-pointer bg-surface-container px-1.5 py-0.5 rounded text-[9px] font-bold text-primary border border-outline-variant/60 hover:bg-surface-container-high transition-all inline-flex items-center gap-0.5 mt-1 shadow-2xs" title="Upload downloaded image file from your device">
                <span class="material-symbols-outlined text-[11px]">upload_file</span>
                <span>Upload</span>
                <input type="file" accept="image/*" class="admin-prod-file-upload hidden" data-prod-id="${prod.id}" />
              </label>
            </div>
            <div class="space-y-1 w-full min-w-[150px]">
              <input type="text" value="${prod.name}" class="admin-prod-name w-full px-2 py-1 border border-outline-variant rounded bg-surface text-xs font-bold text-primary focus:outline-none focus:border-primary" placeholder="Product Name" data-prod-id="${prod.id}" />
              <input type="text" value="${prod.description || ''}" class="admin-prod-desc w-full px-2 py-1 border border-outline-variant/60 rounded bg-surface text-[10px] text-on-surface-variant focus:outline-none focus:border-primary" placeholder="Short description..." data-prod-id="${prod.id}" />
              <input type="url" value="${prod.image_url || ''}" class="admin-prod-img w-full px-2 py-0.5 border border-outline-variant/60 rounded bg-surface text-[10px] text-on-surface-variant focus:outline-none focus:border-primary font-mono" placeholder="Image URL (https://...)" data-prod-id="${prod.id}" />
            </div>
          </div>
        </td>
        <td class="p-3">
          <select class="admin-prod-category px-2 py-1 border border-outline-variant rounded bg-surface text-xs font-medium focus:outline-none focus:border-primary" data-prod-id="${prod.id}">
            ${categoryOptionsHtml}
          </select>
        </td>
        <td class="p-3">
          <input type="number" step="0.5" value="${prod.price}" class="admin-prod-price w-20 px-2 py-1 border border-outline-variant rounded bg-surface text-xs font-bold text-secondary focus:outline-none focus:border-primary" data-prod-id="${prod.id}" />
        </td>
        <td class="p-3">
          <input type="text" value="${prod.unit || '250g'}" class="admin-prod-unit w-20 px-2 py-1 border border-outline-variant rounded bg-surface text-xs focus:outline-none focus:border-primary" data-prod-id="${prod.id}" />
        </td>
        <td class="p-3">
          <select class="admin-prod-badge px-2 py-1 border border-outline-variant rounded bg-surface text-xs font-semibold focus:outline-none focus:border-primary" data-prod-id="${prod.id}">
            <option value="" ${!prod.badge ? 'selected' : ''}>None</option>
            <option value="Best Seller" ${prod.badge === 'Best Seller' ? 'selected' : ''}>Best Seller</option>
            <option value="New" ${prod.badge === 'New' ? 'selected' : ''}>New</option>
            <option value="Signature" ${prod.badge === 'Signature' ? 'selected' : ''}>Signature</option>
            <option value="Classic" ${prod.badge === 'Classic' ? 'selected' : ''}>Classic</option>
            <option value="Special" ${prod.badge === 'Special' ? 'selected' : ''}>Special</option>
          </select>
        </td>
        <td class="p-3">
          <select class="admin-prod-stock px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase transition-all ${isAvail ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-red-100 text-red-900 border-red-300'}" data-prod-id="${prod.id}">
            <option value="true" ${isAvail ? 'selected' : ''}>In Stock</option>
            <option value="false" ${!isAvail ? 'selected' : ''}>Out of Stock</option>
          </select>
        </td>
        <td class="p-3">
          <select class="admin-prod-visibility px-2.5 py-1 rounded-full text-[11px] font-bold border uppercase transition-all ${!isHidden ? 'bg-blue-100 text-blue-900 border-blue-300' : 'bg-slate-200 text-slate-700 border-slate-400'}" data-prod-id="${prod.id}">
            <option value="false" ${!isHidden ? 'selected' : ''}>Show Product</option>
            <option value="true" ${isHidden ? 'selected' : ''}>Hide Product</option>
          </select>
        </td>
        <td class="p-3 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button class="admin-save-prod-btn px-2.5 py-1 bg-primary text-on-primary rounded text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1 shadow-sm" data-prod-id="${prod.id}" title="Save All Product Changes">
              <span class="material-symbols-outlined text-sm">save</span>
              <span class="hidden sm:inline">Save</span>
            </button>
            <button class="admin-delete-prod-btn p-1.5 text-xs text-error hover:bg-error/10 rounded-md transition-colors" data-prod-id="${prod.id}" title="Delete Product">
              <span class="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach event listeners for Direct Image File Uploads
  document.querySelectorAll('.admin-prod-file-upload').forEach(input => {
    input.addEventListener('change', async (e) => {
      const prodId = e.target.dataset.prodId;
      const file = e.target.files[0];
      if (!file) return;

      try {
        const row = document.querySelector(`tr[data-prod-id="${prodId}"]`);
        if (row) {
          const imgPreview = row.querySelector('.admin-prod-img-preview');
          if (imgPreview) imgPreview.style.opacity = '0.5';
        }

        const publicUrl = await uploadProductImage(file);
        await updateProduct(prodId, { image_url: publicUrl });

        const prod = state.allProducts.find(p => p.id === prodId);
        if (prod) prod.image_url = publicUrl;

        alert('Product picture uploaded and updated successfully!');
        renderAdminProductsTable();
        renderCustomerProductsGrid();
      } catch (err) {
        alert(`Failed to upload product picture: ${err.message}`);
      }
    });
  });

  // Attach event listeners for Save buttons
  document.querySelectorAll('.admin-save-prod-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const prodId = e.currentTarget.dataset.prodId;
      const row = document.querySelector(`tr[data-prod-id="${prodId}"]`);
      if (!row) return;

      const nameInput = row.querySelector('.admin-prod-name');
      const descInput = row.querySelector('.admin-prod-desc');
      const imgInput = row.querySelector('.admin-prod-img');
      const catSelect = row.querySelector('.admin-prod-category');
      const priceInput = row.querySelector('.admin-prod-price');
      const unitInput = row.querySelector('.admin-prod-unit');
      const badgeSelect = row.querySelector('.admin-prod-badge');
      const stockSelect = row.querySelector('.admin-prod-stock');
      const visSelect = row.querySelector('.admin-prod-visibility');

      const newName = nameInput.value.trim();
      const newDesc = descInput.value.trim();
      const newImgUrl = imgInput ? imgInput.value.trim() : null;
      const newCatId = catSelect.value || null;
      const newPrice = parseFloat(priceInput.value);
      const newUnit = unitInput.value.trim();
      const newBadge = badgeSelect ? (badgeSelect.value || null) : null;
      const newAvail = stockSelect.value === 'true';
      const newHidden = visSelect.value === 'true';

      if (!newName || isNaN(newPrice) || !newUnit) {
        alert('Please fill in valid Product Name, Price, and Unit Weight.');
        return;
      }

      try {
        await updateProduct(prodId, {
          name: newName,
          description: newDesc,
          image_url: newImgUrl || null,
          category_id: newCatId,
          price: newPrice,
          unit: newUnit,
          badge: newBadge,
          is_available: newAvail,
          is_hidden: newHidden
        });

        const prod = state.allProducts.find(p => p.id === prodId);
        if (prod) {
          prod.name = newName;
          prod.description = newDesc;
          prod.image_url = newImgUrl || null;
          prod.category_id = newCatId;
          prod.price = newPrice;
          prod.unit = newUnit;
          prod.badge = newBadge;
          prod.is_available = newAvail;
          prod.is_hidden = newHidden;
        }

        alert(`Product "${newName}" updated successfully!`);
        renderAdminProductsTable();
        renderCustomerProductsGrid();
      } catch (err) {
        alert(`Failed to update product: ${err.message}`);
      }
    });
  });

  // Attach event listeners for Badge dropdown changes
  document.querySelectorAll('.admin-prod-badge').forEach(select => {
    select.addEventListener('change', async (e) => {
      const prodId = e.target.dataset.prodId;
      const newBadge = e.target.value || null;
      try {
        await toggleProductBadge(prodId, newBadge);
        const prod = state.allProducts.find(p => p.id === prodId);
        if (prod) prod.badge = newBadge;
        renderAdminProductsTable();
        renderCustomerProductsGrid();
      } catch (err) {
        alert(`Failed to update badge: ${err.message}`);
      }
    });
  });

  // Attach event listeners for Stock toggles
  document.querySelectorAll('.admin-prod-stock').forEach(select => {
    select.addEventListener('change', async (e) => {
      const prodId = e.target.dataset.prodId;
      const newAvail = e.target.value === 'true';
      try {
        await toggleProductStock(prodId, newAvail);
        const prod = state.allProducts.find(p => p.id === prodId);
        if (prod) prod.is_available = newAvail;
        renderAdminProductsTable();
        renderCustomerProductsGrid();
      } catch (err) {
        alert(`Failed to update stock status: ${err.message}`);
      }
    });
  });

  // Attach event listeners for Storefront Visibility toggles (Show Product vs Hide Product)
  document.querySelectorAll('.admin-prod-visibility').forEach(select => {
    select.addEventListener('change', async (e) => {
      const prodId = e.target.dataset.prodId;
      const newHidden = e.target.value === 'true';
      try {
        await toggleProductVisibility(prodId, newHidden);
        const prod = state.allProducts.find(p => p.id === prodId);
        if (prod) prod.is_hidden = newHidden;
        alert(newHidden ? 'Product is now HIDDEN from the customer website.' : 'Product is now VISIBLE on the customer website.');
        renderAdminProductsTable();
        renderCustomerProductsGrid();
      } catch (err) {
        alert(`Failed to update product visibility: ${err.message}`);
      }
    });
  });

  // Attach event listeners for Delete buttons
  document.querySelectorAll('.admin-delete-prod-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const prodId = e.currentTarget.dataset.prodId;
      if (!confirm('Are you sure you want to delete this product from inventory?')) return;

      try {
        await deleteProduct(prodId);
        state.allProducts = state.allProducts.filter(p => p.id !== prodId);
        renderAdminProductsTable();
        renderCustomerProductsGrid();
      } catch (err) {
        alert(`Failed to delete product: ${err.message}`);
      }
    });
  });
}

// Render products dynamically on Customer interface (HIDDEN PRODUCTS NEVER APPEAR)
async function renderCustomerProductsGrid() {
  const container = document.getElementById('signatureProductsGrid');
  if (!container) return;

  const products = await getProducts(false, true);
  state.allProducts = products || [];

  // Filter out products marked as hidden by Admin
  const visibleProducts = (products || []).filter(p => p.is_hidden !== true);

  if (visibleProducts.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-12 text-center text-on-surface-variant bg-surface-container/50 rounded-2xl border border-outline-variant/30">
        <span class="material-symbols-outlined text-4xl text-outline-variant mb-2">storefront</span>
        <p class="font-bold text-on-surface">No Products Available</p>
        <p class="text-xs mt-1">Our chefs are preparing fresh sweets. Please check back shortly!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = visibleProducts.map(prod => {
    const isAvail = prod.is_available !== false;
    const imgUrl = prod.image_url || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDSgXSbgG4O-vHwX2nnPLQQNJUjy19q7na2Ru1L8kMiNLQuIKupiWlPusxh0J_re16_QNi6jDS9HaW2gsVYnY5PKHxgtCKTx4-srHUe1BHE7_09Jolu-hFbDT90K0tqrEAfZRpwATZ2UqBKIaZ4lj4rYvTvHKR7BCk8Yvk_hxu1ThNUZlOulICL6hkVWC0JtTv5S2kreKzBb6cLLhYibw8H8lbcUBKBR4zDXbf7ByAM6xB2k3pi3knW';
    const hideOrderBtn = state.currentUserRole === 'Admin';
    const badgeText = prod.badge || null;

    let badgeClass = 'bg-secondary-container/90 text-on-secondary-container';
    if (badgeText === 'Best Seller') badgeClass = 'bg-amber-500 text-white font-bold shadow-sm';
    if (badgeText === 'New') badgeClass = 'bg-emerald-600 text-white font-bold shadow-sm';
    if (badgeText === 'Signature') badgeClass = 'bg-purple-600 text-white font-bold shadow-sm';
    if (badgeText === 'Classic') badgeClass = 'bg-blue-600 text-white font-bold shadow-sm';
    if (badgeText === 'Special') badgeClass = 'bg-rose-600 text-white font-bold shadow-sm';

    return `
      <div class="group bg-surface-container-lowest rounded-xl overflow-hidden card-shadow transition-all hover:-translate-y-2 flex flex-col justify-between border border-outline-variant/30">
        <div>
          <div class="h-64 overflow-hidden relative">
            <img class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ${!isAvail ? 'grayscale opacity-75' : ''}" data-alt="${prod.name}" src="${imgUrl}"/>
            ${!isAvail 
              ? `<div class="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full font-bold text-[10px] uppercase tracking-widest shadow-md z-10">Out of Stock</div>`
              : (badgeText ? `<div class="absolute top-4 right-4 ${badgeClass} px-3 py-1 rounded-full font-label-lg text-xs uppercase tracking-wider z-10">${badgeText}</div>` : '')
            }
          </div>
          <div class="p-lg text-center">
            <h3 class="font-headline-sm text-headline-sm text-primary mb-xs font-bold">${prod.name}</h3>
            <p class="font-body-md text-body-md text-on-surface-variant mb-md text-xs line-clamp-2">${prod.description || ''}</p>
            <span class="font-headline-sm text-secondary block mb-4 font-bold text-lg">₹${prod.price} <small class="font-label-lg text-on-surface-variant text-xs">/ ${prod.unit || '250g'}</small></span>
          </div>
        </div>
        <div class="px-lg pb-lg">
          ${!isAvail
            ? `<button disabled class="w-full bg-slate-200 text-slate-500 py-3 rounded-full font-label-lg uppercase tracking-wider cursor-not-allowed opacity-70 flex items-center justify-center gap-2 border border-slate-300">
                <span class="material-symbols-outlined text-sm">block</span>
                <span>Out of Stock</span>
              </button>`
            : `<button class="item-order-btn ${hideOrderBtn ? 'hidden' : ''} w-full bg-primary text-on-primary py-3 rounded-full font-label-lg uppercase tracking-wider hover:bg-primary-container transition-colors flex items-center justify-center gap-2 shadow-sm" data-item-id="${prod.id}" data-item-name="${prod.name}" data-item-price="${prod.price}">
                <span class="material-symbols-outlined text-sm">shopping_cart</span>
                <span>Order ${prod.name}</span>
              </button>`
          }
        </div>
      </div>
    `;
  }).join('');

  // Re-attach order event listeners to new dynamic buttons
  document.querySelectorAll('.item-order-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemId = e.currentTarget.dataset.itemId;
      triggerOrderFlow(itemId);
    });
  });
}

// ================= CUSTOMER MY ORDERS ENGINE =================

async function loadMyOrders() {
  if (!state.currentUser) {
    openAuthModal('Please sign in to view your orders.');
    return;
  }

  elements.myOrdersContainer.innerHTML = '<div class="p-6 text-center text-on-surface-variant">Loading your order history...</div>';
  elements.myOrdersModal.classList.remove('hidden');

  const userEmail = state.currentUser.email ? state.currentUser.email.toLowerCase() : '';
  const userId = state.currentUser.id;

  let query = supabase.from('orders').select('*');
  if (userId && userEmail) {
    query = query.or(`user_id.eq.${userId},user_email.ilike.${userEmail}`);
  } else if (userEmail) {
    query = query.ilike('user_email', userEmail);
  }

  const { data: orders, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching customer orders:', error);
    elements.myOrdersContainer.innerHTML = `<div class="p-6 text-center text-error font-medium">Failed to load orders: ${error.message}</div>`;
    return;
  }

  if (!orders || orders.length === 0) {
    elements.myOrdersContainer.innerHTML = `
      <div class="p-8 text-center text-on-surface-variant">
        <span class="material-symbols-outlined text-4xl text-outline-variant mb-2">shopping_bag</span>
        <p class="font-bold text-on-surface">No Orders Found</p>
        <p class="text-xs mt-1">You haven't placed any sweet orders with ${state.currentUser.email} yet!</p>
      </div>
    `;
    return;
  }

  elements.myOrdersContainer.innerHTML = orders.map(order => {
    const itemsHtml = Array.isArray(order.items)
      ? order.items.map(i => `<div class="flex justify-between text-xs py-0.5"><span>${i.qty}x ${i.name}</span><span class="font-semibold">₹${i.qty * i.price}</span></div>`).join('')
      : '<div class="text-xs text-on-surface-variant">Order details</div>';

    const status = order.status || 'pending';
    let statusClass = 'bg-amber-100 text-amber-800 border-amber-300';
    if (status === 'completed') statusClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (status === 'cancelled') statusClass = 'bg-red-100 text-red-800 border-red-300';

    return `
      <div class="bg-surface-container p-4 rounded-xl border border-outline-variant/40 space-y-3 shadow-sm">
        <div class="flex justify-between items-center border-b border-outline-variant/20 pb-2">
          <div>
            <span class="font-bold text-primary text-sm">${order.order_id || order.id || '#'}</span>
            <span class="text-[10px] text-on-surface-variant block">${new Date(order.created_at).toLocaleString()}</span>
          </div>
          <span class="px-2.5 py-0.5 text-[10px] font-bold rounded-full border uppercase ${statusClass}">
            ${status}
          </span>
        </div>
        <div class="space-y-1 bg-white/60 p-2.5 rounded-lg border border-outline-variant/20">
          ${itemsHtml}
        </div>
        <div class="flex justify-between items-center border-t border-outline-variant/20 pt-2 font-bold text-xs">
          <span>Total Amount Paid:</span>
          <span class="text-secondary text-sm">₹${order.total_amount}</span>
        </div>
      </div>
    `;
  }).join('');
}

async function handleSignOut() {
  await supabase.auth.signOut();
}

function openAuthModal(promptMessage = null) {
  if (promptMessage) {
    showAuthAlert(promptMessage, 'error');
  } else {
    hideAuthAlert();
  }
  // Reset tabs to sign in
  if (elements.signInForm && elements.signUpForm && elements.forgotPasswordForm) {
    elements.signInForm.classList.remove('hidden');
    elements.signUpForm.classList.add('hidden');
    elements.forgotPasswordForm.classList.add('hidden');
    if (elements.authTabs) elements.authTabs.classList.remove('hidden');
  }
  elements.authModal.classList.remove('hidden');
}

function setupPasswordToggles() {
  if (elements.toggleSignInPasswordBtn && elements.signInPassword && elements.signInEyeIcon) {
    elements.toggleSignInPasswordBtn.addEventListener('click', () => {
      const isPassword = elements.signInPassword.type === 'password';
      elements.signInPassword.type = isPassword ? 'text' : 'password';
      elements.signInEyeIcon.textContent = isPassword ? 'visibility_off' : 'visibility';
    });
  }

  if (elements.toggleSignUpPasswordBtn && elements.signUpPassword && elements.signUpEyeIcon) {
    elements.toggleSignUpPasswordBtn.addEventListener('click', () => {
      const isPassword = elements.signUpPassword.type === 'password';
      elements.signUpPassword.type = isPassword ? 'text' : 'password';
      elements.signUpEyeIcon.textContent = isPassword ? 'visibility_off' : 'visibility';
    });
  }

  if (elements.toggleNewResetPasswordBtn && elements.newResetPassword && elements.newResetEyeIcon) {
    elements.toggleNewResetPasswordBtn.addEventListener('click', () => {
      const isPassword = elements.newResetPassword.type === 'password';
      elements.newResetPassword.type = isPassword ? 'text' : 'password';
      elements.newResetEyeIcon.textContent = isPassword ? 'visibility_off' : 'visibility';
    });
  }

  if (elements.toggleConfirmResetPasswordBtn && elements.confirmResetPassword && elements.confirmResetEyeIcon) {
    elements.toggleConfirmResetPasswordBtn.addEventListener('click', () => {
      const isPassword = elements.confirmResetPassword.type === 'password';
      elements.confirmResetPassword.type = isPassword ? 'text' : 'password';
      elements.confirmResetEyeIcon.textContent = isPassword ? 'visibility_off' : 'visibility';
    });
  }

  if (elements.toggleAdminCodePasswordBtn && elements.signUpAdminCode && elements.adminCodeEyeIcon) {
    elements.toggleAdminCodePasswordBtn.addEventListener('click', () => {
      const isPassword = elements.signUpAdminCode.type === 'password';
      elements.signUpAdminCode.type = isPassword ? 'text' : 'password';
      elements.adminCodeEyeIcon.textContent = isPassword ? 'visibility_off' : 'visibility';
    });
  }
}

function triggerOrderFlow(preselectedItemId = null) {
  if (!state.currentUser) {
    openAuthModal('Please sign in or create an account to order from Banerjee Sweets!');
    return;
  }

  hideOrderAlert();

  if (preselectedItemId === 'rossogolla') {
    state.orderQuantities.rossogolla = Math.max(1, state.orderQuantities.rossogolla);
  } else if (preselectedItemId === 'sandesh') {
    state.orderQuantities.sandesh = Math.max(1, state.orderQuantities.sandesh);
  } else if (preselectedItemId === 'mishti-doi') {
    state.orderQuantities.mishtidoi = Math.max(1, state.orderQuantities.mishtidoi);
  }

  updateCheckoutTotal();
  setupPaymentMethodToggle();
  elements.orderModal.classList.remove('hidden');
}

function updateCheckoutTotal() {
  document.getElementById('qty-rossogolla').textContent = state.orderQuantities.rossogolla;
  document.getElementById('qty-sandesh').textContent = state.orderQuantities.sandesh;
  document.getElementById('qty-mishtidoi').textContent = state.orderQuantities.mishtidoi;

  const total = (state.orderQuantities.rossogolla * 120) + (state.orderQuantities.sandesh * 180) + (state.orderQuantities.mishtidoi * 150);
  elements.checkoutTotalText.textContent = `₹${total}`;
  return total;
}

// Generate jsPDF invoice document
function buildOrderPDF(orderPayload) {
  const doc = new jsPDF();

  const primaryColor = '#6a0008';
  const secondaryColor = '#735c00';

  // Title Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(primaryColor);
  doc.text('BANERJEE SWEETS', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(secondaryColor);
  doc.text('Pure Love from Arambagh - Official Order Invoice', 14, 27);

  // Line Divider
  doc.setDrawColor(224, 191, 188);
  doc.setLineWidth(0.5);
  doc.line(14, 32, 196, 32);

  // Invoice Details Header
  doc.setFontSize(11);
  doc.setTextColor('#1e1b18');
  doc.setFont('helvetica', 'bold');
  doc.text(`Invoice Ref: #${orderPayload.order_id}`, 14, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Order Date: ${new Date(orderPayload.created_at).toLocaleString()}`, 14, 48);
  doc.text(`Customer Email: ${orderPayload.user_email}`, 14, 54);
  doc.text(`Phone Number: ${orderPayload.phone_number}`, 14, 60);
  doc.text(`Payment Method: ${orderPayload.payment_method || 'Online Payment'}`, 14, 66);
  doc.text(`Delivery / Pickup: ${orderPayload.delivery_address}`, 14, 72);

  // Items Table Header
  doc.setLineWidth(0.3);
  doc.line(14, 80, 196, 80);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Item Description', 14, 86);
  doc.text('Qty', 110, 86);
  doc.text('Price/Unit', 140, 86);
  doc.text('Total', 175, 86);

  doc.line(14, 89, 196, 89);

  // Items Rows
  let yPos = 97;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);

  orderPayload.items.forEach(item => {
    doc.text(item.name, 14, yPos);
    doc.text(String(item.qty), 112, yPos);
    doc.text(`Rs. ${item.price}`, 140, yPos);
    doc.text(`Rs. ${item.qty * item.price}`, 175, yPos);
    yPos += 8;
  });

  // Total Summary
  doc.line(14, yPos + 2, 196, yPos + 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(primaryColor);
  doc.text(`Grand Total: Rs. ${orderPayload.total_amount}`, 135, yPos + 12);

  // Footer Note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor('#745c00');
  doc.text('Thank you for choosing Banerjee Sweets! Handcrafted with pure ghee & love in Arambagh.', 14, yPos + 30);
  doc.text('Store Location: Arambagh Hospital More, Near HDFC Bank | Contact: +91 7001832118', 14, yPos + 36);

  return doc;
}

// Mobile Phone OTP Verification Helper Functions for Checkout
async function sendCheckoutOtp() {
  const email = document.getElementById('emailAddress')?.value;
  const emailErr = document.getElementById('emailError');
  const emailInput = document.getElementById('emailAddress');
  const otpContainer = document.getElementById('otpContainer');
  const otpNoticeText = document.getElementById('otpNoticeText');
  const otpErrorText = document.getElementById('otpErrorText');
  const otpSuccessBadge = document.getElementById('otpSuccessBadge');
  const otpTimerText = document.getElementById('otpTimerText');
  const sendOtpBtn = document.getElementById('sendOtpBtn');
  const triggerOtpBtn = document.getElementById('triggerOtpBtn');

  if (emailErr) emailErr.classList.add('hidden');
  if (otpErrorText) otpErrorText.classList.add('hidden');

  if (!email || !email.trim()) {
    if (emailErr) {
      emailErr.textContent = 'Please enter an email address to receive OTP.';
      emailErr.classList.remove('hidden');
    }
    if (emailInput) emailInput.focus();
    return false;
  }

  // Simple email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    if (emailErr) {
      emailErr.textContent = 'Please enter a valid email address.';
      emailErr.classList.remove('hidden');
    }
    if (emailInput) emailInput.focus();
    return false;
  }

  if (sendOtpBtn) {
    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = 'Sending...';
  }
  if (triggerOtpBtn) {
    triggerOtpBtn.disabled = true;
    triggerOtpBtn.textContent = 'Sending...';
  }

  try {
    const response = await fetch('/api/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'Failed to send OTP.');
    }

    // Use the generated OTP from the backend to verify later
    state.generatedOtp = data.otpCode;
    state.isEmailVerified = false; // changed from isPhoneVerified

    if (otpNoticeText) {
      otpNoticeText.innerHTML = `<strong>📧 Email OTP Sent to ${email}!</strong>`;
    }

    if (otpContainer) otpContainer.classList.remove('hidden');
    if (otpSuccessBadge) otpSuccessBadge.classList.add('hidden');

    // Start 30s Countdown Timer
    let timeLeft = 30;
    if (state.otpCountdownTimer) clearInterval(state.otpCountdownTimer);

    if (sendOtpBtn) sendOtpBtn.textContent = 'Verify OTP';
    if (triggerOtpBtn) triggerOtpBtn.textContent = 'Resend OTP';

    state.otpCountdownTimer = setInterval(() => {
      timeLeft--;
      if (otpTimerText) otpTimerText.textContent = `Resend in ${timeLeft}s`;
      if (timeLeft <= 0) {
        clearInterval(state.otpCountdownTimer);
        if (otpTimerText) otpTimerText.textContent = 'Resend OTP';
        if (sendOtpBtn) sendOtpBtn.disabled = false;
        if (triggerOtpBtn) triggerOtpBtn.disabled = false;
      }
    }, 1000);

    return true;

  } catch (error) {
    console.error("Error sending OTP via SMS API:", error);
    if (otpErrorText) {
      otpErrorText.textContent = `Error: ${error.message}`;
      otpErrorText.classList.remove('hidden');
    }
    if (sendOtpBtn) {
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = 'Verify OTP';
    }
    if (triggerOtpBtn) {
      triggerOtpBtn.disabled = false;
      triggerOtpBtn.textContent = 'Send OTP';
    }
    return false;
  }
}

function verifyCheckoutOtp() {
  const otpInput = document.getElementById('checkoutOtpInput');
  const otpErrorText = document.getElementById('otpErrorText');
  const otpSuccessBadge = document.getElementById('otpSuccessBadge');
  const enteredOtp = otpInput ? otpInput.value.trim() : '';

  if (!state.generatedOtp) {
    if (otpErrorText) {
      otpErrorText.textContent = 'Please click "Get OTP" or "Send OTP" to receive verification code.';
      otpErrorText.classList.remove('hidden');
    }
    return false;
  }

  if (!enteredOtp || enteredOtp.length !== 6) {
    if (otpErrorText) {
      otpErrorText.textContent = 'Please enter the 6-digit OTP code sent to your email.';
      otpErrorText.classList.remove('hidden');
    }
    return false;
  }

  if (enteredOtp !== state.generatedOtp) {
    if (otpErrorText) {
      otpErrorText.textContent = 'Invalid OTP Code. Please enter the correct 6-digit code or click Resend OTP.';
      otpErrorText.classList.remove('hidden');
    }
    state.isEmailVerified = false;
    return false;
  }

  // OTP Verified Successfully!
  state.isEmailVerified = true;
  if (otpErrorText) otpErrorText.classList.add('hidden');
  if (otpSuccessBadge) {
    otpSuccessBadge.classList.remove('hidden');
    otpSuccessBadge.classList.add('flex');
  }
  return true;
}

// Handle Order Checkout Submission: DB Table + JSON file upload + PDF invoice upload to Supabase Storage Bucket 'orders'
async function handleCheckoutSubmit(e) {
  e.preventDefault();
  const address = document.getElementById('deliveryAddress')?.value || '';
  const phone = document.getElementById('phoneNumber')?.value || '';
  const submitBtn = document.getElementById('placeOrderSubmitBtn');

  hideOrderAlert();

  const checkedPaymentRadio = document.querySelector('input[name="paymentMethod"]:checked');
  const selectedPaymentMethod = checkedPaymentRadio ? checkedPaymentRadio.value : 'online';

  let paymentMethodLabel = 'Online Payment';
  if (selectedPaymentMethod === 'cod') paymentMethodLabel = 'Cash on Delivery';
  else if (selectedPaymentMethod === 'pickup') paymentMethodLabel = 'Pick Up from Shop';

  // Validate Delivery Address for delivery orders
  if (selectedPaymentMethod !== 'pickup') {
    if (!address || !address.trim()) {
      showOrderAlert('Delivery Address is required for home delivery! Or select "Pick Up from Shop" if picking up in person.');
      const addressInput = document.getElementById('deliveryAddress');
      if (addressInput) addressInput.focus();
      return;
    }
  }

  // Validate Phone Number
  if (!phone || !phone.trim()) {
    showOrderAlert('Phone number is required!');
    if (elements.phoneError) {
      elements.phoneError.textContent = 'Please enter your phone number.';
      elements.phoneError.classList.remove('hidden');
    }
    if (elements.phoneNumberInput) {
      elements.phoneNumberInput.classList.remove('border-outline-variant');
      elements.phoneNumberInput.classList.add('border-error', 'border-red-500');
      elements.phoneNumberInput.focus();
    }
    return;
  }

  // Simple validation for 10 digits
  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(phone.replace(/[\s\-\+]/g, '').slice(-10))) {
    showOrderAlert('Invalid phone number! Please enter a valid 10-digit mobile number.');
    if (elements.phoneError) {
      elements.phoneError.textContent = 'Please enter a valid phone number (e.g. +91 7001832118 or 10-digit mobile number).';
      elements.phoneError.classList.remove('hidden');
    }
    if (elements.phoneNumberInput) {
      elements.phoneNumberInput.classList.remove('border-outline-variant');
      elements.phoneNumberInput.classList.add('border-error', 'border-red-500');
      elements.phoneNumberInput.focus();
    }
    return;
  }

  const total = updateCheckoutTotal();

  if (total <= 0) {
    showOrderAlert('Please select at least 1 item to order!');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Placing Order...';

  const generatedId = `BS-${Math.floor(1000 + Math.random() * 9000)}`;

  let finalDeliveryAddress = '';
  if (selectedPaymentMethod === 'pickup') {
    finalDeliveryAddress = 'Pick Up from Shop (Store Location: Arambagh Hospital More, Near HDFC Bank)';
  } else {
    finalDeliveryAddress = currentGpsCoords?.mapUrl && !address.includes('google.com/maps')
      ? `${address}\n📍 Google Maps Location Pin: ${currentGpsCoords.mapUrl}`
      : address;
  }

  const orderPayload = {
    order_id: generatedId,
    user_id: state.currentUser?.id || null,
    user_email: state.currentUser?.email || 'guest@example.com',
    items: [
      { name: 'Classic Rossogolla', qty: state.orderQuantities.rossogolla, price: 120 },
      { name: 'Nolen Gur Sandesh', qty: state.orderQuantities.sandesh, price: 180 },
      { name: 'Mishti Doi', qty: state.orderQuantities.mishtidoi, price: 150 }
    ].filter(i => i.qty > 0),
    total_amount: total,
    payment_method: paymentMethodLabel,
    delivery_address: finalDeliveryAddress,
    phone_number: phone,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  // 1. Insert order into PostgreSQL table 'orders'
  const { data: dbData, error: dbError } = await supabase.from('orders').insert([orderPayload]).select();
  if (dbError) {
    console.error('Order DB Table Error:', dbError);
  } else if (dbData && dbData[0]) {
    // Record payment entry in 'payments' collection
    try {
      await supabase.from('payments').insert([{
        order_id: dbData[0].id,
        user_id: state.currentUser?.id || null,
        amount: total,
        payment_method: paymentMethodLabel,
        payment_status: selectedPaymentMethod === 'online' ? 'completed' : 'pending'
      }]);
    } catch (payErr) {
      console.error('Payment collection insert error:', payErr);
    }
  }

  // 2. Upload order receipt JSON file into Supabase Storage Bucket 'orders'
  try {
    const jsonFileName = `receipt_${generatedId}_${Date.now()}.json`;
    const jsonBlob = new Blob([JSON.stringify(orderPayload, null, 2)], { type: 'application/json' });

    const { data: jsonStorageData, error: jsonStorageError } = await supabase.storage
      .from('orders')
      .upload(jsonFileName, jsonBlob, {
        contentType: 'application/json',
        upsert: true
      });

    if (jsonStorageError) console.error('JSON Storage Error:', jsonStorageError);
  } catch (err) {
    console.error('JSON Storage Exception:', err);
  }

  // 3. Generate PDF Invoice & Upload PDF file into Supabase Storage Bucket 'orders'
  try {
    const pdfDoc = buildOrderPDF(orderPayload);
    state.lastOrderDoc = pdfDoc;
    state.lastOrderId = generatedId;

    const pdfArrayBuffer = pdfDoc.output('arraybuffer');
    const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
    const pdfFileName = `invoice_${generatedId}_${Date.now()}.pdf`;

    const { data: pdfStorageData, error: pdfStorageError } = await supabase.storage
      .from('orders')
      .upload(pdfFileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (pdfStorageError) {
      console.error('PDF Storage Bucket Error:', pdfStorageError);
    } else {
      console.log('PDF Invoice successfully uploaded to Supabase storage bucket orders:', pdfStorageData);
    }
  } catch (err) {
    console.error('PDF Generation/Storage Exception:', err);
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Confirm & Place Order';

  elements.successOrderId.textContent = `#${generatedId}`;
  elements.successOrderTotal.textContent = `₹${total}`;

  const successPaymentEl = document.getElementById('successPaymentMethod');
  if (successPaymentEl) successPaymentEl.textContent = paymentMethodLabel;

  const successFulfillmentEl = document.getElementById('successFulfillmentText');
  if (successFulfillmentEl) {
    successFulfillmentEl.textContent = selectedPaymentMethod === 'pickup' ? 'Store Pick-Up (Ready in 20 Mins)' : 'Home Delivery (30 - 45 Mins)';
  }

  elements.orderModal.classList.add('hidden');
  elements.orderSuccessModal.classList.remove('hidden');
}

// Helper to format Delivery Address with clickable Google Maps button for Admins & Delivery Partners
function formatDeliveryAddressHtml(address) {
  if (!address) return 'No delivery address provided.';

  const mapsUrlRegex = /(https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.app\.goo\.gl|maps\.google\.com)[^\s]+)/gi;
  
  let formatted = address.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  if (mapsUrlRegex.test(address)) {
    formatted = formatted.replace(mapsUrlRegex, (url) => {
      return `
        <div class="mt-2">
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 bg-primary text-on-primary px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity shadow-sm">
            <span class="material-symbols-outlined text-sm">map</span>
            <span>Open Live Location in Google Maps 🗺️</span>
            <span class="material-symbols-outlined text-xs">open_in_new</span>
          </a>
        </div>
      `;
    });
  }

  return formatted.replace(/\n/g, '<br/>');
}

let currentGpsCoords = null;

// Helper to format clean street address (only address text, no extra URLs)
function formatCleanAddress(geoData) {
  if (!geoData || !geoData.address) return geoData?.display_name || '';

  const a = geoData.address;
  const parts = [];

  // House / Building / Amenity
  if (a.building || a.house_number || a.amenity || a.shop) {
    parts.push(a.building || a.house_number || a.amenity || a.shop);
  }

  // Street / Road
  if (a.road || a.pedestrian || a.street || a.path) {
    parts.push(a.road || a.pedestrian || a.street || a.path);
  }

  // Suburb / Neighbourhood / Village / Ward
  if (a.suburb || a.neighbourhood || a.village || a.residential || a.quarter) {
    parts.push(a.suburb || a.neighbourhood || a.village || a.residential || a.quarter);
  }

  // City / Town / County
  if (a.town || a.city || a.municipality || a.county) {
    parts.push(a.town || a.city || a.municipality || a.county);
  }

  // State & Postcode
  if (a.state_district || a.state) {
    parts.push(a.state_district || a.state);
  }
  if (a.postcode) {
    parts.push(a.postcode);
  }

  return parts.length > 0 ? parts.join(', ') : geoData.display_name;
}

// Detect & Track User's Live Geolocation for Delivery
async function handleDetectGpsLocation() {
  const gpsBtn = document.getElementById('useGpsLocationBtn');
  const addressInput = document.getElementById('deliveryAddress');
  const statusBadge = document.getElementById('gpsStatusBadge');
  const statusText = document.getElementById('gpsStatusText');

  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  if (gpsBtn) {
    gpsBtn.disabled = true;
    gpsBtn.innerHTML = `
      <span class="material-symbols-outlined text-sm animate-spin">progress_activity</span>
      <span>Fetching Address...</span>
    `;
  }

  if (statusBadge && statusText) {
    statusBadge.classList.remove('hidden');
    statusText.textContent = 'Acquiring GPS coordinates...';
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = Math.round(position.coords.accuracy || 0);

      const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      currentGpsCoords = { lat, lng, mapUrl: googleMapsUrl };

      let fetchedCleanAddress = '';
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
          headers: { 'Accept-Language': 'en' }
        });
        if (res.ok) {
          const geoData = await res.json();
          fetchedCleanAddress = formatCleanAddress(geoData);
        }
      } catch (err) {
        console.warn('Reverse geocoding failed:', err);
      }

      if (!fetchedCleanAddress) {
        fetchedCleanAddress = `Arambagh, Hooghly, West Bengal`;
      }

      // Fill ONLY the clean street address in the address section (nothing else)
      if (addressInput) {
        addressInput.value = fetchedCleanAddress;
        addressInput.focus();
      }

      if (statusBadge && statusText) {
        statusText.textContent = `GPS Locked (Accuracy: ±${accuracy}m)`;
      }

      if (gpsBtn) {
        gpsBtn.disabled = false;
        gpsBtn.innerHTML = `
          <span class="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
          <span class="text-emerald-700">Address Filled!</span>
        `;
        setTimeout(() => {
          gpsBtn.innerHTML = `
            <span class="material-symbols-outlined text-sm text-primary">my_location</span>
            <span>Use Current Location</span>
          `;
        }, 3500);
      }
    },
    (error) => {
      if (gpsBtn) {
        gpsBtn.disabled = false;
        gpsBtn.innerHTML = `
          <span class="material-symbols-outlined text-sm text-primary">my_location</span>
          <span>Use Current Location</span>
        `;
      }

      let errorMsg = 'Failed to acquire location.';
      if (error.code === error.PERMISSION_DENIED) {
        errorMsg = 'Location permission denied. Please allow location access in your browser/device settings.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        errorMsg = 'Location information is unavailable.';
      } else if (error.code === error.TIMEOUT) {
        errorMsg = 'Location request timed out. Please try again.';
      }

      if (statusBadge && statusText) {
        statusText.textContent = errorMsg;
      }
      alert(errorMsg);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

// Function to handle clicking (View Map) button -> opens Google Maps app with live current location
function handleOpenGpsMap() {
  if (currentGpsCoords && currentGpsCoords.mapUrl) {
    window.open(currentGpsCoords.mapUrl, '_blank');
    return;
  }

  if (!navigator.geolocation) {
    window.open('https://www.google.com/maps', '_blank');
    return;
  }

  const mapBtn = document.getElementById('gpsMapLink');
  if (mapBtn) {
    mapBtn.innerHTML = `<span>Locating...</span><span class="material-symbols-outlined text-xs animate-spin">progress_activity</span>`;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      currentGpsCoords = { lat, lng, mapUrl };

      if (mapBtn) {
        mapBtn.innerHTML = `<span>View Map</span><span class="material-symbols-outlined text-xs">open_in_new</span>`;
      }
      window.open(mapUrl, '_blank');
    },
    (err) => {
      if (mapBtn) {
        mapBtn.innerHTML = `<span>View Map</span><span class="material-symbols-outlined text-xs">open_in_new</span>`;
      }
      window.open('https://www.google.com/maps/search/?api=1&query=Arambagh', '_blank');
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function setupPaymentMethodToggle() {
  const container = document.getElementById('paymentMethodContainer');
  if (!container) return;

  const cards = container.querySelectorAll('.payment-card');
  const deliverySection = document.getElementById('deliveryAddressSection');
  const deliveryInput = document.getElementById('deliveryAddress');
  const pickupBanner = document.getElementById('shopPickupInfoBanner');

  const updateUI = () => {
    const checkedRadio = container.querySelector('input[name="paymentMethod"]:checked');
    const selectedVal = checkedRadio ? checkedRadio.value : 'online';

    cards.forEach(card => {
      const radio = card.querySelector('input[type="radio"]');
      const label = card.querySelector('.payment-card-label');
      if (radio && radio.value === selectedVal) {
        card.classList.add('active', 'border-2', 'border-primary', 'bg-primary/10');
        card.classList.remove('border', 'border-outline-variant/60', 'bg-surface-container-low');
        if (label) {
          label.classList.add('text-primary');
          label.classList.remove('text-on-surface');
        }
      } else {
        card.classList.remove('active', 'border-2', 'border-primary', 'bg-primary/10');
        card.classList.add('border', 'border-outline-variant/60', 'bg-surface-container-low');
        if (label) {
          label.classList.remove('text-primary');
          label.classList.add('text-on-surface');
        }
      }
    });

    if (selectedVal === 'pickup') {
      if (deliverySection) deliverySection.classList.add('hidden');
      if (deliveryInput) deliveryInput.removeAttribute('required');
      if (pickupBanner) pickupBanner.classList.remove('hidden');
    } else {
      if (deliverySection) deliverySection.classList.remove('hidden');
      if (deliveryInput) deliveryInput.setAttribute('required', 'required');
      if (pickupBanner) pickupBanner.classList.add('hidden');
    }
  };

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        updateUI();
      }
    });
  });

  updateUI();
}

function setupAuthAndOrderEvents() {
  setupPaymentMethodToggle();

  const stayBtn = document.getElementById('stayLoggedInBtn');
  if (stayBtn) {
    stayBtn.addEventListener('click', () => {
      resetInactivityTimer(true);
    });
  }

  const sessionLogoutBtn = document.getElementById('sessionLogoutNowBtn');
  if (sessionLogoutBtn) {
    sessionLogoutBtn.addEventListener('click', () => {
      performInactivityLogout('user_choice', true);
    });
  }

  const useGpsBtn = document.getElementById('useGpsLocationBtn');
  if (useGpsBtn) {
    useGpsBtn.addEventListener('click', handleDetectGpsLocation);
  }

  const gpsMapBtn = document.getElementById('gpsMapLink');
  if (gpsMapBtn) {
    gpsMapBtn.addEventListener('click', handleOpenGpsMap);
  }

  elements.openAuthModalBtn.addEventListener('click', () => openAuthModal());
  elements.closeAuthModalBtn.addEventListener('click', () => elements.authModal.classList.add('hidden'));

  elements.tabSignInBtn.addEventListener('click', () => {
    elements.tabSignInBtn.classList.add('text-primary', 'border-primary');
    elements.tabSignInBtn.classList.remove('text-on-surface-variant', 'border-transparent');
    elements.tabSignUpBtn.classList.remove('text-primary', 'border-primary');
    elements.tabSignUpBtn.classList.add('text-on-surface-variant', 'border-transparent');

    elements.signInForm.classList.remove('hidden');
    elements.signUpForm.classList.add('hidden');
    elements.forgotPasswordForm.classList.add('hidden');
    if (elements.authTabs) elements.authTabs.classList.remove('hidden');
    hideAuthAlert();
  });

  elements.tabSignUpBtn.addEventListener('click', () => {
    elements.tabSignUpBtn.classList.add('text-primary', 'border-primary');
    elements.tabSignUpBtn.classList.remove('text-on-surface-variant', 'border-transparent');
    elements.tabSignInBtn.classList.remove('text-primary', 'border-primary');
    elements.tabSignInBtn.classList.add('text-on-surface-variant', 'border-transparent');

    elements.signUpForm.classList.remove('hidden');
    elements.signInForm.classList.add('hidden');
    elements.forgotPasswordForm.classList.add('hidden');
    if (elements.authTabs) elements.authTabs.classList.remove('hidden');
    hideAuthAlert();
  });

  const toggleAdminBtn = document.getElementById('toggleAdminPasscodeFieldBtn');
  const adminPasscodeContainer = document.getElementById('adminPasscodeContainer');
  if (toggleAdminBtn && adminPasscodeContainer) {
    toggleAdminBtn.addEventListener('click', () => {
      adminPasscodeContainer.classList.toggle('hidden');
    });
  }

  if (elements.openForgotPassBtn) {
    elements.openForgotPassBtn.addEventListener('click', () => {
      elements.signInForm.classList.add('hidden');
      elements.signUpForm.classList.add('hidden');
      elements.forgotPasswordForm.classList.remove('hidden');
      if (elements.authTabs) elements.authTabs.classList.add('hidden');
      hideAuthAlert();
    });
  }

  if (elements.backToSignInBtn) {
    elements.backToSignInBtn.addEventListener('click', () => {
      elements.forgotPasswordForm.classList.add('hidden');
      elements.signInForm.classList.remove('hidden');
      if (elements.authTabs) elements.authTabs.classList.remove('hidden');
      hideAuthAlert();
    });
  }

  if (elements.forgotPasswordForm) {
    elements.forgotPasswordForm.addEventListener('submit', handleForgotPassword);
  }

  if (elements.resetPasswordForm) {
    elements.resetPasswordForm.addEventListener('submit', handleResetPassword);
  }

  if (elements.openResetModalBtn) {
    elements.openResetModalBtn.addEventListener('click', () => {
      if (elements.resetPasswordModal) {
        hideResetAlert();
        elements.resetPasswordModal.classList.remove('hidden');
      }
    });
  }

  if (elements.closeResetModalBtn) {
    elements.closeResetModalBtn.addEventListener('click', () => elements.resetPasswordModal.classList.add('hidden'));
  }

  if (elements.adminPortalBtn) {
    elements.adminPortalBtn.addEventListener('click', () => {
      elements.adminDashboardModal.classList.remove('hidden');
      loadAdminDashboard();
      loadAdminProductsTable();
    });
  }

  // Admin Portal Tab Navigation (Orders vs Products)
  const adminTabOrdersBtn = document.getElementById('adminTabOrdersBtn');
  const adminTabProductsBtn = document.getElementById('adminTabProductsBtn');
  const adminOrdersSec = document.getElementById('adminOrdersSection');
  const adminProductsSec = document.getElementById('adminProductsSection');

  if (adminTabOrdersBtn && adminTabProductsBtn && adminOrdersSec && adminProductsSec) {
    adminTabOrdersBtn.addEventListener('click', () => {
      adminTabOrdersBtn.classList.add('font-bold', 'text-primary', 'border-primary');
      adminTabOrdersBtn.classList.remove('font-semibold', 'text-on-surface-variant', 'border-transparent');
      adminTabProductsBtn.classList.remove('font-bold', 'text-primary', 'border-primary');
      adminTabProductsBtn.classList.add('font-semibold', 'text-on-surface-variant', 'border-transparent');

      adminOrdersSec.classList.remove('hidden');
      adminProductsSec.classList.add('hidden');
    });

    adminTabProductsBtn.addEventListener('click', () => {
      adminTabProductsBtn.classList.add('font-bold', 'text-primary', 'border-primary');
      adminTabProductsBtn.classList.remove('font-semibold', 'text-on-surface-variant', 'border-transparent');
      adminTabOrdersBtn.classList.remove('font-bold', 'text-primary', 'border-primary');
      adminTabOrdersBtn.classList.add('font-semibold', 'text-on-surface-variant', 'border-transparent');

      adminProductsSec.classList.remove('hidden');
      adminOrdersSec.classList.add('hidden');
    });
  }

  if (elements.refreshAdminOrdersBtn) {
    elements.refreshAdminOrdersBtn.addEventListener('click', () => {
      loadAdminDashboard();
    });
  }

  // Toggle Add Product Form
  const toggleAddProductBtn = document.getElementById('toggleAddProductFormBtn');
  const cancelAddProductBtn = document.getElementById('cancelAddProductBtn');
  const addProductForm = document.getElementById('adminAddProductFormContainer');

  if (toggleAddProductBtn && addProductForm) {
    toggleAddProductBtn.addEventListener('click', () => {
      addProductForm.classList.toggle('hidden');
    });
  }
  if (cancelAddProductBtn && addProductForm) {
    cancelAddProductBtn.addEventListener('click', () => {
      addProductForm.classList.add('hidden');
    });
  }

  // Handle Add Product Submit
  if (addProductForm) {
    addProductForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newProdName').value.trim();
      const catId = document.getElementById('newProdCategory').value;
      const price = parseFloat(document.getElementById('newProdPrice').value);
      const unit = document.getElementById('newProdUnit').value.trim();
      const avail = document.getElementById('newProdAvailability').value === 'true';
      const visSelect = document.getElementById('newProdVisibility');
      const isHidden = visSelect ? visSelect.value === 'true' : false;
      const badgeSelect = document.getElementById('newProdBadge');
      const badgeVal = badgeSelect ? (badgeSelect.value || null) : null;
      const fileInput = document.getElementById('newProdImageFile');
      const desc = document.getElementById('newProdDescription').value.trim();
      const submitBtn = document.getElementById('submitNewProductBtn');

      if (!name || isNaN(price) || !unit) {
        alert('Please provide Product Name, Price, and Unit Weight.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading picture & saving...';

      let uploadedImageUrl = null;
      if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
          uploadedImageUrl = await uploadProductImage(fileInput.files[0]);
        } catch (uploadErr) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save Product';
          alert(`Image upload failed: ${uploadErr.message}`);
          return;
        }
      }

      try {
        await createProduct({
          name: name,
          category_id: catId || null,
          price: price,
          unit: unit,
          is_available: avail,
          is_hidden: isHidden,
          badge: badgeVal,
          image_url: uploadedImageUrl || null,
          description: desc
        });

        alert(`Product "${name}" created successfully!`);
        addProductForm.reset();
        addProductForm.classList.add('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Product';

        loadAdminProductsTable();
        renderCustomerProductsGrid();
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Product';
        alert(`Failed to create product: ${err.message}`);
      }
    });
  }

  // Mobile Nav Drawer Event Listeners
  const mobileToggleBtn = document.getElementById('mobileMenuToggleBtn');
  const closeMobileDrawerBtn = document.getElementById('closeMobileNavDrawerBtn');
  const mobileDrawer = document.getElementById('mobileNavDrawer');
  const mobileOrderNowBtn = document.getElementById('mobileOrderNowBtn');
  const mobileGuestAuthBtn = document.getElementById('mobileGuestAuthBtn');
  const mobileMyOrdersBtn = document.getElementById('mobileMyOrdersBtn');
  const mobileAdminPortalBtn = document.getElementById('mobileAdminPortalBtn');

  if (mobileToggleBtn && mobileDrawer) {
    mobileToggleBtn.addEventListener('click', () => {
      mobileDrawer.classList.remove('hidden');
    });
  }
  if (closeMobileDrawerBtn && mobileDrawer) {
    closeMobileDrawerBtn.addEventListener('click', () => {
      mobileDrawer.classList.add('hidden');
    });
  }
  if (mobileDrawer) {
    mobileDrawer.addEventListener('click', (e) => {
      if (e.target === mobileDrawer) {
        mobileDrawer.classList.add('hidden');
      }
    });
  }

  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (mobileDrawer) mobileDrawer.classList.add('hidden');
    });
  });

  if (mobileOrderNowBtn) {
    mobileOrderNowBtn.addEventListener('click', () => {
      if (mobileDrawer) mobileDrawer.classList.add('hidden');
      triggerOrderFlow();
    });
  }

  if (mobileGuestAuthBtn) {
    mobileGuestAuthBtn.addEventListener('click', () => {
      if (mobileDrawer) mobileDrawer.classList.add('hidden');
      openAuthModal();
    });
  }

  if (mobileMyOrdersBtn) {
    mobileMyOrdersBtn.addEventListener('click', () => {
      if (mobileDrawer) mobileDrawer.classList.add('hidden');
      loadMyOrders();
    });
  }

  if (mobileAdminPortalBtn) {
    mobileAdminPortalBtn.addEventListener('click', () => {
      if (mobileDrawer) mobileDrawer.classList.add('hidden');
      loadAdminDashboard();
    });
  }

  // User Profile Modal Listeners
  const profileModal = document.getElementById('userProfileModal');
  const openProfileBtn = document.getElementById('openProfileModalBtn');
  const mobileUserInfo = document.getElementById('mobileUserInfo');
  const closeProfileBtn = document.getElementById('closeProfileModalBtn');
  const profileMyOrdersBtn = document.getElementById('profileMyOrdersBtn');
  const profileResetPassBtn = document.getElementById('profileResetPassBtn');
  const profileSignOutBtn = document.getElementById('profileSignOutBtn');

  const openProfileModal = () => {
    if (profileModal && state.currentUser) {
      profileModal.classList.remove('hidden');
    }
  };

  if (openProfileBtn) openProfileBtn.addEventListener('click', openProfileModal);
  if (mobileUserInfo) {
    mobileUserInfo.style.cursor = 'pointer';
    mobileUserInfo.addEventListener('click', () => {
      if (mobileDrawer) mobileDrawer.classList.add('hidden');
      openProfileModal();
    });
  }
  if (closeProfileBtn && profileModal) {
    closeProfileBtn.addEventListener('click', () => profileModal.classList.add('hidden'));
  }
  if (profileModal) {
    profileModal.addEventListener('click', (e) => {
      if (e.target === profileModal) profileModal.classList.add('hidden');
    });
  }
  const profileAdminPortalBtn = document.getElementById('profileAdminPortalBtn');
  if (profileAdminPortalBtn && profileModal) {
    profileAdminPortalBtn.addEventListener('click', () => {
      profileModal.classList.add('hidden');
      elements.adminDashboardModal.classList.remove('hidden');
      loadAdminDashboard();
      loadAdminProductsTable();
    });
  }

  if (profileMyOrdersBtn && profileModal) {
    profileMyOrdersBtn.addEventListener('click', () => {
      profileModal.classList.add('hidden');
      loadMyOrders();
    });
  }
  if (profileResetPassBtn && profileModal) {
    profileResetPassBtn.addEventListener('click', () => {
      profileModal.classList.add('hidden');
      if (elements.resetPasswordModal) elements.resetPasswordModal.classList.remove('hidden');
    });
  }
  // User Profile Picture File Upload Listener
  // Profile Avatar Interactive Viewer & Upload Listeners
  const avatarContainer = document.getElementById('profileAvatarContainer');
  const avatarViewerModal = document.getElementById('avatarViewerModal');
  const closeAvatarViewerBtn = document.getElementById('closeAvatarViewerBtn');
  const viewerRemoveBtn = document.getElementById('viewerRemoveAvatarBtn');

  if (avatarContainer) {
    avatarContainer.addEventListener('click', (e) => {
      if (e.target.closest('label[for="profileAvatarFileInput"]')) return;

      const avatarUrl = state.currentUser?.user_metadata?.avatar_url;
      if (avatarUrl && avatarViewerModal) {
        updateUserUI(state.currentUser);
        avatarViewerModal.classList.remove('hidden');
      } else {
        const fileInput = document.getElementById('profileAvatarFileInput');
        if (fileInput) fileInput.click();
      }
    });
  }

  if (closeAvatarViewerBtn && avatarViewerModal) {
    closeAvatarViewerBtn.addEventListener('click', () => {
      avatarViewerModal.classList.add('hidden');
    });
  }

  if (viewerRemoveBtn) {
    viewerRemoveBtn.addEventListener('click', () => {
      const removeBtn = document.getElementById('removeProfileAvatarBtn');
      if (removeBtn) removeBtn.click();
    });
  }

  // User Profile Picture File Upload Listener
  const avatarFileInput = document.getElementById('profileAvatarFileInput');
  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!state.currentUser) {
        alert('Please sign in to update your profile picture.');
        return;
      }

      try {
        const pAvatarImg = document.getElementById('profileAvatarImg');
        const vAvatarImg = document.getElementById('viewerAvatarImg');
        if (pAvatarImg) pAvatarImg.style.opacity = '0.5';
        if (vAvatarImg) vAvatarImg.style.opacity = '0.5';

        const publicUrl = await uploadAvatarImage(file, state.currentUser.id, state.currentUser.email);
        
        if (state.currentUser.user_metadata) {
          state.currentUser.user_metadata.avatar_url = publicUrl;
        } else {
          state.currentUser.user_metadata = { avatar_url: publicUrl };
        }

        updateUserUI(state.currentUser);
        if (pAvatarImg) pAvatarImg.style.opacity = '1';
        if (vAvatarImg) vAvatarImg.style.opacity = '1';
        alert('Profile picture updated successfully!');
      } catch (uploadErr) {
        alert(`Failed to update profile picture: ${uploadErr.message}`);
      }
    });
  }

  // Remove Profile Picture Listener
  const removeAvatarBtn = document.getElementById('removeProfileAvatarBtn');
  if (removeAvatarBtn) {
    removeAvatarBtn.addEventListener('click', async () => {
      if (!state.currentUser) return;
      if (!confirm('Are you sure you want to remove your profile picture?')) return;

      try {
        await removeAvatarImage(state.currentUser.id, state.currentUser.email);
        if (state.currentUser.user_metadata) {
          state.currentUser.user_metadata.avatar_url = null;
        }
        updateUserUI(state.currentUser);
        if (avatarViewerModal) avatarViewerModal.classList.add('hidden');
        alert('Profile picture removed successfully!');
      } catch (err) {
        alert(`Failed to remove profile picture: ${err.message}`);
      }
    });
  }

  if (profileSignOutBtn && profileModal) {
    profileSignOutBtn.addEventListener('click', () => {
      profileModal.classList.add('hidden');
      handleSignOut();
    });
  }

  const mobileSignOutBtn = document.getElementById('mobileSignOutBtn');
  if (mobileSignOutBtn) {
    mobileSignOutBtn.addEventListener('click', () => {
      if (mobileDrawer) mobileDrawer.classList.add('hidden');
      handleSignOut();
    });
  }

  if (elements.closeAdminModalBtn) {
    elements.closeAdminModalBtn.addEventListener('click', () => elements.adminDashboardModal.classList.add('hidden'));
  }

  if (elements.refreshAdminOrdersBtn) {
    elements.refreshAdminOrdersBtn.addEventListener('click', () => loadAdminDashboard());
  }

  if (elements.myOrdersBtn) {
    elements.myOrdersBtn.addEventListener('click', () => loadMyOrders());
  }

  if (elements.closeMyOrdersModalBtn) {
    elements.closeMyOrdersModalBtn.addEventListener('click', () => elements.myOrdersModal.classList.add('hidden'));
  }

  elements.signInForm.addEventListener('submit', handleSignIn);
  elements.signUpForm.addEventListener('submit', handleSignUp);
  elements.signOutBtn.addEventListener('click', handleSignOut);

  setupPasswordToggles();

  elements.orderNowNavBtn.addEventListener('click', () => triggerOrderFlow());
  const gOrderBtn = document.getElementById('guestOrderNowNavBtn');
  if (gOrderBtn) {
    gOrderBtn.addEventListener('click', () => triggerOrderFlow());
  }
  elements.closeOrderModalBtn.addEventListener('click', () => elements.orderModal.classList.add('hidden'));
  elements.closeSuccessModalBtn.addEventListener('click', () => elements.orderSuccessModal.classList.add('hidden'));

  // Mobile Phone OTP Event Listeners
  const sendOtpBtn = document.getElementById('sendOtpBtn');
  const triggerOtpBtn = document.getElementById('triggerOtpBtn');
  const verifyOtpBtn = document.getElementById('verifyOtpBtn');
  const phoneInput = document.getElementById('phoneNumber');

  if (sendOtpBtn) sendOtpBtn.addEventListener('click', () => sendCheckoutOtp());
  if (triggerOtpBtn) triggerOtpBtn.addEventListener('click', () => sendCheckoutOtp());
  if (verifyOtpBtn) verifyOtpBtn.addEventListener('click', () => verifyCheckoutOtp());

  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      state.isPhoneVerified = false;
      state.generatedOtp = null;
      const otpContainer = document.getElementById('otpContainer');
      const otpSuccessBadge = document.getElementById('otpSuccessBadge');
      if (otpContainer) otpContainer.classList.add('hidden');
      if (otpSuccessBadge) otpSuccessBadge.classList.add('hidden');
    });
  }

  if (elements.downloadPdfBtn) {
    elements.downloadPdfBtn.addEventListener('click', () => {
      if (state.lastOrderDoc && state.lastOrderId) {
        state.lastOrderDoc.save(`Banerjee_Sweets_Invoice_${state.lastOrderId}.pdf`);
      } else {
        alert('No invoice available to download.');
      }
    });
  }

  elements.itemOrderBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.itemId;
      triggerOrderFlow(itemId);
    });
  });

  document.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const target = btn.dataset.target;

      if (target === 'qty-rossogolla') {
        state.orderQuantities.rossogolla = Math.max(0, state.orderQuantities.rossogolla + (action === 'plus' ? 1 : -1));
      } else if (target === 'qty-sandesh') {
        state.orderQuantities.sandesh = Math.max(0, state.orderQuantities.sandesh + (action === 'plus' ? 1 : -1));
      } else if (target === 'qty-mishtidoi') {
        state.orderQuantities.mishtidoi = Math.max(0, state.orderQuantities.mishtidoi + (action === 'plus' ? 1 : -1));
      }

      updateCheckoutTotal();
    });
  });

  elements.checkoutForm.addEventListener('submit', handleCheckoutSubmit);

  if (elements.phoneNumberInput) {
    elements.phoneNumberInput.addEventListener('input', () => {
      hideOrderAlert();
    });
  }
}

function setupEventListeners() {
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('scroll', updateScrollSync, { passive: true });
  setupSmoothNavigation();
  setupAuthAndOrderEvents();
  initMultiTabSync();
  setupBackgroundFreezeObserver();
  checkAuthSession();
}

function setupRealtimeProductsSubscription() {
  try {
    supabase
      .channel('public:products_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        console.log('Live database update detected on products table:', payload);
        renderCustomerProductsGrid();
        if (state.currentUserRole === 'Admin') {
          loadAdminProductsTable();
        }
      })
      .subscribe();
  } catch (err) {
    console.error('Realtime subscription error:', err);
  }
}

async function init() {
  setupEventListeners();
  await preloadFrames();
  renderCustomerProductsGrid();
  setupRealtimeProductsSubscription();

  setTimeout(() => {
    if (elements.preloader) {
      elements.preloader.classList.add('fade-out');
    }
    resizeCanvas();
    updateScrollSync();
    requestAnimationFrame(animationLoop);
  }, 400);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
