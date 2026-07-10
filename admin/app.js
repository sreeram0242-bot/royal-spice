const BASE_URL = '';
const token = localStorage.getItem('adminToken');
const restaurantId = localStorage.getItem('adminRestaurantId');

if (!token && !window.location.pathname.includes('index.html')) {
  window.location.href = 'index.html';
}

const socket = typeof io !== 'undefined' ? io(BASE_URL) : null;

// Audio Alerts
const dingSound = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
const callSound = new Audio('https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg');

if (socket && restaurantId) {
  socket.on('connect', () => {
    socket.emit('join_restaurant', restaurantId);
  });

  socket.on('new_order', (order) => {
    // Play sound
    dingSound.play().catch(e => console.log('Audio play prevented by browser', e));
    
    // Auto Print if enabled
    if (localStorage.getItem('autoPrint') === 'true') {
      setTimeout(() => {
        if (typeof printKOT === 'function' && order && order.id) {
          printKOT(order.id);
        } else {
          window.print(); // fallback
        }
      }, 500);
    }

    // Show popup
    const popup = document.getElementById('orderPopup');
    if (popup) {
      document.getElementById('popupOrderDetails').innerHTML = `Table ${order.tableNumber} — Order #${order.orderNumber}<br>Total: ₹${order.total}`;
      popup.classList.remove('hidden');
      setTimeout(() => popup.classList.add('hidden'), 10000); // auto dismiss
    }
    loadDashboard();
    if (!document.getElementById('view-orders').classList.contains('hidden')) {
      loadOrders();
    }
  });

  socket.on('waiter_call', (call) => {
    callSound.play().catch(e => console.log('Audio play prevented', e));
    loadDashboard();
    if (!document.getElementById('view-waiter').classList.contains('hidden')) {
      loadWaiterCalls();
    }
  });

  socket.on('master_notification', (data) => {
    alert(`👑 MESSAGE FROM MASTER ADMIN:\n\n${data.message}`);
  });

  socket.on('master_broadcast', (data) => {
    alert(`📢 GLOBAL PLATFORM ALERT:\n\n${data.message}`);
  });
}

function logout() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminRestaurantId');
  window.location.href = 'index.html';
}

// ── THEME TOGGLE ──
function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  const isLight = document.body.classList.contains('light-theme');
  const icon = btn.querySelector('i[data-lucide]');
  if (icon) icon.setAttribute('data-lucide', isLight ? 'sun' : 'moon');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Apply saved theme on page load
(function() {
  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-theme');
  }
  // Update icon after page loads
  window.addEventListener('DOMContentLoaded', () => updateThemeIcon());
})();

// ── COMPLAINT MODAL ──
function openComplaintModal() {
  document.getElementById('complaintSubject').value = '';
  document.getElementById('complaintMessage').value = '';
  const status = document.getElementById('complaintStatus');
  if (status) status.style.display = 'none';
  document.getElementById('complaintModal').classList.remove('hidden');
}

async function submitComplaint() {
  const subject = document.getElementById('complaintSubject').value.trim();
  const message = document.getElementById('complaintMessage').value.trim();
  const statusEl = document.getElementById('complaintStatus');

  if (!subject || !message) {
    statusEl.style.display = 'block';
    statusEl.style.color = '#EF4444';
    statusEl.innerText = '⚠️ Please fill in both subject and message.';
    return;
  }

  try {
    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--text-muted)';
    statusEl.innerText = 'Sending...';

    const res = await fetchAPI('/api/admin/complaints', 'POST', {
      message: `[${subject}] ${message}`
    });

    statusEl.style.color = '#10B981';
    statusEl.innerText = '✅ Complaint sent successfully! The master admin will respond shortly.';

    document.getElementById('complaintSubject').value = '';
    document.getElementById('complaintMessage').value = '';

    setTimeout(() => {
      closeModal('complaintModal');
      statusEl.style.display = 'none';
    }, 2000);
  } catch (err) {
    statusEl.style.color = '#EF4444';
    statusEl.innerText = '❌ Failed to send. Please try again.';
  }
}

function showView(viewId) {
  document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
  document.getElementById('view-' + viewId).classList.remove('hidden');
  
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  
  // Safely set the active nav link
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(`'${viewId}'`)) {
      link.classList.add('active');
    }
  });

  const titles = {
    'dashboard': 'Dashboard',
    'orders': 'Orders',
    'tables': 'Tables',
    'menu': 'Menu Items',
    'categories': 'Categories',
    'qr': 'QR Codes',
    'waiter': 'Waiter Calls',
    'waiters': 'Waiters',
    'revenue': 'Revenue',
    'settings': 'Settings'
  };
  document.getElementById('currentViewTitle').innerText = titles[viewId];

  if (viewId === 'dashboard') loadDashboard();
  if (viewId === 'orders') loadOrders();
  if (viewId === 'tables') loadSettings(true);
  if (viewId === 'menu') loadMenu();
  if (viewId === 'categories') loadCategories();
  if (viewId === 'qr') loadQRCodes();
  if (viewId === 'waiter') loadWaiterCalls();
  if (viewId === 'waiters') loadWaiters();
  if (viewId === 'revenue') loadRevenue();
  if (viewId === 'settings') loadSettings();
}

async function fetchAPI(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  if (res.status === 401 || res.status === 403) logout();
  
  const data = await res.json();
  if (!res.ok) {
    console.error('API Error:', data);
    return []; // Return empty array on error to prevent UI crashes
  }
  return data;
}

let restaurantSettings = null;
let revenueChartInstance = null;

async function loadSettings(onlyTables = false) {
  restaurantSettings = await fetchAPI('/api/admin/settings');
  document.getElementById('sidebarRestaurantName').innerText = restaurantSettings.name;
  
  if (onlyTables) {
    document.getElementById('settingsTotalTables').value = restaurantSettings.totalTables;
    renderFullTableGrid(restaurantSettings.totalTables);
  } else {
    document.getElementById('setRestName').value = restaurantSettings.name;
    document.getElementById('setRestAddress').value = restaurantSettings.address;
    document.getElementById('setRestGst').value = restaurantSettings.gstPercent;
    
    // Load Auto Print toggle from LocalStorage
    document.getElementById('setAutoPrint').checked = localStorage.getItem('autoPrint') === 'true';
    
    // Load QR Code
    if (restaurantSettings.paymentQrCode) {
      document.getElementById('setQrImageBase64').value = restaurantSettings.paymentQrCode;
      document.getElementById('setQrPreview').src = restaurantSettings.paymentQrCode;
      document.getElementById('setQrPreview').style.display = 'block';
      document.getElementById('setQrPreviewText').style.display = 'none';
    } else {
      document.getElementById('setQrImageBase64').value = '';
      document.getElementById('setQrPreview').src = '';
      document.getElementById('setQrPreview').style.display = 'none';
      document.getElementById('setQrPreviewText').style.display = 'block';
    }
  }
}
async function handleAutoPrintToggle(el) {
  if (el.checked) {
    try {
      if (navigator.usb) {
        await navigator.usb.requestDevice({ filters: [] });
      } else if (navigator.bluetooth) {
        await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
      } else {
        alert("Your browser doesn't support Web USB or Bluetooth direct printer connection. Auto KOT will fallback to system print dialog.");
      }
      localStorage.setItem('autoPrint', 'true');
    } catch (e) {
      console.log('Printer connection cancelled or failed', e);
      // Revert the toggle if user cancels connection
      el.checked = false;
      localStorage.setItem('autoPrint', 'false');
    }
  } else {
    localStorage.setItem('autoPrint', 'false');
  }
}

async function saveSettings() {
  const name = document.getElementById('setRestName').value;
  const address = document.getElementById('setRestAddress').value;
  const gstPercent = document.getElementById('setRestGst').value;
  const paymentQrCode = document.getElementById('setQrImageBase64').value || null;
  
  // Save Auto Print toggle
  localStorage.setItem('autoPrint', document.getElementById('setAutoPrint').checked);
  
  await fetchAPI('/api/admin/settings', 'PUT', { name, address, gstPercent, paymentQrCode });
  alert('Settings saved');
  loadSettings();
}

function removeSettingsQr() {
  document.getElementById('setQrImageBase64').value = '';
  document.getElementById('setQrPreview').src = '';
  document.getElementById('setQrPreview').style.display = 'none';
  document.getElementById('setQrPreviewText').style.display = 'block';
}

async function updateTablesCount() {
  const totalTables = parseInt(document.getElementById('settingsTotalTables').value);
  await fetchAPI('/api/admin/settings', 'PUT', { totalTables });
  alert('Tables updated');
  loadSettings(true);
}

// DASHBOARD
async function loadDashboard() {
  const orders = await fetchAPI('/api/admin/orders?date=today');
  const calls = await fetchAPI('/api/admin/waiter-calls');
  
  if (!restaurantSettings) await loadSettings();

  const totalRev = orders.reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'new' || o.status === 'preparing');
  const activeTablesCount = new Set(pendingOrders.map(o => o.tableNumber)).size;
  const pendingCalls = calls.filter(c => c.status === 'pending');

  document.getElementById('dashRev').innerText = `₹${Math.round(totalRev).toLocaleString('en-IN')}`;
  document.getElementById('dashOrders').innerText = orders.length;
  document.getElementById('dashPending').innerText = pendingOrders.length;
  document.getElementById('dashCalls').innerText = pendingCalls.length;
  document.getElementById('dashTables').innerText = `${activeTablesCount}/${restaurantSettings.totalTables}`;

  if (pendingCalls.length > 0) {
    document.getElementById('waiterBadge').innerText = pendingCalls.length;
    document.getElementById('waiterBadge').style.display = 'block';
  } else {
    document.getElementById('waiterBadge').style.display = 'none';
  }

  // Live orders table
  const tbody = document.getElementById('liveOrdersTable');
  tbody.innerHTML = '';
  
  if (pendingOrders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">Currently no live orders</td></tr>';
  } else {
    pendingOrders.slice(0, 5).forEach(o => {
      tbody.innerHTML += `
        <tr onclick="showView('orders');" style="cursor: pointer;">
          <td><div class="table-pill" style="padding: 4px; border-radius: 0; width: 60px; font-size: 12px; background: ${o.status === 'new' ? 'var(--blue)' : 'var(--orange)'}; color: ${o.status === 'new' ? 'white' : 'black'};">Table ${o.tableNumber}</div></td>
          <td>#${o.orderNumber}</td>
          <td>${new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
          <td>${o.items.length} items</td>
          <td>₹${o.total}</td>
          <td><span class="status ${o.status}">${o.status.toUpperCase()}</span></td>
        </tr>
      `;
    });
  }

  // Table Grid
  const grid = document.getElementById('dashTableGrid');
  grid.innerHTML = '';
  for (let i = 1; i <= restaurantSettings.totalTables; i++) {
    let statusClass = 'available';
    const tableOrder = pendingOrders.find(o => o.tableNumber === i);
    if (tableOrder) {
      if (tableOrder.status === 'new') statusClass = 'ordered';
      else if (tableOrder.status === 'preparing') statusClass = 'preparing';
      else if (tableOrder.status === 'ready') statusClass = 'served';
    }
    grid.innerHTML += `<div class="table-pill ${statusClass}">T${i.toString().padStart(2, '0')}</div>`;
  }

  // Revenue Chart
  try {
    const ctx = document.getElementById('revenueChart');
    if (ctx) {
      if (revenueChartInstance) {
        revenueChartInstance.destroy();
      }
      
      // Group orders by hour
      const hourlyRevenue = Array(24).fill(0);
      orders.forEach(o => {
        const hour = new Date(o.createdAt).getHours();
        hourlyRevenue[hour] += o.total;
      });

      // Create labels (e.g. 10 AM, 11 AM)
      const labels = [];
      for (let i = 0; i < 24; i++) {
        let ampm = i >= 12 ? 'PM' : 'AM';
        let displayHour = i % 12 || 12;
        labels.push(`${displayHour} ${ampm}`);
      }

      revenueChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Revenue (₹)',
            data: hourlyRevenue,
            borderColor: '#C9A84C',
            backgroundColor: 'rgba(201, 168, 76, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0.5,
            pointBackgroundColor: '#C9A84C',
            pointRadius: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { ticks: { color: '#9CA3AF', maxTicksLimit: 6 }, grid: { display: false } },
            y: { ticks: { color: '#9CA3AF' }, grid: { color: '#333' }, beginAtZero: true }
          }
        }
      });
    }
  } catch (err) {
    console.error("Chart rendering error:", err);
  }
}

// ORDERS
async function loadOrders() {
  const orders = await fetchAPI('/api/admin/orders');
  const grid = document.getElementById('ordersGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const filter = document.getElementById('orderFilterStatus') ? document.getElementById('orderFilterStatus').value : 'all';
  
  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  
  // Sort by status priority: new > preparing > ready > served
  const statusWeight = { 'new': 1, 'preparing': 2, 'ready': 3, 'served': 4 };
  filteredOrders.sort((a, b) => {
    if (statusWeight[a.status] !== statusWeight[b.status]) {
      return statusWeight[a.status] - statusWeight[b.status];
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  
  if (filteredOrders.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-secondary);">Currently no orders</div>';
    return;
  }
  
  filteredOrders.forEach(o => {
    let actionBtn = '';
    if (o.status === 'new') {
      actionBtn = `<button class="btn-gold" style="width: 100%;" onclick="updateOrderStatus('${o.id}', 'preparing', this)">Receive (Start Preparing)</button>`;
    } else if (o.status === 'preparing') {
      actionBtn = `<button class="btn-gold" style="width: 100%; background: var(--green); color: black;" onclick="updateOrderStatus('${o.id}', 'ready', this)">Mark Ready</button>`;
    } else if (o.status === 'ready') {
      actionBtn = `<button class="btn-gold" style="width: 100%; background: var(--border-color); color: var(--text-secondary);" onclick="updateOrderStatus('${o.id}', 'served', this)">Mark Served</button>`;
    } else if (o.status === 'served') {
      actionBtn = `<button class="btn-gold" style="width: 100%; background: transparent; border: 1px solid var(--border-color); color: var(--text-muted);" disabled>Completed</button>`;
    }

    let itemsHtml = o.items.map(i => `
      <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
        <div>
          <span style="color: var(--gold); font-weight: bold; margin-right: 8px;">${i.qty}x</span>${i.name}
          ${i.specialNote ? `<div style="font-size: 11px; color: #ff9800; margin-top: 2px; margin-left: 24px; font-style: italic;">Note: ${i.specialNote}</div>` : ''}
        </div>
        <div style="color: var(--text-muted);">₹${i.price * i.qty}</div>
      </div>
    `).join('');

    grid.innerHTML += `
      <div class="panel" style="padding: 20px; border: 1px solid #333; position: relative; border-radius: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid #333; padding-bottom: 16px;">
          <div>
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Order Number</div>
            <div style="font-size: 22px; font-weight: bold; margin-bottom: 6px;">#${o.orderNumber} <span style="font-size:12px; font-weight:normal; color:#888;">(Session #${o.sessionNumber || o.orderNumber})</span></div>
            <span class="status ${o.status}">${o.status.toUpperCase()}</span>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Table</div>
            <div style="font-size: 24px; font-weight: bold; color: var(--gold); margin-bottom: 6px;">${o.tableNumber}</div>
            <button onclick="printKOT('${o.id}')" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer;"><i data-lucide="printer" style="width:20px; height:20px;"></i></button>
          </div>
        </div>
        
        <div style="margin-bottom: 16px; max-height: 200px; overflow-y: auto; padding-right: 8px; scrollbar-width: thin; scrollbar-color: #555 #222;">
          ${itemsHtml}
        </div>
        
        <div style="border-top: 1px dashed #444; padding-top: 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 12px; color: var(--text-muted);">Total Amount</div>
            <div style="font-weight: bold; font-size: 18px; color: var(--gold);">₹${o.total.toFixed(2)}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; color: var(--text-muted);">Time</div>
            <div style="font-weight: bold; font-size: 14px;">${new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
          </div>
        </div>
        
        ${o.status === 'completed' ? `
        <div style="background: var(--bg-alpha-green); border: 1px solid var(--green); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span style="color:var(--text-muted);">Payment Method:</span>
            <strong style="color:var(--text-primary); text-transform:capitalize;">${o.paymentMethod || 'Unknown'}</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:var(--text-muted);">Closed By Waiter:</span>
            <strong style="color:var(--text-primary);">${o.closedByWaiter || 'Unknown'}</strong>
          </div>
        </div>
        ` : ''}
        
        <div>
          ${actionBtn}
        </div>
      </div>
    `;
  });
}

function updateOrderStatus(id, status, btn) {
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Updating...';
    btn.style.opacity = '0.7';
  }
  fetchAPI(`/api/admin/orders/${id}/status`, 'PUT', { status })
    .then(() => loadOrders())
    .catch(err => {
      console.error(err);
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'Error';
        btn.style.opacity = '1';
      }
    });
}

// WAITER CALLS
async function loadWaiterCalls() {
  const calls = await fetchAPI('/api/admin/waiter-calls');
  const tbody = document.querySelector('#waiterTable tbody');
  tbody.innerHTML = '';
  
  calls.forEach(c => {
    tbody.innerHTML += `
      <tr>
        <td>Table ${c.tableNumber}</td>
        <td>${new Date(c.createdAt).toLocaleTimeString()}</td>
        <td>${c.status === 'pending' ? '<span class="status new">Pending</span>' : '<span class="status served">Attended</span>'}</td>
        <td>
          ${c.status === 'pending' ? `<button class="btn-gold" style="padding: 4px 12px; font-size: 12px;" onclick="attendWaiterCall('${c.id}')">Mark Attended</button>` : '—'}
        </td>
      </tr>
    `;
  });
}

async function attendWaiterCall(id) {
  await fetchAPI(`/api/admin/waiter-calls/${id}`, 'PUT');
  loadWaiterCalls();
}

// MENU
let currentMenuData = [];
async function loadMenu() {
  currentMenuData = await fetchAPI('/api/admin/menu');

  const container = document.getElementById('menuContainer');
  if (!container) return;
  container.innerHTML = '';
  
  if (!Array.isArray(currentMenuData)) return;
  
  const categories = [...new Set(currentMenuData.map(m => m.category))];
  const datalist = document.getElementById('categoryOptions');
  if (datalist) {
    datalist.innerHTML = categories.map(c => `<option value="${c}">`).join('');
  }

  let catSettings = [];
  try {
    catSettings = await fetchAPI('/api/admin/categories');
  } catch (err) {
    console.error('ERROR fetching catSettings: ', err);
  }

  categories.forEach(cat => {
    const items = currentMenuData.filter(m => m.category === cat);
    const setting = catSettings && Array.isArray(catSettings) ? catSettings.find(s => s.categoryName === cat || s.name === cat) : null;
    
    const groupDiv = document.createElement('div');
    groupDiv.className = 'panel';
    groupDiv.style.padding = '0';
    groupDiv.style.overflow = 'hidden';
    
    const headerDiv = document.createElement('div');
    headerDiv.style.padding = '16px 20px';
    headerDiv.style.background = 'transparent';
    headerDiv.style.borderBottom = '1px solid var(--border-color)';
    headerDiv.style.display = 'flex';
    headerDiv.style.justifyContent = 'space-between';
    headerDiv.style.alignItems = 'center';
    
    const titleSection = document.createElement('div');
    titleSection.style.display = 'flex';
    titleSection.style.alignItems = 'center';
    titleSection.style.gap = '12px';
    
    let defaultImg = `/customer/images/cat_all.png`;
    if (cat.toLowerCase().includes('breakfast')) defaultImg = '/customer/images/cat_breakfast.png';
    else if (cat.toLowerCase().includes('meal') || cat.toLowerCase().includes('lunch')) defaultImg = '/customer/images/cat_meals.png';
    else if (cat.toLowerCase().includes('starter')) defaultImg = '/customer/images/cat_starters.png';
    else if (cat.toLowerCase().includes('bread') || cat.toLowerCase().includes('roti')) defaultImg = '/customer/images/cat_breads.png';
    else if (cat.toLowerCase().includes('gravy') || cat.toLowerCase().includes('gravi') || cat.toLowerCase().includes('curry')) defaultImg = '/customer/images/cat_gravies.png';
    else if (cat.toLowerCase().includes('bev') || cat.toLowerCase().includes('drink')) defaultImg = '/customer/images/cat_beverages.png';
    else if (cat.toLowerCase().includes('dessert') || cat.toLowerCase().includes('sweet')) defaultImg = '/customer/images/cat_desserts.png';

    const img = document.createElement('img');
    img.src = (setting && setting.image) ? setting.image : defaultImg;
    img.onerror = function() { this.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'; };
    img.loading = 'lazy';
    img.style.width = '40px';
    img.style.height = '40px';
    img.style.borderRadius = '50%';
    img.style.objectFit = 'cover';
    img.style.border = '2px solid var(--gold)';
    
    const title = document.createElement('h4');
    title.innerText = cat;
    title.style.margin = '0';
    title.style.fontSize = '18px';
    
    titleSection.appendChild(img);
    titleSection.appendChild(title);
    
    const changeImgBtn = document.createElement('button');
    changeImgBtn.className = 'btn-gold';
    changeImgBtn.style.width = 'auto';
    changeImgBtn.style.padding = '6px 12px';
    changeImgBtn.style.fontSize = '12px';
    changeImgBtn.innerText = 'Change Category Image';
    changeImgBtn.onclick = () => {
      showView('categories');
    };
    
    headerDiv.appendChild(titleSection);
    headerDiv.appendChild(changeImgBtn);
    
    const tableDiv = document.createElement('div');
    tableDiv.style.padding = '0 20px';
    
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 0;">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-color);">
            <th style="text-align: left; padding: 12px 8px; color: var(--text-muted); font-weight: normal; font-size: 14px;">Image</th>
            <th style="text-align: left; padding: 12px 8px; color: var(--text-muted); font-weight: normal; font-size: 14px;">Name</th>
            <th style="text-align: left; padding: 12px 8px; color: var(--text-muted); font-weight: normal; font-size: 14px;">Price</th>
            <th style="text-align: left; padding: 12px 8px; color: var(--text-muted); font-weight: normal; font-size: 14px;">Veg/Non-Veg</th>
            <th style="text-align: left; padding: 12px 8px; color: var(--text-muted); font-weight: normal; font-size: 14px;">Status</th>
            <th style="text-align: right; padding: 12px 8px; color: var(--text-muted); font-weight: normal; font-size: 14px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(m => `
            <tr style="border-bottom: 1px solid var(--table-border);">
              <td style="padding: 12px 8px;"><img src="${m.image || 'https://via.placeholder.com/40'}" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'" loading="lazy" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;"></td>
              <td style="padding: 12px 8px; color: var(--text-primary);">${m.name}</td>
              <td style="padding: 12px 8px; color: var(--text-primary);">₹${m.price}</td>
              <td style="padding: 12px 8px; color: var(--text-primary);">${m.isVeg ? 'Veg' : 'Non-Veg'}</td>
              <td style="padding: 12px 8px; color: var(--text-primary);">${m.isAvailable ? '<span style="color:var(--green);font-size:12px;">Available</span>' : '<span style="color:var(--red);font-size:12px;">Out of Stock</span>'}</td>
              <td style="padding: 12px 8px; text-align: right;">
                <button style="color: var(--gold); background: transparent; border: none; cursor: pointer; margin-right: 12px;" onclick="toggleItemAvailability('${m.id}', ${!m.isAvailable})">${m.isAvailable ? 'Mark Out of Stock' : 'Mark Available'}</button>
                <button style="color: var(--blue); background: transparent; border: none; cursor: pointer; margin-right: 12px;" onclick="openEditMenuModal('${m.id}')">Edit</button>
                <button style="color: var(--red); background: transparent; border: none; cursor: pointer;" onclick="deleteMenuItem('${m.id}')">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    tableDiv.innerHTML = tableHtml;
    
    groupDiv.appendChild(headerDiv);
    groupDiv.appendChild(tableDiv);
    container.appendChild(groupDiv);
  });
}

function openAddMenuModal() {
  document.getElementById('addMenuModal').classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function compressImageBase64(base64Str, maxWidth = 400, maxHeight = 400) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      resolve(canvas.toDataURL('image/jpeg', 0.6)); // Compress as JPEG with 60% quality
    };
  });
}

function handleImageUpload(event, previewId) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async function(e) {
    let base64 = e.target.result;
    
    // Compress image to ensure it's fully optimized
    base64 = await compressImageBase64(base64);

    document.getElementById(previewId + 'Base64').value = base64;
    const preview = document.getElementById(previewId);
    preview.src = base64;
    preview.style.display = 'block';
    const textEl = document.getElementById(previewId + 'Text');
    if (textEl) textEl.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function saveMenuItem() {
  const name = document.getElementById('newMenuName').value;
  const price = document.getElementById('newMenuPrice').value;
  const category = document.getElementById('newMenuCat').value;
  const image = document.getElementById('newMenuImageBase64').value;
  const isVeg = document.querySelector('input[name="newMenuVeg"]:checked').value === 'true';

  await fetchAPI('/api/admin/menu', 'POST', { name, price, category, image, isVeg });
  
  // Clear inputs
  document.getElementById('newMenuName').value = '';
  document.getElementById('newMenuPrice').value = '';
  document.getElementById('newMenuCat').value = '';
  document.getElementById('newMenuImageBase64').value = '';
  document.getElementById('newMenuPreview').src = '';
  document.getElementById('newMenuPreview').style.display = 'none';
  document.getElementById('newMenuPreviewText').style.display = 'block';
  
  closeModal('addMenuModal');
  loadMenu();
}

function openEditMenuModal(id) {
  const m = currentMenuData.find(x => x.id === id);
  if (!m) return;
  
  document.getElementById('editMenuId').value = m.id;
  document.getElementById('editMenuName').value = m.name;
  document.getElementById('editMenuPrice').value = m.price;
  document.getElementById('editMenuCat').value = m.category;
  
  const imgBase64 = m.image || '';
  document.getElementById('editMenuImageBase64').value = imgBase64;
  
  const preview = document.getElementById('editMenuPreview');
  const previewText = document.getElementById('editMenuPreviewText');
  
  if (imgBase64) {
    preview.src = imgBase64;
    preview.style.display = 'block';
    previewText.style.display = 'none';
  } else {
    preview.src = '';
    preview.style.display = 'none';
    previewText.style.display = 'block';
  }
  
  if (m.isVeg) {
    document.querySelector('input[name="editMenuVeg"][value="true"]').checked = true;
  } else {
    document.querySelector('input[name="editMenuVeg"][value="false"]').checked = true;
  }
  
  document.getElementById('editMenuModal').classList.remove('hidden');
}

async function saveEditMenuItem() {
  const id = document.getElementById('editMenuId').value;
  const name = document.getElementById('editMenuName').value;
  const price = document.getElementById('editMenuPrice').value;
  const category = document.getElementById('editMenuCat').value;
  const image = document.getElementById('editMenuImageBase64').value;
  const isVeg = document.querySelector('input[name="editMenuVeg"]:checked').value === 'true';

  await fetchAPI(`/api/admin/menu/${id}`, 'PUT', { name, price, category, image, isVeg });
  
  closeModal('editMenuModal');
  loadMenu();
}

async function toggleItemAvailability(id, isAvailable) {
  try {
    const res = await fetch(`/api/admin/menu/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({ isAvailable })
    });
    if (res.ok) {
      loadMenu();
    } else {
      alert('Error updating status');
    }
  } catch (e) {
    alert('Failed to connect to server');
  }
}

async function deleteMenuItem(id) {
  if (confirm('Are you sure?')) {
    await fetchAPI(`/api/admin/menu/${id}`, 'DELETE');
    loadMenu();
  }
}

// CATEGORIES
async function loadCategories() {
  const catSettings = await fetchAPI('/api/admin/categories');
  const menuData = await fetchAPI('/api/admin/menu');
  
  // Get unique categories from menu
  const uniqueCats = [...new Set(menuData.map(m => m.category))];
  
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  uniqueCats.forEach(cat => {
    const setting = catSettings.find(s => s.categoryName === cat);
    
    const card = document.createElement('div');
    card.style.background = 'var(--panel-bg)';
    card.style.borderRadius = '12px';
    card.style.textAlign = 'center';
    card.style.border = '1px solid var(--border-color)';
    card.style.padding = '20px';
    
    const imgWrapper = document.createElement('div');
    imgWrapper.style.width = '120px';
    imgWrapper.style.height = '120px';
    imgWrapper.style.borderRadius = '50%';
    imgWrapper.style.border = '3px solid var(--gold)';
    imgWrapper.style.margin = '0 auto 16px auto';
    imgWrapper.style.overflow = 'hidden';
    imgWrapper.style.cursor = 'pointer';
    imgWrapper.style.position = 'relative';
    
    const img = document.createElement('img');
    let defaultImg = `/customer/images/cat_all.png`;
    if (cat.toLowerCase().includes('breakfast')) defaultImg = '/customer/images/cat_breakfast.png';
    else if (cat.toLowerCase().includes('meal') || cat.toLowerCase().includes('lunch')) defaultImg = '/customer/images/cat_meals.png';
    else if (cat.toLowerCase().includes('starter')) defaultImg = '/customer/images/cat_starters.png';
    else if (cat.toLowerCase().includes('bread') || cat.toLowerCase().includes('roti')) defaultImg = '/customer/images/cat_breads.png';
    else if (cat.toLowerCase().includes('gravy') || cat.toLowerCase().includes('gravi') || cat.toLowerCase().includes('curry')) defaultImg = '/customer/images/cat_gravies.png';
    else if (cat.toLowerCase().includes('bev') || cat.toLowerCase().includes('drink')) defaultImg = '/customer/images/cat_beverages.png';
    else if (cat.toLowerCase().includes('dessert') || cat.toLowerCase().includes('sweet')) defaultImg = '/customer/images/cat_desserts.png';

    img.src = setting?.image || defaultImg;
    img.onerror = function() { this.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'; };
    img.loading = 'lazy';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        let base64 = ev.target.result;
        // Compress image to ensure it's fully optimized
        base64 = await compressImageBase64(base64);
        
        img.src = base64; // instant preview
        
        // upload to server
        await fetchAPI('/api/admin/categories', 'POST', {
          categoryName: cat,
          image: base64
        });
        
        alert(cat + ' image updated!');
      };
      reader.readAsDataURL(file);
    };
    
    const changeBtn = document.createElement('button');
    changeBtn.className = 'btn-gold';
    changeBtn.style.marginTop = '12px';
    changeBtn.style.fontSize = '12px';
    changeBtn.style.padding = '8px 16px';
    changeBtn.innerText = 'Change Category Image';
    changeBtn.onclick = () => fileInput.click();
    
    imgWrapper.appendChild(img);
    imgWrapper.appendChild(fileInput);
    
    const title = document.createElement('h3');
    title.innerText = cat;
    title.style.margin = '0 0 8px 0';
    
    card.appendChild(imgWrapper);
    card.appendChild(title);
    card.appendChild(changeBtn);
    grid.appendChild(card);
  });
}

// TABLES Overview
async function renderFullTableGrid(total) {
  const grid = document.getElementById('fullTableGrid');
  grid.innerHTML = '<div style="color:var(--text-muted);">Loading tables...</div>';

  try {
    const res = await fetch(`${BASE_URL}/api/admin/tables`, { headers: { 'Authorization': `Bearer ${token}` } });
    const tables = await res.json();
    
    grid.innerHTML = '';
    
    if (!tables || tables.length === 0) {
      grid.innerHTML = '<div style="color:var(--text-muted); grid-column: 1 / -1; text-align:center; padding: 40px 20px;">No tables configured. Please update your total tables in Settings.</div>';
      return;
    }

    tables.forEach(t => {
      const isOccupied = t.status === 'occupied';
      const statusText = isOccupied ? `<span style="color:var(--gold);font-weight:bold;font-size:16px;">₹${(t.total || 0).toFixed(2)}</span>` : (t.passcode ? `<span style="color:var(--gold);font-weight:bold;font-size:14px;">PIN: ${t.passcode}</span>` : 'Free');
      const clickAction = isOccupied ? `onclick="openTableModal(${t.tableNumber}, '${t.passcode || ''}')" style="cursor:pointer;"` : '';
      grid.innerHTML += `<div class="table-pill ${isOccupied ? 'occupied' : (t.passcode ? 'status-new' : 'available')}" ${clickAction} style="height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; ${isOccupied ? 'cursor:pointer;' : ''}">
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 4px;">T${t.tableNumber.toString().padStart(2, '0')}</div>
        <div style="font-size: 12px; color: var(--text-muted); text-align: center;">${statusText}</div>
      </div>`;
    });
  } catch (err) {
    grid.innerHTML = '<div style="color:var(--red); padding: 20px; grid-column: 1 / -1; text-align:center;">Failed to load tables. Please check your connection.</div>';
  }
}

// ── TABLE SESSION MANAGEMENT (Admin) ──
async function openTableModal(tableNumber, passcode = null) {
  const modal = document.getElementById('tableModal');
  const title = document.getElementById('modalTitle');
  const sub = document.getElementById('modalSub');
  const body = document.getElementById('modalBody');
  const headerAction = document.getElementById('modalHeaderAction');

  title.textContent = `Table ${tableNumber}`;
  sub.textContent = `PIN: ${passcode || '----'}`;
  body.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px;">Loading...</div>';
  
  if (headerAction) {
    headerAction.innerHTML = `<button class="btn-gold" style="background:#10B981; color:white; border:none; padding:6px 16px; border-radius:8px; display:flex; align-items:center; gap:6px; font-size:14px; cursor:pointer;" onclick="closeSession(${tableNumber})"><i data-lucide="banknote" style="width:16px; height:16px;"></i> Receive Money</button>`;
  }
  
  modal.classList.remove('hidden');

  try {
    const res = await fetchAPI(`/api/admin/table/${tableNumber}/bill`);
    
    let statusPill = `<div class="modal-status-btn ready" style="background:var(--blue); color:white; padding:4px 12px; border-radius:4px; font-size:12px; display:inline-flex; align-items:center; gap:6px; margin-bottom:12px;"><i data-lucide="check-circle" style="width:14px; height:14px;"></i> Active</div>`;
    let timeStr = new Date(res.orders[0].createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    let bodyHTML = `
      ${statusPill}
      <div style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">Session Started: ${timeStr}</div>
      
      <div style="background:var(--panel-bg); border:1px solid var(--border-color); border-radius:12px; padding:16px; margin-bottom:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:12px; margin-bottom:12px;">
          <span style="font-weight:bold; color:var(--text-primary);">Order #${res.orders[0].orderNumber}</span>
          <span style="color:var(--text-muted); font-size:12px;">${timeStr}</span>
        </div>
        ${res.orders.flatMap(o => o.items).map(item => `
          <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:14px;">
            <span style="color:var(--text-primary);"><span style="color:var(--gold-primary); font-weight:bold; margin-right:8px;">${item.qty}x</span> ${item.name}</span>
            <span style="color:var(--text-muted);">₹${(item.price * item.qty).toFixed(2)}</span>
          </div>
        `).join('')}
        
        <div style="border-top:1px dashed var(--border-color); margin-top:16px; padding-top:16px;">
          <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-muted); margin-bottom:6px;"><span>Subtotal</span><span>₹${res.subtotal.toFixed(2)}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-muted); margin-bottom:12px;"><span>GST (${res.gstPercent}%)</span><span>₹${res.gstAmount.toFixed(2)}</span></div>
          <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:bold; color:var(--text-primary); border-top:1px solid var(--border-color); padding-top:12px;"><span>Grand Total</span><span style="color:var(--gold-primary);">₹${res.grandTotal.toFixed(2)}</span></div>
        </div>
      </div>
    `;

    // Store for change calculator
    window.currentGrandTotal = res.grandTotal;

    body.innerHTML = bodyHTML;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (e) {
    console.error(e);
    body.innerHTML = '<div style="color:var(--red);">Error loading table details.</div>';
  }
}

function closeTableModal() {
  document.getElementById('tableModal').classList.add('hidden');
}

let tableToClose = null;

function closeSession(tableNumber) {
  tableToClose = tableNumber;
  document.getElementById('confirmTableNum').innerText = tableNumber;
  
  // Setup change calculator
  const calcTotal = document.getElementById('calcBillTotal');
  if(calcTotal && window.currentGrandTotal) {
    calcTotal.innerText = '₹' + window.currentGrandTotal.toFixed(2);
  }
  document.getElementById('customerPaid').value = '';
  document.getElementById('changeDue').innerText = '₹0.00';
  document.getElementById('changeDue').style.color = '#10B981';
  document.getElementById('changeCalculator').style.display = 'none';

  // Setup split calculator
  const splitTotal = document.getElementById('splitBillTotal');
  if(splitTotal && window.currentGrandTotal) {
    splitTotal.innerText = '₹' + window.currentGrandTotal.toFixed(2);
  }
  document.getElementById('splitCash').value = '';
  document.getElementById('splitUpi').value = '';
  document.getElementById('splitCard').value = '';
  document.getElementById('splitBalanceLabel').innerText = 'Remaining';
  document.getElementById('splitBalanceValue').innerText = 'Need ₹' + (window.currentGrandTotal || 0).toFixed(2);
  document.getElementById('splitBalanceValue').style.color = '#EF4444';

  const checkedRadio = document.querySelector('input[name="paymentMethod"]:checked');
  if(checkedRadio) checkedRadio.checked = false;
  document.getElementById('splitInputs').style.display = 'none';
  
  document.getElementById('confirmCloseModal').classList.remove('hidden');
}

function closeConfirmModal() {
  document.getElementById('confirmCloseModal').classList.add('hidden');
  tableToClose = null;
}

document.addEventListener('DOMContentLoaded', () => {
  const confirmBtn = document.getElementById('confirmCloseBtn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!tableToClose) return;
      
      const selectedRadio = document.querySelector('input[name="paymentMethod"]:checked');
      if (!selectedRadio) {
        alert('Please select a payment method before closing the session.');
        return;
      }
      let method = selectedRadio.value;
      if (method === 'split') {
        const cash = parseFloat(document.getElementById('splitCash').value) || 0;
        const upi = parseFloat(document.getElementById('splitUpi').value) || 0;
        const card = parseFloat(document.getElementById('splitCard').value) || 0;
        
        if (cash + upi + card === 0) {
          alert('Please enter at least one split amount.');
          return;
        }
        method = `split (Cash: ₹${cash}, UPI: ₹${upi}, Card: ₹${card})`;
      }

      confirmBtn.disabled = true;
      confirmBtn.innerText = 'Processing...';

      try {
        await fetchAPI(`/api/admin/table/${tableToClose}/close-session`, 'POST', { paymentMethod: method });
        closeConfirmModal();
        closeTableModal();
        loadDashboard(); // Refresh UI
        
        // Ensure UI updates if Tables view is open
        if (!document.getElementById('view-tables').classList.contains('hidden')) {
           renderFullTableGrid();
        }
      } catch (err) {
        console.error(err);
        alert('Failed to close session. Make sure the Node server has been restarted to load the new backend changes!');
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerText = 'Done';
      }
    });
  }
});

// QR CODES
async function loadQRCodes() {
  const grid = document.getElementById('qrGrid');
  grid.innerHTML = '';
  
  if (!restaurantSettings) {
    grid.innerHTML = '<div style="color:var(--text-muted);">Loading settings...</div>';
    await loadSettings();
    grid.innerHTML = '';
  }
  
  if (!restaurantSettings) return;


  for (let i = 1; i <= restaurantSettings.totalTables; i++) {
    const card = document.createElement('div');
    card.style.background = 'var(--panel-bg)';
    card.style.padding = '16px';
    card.style.borderRadius = '12px';
    card.style.textAlign = 'center';

    const title = document.createElement('h4');
    title.innerText = `Table ${i}`;
    title.style.marginBottom = '12px';

    const qrContainer = document.createElement('div');
    qrContainer.id = `qr-code-${i}`;
    qrContainer.style.background = 'white';
    qrContainer.style.padding = '10px';
    qrContainer.style.display = 'inline-block';
    qrContainer.style.borderRadius = '8px';
    qrContainer.style.marginBottom = '12px';

    card.appendChild(title);
    card.appendChild(qrContainer);
    
    // Generate QR
    const qrText = `${window.location.origin}/customer/index.html?r=${restaurantId}&t=${i}`;
    setTimeout(() => {
      new QRCode(qrContainer, {
        text: qrText,
        width: 128,
        height: 128,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
      });
    }, 100);

    const btn = document.createElement('button');
    btn.className = 'btn-gold';
    btn.innerText = 'Download QR';
    btn.onclick = () => {
      const img = qrContainer.querySelector('img');
      const canvas = qrContainer.querySelector('canvas');
      let dataUrl = '';
      if (canvas) {
        dataUrl = canvas.toDataURL('image/png');
      } else if (img) {
        dataUrl = img.src;
      }
      
      if (dataUrl) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `table-${i}-qr.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert('QR Code not ready yet. Try again in a moment.');
      }
    };
    card.appendChild(btn);

    grid.appendChild(card);
  }
}

// REVENUE — 4-TAB SYSTEM
let revenueTabChartInstance = null;
let _revenueData = null; // cached revenue data

function switchRevenueTab(tab) {
  const tabs = ['overview', 'analytics', 'daily', 'expenses', 'history'];
  tabs.forEach(t => {
    const btn = document.getElementById(`rev-tab-${t}`);
    const sec = document.getElementById(`rev-section-${t}`);
    if (!btn || !sec) return;
    if (t === tab) {
      btn.style.background = 'var(--primary)';
      btn.style.color = 'white';
      sec.style.display = '';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--text-muted)';
      sec.style.display = 'none';
    }
  });

  if (tab === 'analytics') loadAnalytics();
  if (tab === 'daily') {
    const dMonth = document.getElementById('dailySalesMonth');
    if (dMonth && !dMonth.value) {
      const now = new Date();
      dMonth.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    }
    loadDailySales();
  }
  if (tab === 'expenses') {
    // Set today as default
    const tDate = document.getElementById('tallyDate');
    if (tDate && !tDate.value) tDate.value = new Date().toISOString().split('T')[0];
    const eMonth = document.getElementById('expFilterMonth');
    if (eMonth && !eMonth.value) {
      const now = new Date();
      eMonth.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    }
    renderExpenses();
    renderTally();
  }
  if (tab === 'history') loadHistory();
}

async function loadRevenue() {
  try {
    const data = await fetchAPI('/api/admin/revenue');
    _revenueData = data;

    document.getElementById('revTotal').innerText = `₹${Math.round(data.totalRevenue || 0).toLocaleString('en-IN')}`;
    document.getElementById('revToday').innerText = `₹${Math.round(data.todayRevenue || 0).toLocaleString('en-IN')}`;
    document.getElementById('revWeek').innerText = `₹${Math.round(data.weekRevenue || 0).toLocaleString('en-IN')}`;
    document.getElementById('revMonth').innerText = `₹${Math.round(data.monthRevenue || 0).toLocaleString('en-IN')}`;
    document.getElementById('revOrders').innerText = data.totalOrders || 0;
    document.getElementById('revAvg').innerText = `₹${Math.round(data.avgOrderValue || 0).toLocaleString('en-IN')}`;

    // Payment breakdown
    const pb = data.paymentBreakdown || { cash: 0, upi: 0, card: 0 };
    document.getElementById('revCash').innerText = `₹${Math.round(pb.cash).toLocaleString('en-IN')}`;
    document.getElementById('revUpi').innerText = `₹${Math.round(pb.upi).toLocaleString('en-IN')}`;
    document.getElementById('revCard').innerText = `₹${Math.round(pb.card).toLocaleString('en-IN')}`;

    // Payment bar
    const total = (pb.cash + pb.upi + pb.card) || 1;
    const bar = document.getElementById('revPaymentBar');
    if (bar) {
      const cashPct = (pb.cash / total * 100).toFixed(1);
      const upiPct = (pb.upi / total * 100).toFixed(1);
      const cardPct = (pb.card / total * 100).toFixed(1);
      bar.innerHTML = `
        <div style="flex:${cashPct};background:#10B981;height:100%;border-radius:4px;" title="Cash ${cashPct}%"></div>
        <div style="flex:${upiPct};background:#3B82F6;height:100%;border-radius:4px;" title="UPI ${upiPct}%"></div>
        <div style="flex:${cardPct};background:#8B5CF6;height:100%;border-radius:4px;" title="Card ${cardPct}%"></div>
      `;
    }

    // 7-day bar chart
    const days = data.revenueByDay || [];
    const maxVal = Math.max(...days.map(d => d.revenue), 1);
    const chart = document.getElementById('revBarChart');
    const labels = document.getElementById('revBarLabels');
    if (chart && labels) {
      chart.innerHTML = days.map(d => {
        const h = Math.max(8, (d.revenue / maxVal) * 120);
        const isToday = d.dateString === new Date().toISOString().split('T')[0];
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
          <div style="font-size:10px;color:var(--text-muted);">₹${Math.round(d.revenue)}</div>
          <div style="width:100%;height:${h}px;background:${isToday ? 'var(--gold-primary)' : 'var(--blue)'};border-radius:4px 4px 0 0;opacity:0.85;transition:height 0.5s;"></div>
        </div>`;
      }).join('');
      labels.innerHTML = days.map(d => `<div style="flex:1;text-align:center;font-size:11px;">${d.date}</div>`).join('');
    }

    // Default show overview tab
    switchRevenueTab('overview');

  } catch (err) {
    console.error('Failed to load revenue', err);
  }
}

// ANALYTICS TAB
async function loadAnalytics() {
  try {
    const data = await fetchAPI('/api/admin/analytics');

    // Top Items
    const topEl = document.getElementById('analyticsTopItems');
    if (topEl) {
      if (!data.topItems || data.topItems.length === 0) {
        topEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">No data yet.</div>';
      } else {
        const maxQty = Math.max(...data.topItems.map(i => i.qty), 1);
        topEl.innerHTML = data.topItems.map((item, idx) => `
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:13px;color:var(--text-primary);">${idx+1}. ${item.name}</span>
              <span style="font-size:13px;font-weight:600;color:var(--gold-primary);">${item.qty} sold</span>
            </div>
            <div style="height:6px;background:var(--border-color);border-radius:4px;overflow:hidden;">
              <div style="width:${(item.qty/maxQty*100).toFixed(0)}%;height:100%;background:var(--gold-primary);border-radius:4px;"></div>
            </div>
          </div>
        `).join('');
      }
    }

    // Table Revenue
    const tableEl = document.getElementById('analyticsTableRevenue');
    if (tableEl) {
      if (!data.tableRevenue || data.tableRevenue.length === 0) {
        tableEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">No data yet.</div>';
      } else {
        const maxRev = Math.max(...data.tableRevenue.map(t => t.revenue), 1);
        tableEl.innerHTML = data.tableRevenue.map(t => `
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:13px;color:var(--text-primary);">${t.table}</span>
              <span style="font-size:13px;font-weight:600;color:#3B82F6;">₹${Math.round(t.revenue).toLocaleString('en-IN')} (${t.orders} orders)</span>
            </div>
            <div style="height:6px;background:var(--border-color);border-radius:4px;overflow:hidden;">
              <div style="width:${(t.revenue/maxRev*100).toFixed(0)}%;height:100%;background:#3B82F6;border-radius:4px;"></div>
            </div>
          </div>
        `).join('');
      }
    }

    // Hourly chart
    const hourEl = document.getElementById('analyticsHourly');
    const hourLbl = document.getElementById('analyticsHourlyLabels');
    if (hourEl && data.hourlyOrders) {
      const maxH = Math.max(...data.hourlyOrders, 1);
      hourEl.innerHTML = data.hourlyOrders.map((count, h) => {
        const barH = Math.max(4, (count / maxH) * 80);
        const isPeak = count === maxH && count > 0;
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;" title="${h}:00 — ${count} orders">
          <div style="width:100%;height:${barH}px;background:${isPeak?'#EF4444':'var(--blue)'};border-radius:2px 2px 0 0;opacity:0.8;"></div>
        </div>`;
      }).join('');
      if (hourLbl) {
        hourLbl.innerHTML = data.hourlyOrders.map((_, h) =>
          `<div style="flex:1;text-align:center;font-size:9px;color:var(--text-muted);">${h%3===0?h+'h':''}</div>`
        ).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load analytics', err);
  }
}

// ---- DAILY SALES ----
let _dailySalesData = [];

async function loadDailySales() {
  try {
    const orders = await fetchAPI('/api/admin/history');
    
    // Group by Date string
    const grouped = {};
    orders.forEach(o => {
      const d = new Date(o.createdAt);
      const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!grouped[dateStr]) {
        grouped[dateStr] = {
          date: dateStr,
          displayDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          ordersCount: 0,
          cash: 0,
          upi: 0,
          card: 0,
          total: 0,
          items: {}
        };
      }
      
      grouped[dateStr].total += o.total;
      grouped[dateStr].ordersCount++;
      
      const pm = (o.paymentMethod || 'cash').toLowerCase();
      if (pm.includes('cash')) grouped[dateStr].cash += o.total;
      else if (pm.includes('upi')) grouped[dateStr].upi += o.total;
      else if (pm.includes('card')) grouped[dateStr].card += o.total;
      else grouped[dateStr].cash += o.total;
      
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach(item => {
          if (!grouped[dateStr].items[item.name]) {
            grouped[dateStr].items[item.name] = { qty: 0, revenue: 0 };
          }
          grouped[dateStr].items[item.name].qty += item.quantity;
          grouped[dateStr].items[item.name].revenue += item.price * item.quantity;
        });
      }
    });

    _dailySalesData = Object.values(grouped).sort((a,b) => new Date(b.date) - new Date(a.date));
    renderDailySales();
  } catch(e) {
    console.error('Failed to load daily sales', e);
  }
}

function renderDailySales() {
  const tbody = document.getElementById('dailySalesTableBody');
  if (!tbody) return;
  
  const filterMonth = document.getElementById('dailySalesMonth')?.value;
  let filtered = _dailySalesData;
  if (filterMonth) {
    filtered = filtered.filter(d => d.date.startsWith(filterMonth));
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:16px;text-align:center;color:var(--text-muted);">No sales data for this month.</td></tr>';
    return;
  }
  
  let html = '';
  let sumOrders = 0, sumCash = 0, sumUpi = 0, sumCard = 0, sumTotal = 0;
  
  filtered.forEach(d => {
    sumOrders += d.ordersCount;
    sumCash += d.cash;
    sumUpi += d.upi;
    sumCard += d.card;
    sumTotal += d.total;
    
    html += `
      <tr style="border-bottom:1px solid var(--border-color);">
        <td style="padding:12px;color:var(--text-primary);">${d.displayDate}</td>
        <td style="padding:12px;text-align:center;color:var(--text-secondary);">${d.ordersCount}</td>
        <td style="padding:12px;text-align:right;color:#10B981;">₹${Math.round(d.cash).toLocaleString('en-IN')}</td>
        <td style="padding:12px;text-align:right;color:#3B82F6;">₹${Math.round(d.upi).toLocaleString('en-IN')}</td>
        <td style="padding:12px;text-align:right;color:#8B5CF6;">₹${Math.round(d.card).toLocaleString('en-IN')}</td>
        <td style="padding:12px;text-align:right;color:var(--gold-primary);font-weight:bold;">₹${Math.round(d.total).toLocaleString('en-IN')}</td>
        <td style="padding:12px;text-align:center;"><button class="btn-outline" style="padding:4px 8px;font-size:11px;" onclick="showDailySalesDetails('${d.date}')">Details</button></td>
      </tr>
    `;
  });
  
  html += `
    <tr style="background:rgba(255,255,255,0.02);">
      <td style="padding:16px 12px;font-weight:bold;color:var(--text-primary);">Total</td>
      <td style="padding:16px 12px;text-align:center;font-weight:bold;color:var(--text-primary);">${sumOrders}</td>
      <td style="padding:16px 12px;text-align:right;font-weight:bold;color:#10B981;">₹${Math.round(sumCash).toLocaleString('en-IN')}</td>
      <td style="padding:16px 12px;text-align:right;font-weight:bold;color:#3B82F6;">₹${Math.round(sumUpi).toLocaleString('en-IN')}</td>
      <td style="padding:16px 12px;text-align:right;font-weight:bold;color:#8B5CF6;">₹${Math.round(sumCard).toLocaleString('en-IN')}</td>
      <td style="padding:16px 12px;text-align:right;font-weight:bold;color:var(--gold-primary);">₹${Math.round(sumTotal).toLocaleString('en-IN')}</td>
      <td></td>
    </tr>
  `;
  
  tbody.innerHTML = html;
}

function showDailySalesDetails(dateStr) {
  const dayData = _dailySalesData.find(d => d.date === dateStr);
  if (!dayData) return;
  
  document.getElementById('dailySalesModalTitle').innerText = `Sales Details - ${dayData.displayDate}`;
  
  const tbody = document.getElementById('dailySalesModalBody');
  const items = Object.entries(dayData.items).map(([name, data]) => ({ name, ...data }));
  items.sort((a, b) => b.revenue - a.revenue);
  
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--text-muted);">No item details available.</td></tr>';
  } else {
    tbody.innerHTML = items.map(i => `
      <tr style="border-bottom:1px solid var(--border-color);">
        <td style="padding:8px;color:var(--text-primary);">${i.name}</td>
        <td style="padding:8px;text-align:center;color:var(--text-secondary);">${i.qty}</td>
        <td style="padding:8px;text-align:right;color:var(--gold-primary);font-weight:bold;">₹${Math.round(i.revenue).toLocaleString('en-IN')}</td>
      </tr>
    `).join('');
  }
  
  document.getElementById('dailySalesModal').classList.remove('hidden');
}

// ---- EXPENSES & TALLY ----
function getExpenses() {
  try {
    return JSON.parse(localStorage.getItem('rk_expenses') || '[]');
  } catch { return []; }
}
function saveExpenses(list) {
  localStorage.setItem('rk_expenses', JSON.stringify(list));
}

function addExpense() {
  const date = document.getElementById('expDate').value;
  const cat = document.getElementById('expCategory').value;
  const desc = document.getElementById('expDesc').value.trim();
  const amt = parseFloat(document.getElementById('expAmount').value);

  if (!date) { alert('Please select a date.'); return; }
  if (!amt || amt <= 0) { alert('Please enter a valid amount.'); return; }

  const list = getExpenses();
  list.push({ id: Date.now(), date, category: cat, description: desc, amount: amt });
  saveExpenses(list);

  // Reset inputs
  document.getElementById('expDesc').value = '';
  document.getElementById('expAmount').value = '';

  renderExpenses();
  renderTally();
  alert(`✅ Expense saved: ₹${amt} for ${cat}`);
}

function renderExpenses() {
  const filterMonth = document.getElementById('expFilterMonth')?.value;
  let list = getExpenses().sort((a,b) => new Date(b.date) - new Date(a.date));

  if (filterMonth) {
    list = list.filter(e => e.date && e.date.startsWith(filterMonth));
  }

  const el = document.getElementById('expenseLog');
  if (!el) return;

  if (list.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:24px;font-size:13px;">No expenses for this period.</div>';
    return;
  }

  const total = list.reduce((s,e) => s + e.amount, 0);

  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="border-bottom:1px solid var(--border-color);color:var(--text-muted);">
          <th style="padding:8px;text-align:left;">Date</th>
          <th style="padding:8px;text-align:left;">Category</th>
          <th style="padding:8px;text-align:left;">Description</th>
          <th style="padding:8px;text-align:right;">Amount</th>
          <th style="padding:8px;text-align:right;">Action</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(e => `
          <tr style="border-bottom:1px solid var(--border-color);">
            <td style="padding:8px;color:var(--text-muted);">${e.date}</td>
            <td style="padding:8px;color:var(--text-primary);">${e.category}</td>
            <td style="padding:8px;color:var(--text-muted);">${e.description || '—'}</td>
            <td style="padding:8px;text-align:right;color:#EF4444;font-weight:600;">₹${e.amount.toFixed(2)}</td>
            <td style="padding:8px;text-align:right;">
              <button onclick="deleteExpense(${e.id})" style="background:rgba(239,68,68,0.15);color:#EF4444;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:11px;">Delete</button>
            </td>
          </tr>
        `).join('')}
        <tr>
          <td colspan="3" style="padding:10px 8px;font-weight:700;color:var(--text-primary);">Total Expenses</td>
          <td style="padding:10px 8px;text-align:right;font-weight:700;color:#EF4444;">₹${total.toFixed(2)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;
}

function deleteExpense(id) {
  const list = getExpenses().filter(e => e.id !== id);
  saveExpenses(list);
  renderExpenses();
  renderTally();
}

function clearAllExpenses() {
  if (!confirm('Delete ALL expenses? This cannot be undone.')) return;
  saveExpenses([]);
  renderExpenses();
  renderTally();
}

function renderTally() {
  const date = document.getElementById('tallyDate')?.value;
  const panel = document.getElementById('tallyPanel');
  if (!panel) return;

  const expenses = getExpenses().filter(e => e.date === date);
  const totalExpense = expenses.reduce((s,e) => s + e.amount, 0);

  // Calculate today's revenue from cached data (or 0)
  let dayRevenue = 0;
  if (_revenueData && _revenueData.revenueByDay) {
    const dayData = _revenueData.revenueByDay.find(d => d.dateString === date);
    if (dayData) dayRevenue = dayData.revenue;
    else if (date === new Date().toISOString().split('T')[0]) dayRevenue = _revenueData.todayRevenue || 0;
  }

  const netProfit = dayRevenue - totalExpense;
  const profitColor = netProfit >= 0 ? '#10B981' : '#EF4444';
  const profitLabel = netProfit >= 0 ? '✅ Net Profit' : '⚠️ Net Loss';

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;padding:10px;background:rgba(59,130,246,0.1);border-radius:8px;">
      <span style="color:var(--text-muted);">📥 Revenue</span>
      <span style="color:#3B82F6;font-weight:700;">₹${Math.round(dayRevenue).toLocaleString('en-IN')}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:10px;background:rgba(239,68,68,0.1);border-radius:8px;">
      <span style="color:var(--text-muted);">📤 Expenses (${expenses.length} items)</span>
      <span style="color:#EF4444;font-weight:700;">₹${totalExpense.toFixed(2)}</span>
    </div>
    <div style="border-top:1px dashed var(--border-color);padding-top:10px;display:flex;justify-content:space-between;font-size:16px;font-weight:700;padding:12px;background:rgba(0,0,0,0.05);border-radius:8px;">
      <span style="color:var(--text-primary);">${profitLabel}</span>
      <span style="color:${profitColor};">₹${Math.abs(Math.round(netProfit)).toLocaleString('en-IN')}</span>
    </div>
    ${expenses.length > 0 ? `
    <div style="margin-top:4px;">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Expense Breakdown:</div>
      ${expenses.map(e => `
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border-color);">
          <span style="color:var(--text-muted);">${e.category}${e.description ? ' — '+e.description : ''}</span>
          <span style="color:#EF4444;">₹${e.amount.toFixed(2)}</span>
        </div>
      `).join('')}
    </div>` : '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px;">No expenses logged for this date.</div>'}
  `;
}


// ORDER HISTORY
let allHistorySessions = [];

async function loadHistory() {
  let url = '/api/admin/history';

  try {
    const orders = await fetchAPI(url);
    
    // Group by Session ID
    const grouped = {};
    orders.forEach(o => {
      const sid = o.sessionId || o.id; // fallback to order id if no session
      if (!grouped[sid]) {
        grouped[sid] = {
          sessionId: sid,
          sessionNumber: o.sessionNumber || o.orderNumber,
          tableNumber: o.tableNumber,
          createdAt: o.createdAt,
          paymentMethod: o.paymentMethod || 'cash',
          total: 0,
          subtotal: 0,
          gst: 0,
          tip: 0,
          items: []
        };
      }
      grouped[sid].total += o.total;
      grouped[sid].subtotal += o.subtotal;
      grouped[sid].gst += o.gst;
      grouped[sid].tip += (o.tip || 0);
      
      o.items.forEach(i => {
        const existing = grouped[sid].items.find(xi => xi.name === i.name && xi.price === i.price);
        if (existing) {
          existing.qty += i.qty;
        } else {
          grouped[sid].items.push({...i});
        }
      });
    });
    
    allHistorySessions = Object.values(grouped).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderHistory();
  } catch (err) {
    console.error('Failed to load history', err);
  }
}

function renderHistory() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  const searchInput = document.getElementById('historySearchInput');
  const query = searchInput ? searchInput.value.toLowerCase() : '';
  
  const filteredSessions = allHistorySessions.filter(session => {
    const d = new Date(session.createdAt);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullText = `${dateStr} #${session.sessionNumber} Table ${session.tableNumber} ${session.paymentMethod}`.toLowerCase();
    return fullText.includes(query);
  });

  if (filteredSessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding: 16px; text-align: center; color: var(--text-secondary);">No orders found for your search.</td></tr>';
    return;
  }

  let html = '';
  filteredSessions.forEach((session, index) => {
    const d = new Date(session.createdAt);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    html += `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 12px; color: var(--text-primary);">${dateStr}</td>
        <td style="padding: 12px; color: var(--text-primary);">#${session.sessionNumber}</td>
        <td style="padding: 12px; color: var(--text-primary);">Table ${session.tableNumber}</td>
        <td style="padding: 12px; color: var(--gold-primary); font-weight: bold;">₹${session.total.toFixed(2)}</td>
        <td style="padding: 12px; color: var(--text-secondary); text-transform: capitalize;">${session.paymentMethod || 'cash'}</td>
        <td style="padding: 12px; display: flex; gap: 8px;">
          <button class="btn-gold" style="padding: 6px 12px; font-size: 12px;" onclick="viewHistoryDetails('${session.sessionId}')">View Items</button>
          <button class="btn-gold" style="background:transparent; border:1px solid var(--border-color); color:var(--text-secondary); padding: 6px 8px; display:flex; align-items:center;" onclick="printHistoryBill('${session.sessionId}')" title="Print Bill"><i data-lucide="printer" style="width:14px;height:14px;"></i></button>
        </td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
  setTimeout(() => lucide.createIcons(), 100);
}

function filterHistory() {
  renderHistory();
}

function viewHistoryDetails(sessionId) {
  const session = allHistorySessions.find(s => s.sessionId === sessionId);
  if (!session) return;

  document.getElementById('historyModalTitle').innerText = `Session #${session.sessionNumber} - Table ${session.tableNumber}`;
  
  const container = document.getElementById('historyModalItems');
  let html = '';
  
  session.items.forEach(item => {
    html += `
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding: 12px 0;">
        <div style="color: var(--text-primary);">${item.qty}x ${item.name}</div>
        <div style="color: var(--gold-primary);">₹${(item.price * item.qty).toFixed(2)}</div>
      </div>
    `;
  });
  
  html += `
    <div style="display: flex; justify-content: space-between; margin-top: 16px; font-weight: bold;">
      <div style="color: var(--text-primary);">Subtotal</div>
      <div style="color: var(--text-primary);">₹${session.subtotal.toFixed(2)}</div>
    </div>
    <div style="display: flex; justify-content: space-between; margin-top: 8px;">
      <div style="color: var(--text-secondary);">GST</div>
      <div style="color: var(--text-secondary);">₹${session.gst.toFixed(2)}</div>
    </div>
    <div style="display: flex; justify-content: space-between; margin-top: 8px;">
      <div style="color: var(--text-secondary);">Tip</div>
      <div style="color: var(--text-secondary);">₹${session.tip.toFixed(2)}</div>
    </div>
    <div style="display: flex; justify-content: space-between; margin-top: 16px; font-weight: bold; font-size: 18px; border-top: 1px dashed var(--border-color); padding-top: 16px;">
      <div style="color: var(--gold-primary);">Total Paid</div>
      <div style="color: var(--gold-primary);">₹${session.total.toFixed(2)}</div>
    </div>
  `;
  
  container.innerHTML = html;
  document.getElementById('historyItemsModal').style.display = 'flex';
}

function openPdfModal() {
  document.getElementById('pdfModal').style.display = 'flex';
}

async function generatePDF(range) {
  let startDate = '';
  let endDate = '';
  const d = new Date();
  
  if (range === '1day') {
    d.setDate(d.getDate() - 1);
    startDate = d.toISOString().split('T')[0];
    endDate = new Date().toISOString().split('T')[0];
  } else if (range === '1week') {
    d.setDate(d.getDate() - 7);
    startDate = d.toISOString().split('T')[0];
    endDate = new Date().toISOString().split('T')[0];
  } else if (range === '1month') {
    d.setMonth(d.getMonth() - 1);
    startDate = d.toISOString().split('T')[0];
    endDate = new Date().toISOString().split('T')[0];
  } else if (range === 'custom') {
    startDate = document.getElementById('pdfCustomStart').value;
    endDate = document.getElementById('pdfCustomEnd').value;
    if (!startDate || !endDate) {
      alert("Please select both start and end dates.");
      return;
    }
  }
  
  try {
    document.getElementById('pdfModal').style.display = 'none';
    const url = `/api/admin/history?startDate=${startDate}&endDate=${endDate}`;
    const orders = await fetchAPI(url);
    
    // Group by Session ID
    const grouped = {};
    orders.forEach(o => {
      const sid = o.sessionId || o.id;
      if (!grouped[sid]) {
        grouped[sid] = {
          sessionId: sid,
          sessionNumber: o.sessionNumber || o.orderNumber,
          tableNumber: o.tableNumber,
          createdAt: o.createdAt,
          paymentMethod: o.paymentMethod || 'cash',
          closedByWaiter: o.closedByWaiter || 'Admin',
          total: 0
        };
      }
      grouped[sid].total += o.total;
    });
    
    const sessions = Object.values(grouped).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (!window.jspdf) {
      alert("PDF library not loaded yet.");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Revenue & Order History", 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Date Range: ${startDate} to ${endDate}`, 14, 30);
    
    const totalRev = sessions.reduce((sum, s) => sum + s.total, 0);
    doc.text(`Total Sessions: ${sessions.length} | Total Revenue: Rs. ${totalRev.toFixed(2)}`, 14, 36);

    const tableColumn = ["Date", "Session #", "Table", "Payment", "Waiter", "Amount (Rs.)"];
    const tableRows = [];

    sessions.forEach(session => {
      const sessionDate = new Date(session.createdAt);
      const dateStr = sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const rowData = [
        dateStr,
        session.sessionNumber,
        session.tableNumber,
        session.paymentMethod,
        session.closedByWaiter,
        session.total.toFixed(2)
      ];
      tableRows.push(rowData);
    });

    doc.autoTable({
      startY: 42,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [201, 168, 76] }
    });

    doc.save(`Revenue_Report_${startDate}_to_${endDate}.pdf`);
  } catch(e) {
    console.error(e);
    alert("Failed to generate PDF.");
  }
}

// Init if on dashboard
if (window.location.pathname.includes('dashboard.html')) {
  loadDashboard();
}

// ── WAITER MANAGEMENT ──
async function loadWaiters() {
  // Show restaurant ID (fetch from settings if missing from localStorage)
  let rid = localStorage.getItem('adminRestaurantId');
  if (!rid) {
    try {
      const setRes = await fetchAPI('/api/admin/settings');
      if (setRes && setRes.id) {
        rid = setRes.id;
        localStorage.setItem('adminRestaurantId', rid);
      }
    } catch (e) {}
  }
  const tbody = document.getElementById('waitersTableBody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted);">Loading...</td></tr>';
  try {
    const waiters = await fetchAPI('/api/admin/waiters');
    if (!waiters || !Array.isArray(waiters) || waiters.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">No waiters yet. Click "+ Add Waiter" to create one.</td></tr>';
      return;
    }
    tbody.innerHTML = waiters.map(w => `
      <tr style="border-bottom:1px solid #1f1f1f;">
        <td style="padding:12px 12px; font-weight:600;">${w.name}</td>
        <td style="padding:12px 12px; font-family:monospace; color:var(--gold); font-size:13px;">@${w.username}</td>
        <td style="padding:12px 12px;"><span style="font-size:11px; padding:3px 9px; border-radius:100px; background:${w.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}; color:${w.isActive ? '#22C55E' : '#EF4444'};">${w.isActive ? 'Active' : 'Disabled'}</span></td>
        <td style="padding:12px 12px; color:var(--text-muted); font-size:13px;">${new Date(w.createdAt).toLocaleDateString()}</td>
        <td style="padding:12px 12px; text-align:right;">
          <button onclick="deleteWaiter('${w.id}', '${w.name}')" style="background:rgba(239,68,68,0.12); color:#EF4444; border:1px solid rgba(239,68,68,0.25); border-radius:8px; padding:6px 12px; font-size:12px; cursor:pointer;">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:#EF4444;">Error loading waiters.</td></tr>';
  }
}

function openAddWaiterModal() {
  document.getElementById('newWaiterName').value = '';
  document.getElementById('newWaiterUsername').value = '';
  document.getElementById('newWaiterPassword').value = '';
  document.getElementById('addWaiterModal').classList.remove('hidden');
}

async function addWaiter() {
  const name = document.getElementById('newWaiterName').value.trim();
  const username = document.getElementById('newWaiterUsername').value.trim();
  const password = document.getElementById('newWaiterPassword').value;
  if (!name || !username || !password) { alert('All fields are required.'); return; }
  try {
    const res = await fetchAPI('/api/admin/waiters', 'POST', { name, username, password });
    if (res && res.id) {
      closeModal('addWaiterModal');
      alert(`Waiter "${name}" created! Username: ${username}`);
      loadWaiters();
    } else {
      alert(res?.message || 'Failed to create waiter');
    }
  } catch (e) {
    alert('Error creating waiter');
  }
}

async function deleteWaiter(id, name) {
  if (!confirm(`Delete waiter "${name}"? They will no longer be able to log in.`)) return;
  try {
    await fetchAPI(`/api/admin/waiters/${id}`, 'DELETE');
    loadWaiters();
  } catch (e) {
    alert('Error deleting waiter');
  }
}

function copyRestaurantId() {
  const rid = localStorage.getItem('adminRestaurantId');
  if (!rid) return;
  navigator.clipboard.writeText(rid).then(() => alert('Restaurant ID copied to clipboard!\n\n' + rid));
}

// ── ADMIN PRINT BILL ──
async function adminPrintBill(tableNumber) {
  const modal = document.getElementById('adminBillModal');
  const content = document.getElementById('adminBillContent');
  
  // Extract payment method from UI
  const selectedRadio = document.querySelector('input[name="paymentMethod"]:checked');
  let paymentText = 'Not Specified';
  if (selectedRadio) {
    if (selectedRadio.value === 'split') {
       const cash = parseFloat(document.getElementById('splitCash').value) || 0;
       const upi = parseFloat(document.getElementById('splitUpi').value) || 0;
       const card = parseFloat(document.getElementById('splitCard').value) || 0;
       paymentText = `Split (Cash: ₹${cash}, UPI: ₹${upi}, Card: ₹${card})`;
    } else {
       paymentText = 'Full ' + selectedRadio.value.charAt(0).toUpperCase() + selectedRadio.value.slice(1);
    }
  }

  content.innerHTML = '<p style="text-align:center;padding:20px;color:#555;">Generating bill...</p>';
  modal.classList.remove('hidden');

  try {
    const bill = await fetchAPI(`/api/admin/table/${tableNumber}/bill`);
    if (!bill || bill.message) {
      content.innerHTML = `<p style="color:#c00;padding:20px;">${bill?.message || 'No active orders for this table.'}</p>`;
      return;
    }

    const now = new Date(bill.generatedAt);
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // Flatten items
    const allItems = [];
    bill.orders.forEach(o => {
      o.items.forEach(item => {
        const ex = allItems.find(i => i.name === item.name && i.price === item.price);
        if (ex) { ex.qty += item.qty; ex.total += item.price * item.qty; }
        else allItems.push({ name: item.name, price: item.price, qty: item.qty, total: item.price * item.qty });
      });
    });

    content.innerHTML = `
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:18px;font-weight:bold;">${bill.restaurant.name}</div>
        ${bill.restaurant.address ? `<div style="font-size:11px;color:#555;">${bill.restaurant.address}</div>` : ''}
      </div>
      <hr style="border-top:1px dashed #aaa;margin:10px 0;">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span>Date:</span><span>${dateStr}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span>Time:</span><span>${timeStr}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span>Table:</span><span>No. ${bill.tableNumber}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span>Orders:</span><span>${bill.orders.map(o => '#' + o.orderNumber).join(', ')}</span></div>
      <hr style="border-top:1px dashed #aaa;margin:10px 0;">
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:12px;border-top:1px dashed #aaa;border-bottom:1px dashed #aaa;padding:4px 0;margin:8px 0;">
        <span style="flex:1;">Item</span><span style="width:30px;text-align:center;">Qty</span><span style="width:70px;text-align:right;">Amount</span>
      </div>
      ${allItems.map(item => `
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;">
          <span style="flex:1;">${item.name}</span>
          <span style="width:30px;text-align:center;">${item.qty}</span>
          <span style="width:70px;text-align:right;">₹${item.total.toFixed(2)}</span>
        </div>
      `).join('')}
      <hr style="border-top:1px dashed #aaa;margin:10px 0;">
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:2px 0;"><span>Subtotal</span><span>₹${bill.subtotal.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:2px 0;"><span>GST (${bill.gstPercent}%)</span><span>₹${bill.gstAmount.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;padding:2px 0;"><span>Tip</span><span>₹${(bill.totalTip || 0).toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;border-top:2px solid #111;border-bottom:2px solid #111;padding:6px 0;margin-top:4px;"><span>GRAND TOTAL</span><span>₹${bill.grandTotal.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;"><span>Payment Mode:</span><span style="font-weight:bold;">${paymentText}</span></div>
      <div style="text-align:center;margin-top:16px;font-size:11px;color:#777;">
        Thank you for dining with us!<br>Please visit again — ${bill.restaurant.name}
      </div>
    `;
  } catch (e) {
    content.innerHTML = '<p style="color:#c00;padding:20px;">Error generating bill.</p>';
  }
}

// PRINT KOT
function printKOT(orderId) {
  const printWindow = window.open('', '_blank', 'width=300,height=600');
  printWindow.document.write('<html><body><div style="font-family:monospace; padding:20px;">Fetching order details to print...</div></body></html>');
  
  fetchAPI('/api/admin/orders').then(orders => {
    const o = orders.find(or => or.id === orderId);
    if (!o) return;
    
    let itemsHtml = o.items.map(i => `
      <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:14px;">
        <div><b>${i.qty}x</b> ${i.name}</div>
      </div>
      ${i.specialNote ? `<div style="font-size:12px; font-style:italic; margin-left:20px; margin-bottom:8px;">Note: ${i.specialNote}</div>` : ''}
    `).join('');
    
    printWindow.document.body.innerHTML = `
        <h2 style="text-align:center; margin:0 0 10px 0;">KITCHEN TICKET</h2>
        <div style="border-bottom:1px dashed #000; margin-bottom:10px; padding-bottom:10px; font-family:monospace;">
          <div><b>Table: ${o.tableNumber}</b></div>
          <div>Order: #${o.orderNumber}</div>
          <div>Time: ${new Date(o.createdAt).toLocaleTimeString()}</div>
        </div>
        <div style="font-family:monospace;">${itemsHtml}</div>
        <div style="border-top:1px dashed #000; margin-top:10px; padding-top:10px; text-align:center; font-family:monospace;">
          *** END OF KOT ***
        </div>
    `;
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  });
}

// ── QR DISPLAY LOGIC ──
function showAdminQr() {
  if (restaurantSettings && restaurantSettings.paymentQrCode) {
    document.getElementById('qrDisplayImage').src = restaurantSettings.paymentQrCode;
    document.getElementById('qrDisplayModal').classList.remove('hidden');
  } else {
    alert('No QR Code configured in settings.');
  }
}

// ── PRINT PAST BILL ──
function printHistoryBill(sessionId) {
  const session = allHistorySessions.find(s => s.sessionId === sessionId);
  if (!session) return;
  
  const printWindow = window.open('', '_blank', 'width=350,height=600');
  
  const d = new Date(session.createdAt);
  const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  
  let itemsHtml = session.items.map(item => `
    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
      <span style="flex:1;">${item.qty}x ${item.name}</span>
      <span style="width:70px;text-align:right;">₹${(item.price * item.qty).toFixed(2)}</span>
    </div>
    ${item.specialNote ? `<div style="font-size:11px;font-style:italic;margin-left:20px;">Note: ${item.specialNote}</div>` : ''}
  `).join('');
  
  printWindow.document.write(`
    <html>
      <body style="font-family:'Courier New', monospace; padding:20px; color:#000;">
        <h2 style="text-align:center; margin:0 0 10px 0;">PAST BILL</h2>
        <div style="border-bottom:1px dashed #000; margin-bottom:10px; padding-bottom:10px; font-size:12px;">
          <div style="display:flex;justify-content:space-between;"><span>Date:</span><span>${dateStr}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Time:</span><span>${timeStr}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Table:</span><span>No. ${session.tableNumber}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Session:</span><span>#${session.sessionNumber}</span></div>
          <div style="display:flex;justify-content:space-between;text-transform:capitalize;"><span>Payment:</span><span>${session.paymentMethod}</span></div>
        </div>
        
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:12px;border-bottom:1px dashed #000;padding-bottom:4px;margin-bottom:8px;">
          <span style="flex:1;">Item</span><span style="width:70px;text-align:right;">Amount</span>
        </div>
        
        ${itemsHtml}
        
        <div style="border-top:1px dashed #000; margin-top:10px; padding-top:10px; font-size:12px;">
          <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><span>₹${session.subtotal.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>GST:</span><span>₹${session.gst.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Tip:</span><span>₹${session.tip.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between; font-weight:bold; font-size:16px; margin-top:8px;"><span>TOTAL:</span><span>₹${session.total.toFixed(2)}</span></div>
        </div>
        
        <div style="text-align:center; margin-top:20px; font-size:11px; color:#555;">
          *** END OF BILL ***
        </div>
      </body>
    </html>
  `);
  
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
}

// GLOBAL SEARCH
function handleGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  if (!input) return;
  const query = input.value.toLowerCase();
  
  const currentViewTitle = document.getElementById('currentViewTitle');
  if (!currentViewTitle) return;
  const currentView = currentViewTitle.innerText.toLowerCase();
  
  if (currentView === 'orders') {
    const cards = document.querySelectorAll('#ordersGrid .panel');
    cards.forEach(card => {
      if (card.innerText.toLowerCase().includes(query)) card.style.display = 'block';
      else card.style.display = 'none';
    });
  } else if (currentView === 'menu items') {
    const rows = document.querySelectorAll('#menuContainer tbody tr');
    rows.forEach(row => {
      if (row.innerText.toLowerCase().includes(query)) row.style.display = 'table-row';
      else row.style.display = 'none';
    });
  }
}
