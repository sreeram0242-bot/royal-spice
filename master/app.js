const BASE_URL = '';
const token = localStorage.getItem('masterToken');

if (!token && !window.location.pathname.includes('index.html')) {
  window.location.href = 'index.html';
}

function logout() {
  localStorage.removeItem('masterToken');
  window.location.href = 'index.html';
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

function showView(viewId) {
  document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
  document.getElementById('view-' + viewId).classList.remove('hidden');
  
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');

  const titles = {
    'dashboard': 'Dashboard',
    'restaurants': 'Restaurants',
    'complaints': 'Complaints',
    'revenue': 'Platform Revenue',
    'subscriptions': '💳 Subscriptions',
    'analytics': '📊 Platform Analytics',
    'announcements': '📢 Announcements',
    'activity': '📋 Activity Log',
    'notes': '📓 Admin Notes',
    'backup': '🗄️ Backup & Export',
    'support': '🎧 Support Center',
    'settings': '⚙️ Platform Settings'
  };
  document.getElementById('currentViewTitle').innerText = titles[viewId] || viewId;

  if (viewId === 'dashboard') loadDashboard();
  if (viewId === 'restaurants') loadRestaurants();
  if (viewId === 'complaints') loadComplaints();
  if (viewId === 'subscriptions') loadSubscriptions();
  if (viewId === 'analytics') loadPlatformAnalytics();
  if (viewId === 'notes') renderNotes();
  if (viewId === 'activity') renderActivityLog();
  if (viewId === 'announcements') renderAnnouncements();
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

// ══════════════════════════════════════════
// 1. SUBSCRIPTIONS
// ══════════════════════════════════════════
async function loadSubscriptions() {
  const data = await fetchAPI('/api/master/restaurants');
  const now = new Date();
  const in7 = new Date(); in7.setDate(now.getDate() + 7);

  let monthly = 0, trial = 0, expiring = 0, suspended = 0;
  const filter = document.getElementById('subFilterPlan')?.value;

  const tbody = document.querySelector('#subscriptionTable tbody');
  tbody.innerHTML = '';

  data.forEach(r => {
    if (filter && r.plan !== filter) return;
    if (!r.isActive) suspended++;
    else if (r.plan === 'trial') trial++;
    else monthly++;

    if (r.subscriptionExpiry) {
      const exp = new Date(r.subscriptionExpiry);
      if (exp > now && exp <= in7) expiring++;
    }

    const expText = r.subscriptionExpiry
      ? new Date(r.subscriptionExpiry).toLocaleDateString()
      : r.plan === 'trial' ? `Trial (${r.trialDays || 14} days)` : 'No Expiry';

    const statusLabel = r.isActive ? (r.plan === 'trial' ? 'Trial' : 'Active') : 'Suspended';
    const statusClass = r.isActive ? (r.plan === 'trial' ? 'trial' : 'active') : 'suspended';

    tbody.innerHTML += `
      <tr>
        <td style="font-weight:600;">${r.name}</td>
        <td>${r.plan.toUpperCase()}</td>
        <td><span class="status ${statusClass}">${statusLabel}</span></td>
        <td style="color:var(--text-muted);">${expText}</td>
        <td><button class="btn-gold" style="padding:4px 8px;font-size:12px;" onclick="viewRestaurant('${r.id}')">Manage</button></td>
      </tr>
    `;
  });

  document.getElementById('subCountMonthly').innerText = monthly;
  document.getElementById('subCountTrial').innerText = trial;
  document.getElementById('subCountExpiring').innerText = expiring;
  document.getElementById('subCountSuspended').innerText = suspended;
}

// ══════════════════════════════════════════
// 2. PLATFORM ANALYTICS
// ══════════════════════════════════════════
let planDistChartInstance = null;
async function loadPlatformAnalytics() {
  try {
    const stats = await fetchAPI('/api/master/dashboard-stats');
    const restaurants = await fetchAPI('/api/master/restaurants');

    const total = restaurants.length;
    const totalOrders = stats.totalOrders || 0;
    const totalRev = stats.totalRevenue || 0;
    const avgOrders = total ? Math.round(totalOrders / total) : 0;

    document.getElementById('analTotal').innerText = total;
    document.getElementById('analOrders').innerText = totalOrders;
    document.getElementById('analAvg').innerText = avgOrders;
    document.getElementById('analRev').innerText = '\u20b9' + Math.round(totalRev).toLocaleString('en-IN');

    // Top Restaurants (sorted by name for demo)
    const topEl = document.getElementById('analTopRestaurants');
    if (topEl) {
      const sorted = [...restaurants].slice(0, 8);
      topEl.innerHTML = sorted.map((r, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-color);">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="background:var(--gold);color:#000;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;">${i+1}</span>
            <span style="font-weight:600;color:var(--text-primary);">${r.name}</span>
          </div>
          <span class="status ${r.isActive ? 'active' : 'suspended'}">${r.plan.toUpperCase()}</span>
        </div>
      `).join('');
    }

    // Plan distribution pie chart
    const planCounts = { trial: 0, monthly: 0, premium: 0, enterprise: 0 };
    restaurants.forEach(r => { if (planCounts[r.plan] !== undefined) planCounts[r.plan]++; else planCounts.monthly++; });

    const ctx = document.getElementById('planDistChart');
    if (ctx) {
      if (planDistChartInstance) planDistChartInstance.destroy();
      planDistChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Trial', 'Monthly', 'Premium', 'Enterprise'],
          datasets: [{ data: [planCounts.trial, planCounts.monthly, planCounts.premium, planCounts.enterprise], backgroundColor: ['#F59E0B','#3B82F6','#8B5CF6','#10B981'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#aaa', font: { size: 12 } } } } }
      });
    }
  } catch(e) { console.error('Analytics error', e); }
}

// ══════════════════════════════════════════
// 3. ANNOUNCEMENTS
// ══════════════════════════════════════════
function getAnnouncements() {
  try { return JSON.parse(localStorage.getItem('master_announcements') || '[]'); } catch { return []; }
}
function saveAnnouncements(list) { localStorage.setItem('master_announcements', JSON.stringify(list)); }

function openAnnouncementModal() {
  document.getElementById('announcementModal').classList.remove('hidden');
}

function saveAnnouncement() {
  const title = document.getElementById('annTitle').value.trim();
  const body = document.getElementById('annBody').value.trim();
  if (!title || !body) { alert('Please enter a title and message.'); return; }

  const list = getAnnouncements();
  list.unshift({ id: Date.now(), title, body, date: new Date().toLocaleDateString() });
  saveAnnouncements(list);
  logActivity(`📢 Announcement sent: "${title}"`);

  // Also broadcast it to all admins
  fetchAPI('/api/master/broadcast', 'POST', { message: `[Announcement] ${title}: ${body}` });

  closeModal('announcementModal');
  document.getElementById('annTitle').value = '';
  document.getElementById('annBody').value = '';
  renderAnnouncements();
  alert('Announcement saved and broadcast to all restaurants!');
}

function renderAnnouncements() {
  const list = getAnnouncements();
  const el = document.getElementById('announcementList');
  if (!el) return;
  if (list.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:24px;">No announcements yet.</div>';
    return;
  }
  el.innerHTML = list.map(a => `
    <div style="padding:16px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid var(--border-color);margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-weight:700;color:var(--text-primary);">${a.title}</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <span style="font-size:11px;color:var(--text-muted);">${a.date}</span>
          <button onclick="deleteAnnouncement(${a.id})" style="background:rgba(239,68,68,0.15);color:#EF4444;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px;">Delete</button>
        </div>
      </div>
      <div style="color:var(--text-muted);font-size:13px;">${a.body}</div>
    </div>
  `).join('');
}

function deleteAnnouncement(id) {
  saveAnnouncements(getAnnouncements().filter(a => a.id !== id));
  renderAnnouncements();
}

// ══════════════════════════════════════════
// 4. ACTIVITY LOG
// ══════════════════════════════════════════
function logActivity(text) {
  const log = JSON.parse(localStorage.getItem('master_activity') || '[]');
  log.unshift({ text, time: new Date().toLocaleString() });
  localStorage.setItem('master_activity', JSON.stringify(log.slice(0, 100)));
}

function renderActivityLog() {
  const log = JSON.parse(localStorage.getItem('master_activity') || '[]');
  const el = document.getElementById('activityLog');
  if (!el) return;
  if (log.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:24px;">No activity recorded yet.</div>';
    return;
  }
  el.innerHTML = log.map(l => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:8px;border-left:3px solid var(--gold);">
      <span style="color:var(--text-primary);font-size:13px;">${l.text}</span>
      <span style="color:var(--text-muted);font-size:11px;white-space:nowrap;margin-left:12px;">${l.time}</span>
    </div>
  `).join('');
}

function clearActivityLog() {
  if (!confirm('Clear all activity logs?')) return;
  localStorage.removeItem('master_activity');
  renderActivityLog();
}

// Auto-log key actions
const _origCreate = typeof createRestaurant !== 'undefined' ? createRestaurant : null;

// ══════════════════════════════════════════
// 5. ADMIN NOTES
// ══════════════════════════════════════════
function getNotes() {
  try { return JSON.parse(localStorage.getItem('master_notes') || '[]'); } catch { return []; }
}

function addNote() {
  const input = document.getElementById('noteInput');
  const text = input?.value.trim();
  if (!text) return;
  const notes = getNotes();
  notes.unshift({ id: Date.now(), text, date: new Date().toLocaleDateString() });
  localStorage.setItem('master_notes', JSON.stringify(notes));
  input.value = '';
  renderNotes();
}

function renderNotes() {
  const notes = getNotes();
  const el = document.getElementById('notesList');
  if (!el) return;
  if (notes.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:16px;">No notes yet.</div>';
    return;
  }
  el.innerHTML = notes.map(n => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:rgba(255,255,255,0.03);border-radius:8px;border-left:3px solid var(--gold);">
      <div>
        <div style="color:var(--text-primary);font-size:13px;">${n.text}</div>
        <div style="color:var(--text-muted);font-size:11px;margin-top:2px;">${n.date}</div>
      </div>
      <button onclick="deleteNote(${n.id})" style="background:rgba(239,68,68,0.15);color:#EF4444;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:11px;margin-left:12px;">Delete</button>
    </div>
  `).join('');
}

function deleteNote(id) {
  localStorage.setItem('master_notes', JSON.stringify(getNotes().filter(n => n.id !== id)));
  renderNotes();
}

// ══════════════════════════════════════════
// 6. BACKUP & EXPORT
// ══════════════════════════════════════════
async function exportSummaryJSON() {
  const stats = await fetchAPI('/api/master/dashboard-stats');
  const json = JSON.stringify({ exportedAt: new Date().toISOString(), ...stats }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'platform_summary.json';
  a.click(); URL.revokeObjectURL(url);
  logActivity('🗄️ Downloaded platform summary JSON');
}

function exportNotesTXT() {
  const notes = getNotes();
  const text = notes.map(n => `[${n.date}] ${n.text}`).join('\n');
  const blob = new Blob([text || 'No notes.'], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'admin_notes.txt';
  a.click(); URL.revokeObjectURL(url);
  logActivity('📝 Downloaded admin notes TXT');
}

// ══════════════════════════════════════════
// 7. SUPPORT — RESET PASSWORD
// ══════════════════════════════════════════
async function openResetPasswordModal() {
  const data = await fetchAPI('/api/master/restaurants');
  const select = document.getElementById('resetRestSelect');
  select.innerHTML = '<option value="">Select restaurant...</option>';
  data.forEach(r => { select.innerHTML += `<option value="${r.id}">${r.name}</option>`; });
  document.getElementById('resetPasswordModal').classList.remove('hidden');
}

async function doResetPassword() {
  const id = document.getElementById('resetRestSelect').value;
  const newUser = document.getElementById('resetNewUser').value.trim();
  const newPass = document.getElementById('resetNewPass').value.trim();
  if (!id) { alert('Please select a restaurant.'); return; }
  if (!newPass) { alert('Please enter a new password.'); return; }
  try {
    const payload = { adminPassword: newPass };
    if (newUser) payload.adminUsername = newUser;
    await fetchAPI(`/api/master/restaurants/${id}`, 'PUT', payload);
    logActivity(`🔑 Reset password for restaurant ID ${id}`);
    alert('Password reset successfully!');
    closeModal('resetPasswordModal');
    document.getElementById('resetNewPass').value = '';
    document.getElementById('resetNewUser').value = '';
  } catch(e) { alert('Failed to reset password.'); }
}

// ══════════════════════════════════════════
// 8. PLATFORM SETTINGS
// ══════════════════════════════════════════
function savePlatformSettings() {
  const settings = {
    trialDays: document.getElementById('settingTrialDays').value,
    platformName: document.getElementById('settingPlatformName').value,
    supportEmail: document.getElementById('settingSupportEmail').value,
    maintenanceMode: document.getElementById('settingMaintenanceMode').checked
  };
  localStorage.setItem('master_platform_settings', JSON.stringify(settings));
  logActivity('⚙️ Platform settings updated');
  alert('Settings saved successfully!');
}

function loadPlatformSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('master_platform_settings') || '{}');
    if (s.trialDays) document.getElementById('settingTrialDays').value = s.trialDays;
    if (s.platformName) document.getElementById('settingPlatformName').value = s.platformName;
    if (s.supportEmail) document.getElementById('settingSupportEmail').value = s.supportEmail;
    if (s.maintenanceMode) document.getElementById('settingMaintenanceMode').checked = s.maintenanceMode;
  } catch(e) {}
}

// ══════════════════════════════════════════
// 9. DOCS MODAL
// ══════════════════════════════════════════
function openDocsModal() {
  document.getElementById('docsModal').classList.remove('hidden');
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
if (window.location.pathname.includes('dashboard.html')) {
  loadDashboard();
  loadPlatformSettings();
}
