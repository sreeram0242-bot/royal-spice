const BASE_URL = '';
const token = localStorage.getItem('masterToken');

if (!token && !window.location.pathname.includes('index.html')) {
  window.location.href = 'index.html';
}

function logout() {
  localStorage.removeItem('masterToken');
  window.location.href = 'index.html';
}

function showView(viewId) {
  document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
  document.getElementById('view-' + viewId).classList.remove('hidden');
  
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');

  const titles = {
    'dashboard': 'Dashboard',
    'restaurants': 'Restaurants',
    'complaints': 'Complaints',
    'revenue': 'Platform Revenue'
  };
  document.getElementById('currentViewTitle').innerText = titles[viewId];

  if (viewId === 'dashboard') loadDashboard();
  if (viewId === 'restaurants') loadRestaurants();
  if (viewId === 'complaints') loadComplaints();
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
  return res.json();
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// DASHBOARD & RESTAURANTS
let platformChart = null;
async function loadDashboard() {
  const stats = await fetchAPI('/api/master/dashboard-stats');
  
  document.getElementById('statOrders').innerText = stats.totalOrders;
  document.getElementById('statRev').innerText = '₹' + stats.totalRevenue.toFixed(2);
  document.getElementById('statActive').innerText = stats.activeRestaurants;
  document.getElementById('statSuspended').innerText = stats.pendingComplaints;

  const ctx = document.getElementById('platformRevenueChart');
  if (ctx) {
    if (platformChart) platformChart.destroy();
    const labels = Object.keys(stats.chartData).sort();
    const data = labels.map(l => stats.chartData[l]);
    
    platformChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Platform Revenue',
          data: data,
          borderColor: '#C9A84C',
          backgroundColor: 'rgba(201, 168, 76, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#333' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  const tbody = document.querySelector('#recentRestaurantsTable tbody');
  if (tbody) {
    tbody.innerHTML = '';
    stats.recentRestaurants.forEach(r => {
      tbody.innerHTML += `<tr>
        <td>${r.name}</td>
        <td>${new Date(r.createdAt).toLocaleDateString()}</td>
      </tr>`;
    });
  }
}

async function loadRestaurants() {
  const data = await fetchAPI('/api/master/restaurants');
  const tbody = document.querySelector('#restTable tbody');
  tbody.innerHTML = '';
  
  data.forEach(r => {
    const statusLabel = r.isActive ? (r.plan === 'trial' ? 'Trial' : 'Active') : 'Suspended';
    const statusClass = r.isActive ? (r.plan === 'trial' ? 'trial' : 'active') : 'suspended';
    
    tbody.innerHTML += `
      <tr>
        <td style="font-weight: bold;">${r.name}</td>
        <td>${new Date(r.createdAt).toLocaleDateString()}</td>
        <td>${r.plan.toUpperCase()}</td>
        <td><span class="status ${statusClass}">${statusLabel}</span></td>
        <td style="display: flex; gap: 8px;">
          <button class="btn-gold" style="padding: 4px 8px; font-size: 12px; background: #333; color: white;" onclick="viewRestaurant('${r.id}')">View</button>
          <button class="btn-outline" style="padding: 4px 8px; font-size: 12px;" onclick="toggleStatus('${r.id}', ${!r.isActive})">
            ${r.isActive ? 'Suspend' : 'Restore'}
          </button>
          <button class="btn-gold" style="padding: 4px 8px; font-size: 12px;" onclick="openNotifyModal('${r.id}')">Notify</button>
        </td>
      </tr>
    `;
  });
}

function openAddRestaurantModal() {
  document.getElementById('addRestModal').classList.remove('hidden');
}

async function createRestaurant() {
  const payload = {
    name: document.getElementById('newRestName').value,
    address: document.getElementById('newRestAddress').value,
    plan: document.getElementById('newRestPlan').value,
    trialDays: parseInt(document.getElementById('newRestTrial').value) || 14,
    adminUsername: document.getElementById('newRestUsername').value,
    adminPassword: document.getElementById('newRestPassword').value
  };

  try {
    const res = await fetchAPI('/api/master/restaurants', 'POST', payload);
    if (res.message === 'Restaurant created successfully') {
      alert('Restaurant Created!');
      closeModal('addRestModal');
      loadRestaurants();
      loadDashboard();
    } else {
      alert(res.message);
    }
  } catch (err) {
    console.error(err);
  }
}

async function toggleStatus(id, isActive) {
  if (confirm(`Are you sure you want to ${isActive ? 'restore' : 'suspend'} this restaurant?`)) {
    await fetchAPI(`/api/master/restaurants/${id}/status`, 'PUT', { isActive });
    loadRestaurants();
    loadDashboard();
  }
}

// RESTAURANT MANAGEMENT
async function viewRestaurant(id) {
  const data = await fetchAPI(`/api/master/restaurants/${id}/stats`);
  const r = data.restaurant;
  
  document.getElementById('manageRestId').value = r.id;
  document.getElementById('manageStatOrders').innerText = data.totalOrders;
  document.getElementById('manageStatRev').innerText = '₹' + data.totalRevenue.toFixed(2);
  
  document.getElementById('manageName').value = r.name;
  document.getElementById('managePlan').value = r.plan;
  document.getElementById('manageTrialDays').value = r.trialDays || 14;
  
  if (r.subscriptionExpiry) {
    document.getElementById('manageExpiry').value = new Date(r.subscriptionExpiry).toISOString().split('T')[0];
  } else {
    document.getElementById('manageExpiry').value = '';
  }
  
  document.getElementById('manageModal').classList.remove('hidden');
}

async function saveRestaurantDetails() {
  const id = document.getElementById('manageRestId').value;
  const name = document.getElementById('manageName').value;
  const plan = document.getElementById('managePlan').value;
  const trialDays = document.getElementById('manageTrialDays').value;
  const expiry = document.getElementById('manageExpiry').value;
  
  await fetchAPI(`/api/master/restaurants/${id}`, 'PUT', {
    name,
    plan,
    trialDays,
    subscriptionExpiry: expiry ? expiry : null
  });
  
  alert('Restaurant details updated successfully!');
  closeModal('manageModal');
  loadRestaurants();
}


// NOTIFICATIONS
let currentNotifyId = null;
function openNotifyModal(id) {
  currentNotifyId = id;
  document.getElementById('notifyModal').classList.remove('hidden');
}
async function sendNotification() {
  const message = document.getElementById('notifyText').value;
  await fetchAPI('/api/master/notify', 'POST', { restaurantId: currentNotifyId, message });
  alert('Notification sent!');
  closeModal('notifyModal');
  document.getElementById('notifyText').value = '';
}

// COMPLAINTS
let currentReplyId = null;
async function loadComplaints() {
  const data = await fetchAPI('/api/master/complaints');
  const tbody = document.querySelector('#compTable tbody');
  tbody.innerHTML = '';
  
  data.forEach(c => {
    tbody.innerHTML += `
      <tr>
        <td>${c.restaurantId.name}</td>
        <td>${c.message}</td>
        <td>${new Date(c.createdAt).toLocaleDateString()}</td>
        <td><span class="status ${c.status === 'pending' ? 'suspended' : 'active'}">${c.status.toUpperCase()}</span></td>
        <td>
          ${c.status === 'pending' ? `<button class="btn-gold" style="padding: 4px 8px; font-size: 12px;" onclick="openReplyModal('${c.id}', '${c.message}')">Reply</button>` : 'Replied'}
        </td>
      </tr>
    `;
  });
}

function openReplyModal(id, msg) {
  currentReplyId = id;
  document.getElementById('replyCompMsg').innerText = `"${msg}"`;
  document.getElementById('replyModal').classList.remove('hidden');
}

async function sendReply() {
  const reply = document.getElementById('replyText').value;
  await fetchAPI(`/api/master/complaints/${currentReplyId}/reply`, 'PUT', { reply });
  alert('Reply sent!');
  closeModal('replyModal');
  document.getElementById('replyText').value = '';
  loadComplaints();
}

// NEW FEATURES
function exportRestaurantsCSV() {
  const rows = [['Name', 'Date Added', 'Plan', 'Status']];
  const trs = document.querySelectorAll('#restTable tbody tr');
  trs.forEach(tr => {
    if(tr.style.display !== 'none') {
      const tds = tr.querySelectorAll('td');
      if (tds.length >= 4) {
        rows.push([
          tds[0].innerText,
          tds[1].innerText,
          tds[2].innerText,
          tds[3].innerText
        ]);
      }
    }
  });
  
  const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "restaurants_export.csv");
  document.body.appendChild(link);
  link.click();
}

function handleGlobalSearch() {
  const query = document.getElementById('globalSearch').value.toLowerCase();
  
  if (!document.getElementById('view-restaurants').classList.contains('hidden')) {
    const trs = document.querySelectorAll('#restTable tbody tr');
    trs.forEach(tr => {
      const name = tr.querySelector('td').innerText.toLowerCase();
      tr.style.display = name.includes(query) ? '' : 'none';
    });
  }
}

function openGlobalBroadcastModal() {
  document.getElementById('globalBroadcastModal').classList.remove('hidden');
}

async function sendGlobalBroadcast() {
  const message = document.getElementById('globalBroadcastText').value;
  await fetchAPI('/api/master/broadcast', 'POST', { message });
  alert('Global Broadcast sent successfully!');
  closeModal('globalBroadcastModal');
  document.getElementById('globalBroadcastText').value = '';
}

// Init
if (window.location.pathname.includes('dashboard.html')) {
  loadDashboard();
}
