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
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  
  const tabContent = document.getElementById('tab' + name.charAt(0).toUpperCase() + name.slice(1));
  if(tabContent) tabContent.classList.add('active');
  
  const navBtn = document.getElementById('nav-' + name);
  if(navBtn) navBtn.classList.add('active');

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
    window._paymentQrCode = data.paymentQrCode;
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
    window._allTablesData = tables;
    
    // Update metric cards
    if (document.getElementById('totalTablesCount')) {
      document.getElementById('totalTablesCount').textContent = tables.length;
      document.getElementById('activeTablesCount').textContent = tables.filter(t => t.status !== 'available').length;
    }

    renderTableGrid(tables);
  } catch (e) {
    grid.innerHTML = '<div class="loading-text">Error loading tables.</div>';
  }
}

function filterTables() {
  if (!window._allTablesData) return;
  const q = document.getElementById('tableSearch').value.toLowerCase();
  const filtered = window._allTablesData.filter(t => String(t.tableNumber).includes(q));
  renderTableGrid(filtered);
}

function renderTableGrid(tables) {
  const grid = document.getElementById('tableGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  if (!tables || tables.length === 0) {
    grid.innerHTML = '<div class="loading-text" style="grid-column: 1 / -1; padding: 40px; color: var(--text-muted);">No tables configured. Please ask admin to add tables.</div>';
    return;
  }
  
  tables.forEach(t => {
    const card = document.createElement('div');
    card.onclick = () => openTableModal(t.tableNumber, t.passcode);
    
    const statusMap = {
      available: 'free',
      new: 'ordered',
      preparing: 'cooking',
      ready: 'ready',
      occupied: 'ready'
    };
    const sType = statusMap[t.status] || 'free';
    card.className = `table-card status-${sType}`;

    const statusLabel = {
      available: 'Free',
      new: 'Ordered',
      preparing: 'Cooking',
      ready: 'Ready',
      occupied: 'Occupied'
    }[t.status] || t.status;

    const hasCall = window._activeCalls && window._activeCalls.find(c => c.tableNumber === t.tableNumber);
    const bellHtml = hasCall ? `<i data-lucide="bell-ring" style="width:24px;height:24px;color:#EF4444;animation: bell-ring 2s infinite; margin-left: auto;"></i>` : '';

    card.innerHTML = `
      <div class="icon-row" style="display:flex; justify-content:space-between; align-items:center;">
        <i data-lucide="armchair" style="width:24px;height:24px;"></i>
        ${bellHtml}
      </div>
      <div class="table-name">T${String(t.tableNumber).padStart(2,'0')}</div>
      <div class="table-pin">PIN: ${t.passcode || '----'}</div>
      <div class="status-text">${t.total > 0 ? '₹'+t.total.toFixed(2) + ' <br>' : ''}${statusLabel}</div>
    `;
    grid.appendChild(card);
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── TABLE MODAL ──
async function openTableModal(tableNumber, passcode = null) {
  const modal = document.getElementById('tableModal');
  const title = document.getElementById('modalTitle');
  const sub = document.getElementById('modalSub');
  const body = document.getElementById('modalBody');

  title.textContent = `Table ${tableNumber}`;
  sub.textContent = `PIN: ${passcode || '----'}`;
  body.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px;">Loading...</div>';
  modal.classList.add('open');

  try {
    const res = await api(`/api/waiter/table/${tableNumber}/bill`);
    if (!res) return;
    if (!res.ok) {
      body.innerHTML = `
        <div style="text-align:center; padding: 40px 0;">
          <i data-lucide="info" style="width:48px;height:48px;color:var(--text-muted);opacity:0.5;margin-bottom:16px;"></i>
          <div style="color:var(--text-muted);">Table is currently empty.</div>
        </div>
        <button class="action-btn btn-primary" onclick="closeTableModal(); startOrderForTable(${tableNumber}, '')">
          <i data-lucide="plus" style="width:18px;"></i> Place Order
        </button>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    const bill = await res.json();
    const sessionNo = bill.orders[0]?.sessionNumber || bill.orders[0]?.orderNumber;
    
    let statusPill = `<div class="modal-status-btn ready"><i data-lucide="check-circle" style="width:16px;"></i> Ready</div>`;
    let timeStr = new Date(bill.orders[0].createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    let bodyHTML = `
      ${statusPill}
      <div class="modal-session-time">Session Started: ${timeStr}</div>
      
      <div class="summary-box">
        <div class="summary-header">
          <span>Order #${bill.orders[0].orderNumber}</span>
          <span>${timeStr}</span>
        </div>
        ${bill.orders.flatMap(o => o.items).map(item => `
          <div class="summary-item">
            <span class="summary-item-name">${item.qty}x ${item.name}</span>
            <span class="summary-item-price">₹${(item.price * item.qty).toFixed(2)}</span>
          </div>
        `).join('')}
        
        <div class="summary-totals">
          <div class="summary-total-row"><span>Subtotal</span><span>₹${bill.subtotal.toFixed(2)}</span></div>
          <div class="summary-total-row"><span>GST (${bill.gstPercent}%)</span><span>₹${bill.gstAmount.toFixed(2)}</span></div>
          ${bill.totalTip > 0 ? `<div class="summary-total-row"><span>Tip</span><span>₹${bill.totalTip.toFixed(2)}</span></div>` : ''}
          <div class="summary-grand"><span>Grand Total</span><span>₹${bill.grandTotal.toFixed(2)}</span></div>
        </div>
      </div>
      
      <div class="section-title" style="padding:0; margin-bottom:12px;">ACTIONS</div>
      <button class="action-btn btn-secondary" onclick="printBill(${tableNumber})"><i data-lucide="file-text" style="width:18px;"></i> View Bill</button>
      <button class="action-btn btn-secondary" style="color:var(--text); border-color:var(--border);" onclick="closeTableModal(); startOrderForTable(${tableNumber})"><i data-lucide="plus" style="width:18px;"></i> Add More Items</button>
      <button class="action-btn btn-danger" onclick="closeSession(${tableNumber})"><i data-lucide="x-circle" style="width:18px;"></i> Close Table Session</button>
    `;

    body.innerHTML = bodyHTML;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {
    body.innerHTML = '<div class="loading-text">Error loading table details.</div>';
  }
}

function closeTableModal() {
  document.getElementById('tableModal').classList.remove('open');
}

let currentBillTableNum = null;

// ── PRINT BILL ──
async function cancelWaiterOrder() {
  closeModal('waiterAddOrderModal');
}

// ── QR DISPLAY LOGIC ──
function showWaiterQr() {
  if (window._paymentQrCode) {
    document.getElementById('qrDisplayImage').src = window._paymentQrCode;
    document.getElementById('qrDisplayModal').style.display = 'flex';
  } else {
    alert("No Payment QR Code set by Admin!");
  }
}

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
    closeBillModal();
    closeSession(currentBillTableNum);
  }
}

// ── CLOSE SESSION ──
let tableToClose = null;

function closeSession(tableNumber) {
  tableToClose = tableNumber;
  document.getElementById('confirmTableNum').innerText = tableNumber;
  document.getElementById('confirmCloseModal').classList.add('open');
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
    let paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    
    if (paymentMethod === 'split') {
      const cash = parseFloat(document.getElementById('splitCash').value) || 0;
      const upi = parseFloat(document.getElementById('splitUpi').value) || 0;
      const card = parseFloat(document.getElementById('splitCard').value) || 0;
      
      let parts = [];
      if (cash > 0) parts.push(`Cash(₹${cash})`);
      if (upi > 0) parts.push(`UPI(₹${upi})`);
      if (card > 0) parts.push(`Card(₹${card})`);
      
      if (parts.length === 0) {
        alert("Please enter at least one split amount!");
        return;
      }
      paymentMethod = `Split: ${parts.join(', ')}`;
    }
    
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
    window._activeCalls = calls;

    const badge = document.getElementById('callBadge');
    if (badge) badge.style.display = calls.length > 0 ? 'flex' : 'none';
    const countEl = document.getElementById('callCount');
    if (countEl) countEl.textContent = calls.length;

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
    await loadCalls();
    if (document.getElementById('tabTables').classList.contains('active')) {
      renderTableGrid(window._allTablesData);
    }
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
      loadTables();
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
let currentOrderFilter = 'all';
let allLiveOrders = [];

function setOrderFilter(filter) {
  currentOrderFilter = filter;
  // Update active pill
  document.querySelectorAll('#orderSegments .segment-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick').includes(`'${filter}'`)) {
      btn.classList.add('active');
    }
  });
  renderLiveOrders();
}

async function loadLiveOrders() {
  const container = document.getElementById('liveOrdersContainer');
  container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Loading orders...</div>';
  try {
    const res = await api('/api/waiter/live-orders');
    if (!res.ok) throw new Error('Failed');
    allLiveOrders = await res.json();
    if (document.getElementById('activeOrdersCount')) {
      const activeCount = allLiveOrders.filter(o => ['new', 'preparing', 'ready'].includes(o.status)).length;
      document.getElementById('activeOrdersCount').textContent = activeCount;
    }
    renderLiveOrders();
  } catch (e) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Error loading orders.</div>';
  }
}

function renderLiveOrders() {
  const container = document.getElementById('liveOrdersContainer');
  let filtered = allLiveOrders;
  
  const countAll = allLiveOrders.length;
  const countPrep = allLiveOrders.filter(o => o.status === 'preparing' || o.status === 'new').length;
  const countReady = allLiveOrders.filter(o => o.status === 'ready').length;
  const countServed = allLiveOrders.filter(o => o.status === 'served' || o.status === 'completed').length;
  
  if (document.getElementById('countAll')) document.getElementById('countAll').innerText = countAll;
  if (document.getElementById('countPrep')) document.getElementById('countPrep').innerText = countPrep;
  if (document.getElementById('countReady')) document.getElementById('countReady').innerText = countReady;
  if (document.getElementById('countServed')) document.getElementById('countServed').innerText = countServed;
  
  if (currentOrderFilter === 'preparing') filtered = allLiveOrders.filter(o => o.status === 'preparing' || o.status === 'new');
  else if (currentOrderFilter === 'ready') filtered = allLiveOrders.filter(o => o.status === 'ready');
  else if (currentOrderFilter === 'served') filtered = allLiveOrders.filter(o => o.status === 'served' || o.status === 'completed');

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">No orders in this category.</div>';
    return;
  }

  container.innerHTML = filtered.map(order => {
    let pillClass = 'pill-served';
    let statusName = 'Served';
    if (order.status === 'preparing' || order.status === 'new') { pillClass = 'pill-preparing'; statusName = 'Preparing'; }
    else if (order.status === 'ready') { pillClass = 'pill-ready'; statusName = 'Ready'; }
    
    let timeStr = new Date(order.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    return `
      <div class="order-card">
        <div class="order-card-header">
          <div>
            <div class="order-table-name">Table ${order.tableNumber}</div>
            <div class="order-number">Order #${order.orderNumber}</div>
          </div>
          <div style="text-align:right;">
            <div class="status-pill ${pillClass}">${statusName}</div>
            <div class="order-time">${timeStr}</div>
          </div>
        </div>
        
        ${order.items.map(item => `
          <div class="order-item-row">
            <span class="order-item-name">${item.qty}x ${item.name}</span>
            <span class="order-item-price">₹${(item.price * item.qty).toFixed(2)}</span>
          </div>
        `).join('')}
        
        <div class="order-total-row">
          <span>Total</span>
          <span>₹${order.total.toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ── THEME TOGGLE ──
function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  updateThemeIcon();
}

function updateThemeIcon() {
  const oldBtn = document.getElementById('themeToggleBtn');
  if (!oldBtn) return;
  const isLight = document.body.classList.contains('light-theme');
  
  const newBtn = document.createElement('i');
  newBtn.setAttribute('data-lucide', isLight ? 'sun' : 'moon');
  newBtn.className = 'theme-toggle';
  newBtn.id = 'themeToggleBtn';
  newBtn.setAttribute('onclick', 'toggleTheme()');
  
  oldBtn.replaceWith(newBtn);
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
loadCalls();
loadTables();
loadLiveOrders();

// Auto-refresh every 30 seconds
setInterval(() => {
  const activeTab = document.querySelector('.tab-content.active')?.id;
  if (activeTab === 'tabTables') loadTables();
  if (activeTab === 'tabCalls') loadCalls();
  loadLiveOrders();
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

// ── SOCKET IO ──
const socket = io();
if (restaurantId) {
  socket.emit('join_restaurant', restaurantId);
}

socket.on('waiter_call', (call) => {
  const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
  audio.play().catch(e => console.log('Audio play failed', e));

  loadCalls().then(() => {
    if (document.getElementById('tabTables').classList.contains('active')) {
      renderTableGrid(window._allTablesData);
    }
  });
});

socket.on('new_order', (order) => {
  loadLiveOrders();
  if (document.getElementById('tabTables').classList.contains('active')) {
    loadTables();
  }
});
