const BASE_URL = '';
const token = localStorage.getItem('adminToken');
const restaurantId = localStorage.getItem('adminRestaurantId');

if (!token && !window.location.pathname.includes('index.html')) {
  window.location.href = 'index.html';
}

const socket = typeof io !== 'undefined' ? io(BASE_URL) : null;

if (socket && restaurantId) {
  socket.on('connect', () => {
    socket.emit('join_restaurant', restaurantId);
  });

  socket.on('new_order', (order) => {
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
  }
}

async function saveSettings() {
  const name = document.getElementById('setRestName').value;
  const address = document.getElementById('setRestAddress').value;
  const gstPercent = document.getElementById('setRestGst').value;
  await fetchAPI('/api/admin/settings', 'PUT', { name, address, gstPercent });
  alert('Settings saved');
  loadSettings();
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

  document.getElementById('dashRev').innerText = `₹${totalRev}`;
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
  pendingOrders.slice(0, 5).forEach(o => {
    tbody.innerHTML += `
      <tr onclick="showView('orders');" style="cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#222'" onmouseout="this.style.background='transparent'">
        <td><div class="table-pill" style="padding: 4px; border-radius: 4px; width: 60px; font-size: 12px; background: ${o.status === 'new' ? 'var(--blue)' : 'var(--orange)'}; color: ${o.status === 'new' ? 'white' : 'black'};">Table ${o.tableNumber}</div></td>
        <td>#${o.orderNumber}</td>
        <td>${new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
        <td>${o.items.length} items</td>
        <td>₹${o.total}</td>
        <td><span class="status ${o.status}">${o.status.toUpperCase()}</span></td>
      </tr>
    `;
  });

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
  
  filteredOrders.forEach(o => {
    let actionBtn = '';
    if (o.status === 'new') {
      actionBtn = `<button class="btn-gold" style="width: 100%;" onclick="updateOrderStatus('${o.id}', 'preparing')">Receive (Start Preparing)</button>`;
    } else if (o.status === 'preparing') {
      actionBtn = `<button class="btn-gold" style="width: 100%; background: var(--green); color: black;" onclick="updateOrderStatus('${o.id}', 'ready')">Mark Ready</button>`;
    } else if (o.status === 'ready') {
      actionBtn = `<button class="btn-gold" style="width: 100%; background: #555; color: white;" onclick="updateOrderStatus('${o.id}', 'served')">Mark Served</button>`;
    } else {
      actionBtn = `<button class="btn-gold" style="width: 100%; background: transparent; border: 1px solid #555; color: white;" disabled>Completed</button>`;
    }

    let itemsHtml = o.items.map(i => `
      <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
        <div><span style="color: var(--gold); font-weight: bold; margin-right: 8px;">${i.qty}x</span>${i.name}</div>
        <div style="color: var(--text-muted);">₹${i.price * i.qty}</div>
      </div>
    `).join('');

    grid.innerHTML += `
      <div class="panel" style="padding: 20px; border: 1px solid #333; position: relative; border-radius: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid #333; padding-bottom: 16px;">
          <div>
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Order Number</div>
            <div style="font-size: 22px; font-weight: bold; margin-bottom: 6px;">#${o.orderNumber}</div>
            <span class="status ${o.status}">${o.status.toUpperCase()}</span>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Table</div>
            <div style="font-size: 24px; font-weight: bold; color: var(--gold);">${o.tableNumber}</div>
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
        
        <div>
          ${actionBtn}
        </div>
      </div>
    `;
  });
}

async function updateOrderStatus(id, status) {
  await fetchAPI(`/api/admin/orders/${id}/status`, 'PUT', { status });
  loadOrders();
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
    headerDiv.style.background = 'rgba(255, 255, 255, 0.05)';
    headerDiv.style.borderBottom = '1px solid var(--border-color)';
    headerDiv.style.display = 'flex';
    headerDiv.style.justifyContent = 'space-between';
    headerDiv.style.alignItems = 'center';
    
    const titleSection = document.createElement('div');
    titleSection.style.display = 'flex';
    titleSection.style.alignItems = 'center';
    titleSection.style.gap = '12px';
    
    let defaultImg = `https://ui-avatars.com/api/?name=${encodeURIComponent(cat)}&background=random`;
    if (cat.toLowerCase() === 'all') defaultImg = 'images/cat_all.png';
    else if (cat.toLowerCase().includes('breakfast')) defaultImg = 'images/cat_breakfast.png';
    else if (cat.toLowerCase().includes('meal')) defaultImg = 'images/cat_meals.png';
    else if (cat.toLowerCase().includes('starter')) defaultImg = 'images/cat_starters.png';

    const img = document.createElement('img');
    img.src = (setting && setting.image) ? setting.image : defaultImg;
    img.onerror = function() { this.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'; };
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
            <th style="text-align: right; padding: 12px 8px; color: var(--text-muted); font-weight: normal; font-size: 14px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(m => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 12px 8px;"><img src="${m.image || 'https://via.placeholder.com/40'}" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;"></td>
              <td style="padding: 12px 8px; color: white;">${m.name}</td>
              <td style="padding: 12px 8px; color: white;">₹${m.price}</td>
              <td style="padding: 12px 8px; color: white;">${m.isVeg ? 'Veg' : 'Non-Veg'}</td>
              <td style="padding: 12px 8px; text-align: right;">
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

function compressImageBase64(base64Str, maxWidth = 800, maxHeight = 800) {
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
      
      resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress as JPEG with 70% quality
    };
  });
}

function handleImageUpload(event, previewId) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async function(e) {
    let base64 = e.target.result;
    
    // Compress image if it's large to prevent UI lag
    if (base64.length > 500000) {
      base64 = await compressImageBase64(base64);
    }

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
    card.style.background = 'rgba(255, 255, 255, 0.05)';
    card.style.padding = '20px';
    card.style.borderRadius = '12px';
    card.style.textAlign = 'center';
    card.style.border = '1px solid var(--border-color)';
    
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
    let defaultImg = `https://via.placeholder.com/120?text=${encodeURIComponent(cat)}`;
    if (cat.toLowerCase() === 'all') defaultImg = '/customer/images/cat_all.png';
    else if (cat.toLowerCase().includes('breakfast')) defaultImg = '/customer/images/cat_breakfast.png';
    else if (cat.toLowerCase().includes('meal')) defaultImg = '/customer/images/cat_meals.png';
    else if (cat.toLowerCase().includes('starter')) defaultImg = '/customer/images/cat_starters.png';
    else if (cat.toLowerCase().includes('bread') || cat.toLowerCase().includes('roti')) defaultImg = '/customer/images/cat_breads.png';
    else if (cat.toLowerCase().includes('gravy') || cat.toLowerCase().includes('curry')) defaultImg = '/customer/images/cat_gravies.png';
    else if (cat.toLowerCase().includes('bev') || cat.toLowerCase().includes('drink')) defaultImg = '/customer/images/cat_beverages.png';
    else if (cat.toLowerCase().includes('dessert') || cat.toLowerCase().includes('sweet')) defaultImg = '/customer/images/cat_desserts.png';

    img.src = setting?.image || defaultImg;
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
        // Compress image to fix lag
        if (base64.length > 500000) {
          base64 = await compressImageBase64(base64);
        }
        
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
    changeBtn.className = 'btn-primary';
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
function renderFullTableGrid(total) {
  const grid = document.getElementById('fullTableGrid');
  grid.innerHTML = '';
  for (let i = 1; i <= total; i++) {
    grid.innerHTML += `<div class="table-pill available" style="height: 100px; display: flex; align-items: center; justify-content: center; font-size: 20px;">T${i.toString().padStart(2, '0')}</div>`;
  }
}

// QR CODES
function loadQRCodes() {
  const grid = document.getElementById('qrGrid');
  grid.innerHTML = '';
  
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

// REVENUE
let revenueChartInstance = null;

async function loadRevenue() {
  try {
    const data = await fetchAPI('/api/admin/revenue');
    
    document.getElementById('revTotal').innerText = `₹${data.totalRevenue}`;
    document.getElementById('revToday').innerText = `₹${data.todayRevenue}`;
    document.getElementById('revOrders').innerText = data.totalOrders;

    // Load history when revenue tab is opened
    loadHistory();

    const ctx = document.getElementById('revenueChart').getContext('2d');
    
    if (revenueChartInstance) {
      revenueChartInstance.destroy();
    }

    // data.revenueByDay is ordered from 6 days ago to today.
    const labels = data.revenueByDay.map(d => d.date);
    const chartData = data.revenueByDay.map(d => d.revenue);

    revenueChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Revenue (₹)',
          data: chartData,
          backgroundColor: '#F4A017',
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });

  } catch (err) {
    console.error('Failed to load revenue', err);
  }
}

// ORDER HISTORY
let allHistoryOrders = [];

async function loadHistory() {
  const startDate = document.getElementById('historyStartDate').value;
  const endDate = document.getElementById('historyEndDate').value;
  
  let url = '/api/admin/history';
  if (startDate && endDate) {
    url += `?startDate=${startDate}&endDate=${endDate}`;
  } else if (!startDate && !endDate) {
    // Default to last 7 days if no dates selected
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const start = d.toISOString().split('T')[0];
    const end = new Date().toISOString().split('T')[0];
    url += `?startDate=${start}&endDate=${end}`;
    
    document.getElementById('historyStartDate').value = start;
    document.getElementById('historyEndDate').value = end;
  }

  try {
    allHistoryOrders = await fetchAPI(url);
    renderHistory();
  } catch (err) {
    console.error('Failed to load history', err);
  }
}

function renderHistory() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  if (allHistoryOrders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding: 16px; text-align: center; color: var(--text-secondary);">No orders found for this date range.</td></tr>';
    return;
  }

  let html = '';
  allHistoryOrders.forEach((order, index) => {
    const d = new Date(order.createdAt);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    html += `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 12px; color: var(--text-primary);">${dateStr}</td>
        <td style="padding: 12px; color: var(--text-primary);">#${order.orderNumber}</td>
        <td style="padding: 12px; color: var(--text-primary);">Table ${order.tableNumber}</td>
        <td style="padding: 12px; color: var(--gold-primary); font-weight: bold;">₹${order.total}</td>
        <td style="padding: 12px;">
          <button class="btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="viewHistoryDetails(${index})">View Items</button>
        </td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
}

function viewHistoryDetails(index) {
  const order = allHistoryOrders[index];
  if (!order) return;

  document.getElementById('historyModalTitle').innerText = `Order #${order.orderNumber} - Table ${order.tableNumber}`;
  
  const container = document.getElementById('historyModalItems');
  let html = '';
  
  order.items.forEach(item => {
    html += `
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding: 12px 0;">
        <div style="color: var(--text-primary);">${item.qty}x ${item.name}</div>
        <div style="color: var(--gold-primary);">₹${item.price * item.qty}</div>
      </div>
    `;
  });
  
  html += `
    <div style="display: flex; justify-content: space-between; margin-top: 16px; font-weight: bold;">
      <div style="color: var(--text-primary);">Subtotal</div>
      <div style="color: var(--text-primary);">₹${order.subtotal}</div>
    </div>
    <div style="display: flex; justify-content: space-between; margin-top: 8px;">
      <div style="color: var(--text-secondary);">GST</div>
      <div style="color: var(--text-secondary);">₹${order.gst}</div>
    </div>
    <div style="display: flex; justify-content: space-between; margin-top: 16px; font-weight: bold; font-size: 18px; border-top: 1px dashed var(--border-color); padding-top: 16px;">
      <div style="color: var(--gold-primary);">Total Paid</div>
      <div style="color: var(--gold-primary);">₹${order.total}</div>
    </div>
  `;
  
  container.innerHTML = html;
  document.getElementById('historyItemsModal').style.display = 'flex';
}

// Init if on dashboard
if (window.location.pathname.includes('dashboard.html')) {
  loadDashboard();
}
