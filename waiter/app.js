// Auth guard
const token = localStorage.getItem('waiterToken');
if (!token && !window.location.pathname.includes('index.html')) {
  window.location.href = 'index.html';
}

const waiterName = localStorage.getItem('waiterName') || 'Waiter';
const restaurantId = localStorage.getItem('waiterRestaurantId');

// Set topbar
if (document.getElementById('waiterName')) {
  document.getElementById('waiterName').textContent = waiterName;
}

// ── API Helper ──
async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (res.status === 401 || res.status === 403) {
    localStorage.clear();
    window.location.href = 'index.html';
    return;
  }
  return res;
}

// ── TAB SWITCHING ──
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab' + name.charAt(0).toUpperCase() + name.slice(1)).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');

  if (name === 'tables') loadTables();
  if (name === 'calls') loadCalls();
  if (name === 'liveorders') loadLiveOrders();
}

// ── LOAD SETTINGS ──
async function loadSettings() {
  try {
    const res = await api('/api/waiter/settings');
    if (!res || !res.ok) return;
    const data = await res.json();
    document.getElementById('restaurantNameTop').textContent = data.name;
    window._gstPercent = data.gstPercent;
    window._totalTables = data.totalTables;
  } catch (e) { console.error(e); }
}

// ── TABLES ──
async function loadTables() {
  const grid = document.getElementById('tableGrid');
  grid.innerHTML = '<div class="loading-text">Loading tables...</div>';
  try {
    const res = await api('/api/waiter/tables');
    if (!res || !res.ok) { grid.innerHTML = '<div class="loading-text">Failed to load tables.</div>'; return; }
    const tables = await res.json();

    const pendingCalls = tables.filter(t => t.hasCall).length;
    const badge = document.getElementById('callBadge');
    const countEl = document.getElementById('callCount');
    if (pendingCalls > 0) {
      badge.style.display = 'flex';
      countEl.textContent = pendingCalls;
    } else {
      badge.style.display = 'none';
    }

    grid.innerHTML = '';
    tables.forEach(t => {
      const card = document.createElement('button');
      card.className = `table-card status-${t.status} ${t.hasCall ? 'has-call' : ''}`;
      card.onclick = () => openTableModal(t.tableNumber, t.passcode);
      card.style.display = 'block';
      card.style.width = '100%';

      const pillClass = {
        available: t.passcode ? 'pill-new' : 'pill-available',
        new: 'pill-new',
        preparing: 'pill-preparing',
        ready: 'pill-ready',
        occupied: 'pill-ready'
      }[t.status] || 'pill-available';

      const statusLabel = {
        available: t.passcode ? `PIN: ${t.passcode}` : 'Free',
        new: 'Ordered',
        preparing: 'Cooking',
        ready: 'Ready',
        occupied: 'Occupied'
      }[t.status] || t.status;

      card.innerHTML = `
        <div class="table-num">T${String(t.tableNumber).padStart(2,'0')}</div>
        <span class="table-status-pill ${pillClass}">${statusLabel}</span>
        ${t.total > 0 ? `<div class="table-total">₹${t.total.toFixed(2)}</div>` : ''}
      `;
      grid.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    grid.innerHTML = '<div class="loading-text">Error loading tables.</div>';
  }
}

// ── TABLE MODAL ──
async function openTableModal(tableNumber, passcode = null) {
  const modal = document.getElementById('tableModal');
  const title = document.getElementById('modalTitle');
  const sub = document.getElementById('modalSub');
  const body = document.getElementById('modalBody');
  const actions = document.getElementById('modalActions');

  title.textContent = `Table ${tableNumber}`;
  sub.textContent = 'Loading...';
  body.innerHTML = '<div class="loading-text">Fetching orders...</div>';
  actions.innerHTML = '';
  modal.classList.add('open');

  try {
    const res = await api(`/api/waiter/table/${tableNumber}/bill`);
    if (!res.ok) {
      // No active orders — show empty
      sub.textContent = 'No active orders';
      if (passcode) {
        body.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="key" style="width:48px;height:48px;color:var(--gold-primary);"></i></div><div>Customer PIN for this table:</div><div style="font-size:32px; font-weight:bold; letter-spacing:4px; margin-top:10px; color:var(--gold-primary);">${passcode}</div></div>`;
      } else {
        body.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="armchair" style="width:48px;height:48px;opacity:0.5;"></i></div><div>This table is free. Please refresh to load PIN.</div></div>`;
      }
      actions.innerHTML = `
        <button class="btn-action btn-primary" onclick="startOrderForTable(${tableNumber})"><i data-lucide="plus" style="width:16px;height:16px;vertical-align:middle;"></i> Place Order for this Table</button>
      `;
      setTimeout(() => lucide.createIcons(), 10);
      return;
    }

    const bill = await res.json();
    const sessionNo = bill.orders[0]?.sessionNumber || bill.orders[0]?.orderNumber;
    sub.textContent = `${bill.orders.length} order batch(es) · Session #${sessionNo}`;

    // Render each order batch
    let bodyHTML = '';
    bill.orders.forEach((o, i) => {
      bodyHTML += `<div class="order-block">
        <div class="order-block-header">Order #${o.orderNumber} — ${new Date(o.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
        ${o.items.map(item => `
          <div class="order-line">
            <span class="order-line-name">${item.name}</span>
            <span class="order-line-qty">x${item.qty}</span>
            <span class="order-line-price">₹${(item.price * item.qty).toFixed(2)}</span>
          </div>
        `).join('')}
      </div>`;
    });

    bodyHTML += `<div class="bill-summary">
      <div class="total-row"><span>Subtotal</span><span>₹${bill.subtotal.toFixed(2)}</span></div>
      <div class="total-row"><span>GST (${bill.gstPercent}%)</span><span>₹${bill.gstAmount.toFixed(2)}</span></div>
      <div class="total-row grand"><span>Grand Total</span><span>₹${bill.grandTotal.toFixed(2)}</span></div>
    </div>`;

    body.innerHTML = bodyHTML;

    actions.innerHTML = `
      <button class="btn-action btn-secondary" onclick="printBill(${tableNumber})"><i data-lucide="printer" style="width:16px;height:16px;vertical-align:middle;"></i> View & Print Bill</button>
      <button class="btn-action btn-primary" onclick="closeTableModal(); startOrderForTable(${tableNumber})"><i data-lucide="plus" style="width:16px;height:16px;vertical-align:middle;"></i> Add More Items</button>
      <button class="btn-action btn-danger" onclick="closeSession(${tableNumber})"><i data-lucide="check" style="width:16px;height:16px;vertical-align:middle;"></i> Close Table Session</button>
    `;
    setTimeout(() => lucide.createIcons(), 10);
  } catch (e) {
    console.error(e);
    body.innerHTML = '<div class="loading-text">Error loading data.</div>';
  }
}

function closeTableModal() {
  document.getElementById('tableModal').classList.remove('open');
}

let currentBillTableNum = null;

// ── PRINT BILL ──
async function printBill(tableNumber) {
  closeTableModal();
  currentBillTableNum = tableNumber;
  const billModal = document.getElementById('billModal');
  const billContent = document.getElementById('billContent');
  billContent.innerHTML = '<div class="loading-text" style="color:#333;">Generating bill...</div>';
  billModal.classList.add('open');

  try {
    const res = await api(`/api/waiter/table/${tableNumber}/bill`);
    if (!res.ok) { billContent.innerHTML = '<div style="color:#c00;padding:20px;">No active orders found for this table.</div>'; return; }
    const bill = await res.json();
    renderBillContent(bill, billContent);
  } catch (e) {
    billContent.innerHTML = '<div style="color:#c00;padding:20px;">Error generating bill.</div>';
  }
}

function renderBillContent(bill, container) {
  const now = bill.generatedAt ? new Date(bill.generatedAt) : new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Flatten all items across all orders
  const allItems = [];
  bill.orders.forEach(o => {
    o.items.forEach(item => {
      const existing = allItems.find(i => i.name === item.name && i.price === item.price);
      if (existing) { existing.qty += item.qty; existing.total += item.price * item.qty; }
      else allItems.push({ name: item.name, price: item.price, qty: item.qty, total: item.price * item.qty });
    });
  });

  container.innerHTML = `
    <div class="bill-restaurant">
      <div class="bill-restaurant-name">${bill.restaurant.name}</div>
      ${bill.restaurant.address ? `<div class="bill-restaurant-address">${bill.restaurant.address}</div>` : ''}
    </div>
    <div class="bill-dashed"></div>
    <div class="bill-meta"><span>Date:</span><span>${dateStr}</span></div>
    <div class="bill-meta"><span>Time:</span><span>${timeStr}</span></div>
    <div class="bill-meta"><span>Table:</span><span>No. ${bill.tableNumber}</span></div>
    <div class="bill-meta"><span>Session:</span><span>#${bill.orders[0].sessionNumber || bill.orders[0].orderNumber}</span></div>
    <div class="bill-meta"><span>Orders:</span><span>${bill.orders.map(o => '#' + o.orderNumber).join(', ')}</span></div>
    <div class="bill-dashed"></div>
    <div class="bill-items-header">
      <span class="bill-item-name">Item</span>
      <span class="bill-item-qty">Qty</span>
      <span class="bill-item-price">Amount</span>
    </div>
    ${allItems.map(item => `
      <div class="bill-item-row">
        <span class="bill-item-name">${item.name}</span>
        <span class="bill-item-qty">${item.qty}</span>
        <span class="bill-item-price">₹${item.total.toFixed(2)}</span>
      </div>
    `).join('')}
    <div class="bill-totals">
      <div class="bill-dashed"></div>
      <div class="bill-total-row"><span>Subtotal</span><span>₹${bill.subtotal.toFixed(2)}</span></div>
      <div class="bill-total-row"><span>GST (${bill.gstPercent}%)</span><span>₹${bill.gstAmount.toFixed(2)}</span></div>
      ${bill.totalTip > 0 ? `<div class="bill-total-row"><span>Tip</span><span>₹${bill.totalTip.toFixed(2)}</span></div>` : ''}
      <div class="bill-total-row bill-grand"><span>GRAND TOTAL</span><span>₹${bill.grandTotal.toFixed(2)}</span></div>
    </div>
    <div class="bill-footer">
      Thank you for dining with us!<br>
      Please visit again — ${bill.restaurant.name}
    </div>
  `;
}

function closeBillModal() {
  document.getElementById('billModal').classList.remove('open');
}

function markPaymentDone() {
  if (currentBillTableNum) {
    closeSession(currentBillTableNum);
  }
}

// ── CLOSE SESSION ──
let tableToClose = null;

function closeSession(tableNumber) {
  tableToClose = tableNumber;
  document.getElementById('confirmTableNum').innerText = tableNumber;
  document.getElementById('confirmCloseModal').classList.add('open');
  lucide.createIcons();
}

function closeConfirmModal() {
  document.getElementById('confirmCloseModal').classList.remove('open');
  tableToClose = null;
}

const confirmBtn = document.getElementById('confirmCloseBtn');
if (confirmBtn) {
  confirmBtn.addEventListener('click', async () => {
    if (!tableToClose) return;
    const tableNumber = tableToClose;
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    
    closeConfirmModal();
    closeTableModal();
    
    try {
      const res = await api(`/api/waiter/table/${tableNumber}/close-session`, 'POST', { paymentMethod });
      const data = await res.json();
      alert(data.message || 'Session closed!');
      loadTables();
    } catch (e) {
      alert('Error closing session');
    }
  });
}

// ── WAITER CALLS ──
async function loadCalls() {
  const list = document.getElementById('callsList');
  list.innerHTML = '<div class="loading-text">Loading calls...</div>';
  try {
    const res = await api('/api/waiter/calls');
    if (!res || !res.ok) { list.innerHTML = '<div class="loading-text">Failed to load calls.</div>'; return; }
    const calls = await res.json();

    const badge = document.getElementById('callBadge');
    badge.style.display = calls.length > 0 ? 'flex' : 'none';
    document.getElementById('callCount').textContent = calls.length;

    if (calls.length === 0) {
      list.innerHTML = '<div class="no-calls"><div style="font-size:36px;margin-bottom:8px;"><i data-lucide="check-circle-2" style="width:48px;height:48px;color:var(--gold);"></i></div>No pending calls</div>';
      setTimeout(() => lucide.createIcons(), 10);
      return;
    }

    list.innerHTML = calls.map(c => `
      <div class="call-card" id="call-${c.id}">
        <div class="call-info">
          <div class="call-table"><i data-lucide="bell" style="width:14px;height:14px;vertical-align:middle;"></i> Table ${c.tableNumber}</div>
          <div class="call-time">${new Date(c.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
        </div>
        <button class="btn-attend" onclick="attendCall('${c.id}')">Attended</button>
      </div>
    `).join('');
    setTimeout(() => lucide.createIcons(), 10);
  } catch (e) {
    list.innerHTML = '<div class="loading-text">Error loading calls.</div>';
  }
}

async function attendCall(id) {
  try {
    await api(`/api/waiter/calls/${id}/attend`, 'PUT');
    document.getElementById(`call-${id}`)?.remove();
    loadCalls();
  } catch (e) { alert('Error'); }
}

// ── NEW ORDER (from Overlay) ──
let cart = {};
let fullMenu = [];
let activeCategory = 'All';

function closeOrderOverlay() {
  document.getElementById('orderOverlay').style.display = 'none';
}

async function startOrderForTable(tableNumber, sessionId) {
  document.getElementById('orderOverlay').style.display = 'block';
  
  const menuSec = document.getElementById('orderMenuSection');
  if (menuSec) menuSec.style.display = 'block';
  
  document.getElementById('activeOrderTableNum').innerText = tableNumber;
  document.getElementById('orderTable').value = tableNumber;
  if (document.getElementById('orderSessionId')) {
    document.getElementById('orderSessionId').value = sessionId || '';
  }
  
  cart = {};
  
  if (fullMenu.length === 0) {
    try {
      const res = await api('/api/waiter/menu');
      if (res && res.ok) fullMenu = await res.json();
    } catch (e) { console.error(e); }
  }
  
  renderCategoryFilter();
  renderMenuItems();
  renderCart();
}

function renderCategoryFilter() {
  const categories = ['All', ...new Set(fullMenu.map(i => i.category).filter(Boolean))];
  const container = document.getElementById('catFilter');
  container.innerHTML = categories.map(cat => `
    <button class="cat-chip ${cat === activeCategory ? 'active' : ''}" onclick="setCategory('${cat}')">${cat}</button>
  `).join('');
}

function setCategory(cat) {
  activeCategory = cat;
  renderCategoryFilter();
  renderMenuItems();
}

function renderMenuItems() {
  const filtered = activeCategory === 'All' ? fullMenu : fullMenu.filter(i => i.category === activeCategory);
  const grid = document.getElementById('menuGrid');
  if (filtered.length === 0) { grid.innerHTML = '<div class="loading-text">No items in this category</div>'; return; }
  grid.innerHTML = filtered.map(item => {
    const qty = cart[item.id]?.qty || 0;
    const isAvail = item.isAvailable !== false; // handle true/undefined vs false
    return `
      <div class="menu-item-card" style="${isAvail ? '' : 'opacity: 0.5; filter: grayscale(1); pointer-events: none;'}">
        <div class="menu-item-info">
          <div class="menu-item-name">${item.name} ${!isAvail ? '<span style="font-size:10px;color:#c00;border:1px solid #c00;border-radius:4px;padding:2px 4px;margin-left:4px;">OUT OF STOCK</span>' : ''}</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="menu-item-price">₹${item.price}</span>
            <span class="menu-item-veg" style="display:flex;align-items:center;gap:4px;">
              <div style="width:10px;height:10px;border-radius:50%;background:${item.isVeg ? '#22C55E' : '#EF4444'};"></div>
              ${item.isVeg ? 'Veg' : 'Non-veg'}
            </span>
          </div>
        </div>
        <div class="qty-control">
          ${qty > 0 ? `<button class="qty-btn" onclick="updateCart('${item.id}', ${item.price}, '${item.name.replace(/'/g, "\\'")}', -1)">−</button>` : ''}
          ${qty > 0 ? `<span class="qty-num">${qty}</span>` : ''}
          <button class="qty-btn" onclick="updateCart('${item.id}', ${item.price}, '${item.name.replace(/'/g, "\\'")}', 1)" ${!isAvail ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `;
  }).join('');
}

function updateCart(id, price, name, delta) {
  if (!cart[id]) cart[id] = { qty: 0, price, name, menuItemId: id };
  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];
  renderMenuItems();
  renderCart();
}

function renderCart() {
  const section = document.getElementById('cartSection');
  const keys = Object.keys(cart);
  if (keys.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  const gstPct = window._gstPercent || 5;
  const subtotal = keys.reduce((s, k) => s + cart[k].price * cart[k].qty, 0);
  const gst = subtotal * gstPct / 100;
  const total = subtotal + gst;

  document.getElementById('cartItems').innerHTML = keys.map(k => `
    <div class="cart-item-row">
      <span>${cart[k].name} x${cart[k].qty}</span>
      <span>₹${(cart[k].price * cart[k].qty).toFixed(2)}</span>
    </div>
  `).join('');

  document.getElementById('cartTotals').innerHTML = `
    <div class="total-row"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
    <div class="total-row"><span>GST (${gstPct}%)</span><span>₹${gst.toFixed(2)}</span></div>
    <div class="total-row grand"><span>Total</span><span>₹${total.toFixed(2)}</span></div>
  `;
}

async function placeOrder() {
  const tableNumber = parseInt(document.getElementById('orderTable').value);
  if (!tableNumber || tableNumber < 1) { alert('Please enter a valid table number.'); return; }
  const keys = Object.keys(cart);
  if (keys.length === 0) { alert('Add at least one item.'); return; }

  const gstPct = window._gstPercent || 5;
  const subtotal = keys.reduce((s, k) => s + cart[k].price * cart[k].qty, 0);
  const gst = subtotal * gstPct / 100;
  const total = subtotal + gst;

  const items = keys.map(k => ({ menuItemId: cart[k].menuItemId, name: cart[k].name, price: cart[k].price, qty: cart[k].qty }));

  const sessionIdInput = document.getElementById('orderSessionId');
  const sessionId = sessionIdInput ? sessionIdInput.value : '';

  const btn = document.getElementById('placeOrderBtn');
  btn.disabled = true;
  btn.textContent = 'Placing Order...';

  try {
    const payload = { tableNumber, items, subtotal, gst, total };
    if (sessionId) payload.sessionId = sessionId;

    const res = await api('/api/waiter/order', 'POST', payload);
    const data = await res.json();
    if (res.ok) {
      alert(`Order placed! Order #${data.order.orderNumber}`);
      cart = {};
      document.getElementById('cartTotals').innerHTML = '';
      closeOrderOverlay();
      loadLiveOrders();
      alert('Order placed successfully!');
    } else {
      alert('Failed to place order');
    }
  } catch (e) {
    alert('Error placing order');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Place Order';
  }
}

// ── LIVE ORDERS ──
async function loadLiveOrders() {
  const container = document.getElementById('liveOrdersContainer');
  container.innerHTML = '<div class="loading-text">Loading live orders...</div>';
  try {
    const res = await api('/api/waiter/live-orders');
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();

    if (data.length === 0) {
      container.innerHTML = '<div class="no-calls"><div style="font-size:36px;margin-bottom:8px;"><i data-lucide="check-circle-2" style="width:48px;height:48px;color:var(--gold);"></i></div>No active orders currently</div>';
      setTimeout(() => lucide.createIcons(), 10);
      return;
    }

    let html = '';
    // Group orders by table
    const tableMap = {};
    data.forEach(order => {
      if (!tableMap[order.tableNumber]) tableMap[order.tableNumber] = [];
      tableMap[order.tableNumber].push(order);
    });

    Object.keys(tableMap).sort((a,b) => parseInt(a) - parseInt(b)).forEach(tableNum => {
      html += `<div style="background:#0E0E12; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:16px; margin-bottom:16px;">
        <h3 style="margin-top:0; color:var(--gold); border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:8px; margin-bottom:12px;">Table ${tableNum}</h3>`;
      
      tableMap[tableNum].forEach(order => {
        const isReceived = (order.status !== 'new');
        const statusColor = isReceived ? 'var(--green)' : 'var(--orange)';
        const statusText = isReceived ? 'Received / Preparing' : 'Pending Admin';
        
        html += `<div style="margin-bottom:12px; background:rgba(255,255,255,0.02); padding:10px; border-radius:8px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
            <span style="color:var(--text-muted)">Order #${order.orderNumber}</span>
            <span style="color:${statusColor}; font-weight:600;"><i data-lucide="${isReceived ? 'check-check' : 'clock'}" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i>${statusText}</span>
          </div>`;
        
        order.items.forEach(item => {
          html += `<div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:4px;">
            <span>${item.qty}x ${item.name}</span>
          </div>`;
        });
        
        html += `</div>`;
      });
      html += `</div>`;
    });

    container.innerHTML = html;
    setTimeout(() => lucide.createIcons(), 10);
  } catch (e) {
    container.innerHTML = '<div class="loading-text">Error loading live orders.</div>';
  }
}

// ── THEME TOGGLE ──
function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  updateThemeIcon();
}

function updateThemeIcon() {
  const icon = document.querySelector('#themeToggleBtn i[data-lucide]');
  if (!icon) return;
  const isLight = document.body.classList.contains('light-theme');
  icon.setAttribute('data-lucide', isLight ? 'sun' : 'moon');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Apply saved theme on page load
(function() {
  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-theme');
  }
})();

function logout() {
  localStorage.removeItem('waiterToken');
  localStorage.removeItem('waiterName');
  window.location.href = 'index.html';
}

// ── INIT ──
loadSettings();
loadTables();

// Auto-refresh every 30 seconds
setInterval(() => {
  const activeTab = document.querySelector('.tab-content.active')?.id;
  if (activeTab === 'tabTables') loadTables();
  if (activeTab === 'tabCalls') loadCalls();
}, 30000);

async function generatePasscode(tableNumber) {
  try {
    const res = await api('/api/waiter/table/' + tableNumber + '/generate-code', 'POST');
    if (res && res.ok) {
      loadTables();
      const data = await res.json();
      openTableModal(tableNumber, data.passcode);
    }
  } catch(e) {
    console.error(e);
  }
}
