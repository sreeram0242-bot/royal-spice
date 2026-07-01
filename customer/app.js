const BASE_URL = ''; // Change in prod

let restaurantId = localStorage.getItem('restaurantId');
let tableNumber = localStorage.getItem('tableNumber');
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let menuItems = [];
let categorySettings = [];

const socket = io(BASE_URL);

if (restaurantId) {
  socket.emit('join_restaurant', restaurantId);
}

socket.on('new_order', (order) => {
  if (order.sessionId === localStorage.getItem('sessionId')) {
    if (window.location.pathname.includes('order-status.html')) {
      loadOrders();
    }
  }
});
// Loader Functions
function showLoader() {
  if (!document.getElementById('global-loader')) {
    const loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.innerHTML = `
      <div class="loader-container">
        <div class="loader-icon">
          <svg viewBox="0 0 100 100" fill="var(--gold-primary)">
            <path d="M15 75h70v5H15z" />
            <path d="M25 70 C 25 40, 75 40, 75 70 Z" />
            <circle cx="50" cy="40" r="4" />
            <path class="steam steam-1" d="M 35 35 Q 30 30 35 25 T 35 15" fill="none" stroke="var(--gold-primary)" stroke-width="1.5" stroke-linecap="round"/>
            <path class="steam steam-2" d="M 50 30 Q 45 25 50 20 T 50 10" fill="none" stroke="var(--gold-primary)" stroke-width="1.5" stroke-linecap="round"/>
            <path class="steam steam-3" d="M 65 35 Q 60 30 65 25 T 65 15" fill="none" stroke="var(--gold-primary)" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
      </div>
    `;
    document.body.appendChild(loader);
  }
  document.getElementById('global-loader').classList.remove('hidden');
}

function hideLoader() {
  if (document.getElementById('global-loader')) {
    document.getElementById('global-loader').classList.add('hidden');
  }
}

// Load Restaurant Info
async function loadRestaurantInfo() {
  if (!restaurantId) return;
  try {
    const res = await fetch(`${BASE_URL}/api/customer/restaurant/${restaurantId}`);
    const data = await res.json();
    if (document.getElementById('restaurantName')) {
      document.getElementById('restaurantName').innerText = data.name;
    }
    if (document.getElementById('tableBadge')) {
      document.getElementById('tableBadge').innerText = `TABLE ${tableNumber}`;
    }
  } catch (err) {
    console.error(err);
  }
}

// Load Menu
async function loadMenu() {
  if (!restaurantId) return;
  showLoader();
  try {
    const res = await fetch(`${BASE_URL}/api/customer/menu/${restaurantId}`);
    menuItems = await res.json();

    try {
      const catRes = await fetch(`${BASE_URL}/api/customer/categories/${restaurantId}`);
      categorySettings = await catRes.json();
    } catch (e) { console.error('Failed to load category settings', e); }

    renderCategories();
    renderMenu();
    updateCartUI();

    // Wait for all images to load before hiding the loader
    const images = Array.from(document.querySelectorAll('img'));
    const imagePromises = images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    });
    
    // Fallback timeout of 3 seconds just in case some images get stuck
    await Promise.race([
      Promise.all(imagePromises),
      new Promise(r => setTimeout(r, 3000))
    ]);

  } catch (err) {
    console.error(err);
  }
  hideLoader();
}

function getCategoryIcon(catName) {
  const c = catName.toLowerCase();
  if (c === 'all') return `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`;
  if (c.includes('starter') || c.includes('snack')) return `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`;
  if (c.includes('meal') || c.includes('course')) return `<svg viewBox="0 0 24 24"><path d="M22 9h-4.79l-4.38-6.56c-.19-.28-.51-.42-.83-.42s-.64.14-.83.43L6.79 9H2c-.55 0-1 .45-1 1 0 .09.01.18.04.27l2.54 9.27c.23.84 1 1.46 1.92 1.46h13c.92 0 1.69-.62 1.93-1.46l2.54-9.27L23 10c0-.55-.45-1-1-1zM12 4.8L14.8 9H9.2L12 4.8zM18.5 19l-12.99.01L3.31 11H20.7l-2.2 8z"/></svg>`;
  if (c.includes('rice')) return `<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zM12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`;
  if (c.includes('bread') || c.includes('roti')) return `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
  if (c.includes('gravy') || c.includes('curry')) return `<svg viewBox="0 0 24 24"><path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z"/></svg>`;
  if (c.includes('bev') || c.includes('drink')) return `<svg viewBox="0 0 24 24"><path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.9 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/></svg>`;
  return `<svg viewBox="0 0 24 24"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>`;
}

function renderCategories() {
  const container = document.getElementById('categoriesContainer');
  if (!container) return;

  const categories = ['All', ...new Set(menuItems.map(item => item.category))];
  container.innerHTML = '';

  categories.forEach((cat, index) => {
    const div = document.createElement('div');
    div.className = `category-item ${index === 0 ? 'active' : ''}`;
    div.dataset.cat = cat;

    const setting = categorySettings.find(s => s.categoryName === cat);

    let defaultImg = `https://via.placeholder.com/100?text=${encodeURIComponent(cat)}`;
    if (cat.toLowerCase() === 'all') defaultImg = 'images/cat_all.png';
    else if (cat.toLowerCase().includes('breakfast')) defaultImg = 'images/cat_breakfast.png';
    else if (cat.toLowerCase().includes('meal')) defaultImg = 'images/cat_meals.png';
    else if (cat.toLowerCase().includes('starter')) defaultImg = 'images/cat_starters.png';
    else if (cat.toLowerCase().includes('bread') || cat.toLowerCase().includes('roti')) defaultImg = 'images/cat_breads.png';
    else if (cat.toLowerCase().includes('gravy') || cat.toLowerCase().includes('curry')) defaultImg = 'images/cat_gravies.png';
    else if (cat.toLowerCase().includes('bev') || cat.toLowerCase().includes('drink')) defaultImg = 'images/cat_beverages.png';
    else if (cat.toLowerCase().includes('dessert') || cat.toLowerCase().includes('sweet')) defaultImg = 'images/cat_desserts.png';

    let imageSrc = setting?.image || defaultImg;

    div.innerHTML = `
      <div class="cat-circle" style="overflow: hidden; padding: 0;">
        <img src="${imageSrc}" onerror="this.onerror=null; this.src='images/cat_all.png';" alt="${cat}" style="width: 100%; height: 100%; object-fit: cover;">
      </div>
      <div class="cat-text">${cat}</div>
    `;

    div.onclick = () => {
      document.querySelectorAll('.category-item').forEach(p => p.classList.remove('active'));
      div.classList.add('active');
      renderMenu(cat === 'All' ? null : cat);
    };
    container.appendChild(div);
  });
}

function renderMenu(filterCategory = null, searchQuery = '') {
  const container = document.getElementById('menuContainer');
  if (!container) return;

  let filtered = menuItems;
  if (filterCategory) filtered = filtered.filter(item => item.category === filterCategory);
  if (searchQuery) filtered = filtered.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const grouped = filtered.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});

  let htmlString = '';
  for (const cat in grouped) {
    if (!filterCategory && !searchQuery) {
      htmlString += `<div class="section-title">${cat}</div>`;
    }

    grouped[cat].forEach(item => {
      const cartItem = cart.find(c => c.id === item.id);
      const qty = cartItem ? cartItem.qty : 0;

      const isAvail = item.isAvailable !== false;
      const controls = !isAvail 
        ? `<div style="color:#EF4444; font-size:12px; font-weight:700; text-align:center; padding:8px 0;">OUT OF STOCK</div>`
        : qty > 0
        ? `<div class="qty-control">
             <button class="qty-btn" onclick="updateQty('${item.id}', -1)">−</button>
             <span class="qty-val">${qty}</span>
             <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
           </div>`
        : `<div class="add-btn" onclick="updateQty('${item.id}', 1)">
             ADD <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
           </div>`;

      htmlString += `
        <div class="menu-card" style="${!isAvail ? 'opacity: 0.5; filter: grayscale(1); pointer-events: none;' : ''}">
          <div class="card-img-wrapper">
            <img src="${item.image || 'images/cat_all.png'}" onerror="this.onerror=null; this.src='images/cat_all.png';" class="card-img" alt="${item.name}">
            <div class="veg-dot ${item.isVeg ? '' : 'non-veg-dot'}"></div>
          </div>
          <div class="card-info">
            <div class="card-title">${item.name}</div>
            ${item.isBestSeller ? '<div class="bestseller-badge">🔥 Best Seller</div>' : ''}
            <div class="card-price">₹${item.price}</div>
          </div>
          <div id="item-controls-${item.id}">
            ${controls}
          </div>
        </div>
      `;
    });
  }
  container.innerHTML = htmlString;
}

function updateQty(itemId, change) {
  const item = menuItems.find(i => i.id === itemId);
  const existing = cart.find(c => c.id === itemId);

  if (existing) {
    existing.qty += change;
    if (existing.qty <= 0) {
      cart = cart.filter(c => c.id !== itemId);
    }
  } else if (change > 0) {
    cart.push({ ...item, qty: 1 });
  }

  localStorage.setItem('cart', JSON.stringify(cart));

  // Update specific item's control UI instead of re-rendering entire menu
  const cartItem = cart.find(c => c.id === itemId);
  const qty = cartItem ? cartItem.qty : 0;
  const controlsContainer = document.getElementById(`item-controls-${itemId}`);
  
  if (controlsContainer) {
    controlsContainer.innerHTML = qty > 0
        ? `<div class="qty-control">
             <button class="qty-btn" onclick="updateQty('${itemId}', -1)">−</button>
             <span class="qty-val">${qty}</span>
             <button class="qty-btn" onclick="updateQty('${itemId}', 1)">+</button>
           </div>`
        : `<div class="add-btn" onclick="updateQty('${itemId}', 1)">
             ADD <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
           </div>`;
  }

  updateCartUI();

  if (window.location.pathname.includes('cart.html')) {
    renderCart();
  }
}

function updateCartUI() {
  const floatingCart = document.getElementById('floatingCart');
  if (!floatingCart) return;

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  if (totalItems > 0) {
    floatingCart.style.display = 'flex';
    document.getElementById('cartBadge').innerText = totalItems;
    document.getElementById('cartItemsCount').innerText = `${totalItems} Item${totalItems > 1 ? 's' : ''}`;
    document.getElementById('cartTotal').innerText = totalAmount;
  } else {
    floatingCart.style.display = 'none';
  }
}

// Search Functionality
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    document.querySelectorAll('.category-item').forEach((p, i) => {
      p.classList.toggle('active', i === 0);
    });
    renderMenu(null, e.target.value);
  });
}

// Waiter Call
function callWaiter(e) {
  e.preventDefault();
  document.getElementById('waiterPopup').style.display = 'flex';
}

function closeWaiterPopup() {
  document.getElementById('waiterPopup').style.display = 'none';
}

async function confirmCallWaiter() {
  try {
    await fetch(`${BASE_URL}/api/customer/call-waiter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, tableNumber: parseInt(tableNumber) })
    });
    alert('Waiter has been notified!');
    closeWaiterPopup();
  } catch (err) {
    console.error(err);
  }
}

// Init
if (window.location.pathname.includes('menu.html')) {
  loadRestaurantInfo();
  loadMenu();
  if (localStorage.getItem('sessionId')) {
    const activeOrdersBtn = document.getElementById('floatingOrdersBtn');
    if (activeOrdersBtn) activeOrdersBtn.style.display = 'flex';
  }
}

// Cart Logic
function clearCart() {
  cart = [];
  localStorage.removeItem('cart');
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cartContainer');
  const summary = document.getElementById('cartSummary');
  if (!container || !summary) return;

  if (cart.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); margin-top: 40px;">Your cart is empty.</div>';
    summary.style.display = 'none';
    return;
  }

  let htmlString = '';
  cart.forEach(item => {
    htmlString += `
      <div class="menu-card" style="margin: 0 20px 12px; background: transparent; border: none; border-bottom: 1px solid var(--border-color); padding: 0 0 12px 0; border-radius: 0; display: flex; flex-direction: column; gap: 8px;">
        <div style="display:flex; align-items:center; width:100%;">
          <div class="card-img-wrapper" style="width: 60px; height: 60px; flex-shrink: 0; margin-right: 12px;">
            <img src="${item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150'}" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150'" loading="lazy" class="card-img" alt="${item.name}">
          </div>
          <div class="card-info" style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
            <div class="card-title" style="font-size:14px;">${item.name}</div>
            <div class="card-price" style="font-size:14px; margin-top:4px;">₹${item.price}</div>
          </div>
          <div class="qty-control" style="height: 28px;">
            <button class="qty-btn" onclick="updateQty('${item.id}', -1)">−</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
          </div>
          <div style="font-weight:bold; color:var(--text-primary); margin-left: 12px; width:40px; text-align:right;">₹${item.price * item.qty}</div>
        </div>
        <div style="width:100%;">
          <input type="text" placeholder="Add special instructions (e.g. less spicy)..." 
                 value="${item.specialNote || ''}"
                 onchange="updateNote('${item.id}', this.value)"
                 style="width:100%; padding:8px 12px; border-radius:8px; border:1px solid var(--border-color); background:rgba(255,255,255,0.05); color:white; font-size:12px;">
        </div>
      </div>
    `;
  });

  container.innerHTML = htmlString;

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const subTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const gst = Math.round(subTotal * 0.05); // Assuming 5% GST
  const grandTotal = subTotal + gst + selectedTip;

  document.getElementById('summaryItems').innerText = totalItems;
  document.getElementById('summarySubTotal').innerText = '₹' + subTotal;
  document.getElementById('summaryGST').innerText = '₹' + gst;
  document.getElementById('summaryTotal').innerText = '₹' + grandTotal;

  summary.style.display = 'block';
}

function updateNote(itemId, note) {
  const item = cart.find(c => c.id === itemId);
  if (item) {
    item.specialNote = note;
    localStorage.setItem('cart', JSON.stringify(cart));
  }
}

let selectedTip = 0;
function setTip(amt) {
  selectedTip = amt;
  const btns = document.querySelectorAll('.tip-btn');
  btns.forEach(btn => {
    btn.classList.remove('active');
    btn.style.background = 'transparent';
    btn.style.color = 'var(--text-primary)';
    btn.style.borderColor = 'var(--border-color)';
  });
  if (event && event.target) {
    const activeBtn = event.target;
    activeBtn.classList.add('active');
    activeBtn.style.background = 'var(--gold-primary)';
    activeBtn.style.color = '#000';
    activeBtn.style.borderColor = 'var(--gold-primary)';
  }
  renderCart();
}

async function placeOrder() {
  if (cart.length === 0) return;
  
  const savedPasscode = localStorage.getItem('tablePasscode');
  const savedSessionId = localStorage.getItem('sessionId');
  
  if (savedPasscode && savedSessionId) {
    await submitOrder(savedPasscode);
    return;
  }
  
  // Show PIN popup if no session/passcode exists
  const overlay = document.getElementById('passcodePromptOverlay');
  const input = document.getElementById('orderPasscodeInput');
  overlay.style.display = 'flex';
  input.value = '';
  setTimeout(() => input.focus(), 100);
}

async function submitOrderWithPasscode() {
  const passcode = document.getElementById('orderPasscodeInput').value.trim();
  if (!passcode || passcode.length !== 4) {
    alert('Please enter the 4-digit PIN provided by the waiter.');
    return;
  }
  document.getElementById('passcodePromptOverlay').style.display = 'none';
  await submitOrder(passcode);
}

async function submitOrder(passcode) {
  const subTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const gst = Math.round(subTotal * 0.05);
  const total = subTotal + gst + selectedTip;

  let sessionId = localStorage.getItem('sessionId');

  const orderItems = cart.map(i => ({ menuItemId: i.id, name: i.name, price: i.price, qty: i.qty, specialNote: i.specialNote || '' }));

  const payload = {
    restaurantId,
    tableNumber: parseInt(tableNumber),
    items: orderItems,
    subtotal: subTotal,
    gst,
    tip: selectedTip,
    total,
    sessionId,
    passcode
  };

  try {
    showLoader();
    const res = await fetch(`${BASE_URL}/api/customer/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('tablePasscode');
        localStorage.removeItem('sessionId');
        alert('Passcode expired or invalid. Please ask waiter for the new PIN.');
        placeOrder(); // Trigger prompt again
      } else {
        alert(data.message || 'Failed to place order');
      }
      hideLoader();
      return;
    }

    localStorage.setItem('tablePasscode', passcode);
    if (!sessionId) {
      localStorage.setItem('sessionId', data.order.sessionId);
    }

    cart = [];
    localStorage.removeItem('cart');

    hideLoader();

    document.getElementById('placedOrderNo').innerText = '#' + data.order.orderNumber;
    document.getElementById('orderSuccessPopup').style.display = 'flex';
  } catch (err) {
    console.error(err);
    alert('Failed to place order');
  } finally {
    hideLoader();
  }
}

// Order Status Logic
async function loadOrders() {
  const sessionId = localStorage.getItem('sessionId');
  const container = document.getElementById('ordersContainer');
  if (!container || !sessionId) {
    if (container) container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); margin-top: 40px;">No orders found.</div>';
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/customer/orders/${sessionId}`);
    const orders = await res.json();

    container.innerHTML = '';
    if (orders.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); margin-top: 40px;">No orders found.</div>';
      return;
    }

    let htmlString = `
      <div style="background:var(--panel-color); border:1px solid var(--border-color); border-radius:12px; padding:16px; margin-bottom:20px; text-align:center;">
        <h3 style="color:var(--gold-primary); margin:0 0 8px; font-size:18px;">Session #${orders[orders.length - 1].orderNumber}</h3>
        <div style="font-size:14px; color:var(--text-secondary);">Table ${orders[0].tableNumber}</div>
      </div>
    `;

    orders.forEach(order => {
      let statusHtml = '';
      if (order.status === 'new') statusHtml = '<div class="status-badge-outlined" style="border-color:#F4A017; color:#F4A017;"><svg style="fill:#F4A017;" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg> NEW</div>';
      else if (order.status === 'preparing') statusHtml = '<div class="status-badge-outlined" style="border-color:#F4A017; color:#F4A017;"><svg style="fill:#F4A017;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg> PREPARING</div>';
      else if (order.status === 'ready') statusHtml = '<div class="status-badge-outlined" style="border-color:var(--green); color:var(--green);"><svg style="fill:var(--green);" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> READY</div>';
      else if (order.status === 'served') statusHtml = '<div class="status-badge-outlined" style="border-color:#555; color:#555;"><svg style="fill:#555;" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> SERVED</div>';

      let itemsHtml = order.items.map(i => `
        <div class="order-item-row">
          <div><span class="item-qty">${i.qty}x</span><span class="item-name">${i.name}</span></div>
          <div class="item-price">₹${i.price * i.qty}</div>
        </div>
      `).join('');

      htmlString += `
        <div class="status-card" id="order-card-${order.id}">
          <div class="status-row">
            <div>
              <div class="status-label">ORDER NUMBER</div>
              <div class="order-num"><span>#</span>${order.orderNumber}</div>
            </div>
            <div id="status-${order.id}">
              ${statusHtml}
            </div>
          </div>
          
          <div class="order-items-list">
            ${itemsHtml}
          </div>
          
          <div class="totals-row">
            <div>
              <div class="status-label">Total Amount</div>
              <div class="total-val">₹${order.total.toFixed(2)}</div>
            </div>
            <div style="text-align: right;">
              <div class="status-label">Estimated Time</div>
              <div class="time-val">18 - 20 Mins</div>
            </div>
          </div>
        </div>
      `;
    });

    // Add one ORDER MORE button at the very bottom
    htmlString += `
      <button class="btn-primary-large" onclick="window.location.href='menu.html'" style="margin-top: 8px;">
        <svg viewBox="0 0 24 24" style="width:20px; height:20px; fill:#000;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        ORDER MORE
      </button>
    `;

    container.innerHTML = htmlString;
  } catch (err) {
    console.error(err);
  }
}

// Socket listen for order status updates
socket.on('connect', () => {
  if (restaurantId) {
    socket.emit('join_restaurant', restaurantId);
  }
});

socket.on('order_status_update', (data) => {
  if (window.location.pathname.includes('order-status.html')) {
    const statusDiv = document.getElementById(`status-${data.orderId}`);
    if (statusDiv) {
      let statusHtml = '';
      if (data.status === 'new') statusHtml = '<div class="status-badge-outlined" style="border-color:#F4A017; color:#F4A017;"><svg style="fill:#F4A017;" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg> NEW</div>';
      else if (data.status === 'preparing') statusHtml = '<div class="status-badge-outlined" style="border-color:#F4A017; color:#F4A017;"><svg style="fill:#F4A017;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg> PREPARING</div>';
      else if (data.status === 'ready') statusHtml = '<div class="status-badge-outlined" style="border-color:var(--green); color:var(--green);"><svg style="fill:var(--green);" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> READY</div>';
      else if (data.status === 'served') statusHtml = '<div class="status-badge-outlined" style="border-color:#555; color:#555;"><svg style="fill:#555;" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> SERVED</div>';
      statusDiv.innerHTML = statusHtml;
    }
  }
});

socket.on('session_closed', (data) => {
  const currentSession = localStorage.getItem('sessionId');
  if (currentSession && data.sessionId === currentSession) {
    localStorage.removeItem('sessionId');
    localStorage.removeItem('tablePasscode');
    localStorage.removeItem('cart');
    localStorage.removeItem('restaurantId');
    localStorage.removeItem('tableNumber');
    alert('Your session has been closed by the waiter. Thank you for dining with us!');
    window.location.href = 'index.html';
  }
});

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

if (localStorage.getItem('theme') === 'light') {
  document.body.classList.add('light-theme');
}
