import { supabase } from './supabase.js';
import { jsPDF } from 'jspdf';

// Configuration Constants
const TOTAL_FRAMES = 240;
const FRAME_PATH = '/frames/ezgif-frame-';

// App State
const state = {
  frames: [],
  loadedFrames: 0,
  currentFrameIndex: 0,
  targetFrameIndex: 0,
  isLoaded: false,
  currentUser: null,
  orderQuantities: {
    rossogolla: 1,
    sandesh: 0,
    mishtidoi: 0
  },
  lastOrderDoc: null,
  lastOrderId: null
};

// Helper: Format frame filename with 3-digit zero padding
function getFrameUrl(index) {
  const paddedNumber = String(index).padStart(3, '0');
  return `${FRAME_PATH}${paddedNumber}.jpg`;
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
  signOutBtn: document.getElementById('signOutBtn'),

  // Password Visibility Toggle Elements
  toggleSignInPasswordBtn: document.getElementById('toggleSignInPasswordBtn'),
  signInPassword: document.getElementById('signInPassword'),
  signInEyeIcon: document.getElementById('signInEyeIcon'),
  toggleSignUpPasswordBtn: document.getElementById('toggleSignUpPasswordBtn'),
  signUpPassword: document.getElementById('signUpPassword'),
  signUpEyeIcon: document.getElementById('signUpEyeIcon'),

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
  itemOrderBtns: document.querySelectorAll('.item-order-btn')
};

// Initialize Canvas Context
const ctx = elements.canvas.getContext('2d');

// Canvas Size Adjustment
function resizeCanvas() {
  if (!elements.canvasContainer) return;
  const dpr = window.devicePixelRatio || 1;
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
  const img = state.frames[frameIndex];
  if (!img || !img.complete) return;

  const canvasWidth = elements.canvasContainer.clientWidth;
  const canvasHeight = elements.canvasContainer.clientHeight;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const CROP_ZOOM = 1.15;
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

    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getFrameUrl(i);

      img.onload = () => {
        loadedCount++;
        state.loadedFrames = loadedCount;
        const percent = Math.floor((loadedCount / TOTAL_FRAMES) * 100);
        updatePreloaderUI(percent, loadedCount);
        if (loadedCount === TOTAL_FRAMES) {
          state.isLoaded = true;
          resolve();
        }
      };

      img.onerror = () => {
        loadedCount++;
        state.loadedFrames = loadedCount;
        const percent = Math.floor((loadedCount / TOTAL_FRAMES) * 100);
        updatePreloaderUI(percent, loadedCount);
        if (loadedCount === TOTAL_FRAMES) {
          state.isLoaded = true;
          resolve();
        }
      };

      state.frames.push(img);
    }
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
  if (state.isLoaded) {
    const diff = state.targetFrameIndex - state.currentFrameIndex;
    if (Math.abs(diff) > 0.01) {
      state.currentFrameIndex += diff * 0.25;
      renderFrame(Math.round(state.currentFrameIndex));
    }
  }
  requestAnimationFrame(animationLoop);
}

// ================= SUPABASE AUTHENTICATION & ORDER ENGINE =================

async function checkAuthSession() {
  const { data: { session } } = await supabase.auth.getSession();
  updateUserUI(session?.user || null);

  supabase.auth.onAuthStateChange((event, session) => {
    updateUserUI(session?.user || null);
  });
}

function updateUserUI(user) {
  state.currentUser = user;
  if (user) {
    elements.openAuthModalBtn.classList.add('hidden');
    elements.userProfileNav.classList.remove('hidden');
    elements.userProfileNav.classList.add('flex');
    elements.userEmailText.textContent = user.email;

    // Autofill Phone Number in Checkout Form if user registered with mandatory phone
    const userPhone = user.user_metadata?.phone_number;
    if (userPhone && document.getElementById('phoneNumber')) {
      document.getElementById('phoneNumber').value = userPhone;
    }
  } else {
    elements.openAuthModalBtn.classList.remove('hidden');
    elements.userProfileNav.classList.add('hidden');
    elements.userProfileNav.classList.remove('flex');
  }
}

function showAuthAlert(message, type = 'error') {
  elements.authAlert.classList.remove('hidden', 'bg-error/15', 'text-error', 'bg-secondary-container/50', 'text-on-secondary-container');
  if (type === 'error') {
    elements.authAlert.classList.add('bg-error/15', 'text-error');
  } else {
    elements.authAlert.classList.add('bg-secondary-container/50', 'text-on-secondary-container');
  }
  elements.authAlert.textContent = message;
}

function hideAuthAlert() {
  elements.authAlert.classList.add('hidden');
}

// Handle Sign In (Email & Password only)
async function handleSignIn(e) {
  e.preventDefault();
  const email = document.getElementById('signInEmail').value;
  const password = document.getElementById('signInPassword').value;
  const submitBtn = document.getElementById('signInSubmitBtn');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';
  hideAuthAlert();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Sign In';

  if (error) {
    showAuthAlert(error.message, 'error');
  } else {
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
  const name = document.getElementById('signUpName').value;
  const email = document.getElementById('signUpEmail').value;
  const phone = document.getElementById('signUpPhone').value;
  const password = document.getElementById('signUpPassword').value;
  const submitBtn = document.getElementById('signUpSubmitBtn');

  if (!phone || phone.trim() === '') {
    showAuthAlert('Phone Number is mandatory for registration!', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';
  hideAuthAlert();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        phone_number: phone
      }
    }
  });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Create Account';

  if (error) {
    showAuthAlert(error.message, 'error');
  } else {
    showAuthAlert('Account created successfully! You are now logged in.', 'success');
    setTimeout(() => {
      elements.authModal.classList.add('hidden');
      hideAuthAlert();
    }, 800);
  }
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
}

function triggerOrderFlow(preselectedItemId = null) {
  if (!state.currentUser) {
    openAuthModal('Please sign in or create an account to order from Banerjee Sweets!');
    return;
  }

  if (preselectedItemId === 'rossogolla') {
    state.orderQuantities.rossogolla = Math.max(1, state.orderQuantities.rossogolla);
  } else if (preselectedItemId === 'sandesh') {
    state.orderQuantities.sandesh = Math.max(1, state.orderQuantities.sandesh);
  } else if (preselectedItemId === 'mishti-doi') {
    state.orderQuantities.mishtidoi = Math.max(1, state.orderQuantities.mishtidoi);
  }

  updateCheckoutTotal();
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
  doc.text(`Delivery Address: ${orderPayload.delivery_address}`, 14, 66);

  // Items Table Header
  doc.setLineWidth(0.3);
  doc.line(14, 74, 196, 74);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Item Description', 14, 80);
  doc.text('Qty', 110, 80);
  doc.text('Price/Unit', 140, 80);
  doc.text('Total', 175, 80);

  doc.line(14, 83, 196, 83);

  // Items Rows
  let yPos = 91;
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

// Handle Order Checkout Submission: DB Table + JSON file upload + PDF invoice upload to Supabase Storage Bucket 'orders'
async function handleCheckoutSubmit(e) {
  e.preventDefault();
  const address = document.getElementById('deliveryAddress').value;
  const phone = document.getElementById('phoneNumber').value;
  const submitBtn = document.getElementById('placeOrderSubmitBtn');

  const total = updateCheckoutTotal();

  if (total <= 0) {
    alert('Please select at least 1 item to order!');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Placing Order...';

  const generatedId = `BS-${Math.floor(1000 + Math.random() * 9000)}`;

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
    delivery_address: address,
    phone_number: phone,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  // 1. Insert order into PostgreSQL table 'orders'
  const { data: dbData, error: dbError } = await supabase.from('orders').insert([orderPayload]).select();
  if (dbError) {
    console.error('Order DB Table Error:', dbError);
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

  elements.orderModal.classList.add('hidden');
  elements.orderSuccessModal.classList.remove('hidden');
}

function setupAuthAndOrderEvents() {
  elements.openAuthModalBtn.addEventListener('click', () => openAuthModal());
  elements.closeAuthModalBtn.addEventListener('click', () => elements.authModal.classList.add('hidden'));

  elements.tabSignInBtn.addEventListener('click', () => {
    elements.tabSignInBtn.classList.add('text-primary', 'border-primary');
    elements.tabSignInBtn.classList.remove('text-on-surface-variant', 'border-transparent');
    elements.tabSignUpBtn.classList.remove('text-primary', 'border-primary');
    elements.tabSignUpBtn.classList.add('text-on-surface-variant', 'border-transparent');

    elements.signInForm.classList.remove('hidden');
    elements.signUpForm.classList.add('hidden');
    hideAuthAlert();
  });

  elements.tabSignUpBtn.addEventListener('click', () => {
    elements.tabSignUpBtn.classList.add('text-primary', 'border-primary');
    elements.tabSignUpBtn.classList.remove('text-on-surface-variant', 'border-transparent');
    elements.tabSignInBtn.classList.remove('text-primary', 'border-primary');
    elements.tabSignInBtn.classList.add('text-on-surface-variant', 'border-transparent');

    elements.signUpForm.classList.remove('hidden');
    elements.signInForm.classList.add('hidden');
    hideAuthAlert();
  });

  elements.signInForm.addEventListener('submit', handleSignIn);
  elements.signUpForm.addEventListener('submit', handleSignUp);
  elements.signOutBtn.addEventListener('click', handleSignOut);

  setupPasswordToggles();

  elements.orderNowNavBtn.addEventListener('click', () => triggerOrderFlow());
  elements.closeOrderModalBtn.addEventListener('click', () => elements.orderModal.classList.add('hidden'));
  elements.closeSuccessModalBtn.addEventListener('click', () => elements.orderSuccessModal.classList.add('hidden'));

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
}

function setupEventListeners() {
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('scroll', updateScrollSync, { passive: true });
  setupSmoothNavigation();
  setupAuthAndOrderEvents();
  checkAuthSession();
}

async function init() {
  setupEventListeners();
  await preloadFrames();

  setTimeout(() => {
    if (elements.preloader) {
      elements.preloader.classList.add('fade-out');
    }
    resizeCanvas();
    updateScrollSync();
    requestAnimationFrame(animationLoop);
  }, 400);
}

document.addEventListener('DOMContentLoaded', init);
