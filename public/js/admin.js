/**
 * Smart Bus Management System - Admin Dashboard Controller
 * Full-Stack MySQL-backed SPA Controller
 */

let currentAdmin = null;
let currentGoogleMapsKey = null;
let googleMapsLoaded = false;
let googleMapInstance = null;
let directionsRenderer = null;
let directionsService = null;
let lastCalculatedKm = 18.7;

document.addEventListener('DOMContentLoaded', () => {
  currentAdmin = Auth.requireAuth(['admin']);
  if (!currentAdmin) return;

  initAdminProfile();
  initSidebarNavigation();
  initFeeSubtabs();
  initGlobalSearch();
  checkGoogleMapsConfig();
  loadDashboardData();
  fetchUnreadNotificationsCount();
});

// 1. Initialize Profile in Sidebar and Topbar
function initAdminProfile() {
  const nameEls = document.querySelectorAll('.admin-profile-name');
  nameEls.forEach(el => el.innerText = currentAdmin.name || 'Dr. Ramesh Sharma');

  const roleEls = document.querySelectorAll('.admin-profile-role');
  roleEls.forEach(el => el.innerText = 'Transport Director');
}

// 2. Sidebar View Navigation
function initSidebarNavigation() {
  const links = document.querySelectorAll('.sidebar-link[data-view]');
  const views = document.querySelectorAll('.dashboard-view');
  const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');

  links.forEach(link => {
    link.addEventListener('click', () => {
      const targetView = link.getAttribute('data-view');

      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      views.forEach(v => {
        if (v.id === `view-${targetView}`) {
          v.classList.add('active');
        } else {
          v.classList.remove('active');
        }
      });

      if (breadcrumbCurrent) {
        breadcrumbCurrent.innerText = link.querySelector('span:not(.sidebar-icon):not(.sidebar-badge)')?.innerText || targetView;
      }

      // Load specific view data on demand
      if (targetView === 'dashboard') loadDashboardData();
      else if (targetView === 'students') loadStudentsView();
      else if (targetView === 'drivers') loadDriversView();
      else if (targetView === 'buses') loadBusesView();
      else if (targetView === 'routes') loadRoutesView();
      else if (targetView === 'locations') loadLocationsView();
      else if (targetView === 'trans-apps') loadTransAppsView();
      else if (targetView === 'fees') loadFeeManagementView();
      else if (targetView === 'payments') loadAdminPaymentsView();
      else if (targetView === 'receipts') loadReceiptsDirectory();
      else if (targetView === 'pass-apps') loadPassAppsView();
      else if (targetView === 'passes') loadPassesView();
      else if (targetView === 'tracking') loadFleetTrackingView();
      else if (targetView === 'cancellations') loadCancellationsView();
      else if (targetView === 'notifications') loadAdminNotificationsView();
      else if (targetView === 'reports') loadReportsView();

      document.querySelector('.sidebar')?.classList.remove('mobile-open');
    });
  });

  document.getElementById('sidebarToggleBtn')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('mobile-open');
  });
}

// 3. Fee Subtabs Manager (Requirement 11 & All 7 Modules Navigation)
window.switchFeeSubtab = function(target) {
  // If fees view is not currently active, switch to it
  const feeView = document.getElementById('view-fees');
  const feeLink = document.querySelector('[data-view="fees"]');
  if (feeView && !feeView.classList.contains('active')) {
    document.querySelectorAll('.dashboard-view').forEach(v => v.classList.remove('active'));
    feeView.classList.add('active');
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    if (feeLink) feeLink.classList.add('active');
    const titleEl = document.getElementById('topbarPageTitle');
    if (titleEl) titleEl.innerText = 'Transportation Fee Management System';
  }

  // Update tab buttons
  const subtabBtns = document.querySelectorAll('.fee-subtab-btn');
  subtabBtns.forEach(b => {
    if (b.getAttribute('data-subtab') === target) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  // Update sidebar fee sublinks
  document.querySelectorAll('.fee-nav-link').forEach(link => {
    if (link.getAttribute('data-subtab') === target) {
      link.style.color = '#38bdf8';
      link.style.fontWeight = '700';
      link.style.background = 'rgba(56, 189, 248, 0.12)';
    } else {
      link.style.color = '#94a3b8';
      link.style.fontWeight = 'normal';
      link.style.background = 'transparent';
    }
  });

  // Display target content card
  const subtabContents = document.querySelectorAll('.fee-subtab-content');
  subtabContents.forEach(c => {
    if (c.id === `subtab-${target}`) {
      c.style.display = 'block';
    } else {
      c.style.display = 'none';
    }
  });

  // Load specific submodule data
  if (target === 'fee-structures') loadFeeStructures();
  else if (target === 'student-fee-records') loadStudentFeeRecords();
  else if (target === 'paid-pending-status') loadPaidPendingStatus();
  else if (target === 'payment-processing') loadPaymentProcessingModule();
  else if (target === 'fee-history') loadFeeHistory();
  else if (target === 'receipt-gen') loadReceiptsDirectory();
  else if (target === 'late-fee') loadLateFeesList();
  else if (target === 'fee-notifications') loadFeeNotifications();
};

function initFeeSubtabs() {
  const subtabBtns = document.querySelectorAll('.fee-subtab-btn');
  subtabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-subtab');
      window.switchFeeSubtab(target);
    });
  });

  // Wire up sidebar sublinks
  document.querySelectorAll('.fee-nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const target = link.getAttribute('data-subtab');
      window.switchFeeSubtab(target);
    });
  });
}

// 4. Global Search
function initGlobalSearch() {
  const searchInput = document.getElementById('adminGlobalSearch');
  searchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      if (!q) return;
      document.querySelector('[data-view=students]').click();
      const sInput = document.getElementById('studentSearchInput');
      if (sInput) {
        sInput.value = q;
        sInput.dispatchEvent(new Event('input'));
      }
    }
  });
}

// 5. Check & Load Google Maps API (Requirements 8 & 9)
async function checkGoogleMapsConfig() {
  try {
    const res = await api.get('/maps/config');
    const badge = document.getElementById('googleMapsApiStatusBadge');
    if (res.hasKey && res.apiKey) {
      currentGoogleMapsKey = res.apiKey;
      if (badge) badge.innerHTML = `<span class="badge badge-success">✓ Google Maps API Active</span>`;
      loadGoogleMapsScript(res.apiKey);
    } else {
      if (badge) {
        badge.innerHTML = `<span class="badge badge-warning" title="${res.message}">⚠️ Maps API Key Not Set (Using Regional Engine)</span>`;
      }
      renderFallbackRouteMap();
    }
  } catch (err) {
    console.error('Failed to load Google Maps config:', err);
    renderFallbackRouteMap();
  }
}

function loadGoogleMapsScript(apiKey) {
  if (googleMapsLoaded) return;
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    googleMapsLoaded = true;
    initGoogleMapsInstance();
  };
  script.onerror = () => {
    console.warn('Google Maps script failed to load. Fallback map engine enabled.');
    renderFallbackRouteMap();
  };
  document.head.appendChild(script);
}

function initGoogleMapsInstance() {
  const container = document.getElementById('adminRouteMapContainer');
  if (!container || !window.google || !window.google.maps) return;

  const madanapalleCenter = { lat: 13.5800, lng: 78.5300 };
  googleMapInstance = new google.maps.Map(container, {
    center: madanapalleCenter,
    zoom: 12,
    mapTypeControl: false,
    streetViewControl: false
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: googleMapInstance,
    polylineOptions: { strokeColor: '#0d9488', strokeWeight: 5 }
  });

  calculateRouteOnMap();
}

// Interactive Map Route & Distance Calculation (Requirements 8 & 9)
window.calculateRouteOnMap = async () => {
  const startInput = document.getElementById('mapCalcStart')?.value.trim() || 'Madanapalle RTC Bus Stand';
  const pickupsInput = document.getElementById('mapCalcPickups')?.value.trim() || '';
  const endInput = document.getElementById('mapCalcEnd')?.value.trim() || 'Main College Campus';

  const waypoints = pickupsInput.split(',').map(s => s.trim()).filter(Boolean);

  if (googleMapsLoaded && directionsService && directionsRenderer) {
    const gWaypoints = waypoints.map(w => ({ location: w, stopover: true }));
    directionsService.route({
      origin: startInput,
      destination: endInput,
      waypoints: gWaypoints,
      travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK) {
        directionsRenderer.setDirections(result);
        let meters = 0;
        result.routes[0].legs.forEach(leg => meters += leg.distance.value);
        lastCalculatedKm = Math.round((meters / 1000) * 10) / 10;
        updateDistanceBanner(lastCalculatedKm, startInput, waypoints, endInput);
      } else {
        calculateDistanceFallback(startInput, waypoints, endInput);
      }
    });
  } else {
    calculateDistanceFallback(startInput, waypoints, endInput);
  }
};

async function calculateDistanceFallback(start, waypoints, end) {
  // Built-in waypoint coordinates for region
  const knownCoords = {
    'madanapalle rtc bus stand': { lat: 13.5510, lng: 78.5020 },
    'nehru circle': { lat: 13.5580, lng: 78.5080 },
    'rama rao colony': { lat: 13.5700, lng: 78.5200 },
    'angallu junction': { lat: 13.5950, lng: 78.5520 },
    'main college campus': { lat: 13.6200, lng: 78.5800 },
    'punganur town bus stand': { lat: 13.3660, lng: 78.5800 },
    'kurabalakota center': { lat: 13.6500, lng: 78.4800 }
  };

  const points = [];
  const addPoint = (name) => {
    const key = name.toLowerCase().trim();
    if (knownCoords[key]) {
      points.push(knownCoords[key]);
    } else {
      points.push({ lat: 13.56 + (points.length * 0.02), lng: 78.51 + (points.length * 0.02) });
    }
  };

  addPoint(start);
  waypoints.forEach(addPoint);
  addPoint(end);

  try {
    const res = await api.post('/routes/calculate-distance', { points });
    if (res.success && res.distanceKm) {
      lastCalculatedKm = res.distanceKm;
    } else {
      lastCalculatedKm = 18.7;
    }
  } catch (e) {
    lastCalculatedKm = 18.7;
  }

  updateDistanceBanner(lastCalculatedKm, start, waypoints, end);
  renderFallbackRouteMap(start, waypoints, end);
}

function updateDistanceBanner(distKm, start, waypoints, end) {
  const distText = document.getElementById('mapCalculatedDistanceText');
  const waypointsText = document.getElementById('mapRouteWaypointsText');

  if (distText) {
    distText.innerText = `Calculated Distance: ${distKm} KM`;
  }
  if (waypointsText) {
    const chain = [start, ...waypoints, end].join(' ➔ ');
    waypointsText.innerText = `Route: ${chain}`;
  }
}

function renderFallbackRouteMap(start = 'Madanapalle RTC Stand', waypoints = ['Nehru Circle', 'Angallu'], end = 'College Campus') {
  const container = document.getElementById('adminRouteMapContainer');
  if (!container) return;

  const pointsList = [start, ...waypoints, end];

  container.innerHTML = `
    <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: 1.5rem; background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%); color: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.8rem; font-weight: 700; color: #2dd4bf; text-transform: uppercase;">
          📍 Geometric Transit Polyline Simulation
        </span>
        <span style="background: rgba(13, 148, 136, 0.3); border: 1px solid #14b8a6; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 800; color: #2dd4bf;">
          ${lastCalculatedKm} KM
        </span>
      </div>

      <!-- Route Visual Line -->
      <div style="position: relative; margin: 2rem 1rem;">
        <div style="height: 4px; background: linear-gradient(90deg, #10b981 0%, #0d9488 50%, #38bdf8 100%); border-radius: 2px;"></div>
        <div style="display: flex; justify-content: space-between; position: absolute; width: 100%; top: -14px;">
          ${pointsList.map((p, idx) => `
            <div style="display: flex; flex-direction: column; align-items: center; text-align: center; max-width: 120px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: ${idx === 0 ? '#10b981' : (idx === pointsList.length - 1 ? '#38bdf8' : '#0d9488')}; border: 3px solid #0f172a; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 800; color: #ffffff;">
                ${idx === 0 ? 'S' : (idx === pointsList.length - 1 ? 'C' : idx)}
              </div>
              <div style="font-size: 0.72rem; color: #cbd5e1; font-weight: 600; margin-top: 0.4rem; line-height: 1.2;">
                ${p}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div style="font-size: 0.75rem; color: #94a3b8; display: flex; justify-content: space-between;">
        <span>GPS Datum: WGS84 • Rayachoti Corridor</span>
        <span>Route Line: Verified • Calculated Distance: ${lastCalculatedKm} KM</span>
      </div>
    </div>
  `;
}

window.applyCalculatedDistanceToFee = () => {
  document.querySelector('[data-view=fees]').click();
  document.querySelector('[data-subtab=fee-structures]').click();
  openAddFeeStructureModal({ distanceKm: lastCalculatedKm });
};

// 6. Load Main Dashboard Analytics (from MySQL)
async function loadDashboardData() {
  try {
    const res = await api.get('/reports/summary');
    if (!res.success) return;

    const { stats, charts, recentActivity } = res;

    document.getElementById('statTotalStudents').innerText = stats.totalStudents;
    document.getElementById('statActiveStudents').innerText = stats.activeStudents;
    document.getElementById('statTotalBuses').innerText = stats.totalBuses;
    document.getElementById('statActiveBuses').innerText = stats.activeBuses;
    document.getElementById('statTotalDrivers').innerText = stats.totalDrivers;
    document.getElementById('statTotalRoutes').innerText = stats.totalRoutes;
    document.getElementById('statRevenue').innerText = `₹${parseFloat(stats.revenue || 0).toLocaleString('en-IN')}`;
    document.getElementById('statPendingRequests').innerText = stats.pendingRequests;

    const canBadge = document.getElementById('sidebarCancellationBadge');
    if (canBadge) {
      canBadge.innerText = stats.pendingRequests;
      canBadge.style.display = stats.pendingRequests > 0 ? 'inline-block' : 'none';
    }

    renderBusUsageChart(charts.busUtilization || []);
    renderBranchDonutChart(charts.deptDistribution || []);
    renderActivityFeed(recentActivity || []);
  } catch (err) {
    console.error('Failed to load dashboard summary:', err);
  }
}

function renderBusUsageChart(busUsage) {
  const container = document.getElementById('busUsageChartContainer');
  if (!container) return;

  if (!busUsage.length) {
    container.innerHTML = `<p class="text-muted text-center" style="margin: auto;">No buses registered in MySQL.</p>`;
    return;
  }

  container.innerHTML = `
    <div class="bar-chart-wrap" style="display: flex; gap: 1.5rem; height: 200px; align-items: flex-end; padding-top: 1rem;">
      ${busUsage.map(b => {
        const pct = Math.min(100, Math.round((b.occupied / (b.capacity || 50)) * 100));
        return `
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end;">
            <div style="width: 100%; max-width: 44px; height: ${Math.max(15, pct)}%; background: linear-gradient(180deg, #0d9488 0%, #059669 100%); border-radius: 6px 6px 0 0; position: relative;">
              <span style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-size: 0.72rem; font-weight: 700; color: #475569;">${b.occupied}</span>
            </div>
            <span style="font-size: 0.75rem; font-weight: 700; color: #111827; margin-top: 0.5rem;">${b.bus_number}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderBranchDonutChart(departments) {
  const container = document.getElementById('branchDonutContainer');
  if (!container) return;

  if (!departments.length) {
    container.innerHTML = `<p class="text-muted text-center" style="margin: auto;">No student branch data.</p>`;
    return;
  }

  const colors = ['#0d9488', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];
  const total = departments.reduce((sum, d) => sum + d.count, 0);

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.75rem; width: 100%; justify-content: center;">
      ${departments.map((d, i) => {
        const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
        return `
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.25rem;">
              <span>${d.course || 'General'}</span>
              <span>${d.count} (${pct}%)</span>
            </div>
            <div style="width: 100%; height: 8px; background: #e5e4de; border-radius: 9999px; overflow: hidden;">
              <div style="width: ${pct}%; height: 100%; background: ${colors[i % colors.length]}; border-radius: 9999px;"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderActivityFeed(activities) {
  const container = document.getElementById('recentActivityContainer');
  if (!container) return;

  if (!activities.length) {
    container.innerHTML = `<p class="text-muted text-center" style="padding: 1rem;">No recent system notifications recorded.</p>`;
    return;
  }

  container.innerHTML = activities.map(act => `
    <div style="display: flex; gap: 1rem; align-items: flex-start; padding: 0.85rem 0; border-bottom: 1px solid #f2f1ec;">
      <div style="width: 32px; height: 32px; border-radius: 50%; background: #ccfbf1; color: #0d9488; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">
        ${act.category === 'success' ? '✓' : (act.category === 'warning' ? '⚠' : 'ℹ')}
      </div>
      <div>
        <div style="font-size: 0.88rem; font-weight: 700; color: #111827;">${act.title}</div>
        <div style="font-size: 0.8rem; color: #4b5563; margin-top: 0.15rem;">${act.message}</div>
        <div style="font-size: 0.7rem; color: #9ca3af; margin-top: 0.25rem;">${new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</div>
      </div>
    </div>
  `).join('');
}

// 7. Load Students View (Requirement 38)
async function loadStudentsView() {
  const tbody = document.getElementById('studentsTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="12" class="text-center" style="padding: 2rem;"><span class="spinner"></span> Loading students from MySQL...</td></tr>`;

  try {
    const q = document.getElementById('studentSearchInput')?.value.trim() || '';
    const feeFilter = document.getElementById('studentFeeFilter')?.value || '';

    const res = await api.get('/students', { search: q, feeStatus: feeFilter });
    if (!res.success) return;

    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="text-center text-muted" style="padding: 2rem;">No student records found in MySQL database. Click "+ Add Student" to register.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(s => `
      <tr>
        <td><strong style="color: #0d9488; letter-spacing: 0.03em;">${s.rollNumber}</strong></td>
        <td><strong>${s.name}</strong></td>
        <td>${s.course}</td>
        <td>${s.admissionNumber}</td>
        <td>${s.parentName}</td>
        <td>${s.phone}</td>
        <td>${s.locationName}</td>
        <td>${s.routeName}</td>
        <td>${s.busNumber}</td>
        <td>
          <span class="badge ${s.feeStatus === 'PAID' ? 'badge-success' : (s.feeStatus === 'PARTIALLY PAID' ? 'badge-warning' : 'badge-danger')}">
            ${s.feeStatus}
          </span>
        </td>
        <td>
          <span class="badge ${s.passStatus === 'ACTIVE' ? 'badge-success' : 'badge-secondary'}">
            ${s.passStatus}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-secondary btn-sm" onclick="openEditStudentModal(${s.id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteStudent(${s.id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Bind filters
    initStudentSearchAndFilters();
  } catch (err) {
    console.error('loadStudentsView error:', err);
    tbody.innerHTML = `<tr><td colspan="12" class="text-center text-danger" style="padding: 2rem;">Failed to retrieve students from MySQL.</td></tr>`;
  }
}

function initStudentSearchAndFilters() {
  const sInput = document.getElementById('studentSearchInput');
  const fFilter = document.getElementById('studentFeeFilter');

  sInput?.addEventListener('input', debounce(loadStudentsView, 300));
  fFilter?.addEventListener('change', loadStudentsView);
}

// Open Add Student Modal (Requirement 5 & 6)
window.openAddStudentModal = async () => {
  const modal = document.getElementById('adminGenericModal');
  const modalTitle = document.getElementById('adminModalTitle');
  const modalBody = document.getElementById('adminModalBody');
  if (!modal) return;

  modalTitle.innerText = 'Register New Student (MySQL)';

  const [locsRes, routesRes, busesRes] = await Promise.all([
    api.get('/locations'),
    api.get('/routes'),
    api.get('/buses')
  ]);

  modalBody.innerHTML = `
    <form id="addStudentModalForm">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Full Name *</label>
          <input type="text" class="form-control" id="mName" required placeholder="e.g. Ramesh Kumar" />
        </div>
        <div class="form-group">
          <label class="form-label">Roll Number (Exact 10 Alphanumeric) *</label>
          <input type="text" class="form-control" id="mRoll" required placeholder="23A45B6789" style="text-transform: uppercase;" maxlength="10" />
          <div class="form-hint">Must be exactly 10 letters and digits (e.g. 23A45B6789).</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Course / Branch *</label>
          <input type="text" class="form-control" id="mCourse" required placeholder="Computer Science & Engineering" />
        </div>
        <div class="form-group">
          <label class="form-label">Admission Number</label>
          <input type="text" class="form-control" id="mAdmNo" placeholder="ADM-2026-081" />
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Parent / Guardian Name</label>
          <input type="text" class="form-control" id="mParent" placeholder="Parent Full Name" />
        </div>
        <div class="form-group">
          <label class="form-label">Mobile Phone *</label>
          <input type="text" class="form-control" id="mPhone" required placeholder="+91 98765 43210" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Email Address *</label>
        <input type="email" class="form-control" id="mEmail" required placeholder="student@college.edu" />
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Pickup Stop</label>
          <select class="form-control form-select" id="mPickup">
            <option value="">-- Select Pickup Stop --</option>
            ${(locsRes.data || []).map(l => `<option value="${l.id}">${l.name} (${l.distanceKm} km)</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Assigned Route</label>
          <select class="form-control form-select" id="mRoute">
            <option value="">-- Select Route --</option>
            ${(routesRes.data || []).map(r => `<option value="${r.id}">${r.route_number} - ${r.route_name}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Assigned Bus</label>
        <select class="form-control form-select" id="mBus">
          <option value="">-- Select Fleet Bus --</option>
          ${(busesRes.data || []).map(b => `<option value="${b.id}">${b.busNumber} (${b.regNumber})</option>`).join('')}
        </select>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button type="button" class="btn btn-secondary" onclick="closeAdminModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save to MySQL</button>
      </div>
    </form>
  `;

  document.getElementById('addStudentModalForm').onsubmit = async (e) => {
    e.preventDefault();
    const roll = document.getElementById('mRoll').value.trim().toUpperCase();

    // Requirement 6: Validate exactly 10 alphanumeric chars
    if (!/^[A-Za-z0-9]{10}$/.test(roll)) {
      showAlertModal(
        'Invalid Roll Number',
        'Roll Number must contain exactly 10 letters and numbers.',
        'error'
      );
      return;
    }

    const payload = {
      name: document.getElementById('mName').value.trim(),
      rollNo: roll,
      course: document.getElementById('mCourse').value.trim(),
      admissionNumber: document.getElementById('mAdmNo').value.trim(),
      parentName: document.getElementById('mParent').value.trim(),
      phone: document.getElementById('mPhone').value.trim(),
      email: document.getElementById('mEmail').value.trim(),
      pickupId: document.getElementById('mPickup').value || null,
      routeId: document.getElementById('mRoute').value || null,
      busId: document.getElementById('mBus').value || null
    };

    const res = await api.post('/students', payload);
    if (!res.success) {
      if (res.message && res.message.toLowerCase().includes('roll number already exists')) {
        showAlertModal(
          'Duplicate Roll Number',
          'Roll Number already exists. Please enter a different Roll Number.',
          'error'
        );
      } else {
        showToast('Registration Error', res.message || 'Could not add student.', 'error');
      }
      return;
    }

    showToast('Student Registered', 'Student stored in MySQL database.', 'success');
    closeAdminModal();
    loadStudentsView();
    loadDashboardData();
  };

  modal.classList.add('active');
};

// Open Edit Student Modal (Requirement 23 & 38)
window.openEditStudentModal = async (studentId) => {
  const modal = document.getElementById('adminGenericModal');
  const modalTitle = document.getElementById('adminModalTitle');
  const modalBody = document.getElementById('adminModalBody');
  if (!modal) return;

  const [studentRes, locsRes, routesRes, busesRes] = await Promise.all([
    api.get(`/students/${studentId}`),
    api.get('/locations'),
    api.get('/routes'),
    api.get('/buses')
  ]);

  if (!studentRes.success) return;
  const s = studentRes.data;

  modalTitle.innerText = `Update Student Profile: ${s.name} (${s.rollNumber})`;

  modalBody.innerHTML = `
    <form id="editStudentModalForm">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Student Name *</label>
          <input type="text" class="form-control" id="eName" value="${s.name}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Roll Number (Read-only)</label>
          <input type="text" class="form-control" value="${s.rollNumber}" readonly style="background: #f1f5f9; font-weight: 700;" />
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Course / Degree *</label>
          <input type="text" class="form-control" id="eCourse" value="${s.course}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Admission Number</label>
          <input type="text" class="form-control" id="eAdmNo" value="${s.admissionNumber || ''}" />
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Parent / Guardian Name</label>
          <input type="text" class="form-control" id="eParent" value="${s.parentName || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Phone Number *</label>
          <input type="text" class="form-control" id="ePhone" value="${s.phone}" required />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Email Address *</label>
        <input type="email" class="form-control" id="eEmail" value="${s.email}" required />
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Pickup Location</label>
          <select class="form-control form-select" id="ePickup">
            <option value="">-- Unassigned --</option>
            ${(locsRes.data || []).map(l => `<option value="${l.id}" ${l.id === s.pickupId ? 'selected' : ''}>${l.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Assigned Route</label>
          <select class="form-control form-select" id="eRoute">
            <option value="">-- Unassigned --</option>
            ${(routesRes.data || []).map(r => `<option value="${r.id}" ${r.id === s.routeId ? 'selected' : ''}>${r.route_number} - ${r.route_name}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Assigned Bus</label>
          <select class="form-control form-select" id="eBus">
            <option value="">-- Unassigned --</option>
            ${(busesRes.data || []).map(b => `<option value="${b.id}" ${b.id === s.busId ? 'selected' : ''}>${b.busNumber}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Transportation Status</label>
          <select class="form-control form-select" id="eStatus">
            <option value="pending" ${s.status === 'pending' ? 'selected' : ''}>pending</option>
            <option value="approved" ${s.status === 'approved' ? 'selected' : ''}>approved</option>
            <option value="active" ${s.status === 'active' ? 'selected' : ''}>active</option>
            <option value="cancelled" ${s.status === 'cancelled' ? 'selected' : ''}>cancelled</option>
          </select>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button type="button" class="btn btn-secondary" onclick="closeAdminModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Update in MySQL</button>
      </div>
    </form>
  `;

  document.getElementById('editStudentModalForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('eName').value.trim(),
      course: document.getElementById('eCourse').value.trim(),
      admissionNumber: document.getElementById('eAdmNo').value.trim(),
      parentName: document.getElementById('eParent').value.trim(),
      phone: document.getElementById('ePhone').value.trim(),
      email: document.getElementById('eEmail').value.trim(),
      pickupId: document.getElementById('ePickup').value || null,
      routeId: document.getElementById('eRoute').value || null,
      busId: document.getElementById('eBus').value || null,
      transportationStatus: document.getElementById('eStatus').value
    };

    const res = await api.put(`/students/${studentId}`, payload);
    if (!res.success) {
      showToast('Update Failed', res.message, 'error');
      return;
    }

    showToast('Student Updated', 'MySQL record updated. Receipt and dashboard reflect changes.', 'success');
    closeAdminModal();
    loadStudentsView();
  };

  modal.classList.add('active');
};

window.deleteStudent = async (studentId) => {
  if (!confirm('Are you sure you want to delete this student and their transit records from the MySQL database?')) return;
  try {
    const res = await api.delete(`/students/${studentId}`);
    if (res.success) {
      showToast('Deleted', 'Student removed from database.', 'success');
      loadStudentsView();
      loadDashboardData();
    } else {
      showToast('Error', res.message, 'error');
    }
  } catch (err) {
    showToast('Error', 'Failed to delete student.', 'error');
  }
};

// 8. Load Drivers View
async function loadDriversView() {
  const container = document.getElementById('driversContainer');
  if (!container) return;

  container.innerHTML = `<div class="text-center" style="grid-column: 1 / -1; padding: 2rem;"><span class="spinner"></span> Loading drivers...</div>`;

  try {
    const res = await api.get('/drivers');
    if (!res.success) return;

    if (res.data.length === 0) {
      container.innerHTML = `<div class="text-center text-muted" style="grid-column: 1 / -1; padding: 2rem;">No drivers registered in MySQL. Click "+ Add New Driver" to add.</div>`;
      return;
    }

    container.innerHTML = res.data.map(d => `
      <div class="card" style="padding: 1.5rem;">
        <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
          <div style="width: 3.5rem; height: 3.5rem; border-radius: 50%; background: #ccfbf1; display: flex; align-items: center; justify-content: center; font-size: 1.8rem;">
            👮‍♂️
          </div>
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: #111827;">${d.name}</h3>
            <div style="font-size: 0.8rem; color: #0d9488; font-weight: 700;">Lic: ${d.license}</div>
            <div style="font-size: 0.75rem; color: #9ca3af;">Exp: ${d.experience}</div>
          </div>
        </div>

        <div style="background: #f8fafc; padding: 0.85rem; border-radius: 8px; font-size: 0.82rem; margin-bottom: 1.25rem;">
          <div>📞 <strong>${d.phone}</strong></div>
          <div style="margin-top: 0.25rem;">🚌 Assigned: <strong>${d.busNumber}</strong></div>
          <div style="margin-top: 0.25rem;">🗺️ Route: <strong>${d.routeName}</strong></div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="badge ${d.status === 'active' ? 'badge-success' : 'badge-secondary'}">${d.status}</span>
          <button class="btn btn-secondary btn-sm" onclick="openEditDriverModal(${d.id})">Edit Details</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('loadDriversView error:', err);
  }
}

window.openAddDriverModal = async () => {
  const modal = document.getElementById('adminGenericModal');
  const modalTitle = document.getElementById('adminModalTitle');
  const modalBody = document.getElementById('adminModalBody');
  if (!modal) return;

  modalTitle.innerText = 'Add Licensed Fleet Driver';
  const busesRes = await api.get('/buses');

  modalBody.innerHTML = `
    <form id="addDriverForm">
      <div class="form-group">
        <label class="form-label">Full Driver Name *</label>
        <input type="text" class="form-control" id="dName" required placeholder="e.g. Suresh Kumar" />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Mobile Phone *</label>
          <input type="text" class="form-control" id="dPhone" required placeholder="+91 91234 56789" />
        </div>
        <div class="form-group">
          <label class="form-label">License Number *</label>
          <input type="text" class="form-control" id="dLicense" required placeholder="DL-AP04-2018-00982" />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Driving Experience</label>
          <input type="text" class="form-control" id="dExp" placeholder="10 Years" value="8 Years" />
        </div>
        <div class="form-group">
          <label class="form-label">Assign Bus</label>
          <select class="form-control form-select" id="dBus">
            <option value="">-- Select Bus --</option>
            ${(busesRes.data || []).map(b => `<option value="${b.id}">${b.busNumber}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button type="button" class="btn btn-secondary" onclick="closeAdminModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Driver</button>
      </div>
    </form>
  `;

  document.getElementById('addDriverForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('dName').value.trim(),
      phone: document.getElementById('dPhone').value.trim(),
      license: document.getElementById('dLicense').value.trim(),
      experience: document.getElementById('dExp').value.trim(),
      busId: document.getElementById('dBus').value || null
    };

    const res = await api.post('/drivers', payload);
    if (!res.success) {
      showToast('Error', res.message, 'error');
      return;
    }

    showToast('Driver Added', 'Driver saved to MySQL.', 'success');
    closeAdminModal();
    loadDriversView();
    loadDashboardData();
  };

  modal.classList.add('active');
};

window.openEditDriverModal = async (driverId) => {
  const modal = document.getElementById('adminGenericModal');
  const modalTitle = document.getElementById('adminModalTitle');
  const modalBody = document.getElementById('adminModalBody');
  if (!modal) return;

  const [dRes, busesRes] = await Promise.all([
    api.get(`/drivers/${driverId}`),
    api.get('/buses')
  ]);

  if (!dRes.success) return;
  const d = dRes.data;

  modalTitle.innerText = `Edit Driver: ${d.name}`;
  modalBody.innerHTML = `
    <form id="editDriverForm">
      <div class="form-group">
        <label class="form-label">Full Name</label>
        <input type="text" class="form-control" id="edName" value="${d.name}" required />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input type="text" class="form-control" id="edPhone" value="${d.phone}" required />
        </div>
        <div class="form-group">
          <label class="form-label">License Number</label>
          <input type="text" class="form-control" id="edLic" value="${d.license}" required />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Experience</label>
          <input type="text" class="form-control" id="edExp" value="${d.experience}" />
        </div>
        <div class="form-group">
          <label class="form-label">Assigned Bus</label>
          <select class="form-control form-select" id="edBus">
            <option value="">-- Unassigned --</option>
            ${(busesRes.data || []).map(b => `<option value="${b.id}" ${b.id === d.busId ? 'selected' : ''}>${b.busNumber}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button type="button" class="btn btn-secondary" onclick="closeAdminModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Update Driver</button>
      </div>
    </form>
  `;

  document.getElementById('editDriverForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('edName').value.trim(),
      phone: document.getElementById('edPhone').value.trim(),
      license: document.getElementById('edLic').value.trim(),
      experience: document.getElementById('edExp').value.trim(),
      busId: document.getElementById('edBus').value || null
    };

    const res = await api.put(`/drivers/${driverId}`, payload);
    if (!res.success) {
      showToast('Error', res.message, 'error');
      return;
    }

    showToast('Updated', 'Driver updated in MySQL.', 'success');
    closeAdminModal();
    loadDriversView();
  };

  modal.classList.add('active');
};

// 9. Load Buses View
async function loadBusesView() {
  const container = document.getElementById('busesContainer');
  if (!container) return;

  container.innerHTML = `<div class="text-center" style="grid-column: 1 / -1; padding: 2rem;"><span class="spinner"></span> Loading fleet buses...</div>`;

  try {
    const res = await api.get('/buses');
    if (!res.success) return;

    if (res.data.length === 0) {
      container.innerHTML = `<div class="text-center text-muted" style="grid-column: 1 / -1; padding: 2rem;">No buses registered in MySQL. Click "+ Add Fleet Bus" to create.</div>`;
      return;
    }

    container.innerHTML = res.data.map(b => `
      <div class="card" style="padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #111827;">${b.busNumber}</h3>
            <div style="font-size: 0.8rem; color: #64748b; font-weight: 600;">Reg: ${b.regNumber}</div>
          </div>
          <span class="badge ${b.status === 'active' ? 'badge-success' : 'badge-warning'}">${b.status}</span>
        </div>

        <div style="margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.35rem;">
            <span>Occupancy</span>
            <strong>${b.occupied} / ${b.capacity} Seats</strong>
          </div>
          <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 9999px; overflow: hidden;">
            <div style="width: ${Math.min(100, Math.round((b.occupied / b.capacity) * 100))}%; height: 100%; background: #0d9488; border-radius: 9999px;"></div>
          </div>
        </div>

        <div style="font-size: 0.8rem; color: #475569; background: #f8fafc; padding: 0.75rem; border-radius: 6px; margin-bottom: 1.25rem;">
          <div>👮 Driver: <strong>${b.driverName}</strong></div>
          <div style="margin-top: 0.2rem;">🗺️ Route: <strong>${b.routeName}</strong></div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
          <button class="btn btn-secondary btn-sm" onclick="openEditBusModal(${b.id})">Edit</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('loadBusesView error:', err);
  }
}

window.openAddBusModal = () => {
  const modal = document.getElementById('adminGenericModal');
  const modalTitle = document.getElementById('adminModalTitle');
  const modalBody = document.getElementById('adminModalBody');
  if (!modal) return;

  modalTitle.innerText = 'Add New Fleet Bus';
  modalBody.innerHTML = `
    <form id="addBusForm">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Bus Identifier *</label>
          <input type="text" class="form-control" id="bNum" required placeholder="e.g. BUS-06" />
        </div>
        <div class="form-group">
          <label class="form-label">Registration Number *</label>
          <input type="text" class="form-control" id="bReg" required placeholder="AP 04 TC 4406" />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Seating Capacity</label>
          <input type="number" class="form-control" id="bCap" value="52" />
        </div>
        <div class="form-group">
          <label class="form-label">Operational Status</label>
          <select class="form-control form-select" id="bStat">
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="standby">Standby</option>
          </select>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button type="button" class="btn btn-secondary" onclick="closeAdminModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Bus</button>
      </div>
    </form>
  `;

  document.getElementById('addBusForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      busNumber: document.getElementById('bNum').value.trim(),
      regNumber: document.getElementById('bReg').value.trim(),
      capacity: document.getElementById('bCap').value,
      status: document.getElementById('bStat').value
    };

    const res = await api.post('/buses', payload);
    if (!res.success) {
      showToast('Error', res.message, 'error');
      return;
    }

    showToast('Bus Created', 'Bus registered in MySQL fleet.', 'success');
    closeAdminModal();
    loadBusesView();
    loadDashboardData();
  };

  modal.classList.add('active');
};

window.openEditBusModal = async (busId) => {
  const modal = document.getElementById('adminGenericModal');
  const modalTitle = document.getElementById('adminModalTitle');
  const modalBody = document.getElementById('adminModalBody');
  if (!modal) return;

  const res = await api.get(`/buses/${busId}`);
  if (!res.success) return;
  const b = res.data;

  modalTitle.innerText = `Edit Bus: ${b.busNumber}`;
  modalBody.innerHTML = `
    <form id="editBusForm">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Bus Number</label>
          <input type="text" class="form-control" id="ebNum" value="${b.busNumber}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Registration Number</label>
          <input type="text" class="form-control" id="ebReg" value="${b.regNumber}" required />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Capacity</label>
          <input type="number" class="form-control" id="ebCap" value="${b.capacity}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control form-select" id="ebStat">
            <option value="active" ${b.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="maintenance" ${b.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
            <option value="standby" ${b.status === 'standby' ? 'selected' : ''}>Standby</option>
          </select>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button type="button" class="btn btn-secondary" onclick="closeAdminModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Update Bus</button>
      </div>
    </form>
  `;

  document.getElementById('editBusForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      busNumber: document.getElementById('ebNum').value.trim(),
      regNumber: document.getElementById('ebReg').value.trim(),
      capacity: document.getElementById('ebCap').value,
      status: document.getElementById('ebStat').value
    };

    const upd = await api.put(`/buses/${busId}`, payload);
    if (!upd.success) {
      showToast('Error', upd.message, 'error');
      return;
    }

    showToast('Updated', 'Bus details updated in MySQL.', 'success');
    closeAdminModal();
    loadBusesView();
  };

  modal.classList.add('active');
};

// 10. Load Routes View (Requirement 33)
async function loadRoutesView() {
  const container = document.getElementById('routesManagementContainer');
  if (!container) return;

  try {
    const res = await api.get('/routes');
    if (!res.success) return;

    if (res.data.length === 0) {
      container.innerHTML = `<div class="card" style="padding: 2rem; text-align: center; color: #64748b;">No routes configured in MySQL. Click "+ Add New Route" above.</div>`;
      return;
    }

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem;">
        ${res.data.map(r => `
          <div class="card" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
              <div>
                <span class="badge badge-info" style="margin-bottom: 0.4rem;">${r.route_number}</span>
                <h3 style="font-size: 1.2rem; font-weight: 800; color: #111827;">${r.route_name}</h3>
              </div>
              <span class="badge ${r.status === 'active' ? 'badge-success' : 'badge-secondary'}">${r.status}</span>
            </div>

            <div style="font-size: 0.85rem; color: #475569; margin-bottom: 1rem;">
              <div>📍 <strong>${r.start_point}</strong> ➔ <strong>${r.end_point}</strong></div>
              <div style="margin-top: 0.35rem;">📏 Distance: <strong>${r.distance_km} KM</strong> • ⏱️ ${r.timing}</div>
              <div style="margin-top: 0.35rem;">🚌 Bus: <strong>${r.busNumber}</strong> • 👮 Driver: <strong>${r.driverName}</strong></div>
              <div style="margin-top: 0.35rem;">👨‍🎓 Enrolled Students: <strong>${r.studentCount}</strong> • 💰 Route Fee: <strong>₹${parseFloat(r.fee || 0).toLocaleString('en-IN')}</strong></div>
            </div>

            <!-- Route Stops List -->
            <div style="background: #f8fafc; padding: 0.85rem; border-radius: var(--radius-sm); margin-bottom: 1rem;">
              <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 0.5rem;">Route Stops Sequence</div>
              <ol style="padding-left: 1.2rem; font-size: 0.8rem; color: #334155;">
                ${(r.stops || []).map(s => `<li>${s.stop_name} (${s.pickup_time})</li>`).join('')}
              </ol>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
              <button class="btn btn-secondary btn-sm" onclick="openEditRouteModal(${r.id})">Edit Route</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    console.error('loadRoutesView error:', err);
  }
}

window.openAddRouteModal = async () => {
  const modal = document.getElementById('adminGenericModal');
  const modalTitle = document.getElementById('adminModalTitle');
  const modalBody = document.getElementById('adminModalBody');
  if (!modal) return;

  const [busesRes, driversRes] = await Promise.all([
    api.get('/buses'),
    api.get('/drivers')
  ]);

  modalTitle.innerText = 'Create New Transit Route';
  modalBody.innerHTML = `
    <form id="addRouteModalForm">
      <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Route Number *</label>
          <input type="text" class="form-control" id="rNum" required placeholder="e.g. Route 04" />
        </div>
        <div class="form-group">
          <label class="form-label">Route Title *</label>
          <input type="text" class="form-control" id="rTitle" required placeholder="e.g. B.Kothakota Rural Express" />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Starting Point *</label>
          <input type="text" class="form-control" id="rStart" required placeholder="e.g. B.Kothakota Center" />
        </div>
        <div class="form-group">
          <label class="form-label">Destination College</label>
          <input type="text" class="form-control" id="rEnd" value="Main College Campus" required />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Route Distance (KM) *</label>
          <input type="number" step="0.1" class="form-control" id="rDist" value="${lastCalculatedKm || 20}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Schedule Timing</label>
          <input type="text" class="form-control" id="rTiming" value="07:30 AM - 08:35 AM" />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Assign Bus</label>
          <select class="form-control form-select" id="rBus">
            <option value="">-- Select Bus --</option>
            ${(busesRes.data || []).map(b => `<option value="${b.id}">${b.busNumber}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Assign Driver</label>
          <select class="form-control form-select" id="rDriver">
            <option value="">-- Select Driver --</option>
            ${(driversRes.data || []).map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button type="button" class="btn btn-secondary" onclick="closeAdminModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Route in MySQL</button>
      </div>
    </form>
  `;

  document.getElementById('addRouteModalForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      routeNumber: document.getElementById('rNum').value.trim(),
      title: document.getElementById('rTitle').value.trim(),
      startPoint: document.getElementById('rStart').value.trim(),
      endPoint: document.getElementById('rEnd').value.trim(),
      distance: document.getElementById('rDist').value,
      timing: document.getElementById('rTiming').value.trim(),
      busId: document.getElementById('rBus').value || null,
      driverId: document.getElementById('rDriver').value || null
    };

    const res = await api.post('/routes', payload);
    if (!res.success) {
      showToast('Error', res.message, 'error');
      return;
    }

    showToast('Route Created', 'Transit line saved to database.', 'success');
    closeAdminModal();
    loadRoutesView();
    loadDashboardData();
  };

  modal.classList.add('active');
};

window.openEditRouteModal = async (routeId) => {
  const modal = document.getElementById('adminGenericModal');
  const modalTitle = document.getElementById('adminModalTitle');
  const modalBody = document.getElementById('adminModalBody');
  if (!modal) return;

  const [rRes, busesRes, driversRes] = await Promise.all([
    api.get(`/routes/${routeId}`),
    api.get('/buses'),
    api.get('/drivers')
  ]);

  if (!rRes.success) return;
  const r = rRes.data;

  modalTitle.innerText = `Edit Route: ${r.route_number}`;
  modalBody.innerHTML = `
    <form id="editRouteModalForm">
      <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Route Number</label>
          <input type="text" class="form-control" id="erNum" value="${r.route_number}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Route Title</label>
          <input type="text" class="form-control" id="erTitle" value="${r.route_name}" required />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Starting Point</label>
          <input type="text" class="form-control" id="erStart" value="${r.start_point}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Distance (KM)</label>
          <input type="number" step="0.1" class="form-control" id="erDist" value="${r.distance_km}" required />
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Assign Bus</label>
          <select class="form-control form-select" id="erBus">
            <option value="">-- Unassigned --</option>
            ${(busesRes.data || []).map(b => `<option value="${b.id}" ${b.id === r.bus_id ? 'selected' : ''}>${b.busNumber}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Assign Driver</label>
          <select class="form-control form-select" id="erDriver">
            <option value="">-- Unassigned --</option>
            ${(driversRes.data || []).map(d => `<option value="${d.id}" ${d.id === r.driver_id ? 'selected' : ''}>${d.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button type="button" class="btn btn-secondary" onclick="closeAdminModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Update Route</button>
      </div>
    </form>
  `;

  document.getElementById('editRouteModalForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      routeNumber: document.getElementById('erNum').value.trim(),
      title: document.getElementById('erTitle').value.trim(),
      startPoint: document.getElementById('erStart').value.trim(),
      distance: document.getElementById('erDist').value,
      busId: document.getElementById('erBus').value || null,
      driverId: document.getElementById('erDriver').value || null
    };

    const res = await api.put(`/routes/${routeId}`, payload);
    if (!res.success) {
      showToast('Error', res.message, 'error');
      return;
    }

    showToast('Updated', 'Route updated in MySQL.', 'success');
    closeAdminModal();
    loadRoutesView();
  };

  modal.classList.add('active');
};

// 11. Load Locations View
async function loadLocationsView() {
  const tbody = document.getElementById('locationsTableBody');
  if (!tbody) return;

  try {
    const res = await api.get('/locations');
    if (!res.success) return;

    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 2rem;">No pickup locations stored in database. Click "+ Add Pickup Stop" to create.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(l => `
      <tr>
        <td><strong>${l.name}</strong></td>
        <td><span class="badge badge-info">${l.zone}</span></td>
        <td>${l.distanceKm} km</td>
        <td>${l.routeName}</td>
        <td>${l.morningPickupTime}</td>
        <td>${l.eveningDropTime}</td>
        <td><span class="badge ${l.status === 'active' ? 'badge-success' : 'badge-secondary'}">${l.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openEditLocationModal(${l.id})">Edit</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('loadLocationsView error:', err);
  }
}

window.openAddLocationModal = async () => {
  const modal = document.getElementById('adminGenericModal');
  const modalTitle = document.getElementById('adminModalTitle');
  const modalBody = document.getElementById('adminModalBody');
  if (!modal) return;

  modalTitle.innerText = 'Add Designated Pickup Stop';
  const routesRes = await api.get('/routes');

  modalBody.innerHTML = `
    <form id="addLocationForm">
      <div class="form-group">
        <label class="form-label">Stop / Center Name *</label>
        <input type="text" class="form-control" id="locName" required placeholder="e.g. Madanapalle RTC Bus Stand" />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Pricing Zone</label>
          <input type="text" class="form-control" id="locZone" value="Zone 1" />
        </div>
        <div class="form-group">
          <label class="form-label">Distance from Campus (KM) *</label>
          <input type="number" step="0.1" class="form-control" id="locDist" value="18" required />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Assigned Transit Route</label>
        <select class="form-control form-select" id="locRoute">
          <option value="">-- Assign to Route --</option>
          ${(routesRes.data || []).map(r => `<option value="${r.id}">${r.route_number} - ${r.route_name}</option>`).join('')}
        </select>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Morning Pickup Time</label>
          <input type="text" class="form-control" id="locMTime" value="07:45 AM" />
        </div>
        <div class="form-group">
          <label class="form-label">Evening Drop Time</label>
          <input type="text" class="form-control" id="locETime" value="05:30 PM" />
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button type="button" class="btn btn-secondary" onclick="closeAdminModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save Stop to MySQL</button>
      </div>
    </form>
  `;

  document.getElementById('addLocationForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('locName').value.trim(),
      zone: document.getElementById('locZone').value.trim(),
      distanceKm: document.getElementById('locDist').value,
      routeId: document.getElementById('locRoute').value || null,
      morningPickupTime: document.getElementById('locMTime').value.trim(),
      eveningDropTime: document.getElementById('locETime').value.trim()
    };

    const res = await api.post('/locations', payload);
    if (!res.success) {
      showToast('Error', res.message, 'error');
      return;
    }

    showToast('Stop Added', 'Pickup stop saved to MySQL.', 'success');
    closeAdminModal();
    loadLocationsView();
  };

  modal.classList.add('active');
};

window.openEditLocationModal = async (locId) => {
  const modal = document.getElementById('adminGenericModal');
  const modalTitle = document.getElementById('adminModalTitle');
  const modalBody = document.getElementById('adminModalBody');
  if (!modal) return;

  const [locRes, routesRes] = await Promise.all([
    api.get(`/locations/${locId}`),
    api.get('/routes')
  ]);

  if (!locRes.success) return;
  const l = locRes.data;

  modalTitle.innerText = `Edit Stop: ${l.name}`;
  modalBody.innerHTML = `
    <form id="editLocationForm">
      <div class="form-group">
        <label class="form-label">Stop Name</label>
        <input type="text" class="form-control" id="elName" value="${l.name}" required />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Zone</label>
          <input type="text" class="form-control" id="elZone" value="${l.zone}" />
        </div>
        <div class="form-group">
          <label class="form-label">Distance (KM)</label>
          <input type="number" step="0.1" class="form-control" id="elDist" value="${l.distance_km}" required />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Assigned Route</label>
        <select class="form-control form-select" id="elRoute">
          <option value="">-- Unassigned --</option>
          ${(routesRes.data || []).map(r => `<option value="${r.id}" ${r.id === l.route_id ? 'selected' : ''}>${r.route_number} - ${r.route_name}</option>`).join('')}
        </select>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button type="button" class="btn btn-secondary" onclick="closeAdminModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Update Stop</button>
      </div>
    </form>
  `;

  document.getElementById('editLocationForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('elName').value.trim(),
      zone: document.getElementById('elZone').value.trim(),
      distanceKm: document.getElementById('elDist').value,
      routeId: document.getElementById('elRoute').value || null
    };

    const res = await api.put(`/locations/${locId}`, payload);
    if (!res.success) {
      showToast('Error', res.message, 'error');
      return;
    }

    showToast('Updated', 'Stop updated in MySQL.', 'success');
    closeAdminModal();
    loadLocationsView();
  };

  modal.classList.add('active');
};

// 12. Load Transportation Applications
async function loadTransAppsView() {
  const tbody = document.getElementById('transAppsTableBody');
  if (!tbody) return;

  try {
    const res = await api.get('/students?status=pending');
    if (!res.success) return;

    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding: 2rem;">No pending transportation enrollment requests.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(s => `
      <tr>
        <td>#APP-${s.id}</td>
        <td><strong>${s.name}</strong></td>
        <td><strong style="color: #0d9488;">${s.rollNumber}</strong></td>
        <td>${s.course}</td>
        <td>${s.locationName}</td>
        <td>${s.routeName}</td>
        <td>${new Date().toLocaleDateString('en-IN')}</td>
        <td><span class="badge badge-warning">pending</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="approveStudentTransportation(${s.id})">Approve &amp; Assign</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('loadTransAppsView error:', err);
  }
}

window.approveStudentTransportation = async (studentId) => {
  try {
    const res = await api.put(`/students/${studentId}`, { transportationStatus: 'approved' });
    if (res.success) {
      showToast('Approved', 'Student transportation approved. Student can now pay fee.', 'success');
      loadTransAppsView();
    }
  } catch (e) {
    showToast('Error', 'Failed to approve enrollment.', 'error');
  }
};

// ============================================================================
// 13. Transportation Fee Management System - Complete 7 Modules Implementation
// ============================================================================

let _cachedFeeStructures = [];
let _cachedStudentFeeRecords = [];
let _cachedPayments = [];
let _cachedLateFees = [];
let _currentPreviewPayment = null;

async function loadFeeManagementView() {
  await Promise.all([
    populateFeeStructureDropdowns(),
    populateStudentFeeDropdowns()
  ]);
  loadFeeStructures();
}

// ----------------------------------------------------------------------------
// MODULE 1: BUS FEE STRUCTURE
// ----------------------------------------------------------------------------
async function populateFeeStructureDropdowns() {
  try {
    const [routesRes, busesRes] = await Promise.all([
      api.get('/routes'),
      api.get('/buses')
    ]);

    const routeSelect = document.getElementById('feeStructRoute');
    if (routeSelect && routesRes.success) {
      const currentVal = routeSelect.value;
      routeSelect.innerHTML = '<option value="">-- Select Route --</option>' +
        (routesRes.data || []).map(r => `<option value="${r.id}" data-bus="${r.bus_id || ''}" data-dist="${r.distance_km || 0}">${r.route_number} - ${r.route_name}</option>`).join('');
      if (currentVal) routeSelect.value = currentVal;
    }

    const busSelect = document.getElementById('feeStructBus');
    if (busSelect && busesRes.success) {
      const currentVal = busSelect.value;
      busSelect.innerHTML = '<option value="">-- Select Bus --</option>' +
        (busesRes.data || []).map(b => `<option value="${b.id}">${b.busNumber}</option>`).join('');
      if (currentVal) busSelect.value = currentVal;
    }
  } catch (err) {
    console.error('populateFeeStructureDropdowns error:', err);
  }
}

window.onFeeStructureRouteChange = function() {
  const routeSelect = document.getElementById('feeStructRoute');
  const busSelect = document.getElementById('feeStructBus');
  if (!routeSelect || !busSelect) return;
  const opt = routeSelect.options[routeSelect.selectedIndex];
  if (opt && opt.getAttribute('data-bus')) {
    busSelect.value = opt.getAttribute('data-bus');
  }
};

window.loadFeeStructures = async function() {
  const tbody = document.getElementById('feeStructuresTableBody');
  if (!tbody) return;

  try {
    const res = await api.get('/fees/structures');
    if (!res.success) return;
    _cachedFeeStructures = res.data || [];

    if (_cachedFeeStructures.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 2rem;">No fee structures configured yet in MySQL. Fill the form above and click Save.</td></tr>`;
      return;
    }

    tbody.innerHTML = _cachedFeeStructures.map(fs => {
      const routeText = fs.route_number ? `${fs.route_number} - ${fs.route_name || ''}` : (fs.route_name || 'Route');
      const busText = fs.bus_number || 'Bus Unassigned';
      const feeVal = parseFloat(fs.final_fee || fs.fixed_route_fee || 0);

      return `
        <tr>
          <td><strong>${routeText}</strong></td>
          <td>${busText}</td>
          <td><strong style="color: #0d9488; font-size: 1rem;">₹${feeVal.toLocaleString('en-IN')}</strong></td>
          <td>${fs.academic_year || '2026-27'}</td>
          <td>Sem ${fs.semester || '1'}</td>
          <td>
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-secondary btn-sm" onclick="editFeeStructure(${fs.id})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteFeeStructure(${fs.id})">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('loadFeeStructures error:', err);
  }
};

window.saveBusFeeStructure = async function() {
  const editId = document.getElementById('feeStructEditId')?.value;
  const routeId = document.getElementById('feeStructRoute')?.value;
  const busId = document.getElementById('feeStructBus')?.value || null;
  const amount = document.getElementById('feeStructAmount')?.value;
  const academicYear = document.getElementById('feeStructAcademicYear')?.value.trim() || '2026-27';
  const semester = document.getElementById('feeStructSemester')?.value || '1';
  const calcType = document.getElementById('feeStructCalcType')?.value || 'FIXED_ROUTE';

  if (!routeId) {
    showToast('Validation Error', 'Please select a Route.', 'warning');
    return;
  }
  if (!amount || parseFloat(amount) < 0) {
    showToast('Validation Error', 'Please enter a valid Fee Amount.', 'warning');
    return;
  }

  const payload = {
    route_id: routeId,
    bus_id: busId,
    academic_year: academicYear,
    semester: semester,
    fee_calculation_type: calcType,
    feeAmount: amount,
    fixed_route_fee: amount
  };

  try {
    let res;
    if (editId) {
      res = await api.put(`/fees/${editId}`, payload);
    } else {
      res = await api.post('/fees', payload);
    }

    if (!res.success) {
      showToast('Error', res.message || 'Failed to save fee structure.', 'error');
      return;
    }

    showToast('Saved', editId ? 'Fee structure updated successfully in MySQL!' : 'Fee structure created successfully in MySQL!', 'success');
    clearBusFeeStructureForm();
    loadFeeStructures();
    populateStudentFeeDropdowns();
    loadStudentFeeRecords();
  } catch (err) {
    console.error('saveBusFeeStructure error:', err);
    showToast('Error', 'Server error saving fee structure.', 'error');
  }
};

window.editFeeStructure = function(id) {
  const fs = _cachedFeeStructures.find(item => item.id == id);
  if (!fs) return;

  document.getElementById('feeStructEditId').value = fs.id;
  document.getElementById('feeStructRoute').value = fs.route_id || '';
  document.getElementById('feeStructBus').value = fs.bus_id || '';
  document.getElementById('feeStructAmount').value = Math.round(parseFloat(fs.final_fee || fs.fixed_route_fee || 0));
  document.getElementById('feeStructAcademicYear').value = fs.academic_year || '2026-27';
  document.getElementById('feeStructSemester').value = fs.semester || '1';
  if (document.getElementById('feeStructCalcType')) {
    document.getElementById('feeStructCalcType').value = fs.fee_calculation_type || 'FIXED_ROUTE';
  }

  const title = document.getElementById('busFeeFormTitle');
  if (title) title.innerText = `Edit Bus Fee Structure #${fs.id}`;
  const badge = document.getElementById('busFeeFormModeBadge');
  if (badge) {
    badge.innerText = 'Edit Mode';
    badge.className = 'badge badge-warning';
  }

  const card = document.getElementById('busFeeStructureFormCard');
  if (card) {
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth' });
  }
};

window.deleteFeeStructure = async function(id) {
  if (!confirm(`Are you sure you want to delete Fee Structure #${id} from MySQL?`)) return;
  try {
    const res = await api.delete(`/fees/${id}`);
    if (res.success) {
      showToast('Deleted', 'Fee structure deleted from database.', 'success');
      loadFeeStructures();
    } else {
      showToast('Error', res.message || 'Failed to delete fee structure.', 'error');
    }
  } catch (err) {
    showToast('Error', 'Error deleting fee structure.', 'error');
  }
};

window.clearBusFeeStructureForm = function() {
  const form = document.getElementById('busFeeStructureForm');
  if (form) form.reset();
  document.getElementById('feeStructEditId').value = '';
  document.getElementById('feeStructAcademicYear').value = '2026-27';
  const title = document.getElementById('busFeeFormTitle');
  if (title) title.innerText = 'Add / Edit Bus Fee Structure';
  const badge = document.getElementById('busFeeFormModeBadge');
  if (badge) {
    badge.innerText = 'Create Mode';
    badge.className = 'badge badge-info';
  }
};

window.openAddFeeStructureModal = function() {
  window.switchFeeSubtab('fee-structures');
  const card = document.getElementById('busFeeStructureFormCard');
  if (card) {
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth' });
  }
};

// ----------------------------------------------------------------------------
// MODULE 2: STUDENT FEE RECORDS
// ----------------------------------------------------------------------------
async function populateStudentFeeDropdowns() {
  try {
    const [busesRes, routesRes] = await Promise.all([
      api.get('/buses'),
      api.get('/routes')
    ]);

    const busSelect = document.getElementById('studentFeeBusSelect');
    if (busSelect && busesRes.success) {
      const cur = busSelect.value;
      busSelect.innerHTML = '<option value="">-- Select Bus --</option>' +
        (busesRes.data || []).map(b => `<option value="${b.id}">${b.busNumber}</option>`).join('');
      if (cur) busSelect.value = cur;
    }

    const routeSelect = document.getElementById('studentFeeRouteSelect');
    if (routeSelect && routesRes.success) {
      const cur = routeSelect.value;
      routeSelect.innerHTML = '<option value="">-- Select Route --</option>' +
        (routesRes.data || []).map(r => `<option value="${r.id}" data-bus="${r.bus_id || ''}">${r.route_number} - ${r.route_name}</option>`).join('');
      if (cur) routeSelect.value = cur;
    }
  } catch (err) {
    console.error('populateStudentFeeDropdowns error:', err);
  }
}

window.onStudentFeeRouteChange = function() {
  const routeSelect = document.getElementById('studentFeeRouteSelect');
  const busSelect = document.getElementById('studentFeeBusSelect');
  const amountInput = document.getElementById('studentFeeAmount');
  if (!routeSelect) return;

  const opt = routeSelect.options[routeSelect.selectedIndex];
  if (opt && opt.getAttribute('data-bus') && busSelect) {
    busSelect.value = opt.getAttribute('data-bus');
  }

  const routeId = routeSelect.value;
  if (routeId && _cachedFeeStructures.length > 0) {
    const match = _cachedFeeStructures.find(fs => fs.route_id == routeId);
    if (match && amountInput && !amountInput.value) {
      amountInput.value = Math.round(parseFloat(match.final_fee || match.fixed_route_fee || 0));
    }
  }
};

window.lookupStudentForFee = async function(roll) {
  if (!roll || !roll.trim()) return;
  const clean = roll.trim();
  const hint = document.getElementById('studentFeeLookupHint');

  try {
    if (hint) hint.innerText = 'Checking student database...';
    const res = await api.get('/admin/student-lookup/' + encodeURIComponent(clean));
    if (!res.success || !res.data) {
      if (hint) hint.innerText = 'New student. Please enter name and details.';
      return;
    }

    const s = res.data;
    const nameInput = document.getElementById('studentFeeStudentName');
    const semSelect = document.getElementById('studentFeeSemester');
    const routeSelect = document.getElementById('studentFeeRouteSelect');
    const busSelect = document.getElementById('studentFeeBusSelect');
    const amountInput = document.getElementById('studentFeeAmount');
    const ayInput = document.getElementById('studentFeeAcademicYear');

    if (nameInput) nameInput.value = s.studentName || '';
    if (semSelect && s.semester) {
      const semStr = s.semester.toString();
      semSelect.value = semStr;
    }
    if (routeSelect && s.assignedRouteId) {
      routeSelect.value = s.assignedRouteId;
    }
    if (busSelect && s.assignedBusId) {
      busSelect.value = s.assignedBusId;
    }

    if (s.feeRecord) {
      if (amountInput) amountInput.value = Math.round(s.feeRecord.totalFee);
      if (ayInput && s.feeRecord.academicYear) ayInput.value = s.feeRecord.academicYear;
      if (hint) hint.innerHTML = `<span style="color: #059669;">✓ Found: ${s.studentName} (Current Pending: ₹${s.feeRecord.pendingAmount.toLocaleString('en-IN')})</span>`;
    } else {
      if (s.assignedRouteId && _cachedFeeStructures.length > 0) {
        const match = _cachedFeeStructures.find(fs => fs.route_id == s.assignedRouteId);
        if (match && amountInput) {
          amountInput.value = Math.round(parseFloat(match.final_fee || match.fixed_route_fee || 0));
        }
      }
      if (hint) hint.innerHTML = `<span style="color: #0284c7;">✓ Found: ${s.studentName} (${s.course || 'Student'}). Ready to assign fee.</span>`;
    }
  } catch (err) {
    if (hint) hint.innerText = 'Auto-lookup completed.';
  }
};

window.loadStudentFeeRecords = async function() {
  const tbody = document.getElementById('studentFeeRecordsTableBody');
  if (!tbody) return;

  try {
    const res = await api.get('/fees/records');
    if (!res.success) return;
    _cachedStudentFeeRecords = res.data || [];

    if (_cachedStudentFeeRecords.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">No student fee records found in MySQL. Fill the form above and click Save.</td></tr>`;
      return;
    }

    renderStudentFeeRecordsTable(_cachedStudentFeeRecords);
  } catch (err) {
    console.error('loadStudentFeeRecords error:', err);
  }
};

function renderStudentFeeRecordsTable(records) {
  const tbody = document.getElementById('studentFeeRecordsTableBody');
  if (!tbody) return;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">No matching student fee records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => {
    const routeText = r.route_number ? `${r.route_number} - ${r.route_name || ''}` : (r.route_name || 'Unassigned');
    const busText = r.bus_number || 'Unassigned';
    const feeVal = parseFloat(r.total_fee || 0);

    return `
      <tr>
        <td><strong style="color: #0d9488; font-family: monospace; font-size: 0.95rem;">${r.roll_number}</strong></td>
        <td><strong>${r.student_name}</strong></td>
        <td>Sem ${r.semester || '1'}</td>
        <td>${busText}</td>
        <td>${routeText}</td>
        <td><strong style="font-size: 1rem; color: #111827;">₹${feeVal.toLocaleString('en-IN')}</strong></td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-secondary btn-sm" onclick="editStudentFee(${r.id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteStudentFee(${r.id})">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.filterStudentFeeRecords = function() {
  const q = document.getElementById('feeRecordSearchInput')?.value.trim().toLowerCase() || '';
  if (!q) {
    renderStudentFeeRecordsTable(_cachedStudentFeeRecords);
    return;
  }
  const filtered = _cachedStudentFeeRecords.filter(r =>
    (r.roll_number && r.roll_number.toLowerCase().includes(q)) ||
    (r.student_name && r.student_name.toLowerCase().includes(q)) ||
    (r.route_number && r.route_number.toLowerCase().includes(q)) ||
    (r.bus_number && r.bus_number.toLowerCase().includes(q))
  );
  renderStudentFeeRecordsTable(filtered);
};

window.saveStudentFeeRecord = async function() {
  const editId = document.getElementById('studentFeeEditId')?.value;
  const roll = document.getElementById('studentFeeStudentId')?.value.trim();
  const name = document.getElementById('studentFeeStudentName')?.value.trim();
  const semester = document.getElementById('studentFeeSemester')?.value || '1';
  const busId = document.getElementById('studentFeeBusSelect')?.value || null;
  const routeId = document.getElementById('studentFeeRouteSelect')?.value || null;
  const amount = document.getElementById('studentFeeAmount')?.value;
  const academicYear = document.getElementById('studentFeeAcademicYear')?.value.trim() || '2026-27';

  if (!roll) {
    showToast('Validation Error', 'Student ID (Roll Number) is required.', 'warning');
    return;
  }
  if (!amount || parseFloat(amount) < 0) {
    showToast('Validation Error', 'Valid Fee Amount is required.', 'warning');
    return;
  }

  const payload = {
    studentId: roll,
    studentName: name,
    semester: semester,
    busId: busId,
    routeId: routeId,
    feeAmount: amount,
    academicYear: academicYear
  };

  try {
    let res;
    if (editId) {
      res = await api.put(`/admin/student-fees/${editId}`, payload);
    } else {
      res = await api.post('/admin/student-fees', payload);
    }

    if (!res.success) {
      showToast('Error', res.message || 'Failed to save student fee record.', 'error');
      return;
    }

    showToast('Success', editId ? 'Student fee record updated in MySQL!' : 'Student fee record saved in MySQL!', 'success');
    clearStudentFeeForm();
    loadStudentFeeRecords();
    loadPaidPendingStatus();
  } catch (err) {
    console.error('saveStudentFeeRecord error:', err);
    showToast('Error', 'Server error saving student fee record.', 'error');
  }
};

window.editStudentFee = function(id) {
  const r = _cachedStudentFeeRecords.find(item => item.id == id);
  if (!r) return;

  document.getElementById('studentFeeEditId').value = r.id;
  document.getElementById('studentFeeStudentId').value = r.roll_number || '';
  document.getElementById('studentFeeStudentName').value = r.student_name || '';
  document.getElementById('studentFeeSemester').value = r.semester || '1';
  document.getElementById('studentFeeBusSelect').value = r.assigned_bus_id || '';
  document.getElementById('studentFeeRouteSelect').value = r.route_id || '';
  document.getElementById('studentFeeAmount').value = Math.round(parseFloat(r.total_fee || 0));
  document.getElementById('studentFeeAcademicYear').value = r.academic_year || '2026-27';

  const title = document.getElementById('studentFeeFormTitle');
  if (title) title.innerText = `Edit Student Fee Record (#${r.id} - ${r.student_name})`;
  const badge = document.getElementById('studentFeeFormModeBadge');
  if (badge) {
    badge.innerText = 'Edit Mode';
    badge.className = 'badge badge-warning';
  }

  const card = document.getElementById('studentFeeRecordFormCard');
  if (card) {
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth' });
  }
};

window.deleteStudentFee = async function(id) {
  if (!confirm(`Are you sure you want to delete Student Fee Record #${id} from MySQL?`)) return;
  try {
    const res = await api.delete(`/admin/student-fees/${id}`);
    if (res.success) {
      showToast('Deleted', 'Student fee record deleted from database.', 'success');
      loadStudentFeeRecords();
      loadPaidPendingStatus();
    } else {
      showToast('Error', res.message || 'Failed to delete record.', 'error');
    }
  } catch (err) {
    showToast('Error', 'Failed to delete student fee record.', 'error');
  }
};

window.clearStudentFeeForm = function() {
  const form = document.getElementById('studentFeeRecordForm');
  if (form) form.reset();
  document.getElementById('studentFeeEditId').value = '';
  document.getElementById('studentFeeAcademicYear').value = '2026-27';
  const hint = document.getElementById('studentFeeLookupHint');
  if (hint) hint.innerText = 'Enter roll number to auto-populate';
  const title = document.getElementById('studentFeeFormTitle');
  if (title) title.innerText = 'Assign / Edit Student Fee Record';
  const badge = document.getElementById('studentFeeFormModeBadge');
  if (badge) {
    badge.innerText = 'Add Mode';
    badge.className = 'badge badge-info';
  }
};

// ----------------------------------------------------------------------------
// MODULE 3: PAID / PENDING STATUS
// ----------------------------------------------------------------------------
window.loadPaidPendingStatus = async function() {
  const tbody = document.getElementById('paidPendingTableBody');
  if (!tbody) return;

  try {
    const res = await api.get('/fees/records');
    if (!res.success) return;
    _cachedStudentFeeRecords = res.data || [];

    let totalAssigned = 0;
    let totalPaid = 0;
    let totalPending = 0;

    _cachedStudentFeeRecords.forEach(r => {
      totalAssigned += parseFloat(r.total_payable || r.total_fee || 0);
      totalPaid += parseFloat(r.paid_amount || 0);
      totalPending += parseFloat(r.pending_amount || 0);
    });

    const statAssigned = document.getElementById('statTotalFeeAssigned');
    const statPaid = document.getElementById('statTotalFeePaid');
    const statPending = document.getElementById('statTotalFeePending');

    if (statAssigned) statAssigned.innerText = `₹${totalAssigned.toLocaleString('en-IN')}`;
    if (statPaid) statPaid.innerText = `₹${totalPaid.toLocaleString('en-IN')}`;
    if (statPending) statPending.innerText = `₹${totalPending.toLocaleString('en-IN')}`;

    renderPaidPendingTable(_cachedStudentFeeRecords);
  } catch (err) {
    console.error('loadPaidPendingStatus error:', err);
  }
};

function renderPaidPendingTable(records) {
  const tbody = document.getElementById('paidPendingTableBody');
  if (!tbody) return;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">No fee reconciliation records found in database.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => {
    const totalFee = parseFloat(r.total_fee || 0);
    const paid = parseFloat(r.paid_amount || 0);
    const pending = parseFloat(r.pending_amount || 0);
    const status = r.payment_status || (pending <= 0 ? 'PAID' : (paid > 0 ? 'PARTIALLY PAID' : 'PENDING'));
    const badgeClass = status === 'PAID' ? 'badge-success' : (status === 'PARTIALLY PAID' ? 'badge-warning' : 'badge-danger');

    return `
      <tr>
        <td><strong style="color: #0d9488; font-family: monospace; font-size: 0.95rem;">${r.roll_number}</strong></td>
        <td><strong>${r.student_name}</strong></td>
        <td>₹${totalFee.toLocaleString('en-IN')}</td>
        <td><span style="color: #059669; font-weight: 700;">₹${paid.toLocaleString('en-IN')}</span></td>
        <td><span style="color: #dc2626; font-weight: 800;">₹${pending.toLocaleString('en-IN')}</span></td>
        <td><span class="badge ${badgeClass}">${status}</span></td>
        <td>
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="openFeeStatusDetail(${r.id})">👁️ View Details</button>
            ${pending > 0 ? `<button class="btn btn-primary btn-sm" onclick="openPaymentForStudent('${r.roll_number}')">💳 Pay Fee</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.filterPaidPendingStatus = function() {
  const q = document.getElementById('paidPendingSearchInput')?.value.trim().toLowerCase() || '';
  const statusFilter = document.getElementById('paidPendingStatusFilter')?.value || '';

  let filtered = _cachedStudentFeeRecords;
  if (statusFilter) {
    filtered = filtered.filter(r => (r.payment_status || '').toUpperCase() === statusFilter.toUpperCase());
  }
  if (q) {
    filtered = filtered.filter(r =>
      (r.roll_number && r.roll_number.toLowerCase().includes(q)) ||
      (r.student_name && r.student_name.toLowerCase().includes(q))
    );
  }
  renderPaidPendingTable(filtered);
};

window.openFeeStatusDetail = function(id) {
  const r = _cachedStudentFeeRecords.find(item => item.id == id);
  if (!r) return;

  const modal = document.getElementById('feeStatusDetailModal');
  const content = document.getElementById('feeStatusDetailContent');
  if (!modal || !content) return;

  const totalFee = parseFloat(r.total_fee || 0);
  const paid = parseFloat(r.paid_amount || 0);
  const pending = parseFloat(r.pending_amount || 0);
  const lateFee = parseFloat(r.late_fee || 0);
  const totalPayable = parseFloat(r.total_payable || (totalFee + lateFee));
  const status = r.payment_status;

  content.innerHTML = `
    <div style="margin-bottom: 1.25rem;">
      <h4 style="font-size: 1.15rem; font-weight: 800; color: #111827; margin-bottom: 0.25rem;">${r.student_name}</h4>
      <div style="font-size: 0.85rem; color: #64748b; font-family: monospace;">Roll No: ${r.roll_number} • Course: ${r.course || 'N/A'} • Sem ${r.semester || '1'}</div>
      <div style="font-size: 0.82rem; color: #475569; margin-top: 0.25rem;">Transit Route: <strong>${r.route_number || ''} ${r.route_name || 'Assigned Route'}</strong> | Bus: <strong>${r.bus_number || 'Linked Bus'}</strong></div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.25rem;">
      <div>
        <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Base Route Fee</div>
        <div style="font-size: 1.2rem; font-weight: 800; color: #111827;">₹${totalFee.toLocaleString('en-IN')}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Late Fine / Penalty</div>
        <div style="font-size: 1.2rem; font-weight: 800; color: ${lateFee > 0 ? '#b91c1c' : '#475569'};">₹${lateFee.toLocaleString('en-IN')}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Total Payable</div>
        <div style="font-size: 1.2rem; font-weight: 900; color: #111827;">₹${totalPayable.toLocaleString('en-IN')}</div>
      </div>
      <div>
        <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Total Paid So Far</div>
        <div style="font-size: 1.2rem; font-weight: 800; color: #059669;">₹${paid.toLocaleString('en-IN')}</div>
      </div>
      <div style="grid-column: 1 / -1; border-top: 1px dashed #cbd5e1; padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Net Pending Balance</div>
          <div style="font-size: 1.4rem; font-weight: 900; color: #dc2626;">₹${pending.toLocaleString('en-IN')}</div>
        </div>
        <div>
          <span class="badge ${status === 'PAID' ? 'badge-success' : (status === 'PARTIALLY PAID' ? 'badge-warning' : 'badge-danger')}" style="font-size: 0.9rem; padding: 0.4rem 0.85rem;">
            ${status}
          </span>
        </div>
      </div>
    </div>

    ${pending > 0 ? `
      <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
        <button class="btn btn-primary" onclick="document.getElementById('feeStatusDetailModal').classList.remove('active'); openPaymentForStudent('${r.roll_number}');">
          💳 Process Payment (₹${pending.toLocaleString('en-IN')} Due)
        </button>
      </div>
    ` : `
      <div style="text-align: right; color: #059669; font-weight: 700; font-size: 0.9rem;">
        ✓ Account fully cleared. No outstanding pending balance.
      </div>
    `}
  `;

  modal.classList.add('active');
};

window.openPaymentForStudent = function(studentRoll) {
  window.switchFeeSubtab('payment-processing');
  const input = document.getElementById('payProcStudentId');
  if (input) {
    input.value = studentRoll;
    lookupStudentForPayment(studentRoll);
  }
};

// ----------------------------------------------------------------------------
// MODULE 4: PAYMENT PROCESSING
// ----------------------------------------------------------------------------
window.loadPaymentProcessingModule = function() {
  const dateInput = document.getElementById('payProcDate');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  const txnInput = document.getElementById('payProcTxnId');
  if (txnInput && !txnInput.value) {
    generateRandomTxnIdForField();
  }
  loadCashVerificationQueue();
};

window.generateRandomTxnIdForField = function() {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const txn = `TXN${Date.now().toString(36).toUpperCase()}${randomSuffix}`;
  const input = document.getElementById('payProcTxnId');
  if (input) input.value = txn;
};

window.lookupStudentForPayment = async function(roll) {
  if (!roll || !roll.trim()) return;
  const clean = roll.trim();
  const nameInput = document.getElementById('payProcStudentName');
  const pendingDisplay = document.getElementById('payProcPendingDisplay');
  const amountInput = document.getElementById('payProcAmount');

  try {
    if (pendingDisplay) pendingDisplay.innerText = 'Looking up student balances...';
    const res = await api.get('/admin/student-lookup/' + encodeURIComponent(clean));
    if (!res.success || !res.data) {
      if (nameInput) nameInput.value = '';
      if (pendingDisplay) {
        pendingDisplay.innerText = 'Student not found in database.';
        pendingDisplay.style.color = '#b91c1c';
      }
      return;
    }

    const s = res.data;
    if (nameInput) nameInput.value = s.studentName;

    if (s.feeRecord) {
      const pending = parseFloat(s.feeRecord.pendingAmount || 0);
      if (pendingDisplay) {
        pendingDisplay.innerText = `Pending: ₹${pending.toLocaleString('en-IN')} (Total: ₹${s.feeRecord.totalFee.toLocaleString('en-IN')}, Paid: ₹${s.feeRecord.paidAmount.toLocaleString('en-IN')})`;
        pendingDisplay.style.color = pending <= 0 ? '#059669' : '#b91c1c';
        pendingDisplay.style.background = pending <= 0 ? '#ecfdf5' : '#fef2f2';
      }
      if (amountInput) {
        amountInput.max = pending;
        if (pending > 0 && !amountInput.value) {
          amountInput.value = pending;
        }
      }
    } else {
      if (pendingDisplay) {
        pendingDisplay.innerText = 'No Fee Record found. Please configure Student Fee Record first.';
        pendingDisplay.style.color = '#b91c1c';
      }
    }
  } catch (err) {
    console.error('lookupStudentForPayment error:', err);
  }
};

window.submitAdminPayment = async function() {
  const roll = document.getElementById('payProcStudentId')?.value.trim();
  const amount = parseFloat(document.getElementById('payProcAmount')?.value || 0);
  const method = document.getElementById('payProcMethod')?.value || 'UPI';
  const txnId = document.getElementById('payProcTxnId')?.value.trim();
  const status = document.getElementById('payProcStatus')?.value || 'SUCCESSFUL';
  const payDate = document.getElementById('payProcDate')?.value;

  if (!roll) {
    showToast('Validation Error', 'Student ID is required.', 'warning');
    return;
  }
  if (!amount || isNaN(amount) || amount <= 0) {
    showToast('Validation Error', 'Payment Amount must be greater than ₹0.', 'warning');
    return;
  }
  if (!payDate) {
    showToast('Validation Error', 'Payment Date is required.', 'warning');
    return;
  }

  const payload = {
    studentId: roll,
    amount: amount,
    paymentMethod: method,
    transactionId: txnId,
    paymentStatus: status,
    paymentDate: payDate
  };

  try {
    const res = await api.post('/admin/payments', payload);
    if (!res.success) {
      showToast('Payment Failed', res.message || 'Error processing payment.', 'error');
      return;
    }

    const { receiptNumber, newPaid, newPending, calculatedStatus } = res.data || {};
    showToast(
      'Payment Processed Successfully!',
      `Receipt: ${receiptNumber || 'Created'} • New Status: ${calculatedStatus || 'Updated'} • Remaining Pending: ₹${(newPending || 0).toLocaleString('en-IN')}`,
      'success'
    );

    clearAdminPaymentForm();
    loadPaidPendingStatus();
    loadFeeHistory();
    loadReceiptsDirectory();
  } catch (err) {
    console.error('submitAdminPayment error:', err);
    showToast('Error', 'Server error processing payment.', 'error');
  }
};

window.clearAdminPaymentForm = function() {
  const form = document.getElementById('adminPaymentForm');
  if (form) form.reset();
  const dateInput = document.getElementById('payProcDate');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  const pendingDisplay = document.getElementById('payProcPendingDisplay');
  if (pendingDisplay) {
    pendingDisplay.innerText = 'Pending: ₹0';
    pendingDisplay.style.color = '#b91c1c';
    pendingDisplay.style.background = '#fef2f2';
  }
  generateRandomTxnIdForField();
};

async function loadCashVerificationQueue() {
  const tbody = document.getElementById('cashProcessingTableBody');
  if (!tbody) return;

  try {
    const res = await api.get('/payments?status=PENDING ADMIN VERIFICATION');
    if (!res.success) return;

    if (!res.data || res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 1.5rem;">No cash payments awaiting verification.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(p => `
      <tr>
        <td><code>${p.transaction_id}</code></td>
        <td><strong>${p.student_name}</strong></td>
        <td>${p.roll_number}</td>
        <td><strong style="color: #0f766e;">₹${parseFloat(p.amount).toLocaleString('en-IN')}</strong></td>
        <td><span class="badge badge-warning">${p.payment_method}</span></td>
        <td>${new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
        <td><span class="badge badge-warning">${p.payment_status}</span></td>
        <td>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-success btn-sm" onclick="approveCashPayment(${p.payment_id})">Approve &amp; Issue Receipt</button>
            <button class="btn btn-danger btn-sm" onclick="rejectCashPayment(${p.payment_id})">Reject</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('loadCashVerificationQueue error:', err);
  }
}

window.approveCashPayment = async function(paymentId) {
  if (!confirm('Confirm cash receipt and issue official 11-character receipt?')) return;
  try {
    const res = await api.put(`/payments/cash/${paymentId}/approve`);
    if (res.success) {
      showToast('Cash Verified', `Receipt ${res.receiptNumber} generated and saved to MySQL.`, 'success');
      loadCashVerificationQueue();
      loadFeeHistory();
      loadReceiptsDirectory();
      loadPaidPendingStatus();
    } else {
      showToast('Error', res.message, 'error');
    }
  } catch (err) {
    showToast('Error', 'Failed to approve cash payment.', 'error');
  }
};

window.rejectCashPayment = async function(paymentId) {
  const reason = prompt('Please enter the reason for rejecting this cash payment:');
  if (reason === null) return;
  try {
    const res = await api.put(`/payments/cash/${paymentId}/reject`, { reason });
    if (res.success) {
      showToast('Rejected', 'Cash payment rejected and student notified.', 'info');
      loadCashVerificationQueue();
    } else {
      showToast('Error', res.message, 'error');
    }
  } catch (err) {
    showToast('Error', 'Failed to reject cash payment.', 'error');
  }
};

// ----------------------------------------------------------------------------
// MODULE 5: PAYMENT HISTORY
// ----------------------------------------------------------------------------
window.loadFeeHistory = async function() {
  const tbody = document.getElementById('feeHistoryTableBody');
  if (!tbody) return;

  try {
    const res = await api.get('/payments');
    if (!res.success) return;
    _cachedPayments = res.data || [];

    if (_cachedPayments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 2rem;">No payment transactions recorded in MySQL yet.</td></tr>`;
      return;
    }

    renderFeeHistoryTable(_cachedPayments);
  } catch (err) {
    console.error('loadFeeHistory error:', err);
  }
};

function renderFeeHistoryTable(payments) {
  const tbody = document.getElementById('feeHistoryTableBody');
  if (!tbody) return;

  if (payments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 2rem;">No matching payment history records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = payments.map(p => {
    const amt = parseFloat(p.amount || 0);
    const isSuccess = p.payment_status === 'SUCCESSFUL';
    const badgeClass = isSuccess ? 'badge-success' : (p.payment_status === 'REJECTED' ? 'badge-danger' : 'badge-warning');

    return `
      <tr>
        <td><code>${p.transaction_id}</code></td>
        <td><strong style="color: #0d9488; font-family: monospace;">${p.roll_number || p.student_id}</strong></td>
        <td><strong>${p.student_name}</strong></td>
        <td><strong style="font-size: 1rem; color: #111827;">₹${amt.toLocaleString('en-IN')}</strong></td>
        <td><span class="badge badge-info">${p.payment_method}</span></td>
        <td>${new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
        <td><span class="badge ${badgeClass}">${p.payment_status}</span></td>
        <td>
          ${p.receipt_number ? `
            <button class="btn btn-secondary btn-sm" onclick="viewReceiptModal('${p.receipt_number}')">👁️ View Receipt</button>
          ` : (isSuccess ? `
            <button class="btn btn-primary btn-sm" onclick="generateAndOpenReceipt('${p.payment_id}')">⚡ Get Receipt</button>
          ` : '-')}
        </td>
      </tr>
    `;
  }).join('');
}

window.filterFeeHistory = function() {
  const q = document.getElementById('payHistSearchInput')?.value.trim().toLowerCase() || '';
  const methodFilter = document.getElementById('payHistMethodFilter')?.value || '';
  const statusFilter = document.getElementById('payHistStatusFilter')?.value || '';

  let filtered = _cachedPayments;
  if (methodFilter) {
    filtered = filtered.filter(p => (p.payment_method || '').toUpperCase() === methodFilter.toUpperCase());
  }
  if (statusFilter) {
    filtered = filtered.filter(p => (p.payment_status || '').toUpperCase() === statusFilter.toUpperCase());
  }
  if (q) {
    filtered = filtered.filter(p =>
      (p.transaction_id && p.transaction_id.toLowerCase().includes(q)) ||
      (p.roll_number && p.roll_number.toLowerCase().includes(q)) ||
      (p.student_name && p.student_name.toLowerCase().includes(q))
    );
  }
  renderFeeHistoryTable(filtered);
};

window.generateAndOpenReceipt = async function(paymentId) {
  try {
    const res = await api.post('/admin/generate-receipt', { paymentId });
    if (res.success && res.data) {
      showToast('Receipt Generated', `Official Receipt ${res.data.receipt_number} generated.`, 'success');
      loadFeeHistory();
      loadReceiptsDirectory();
      viewReceiptModal(res.data.receipt_number);
    }
  } catch (err) {
    showToast('Error', 'Failed to generate receipt.', 'error');
  }
};

// ----------------------------------------------------------------------------
// MODULE 6: RECEIPT GENERATION
// ----------------------------------------------------------------------------
window.loadReceiptsDirectory = async function() {
  const tbody = document.getElementById('receiptsDirectoryTableBody') || document.getElementById('receiptsTableBody');
  if (!tbody) return;

  try {
    const res = await api.get('/payments?status=SUCCESSFUL');
    if (!res.success) return;

    const receipts = res.data || [];
    if (receipts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 2rem;">No receipts generated yet in MySQL database.</td></tr>`;
      return;
    }

    tbody.innerHTML = receipts.map(r => `
      <tr>
        <td><strong style="color: #0f766e; font-family: monospace; font-size: 1rem;">${r.receipt_number || 'N/A'}</strong></td>
        <td><code>${r.transaction_id}</code></td>
        <td>${r.roll_number || r.student_id}</td>
        <td><strong>${r.student_name}</strong></td>
        <td><strong style="color: #059669;">₹${parseFloat(r.amount).toLocaleString('en-IN')}</strong></td>
        <td>${r.payment_method}</td>
        <td>${new Date(r.payment_date).toLocaleDateString('en-IN')}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="viewReceiptModal('${r.receipt_number || r.payment_id}')">👁️ View Official Receipt</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('loadReceiptsDirectory error:', err);
  }
};

window.searchPaymentForReceipt = async function() {
  const query = document.getElementById('receiptSearchQuery')?.value.trim();
  if (!query) {
    showToast('Validation Error', 'Please enter a Student ID or Transaction ID.', 'warning');
    return;
  }

  const container = document.getElementById('receiptSelectedContainer');
  try {
    const res = await api.post('/admin/generate-receipt', {
      studentId: query,
      transactionId: query
    });

    if (!res.success || !res.data) {
      showToast('Not Found', 'No successful payment found for this Student ID or Transaction ID.', 'error');
      if (container) container.style.display = 'none';
      return;
    }

    _currentPreviewPayment = res.data;
    const r = res.data;

    document.getElementById('prevReceiptNo').innerText = r.receipt_number || 'Pending Generation';
    document.getElementById('prevReceiptTxnId').innerText = r.transactionId || r.transaction_id || '--';
    document.getElementById('prevReceiptStudentId').innerText = r.studentRollNumber || r.studentId || query;
    document.getElementById('prevReceiptStudentName').innerText = r.studentName || '--';
    document.getElementById('prevReceiptAmount').innerText = `₹${parseFloat(r.amount || 0).toLocaleString('en-IN')}`;
    document.getElementById('prevReceiptMethod').innerText = r.payment_mode || r.payment_method || 'Online';
    document.getElementById('prevReceiptDate').innerText = new Date(r.receipt_date || r.payment_date || Date.now()).toLocaleDateString('en-IN');

    if (container) container.style.display = 'block';
    showToast('Found', 'Matching payment transaction loaded!', 'success');
  } catch (err) {
    console.error('searchPaymentForReceipt error:', err);
    showToast('Error', 'Failed to search payment record.', 'error');
  }
};

window.generateReceiptFromPreview = async function() {
  if (!_currentPreviewPayment) return;
  try {
    const res = await api.post('/admin/generate-receipt', {
      paymentId: _currentPreviewPayment.payment_id || _currentPreviewPayment.id
    });
    if (res.success && res.data) {
      _currentPreviewPayment.receipt_number = res.data.receipt_number;
      document.getElementById('prevReceiptNo').innerText = res.data.receipt_number;
      showToast('Receipt Generated', `Official Receipt Number: ${res.data.receipt_number}`, 'success');
      loadReceiptsDirectory();
      loadFeeHistory();
    }
  } catch (err) {
    showToast('Error', 'Could not generate receipt.', 'error');
  }
};

window.viewReceiptFromPreview = function() {
  if (!_currentPreviewPayment) return;
  const receiptNo = _currentPreviewPayment.receipt_number || _currentPreviewPayment.payment_id;
  viewReceiptModal(receiptNo);
};

window.printReceiptFromPreview = function() {
  if (!_currentPreviewPayment) return;
  const receiptNo = _currentPreviewPayment.receipt_number || _currentPreviewPayment.payment_id;
  viewReceiptModal(receiptNo);
  setTimeout(() => {
    window.print();
  }, 600);
};

window.downloadReceiptFromPreview = function() {
  if (!_currentPreviewPayment) return;
  const receiptNo = _currentPreviewPayment.receipt_number || _currentPreviewPayment.payment_id;
  viewReceiptModal(receiptNo);
  setTimeout(() => {
    window.print();
  }, 600);
};

// ----------------------------------------------------------------------------
// MODULE 7: LATE FEE / FINE
// ----------------------------------------------------------------------------
window.lookupStudentForFine = async function(roll) {
  if (!roll || !roll.trim()) return;
  const clean = roll.trim();

  try {
    const res = await api.get('/admin/student-lookup/' + encodeURIComponent(clean));
    if (!res.success || !res.data) {
      showToast('Student Not Found', `No student found with ID ${clean}`, 'warning');
      return;
    }

    const s = res.data;
    const nameInp = document.getElementById('lateFeeStudentName');
    const semInp = document.getElementById('lateFeeSemester');
    const pendingInp = document.getElementById('lateFeePendingAmount');
    const recIdInp = document.getElementById('lateFeeRecordId');

    if (nameInp) nameInp.value = s.studentName;
    if (semInp) semInp.value = 'Sem ' + (s.semester || '1');

    if (s.feeRecord) {
      if (pendingInp) pendingInp.value = Math.round(s.feeRecord.pendingAmount);
      if (recIdInp) recIdInp.value = s.feeRecord.id;
      calculateLateFeeTotalPayable();
    } else {
      if (pendingInp) pendingInp.value = 0;
      showToast('Notice', 'No active fee record found for this student. Assign fee first.', 'info');
    }
  } catch (err) {
    console.error('lookupStudentForFine error:', err);
  }
};

window.calculateLateFeeTotalPayable = function() {
  const pending = parseFloat(document.getElementById('lateFeePendingAmount')?.value || 0);
  const fine = parseFloat(document.getElementById('lateFeeAmount')?.value || 0);
  const totalInp = document.getElementById('lateFeeTotalPayable');
  if (totalInp) {
    totalInp.value = Math.max(0, Math.round(pending + fine));
  }
};

window.loadLateFeesList = async function() {
  const tbody = document.getElementById('lateFeesTableBody');
  if (!tbody) return;

  try {
    const res = await api.get('/fees/late-fees');
    if (!res.success) return;
    _cachedLateFees = res.data || [];

    if (_cachedLateFees.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 2rem;">No late fees or fine penalties recorded in database.</td></tr>`;
      return;
    }

    renderLateFeesTable(_cachedLateFees);
  } catch (err) {
    console.error('loadLateFeesList error:', err);
  }
};

function renderLateFeesTable(lateFees) {
  const tbody = document.getElementById('lateFeesTableBody');
  if (!tbody) return;

  if (lateFees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted" style="padding: 2rem;">No matching late fee records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = lateFees.map(lf => {
    const roll = lf.student_id_code || lf.roll_number || 'N/A';
    const name = lf.student_name || 'N/A';
    const sem = lf.semester || '1';
    const pending = parseFloat(lf.pending_amount || 0);
    const fine = parseFloat(lf.late_fee || lf.amount || 0);
    const total = parseFloat(lf.total_payable || (pending + fine));
    const reason = lf.reason || 'Late fee penalty';

    return `
      <tr>
        <td><strong style="color: #0d9488; font-family: monospace;">${roll}</strong></td>
        <td><strong>${name}</strong></td>
        <td>Sem ${sem}</td>
        <td><span style="color: #dc2626; font-weight: 700;">₹${pending.toLocaleString('en-IN')}</span></td>
        <td><span style="color: #e11d48; font-weight: 800;">₹${fine.toLocaleString('en-IN')}</span></td>
        <td><strong style="color: #111827; font-size: 1rem;">₹${total.toLocaleString('en-IN')}</strong></td>
        <td>${reason}</td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-secondary btn-sm" onclick="editLateFee(${lf.id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteLateFee(${lf.id})">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.filterLateFeesList = function() {
  const q = document.getElementById('lateFeeSearchInput')?.value.trim().toLowerCase() || '';
  if (!q) {
    renderLateFeesTable(_cachedLateFees);
    return;
  }
  const filtered = _cachedLateFees.filter(lf =>
    ((lf.student_id_code || lf.roll_number || '').toLowerCase().includes(q)) ||
    ((lf.student_name || '').toLowerCase().includes(q)) ||
    ((lf.reason || '').toLowerCase().includes(q))
  );
  renderLateFeesTable(filtered);
};

window.saveLateFeeRecord = async function() {
  const editId = document.getElementById('lateFeeEditId')?.value;
  const recId = document.getElementById('lateFeeRecordId')?.value;
  const fine = parseFloat(document.getElementById('lateFeeAmount')?.value || 0);
  const reason = document.getElementById('lateFeeReason')?.value.trim() || 'Late transportation fee penalty';

  if (!fine || fine <= 0) {
    showToast('Validation Error', 'Late Fee / Fine amount must be greater than ₹0.', 'warning');
    return;
  }

  try {
    let res;
    if (editId) {
      res = await api.put(`/fees/late-fees/${editId}`, { amount: fine, reason });
    } else {
      if (!recId) {
        showToast('Validation Error', 'Valid Student Fee Record required. Lookup a student first.', 'warning');
        return;
      }
      res = await api.post('/fees/late-fee', { recordId: recId, amount: fine, reason });
    }

    if (!res.success) {
      showToast('Error', res.message || 'Failed to save late fee.', 'error');
      return;
    }

    showToast('Fine Saved', 'Late fee penalty saved and synchronized with student payable in MySQL!', 'success');
    clearLateFeeForm();
    loadLateFeesList();
    loadStudentFeeRecords();
    loadPaidPendingStatus();
  } catch (err) {
    console.error('saveLateFeeRecord error:', err);
    showToast('Error', 'Server error saving late fee.', 'error');
  }
};

window.editLateFee = function(id) {
  const lf = _cachedLateFees.find(item => item.id == id);
  if (!lf) return;

  document.getElementById('lateFeeEditId').value = lf.id;
  document.getElementById('lateFeeRecordId').value = lf.student_fee_record_id || '';
  document.getElementById('lateFeeStudentId').value = lf.student_id_code || lf.roll_number || '';
  document.getElementById('lateFeeStudentName').value = lf.student_name || '';
  document.getElementById('lateFeeSemester').value = 'Sem ' + (lf.semester || '1');
  document.getElementById('lateFeePendingAmount').value = Math.round(parseFloat(lf.pending_amount || 0));
  document.getElementById('lateFeeAmount').value = Math.round(parseFloat(lf.late_fee || lf.amount || 0));
  document.getElementById('lateFeeReason').value = lf.reason || '';

  calculateLateFeeTotalPayable();

  const title = document.getElementById('lateFeeFormTitle');
  if (title) title.innerText = `Edit Late Fee Fine (#${lf.id} - ${lf.student_name})`;
  const badge = document.getElementById('lateFeeFormModeBadge');
  if (badge) {
    badge.innerText = 'Edit Mode';
    badge.className = 'badge badge-warning';
  }

  const card = document.getElementById('lateFeeFormCard');
  if (card) card.scrollIntoView({ behavior: 'smooth' });
};

window.deleteLateFee = async function(id) {
  if (!confirm(`Are you sure you want to remove Late Fee #${id}? Student pending balance will be recalculated in MySQL.`)) return;
  try {
    const res = await api.delete(`/fees/late-fees/${id}`);
    if (res.success) {
      showToast('Removed', 'Late fee penalty deleted from database.', 'success');
      loadLateFeesList();
      loadStudentFeeRecords();
      loadPaidPendingStatus();
    } else {
      showToast('Error', res.message || 'Failed to remove late fee.', 'error');
    }
  } catch (err) {
    showToast('Error', 'Failed to delete late fee.', 'error');
  }
};

window.clearLateFeeForm = function() {
  const form = document.getElementById('lateFeeForm');
  if (form) form.reset();
  document.getElementById('lateFeeEditId').value = '';
  document.getElementById('lateFeeRecordId').value = '';
  document.getElementById('lateFeeReason').value = 'Overdue transportation fee penalty';
  const title = document.getElementById('lateFeeFormTitle');
  if (title) title.innerText = 'Add / Edit Late Fee Fine';
  const badge = document.getElementById('lateFeeFormModeBadge');
  if (badge) {
    badge.innerText = 'Impose Penalty';
    badge.className = 'badge badge-danger';
  }
};

window.openApplyLateFeeModal = function(recordId, studentName = '') {
  window.switchFeeSubtab('late-fee');
  const rec = _cachedStudentFeeRecords.find(r => r.id == recordId);
  if (rec) {
    document.getElementById('lateFeeStudentId').value = rec.roll_number;
    lookupStudentForFine(rec.roll_number);
  }
};

// ----------------------------------------------------------------------------
// MODULE 8: FEE NOTIFICATIONS
// ----------------------------------------------------------------------------
async function loadFeeNotifications() {
  const container = document.getElementById('feeNotificationsListContainer');
  if (!container) return;

  try {
    const res = await api.get('/notifications?role=admin');
    if (!res.success) return;

    const feeNotifs = (res.data || []).filter(n =>
      (n.title && (n.title.toLowerCase().includes('fee') || n.title.toLowerCase().includes('payment') || n.title.toLowerCase().includes('receipt'))) ||
      (n.category && n.category.toLowerCase().includes('fee'))
    );

    if (feeNotifs.length === 0) {
      container.innerHTML = `<p class="text-muted text-center" style="padding: 2rem;">No fee-specific notification logs recorded.</p>`;
      return;
    }

    container.innerHTML = feeNotifs.map(n => `
      <div style="padding: 0.85rem; border-bottom: 1px solid #e5e4de; display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
        <div>
          <div style="font-weight: 700; color: #111827; margin-bottom: 0.2rem;">${n.title}</div>
          <div style="font-size: 0.84rem; color: #4b5563;">${n.message}</div>
        </div>
        <div style="font-size: 0.72rem; color: #9ca3af; white-space: nowrap;">${new Date(n.created_at).toLocaleString('en-IN')}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('loadFeeNotifications error:', err);
  }
}

// 14. VIEW 9: Admin Payments Ledger (Requirement 26)
async function loadAdminPaymentsView() {
  const tbody = document.getElementById('adminPaymentsTableBody');
  if (!tbody) return;

  try {
    const q = document.getElementById('paymentsSearchInput')?.value.trim() || '';
    const status = document.getElementById('paymentsStatusFilter')?.value || '';

    const res = await api.get('/payments', { search: q, status });
    if (!res.success) return;

    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding: 2rem;">No payment transactions found in database.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(p => `
      <tr>
        <td><code>${p.transaction_id}</code></td>
        <td><strong style="color: #0f766e;">${p.receipt_number || 'N/A'}</strong></td>
        <td>${p.student_id}</td>
        <td><strong>${p.student_name}</strong></td>
        <td>₹${parseFloat(p.amount).toLocaleString('en-IN')}</td>
        <td><span class="badge badge-info">${p.payment_method}</span></td>
        <td>${new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
        <td>
          <span class="badge ${p.payment_status === 'SUCCESSFUL' ? 'badge-success' : (p.payment_status === 'PENDING ADMIN VERIFICATION' ? 'badge-warning' : 'badge-danger')}">
            ${p.payment_status}
          </span>
        </td>
        <td>
          ${p.receipt_number ? `
            <button class="btn btn-secondary btn-sm" onclick="viewReceiptModal('${p.receipt_number}')">View Receipt</button>
          ` : (p.payment_status === 'PENDING ADMIN VERIFICATION' ? `
            <button class="btn btn-success btn-sm" onclick="approveCashPayment(${p.payment_id})">Verify Cash</button>
          ` : '-')}
        </td>
      </tr>
    `).join('');

    document.getElementById('paymentsSearchInput')?.addEventListener('input', debounce(loadAdminPaymentsView, 300));
    document.getElementById('paymentsStatusFilter')?.addEventListener('change', loadAdminPaymentsView);
  } catch (err) {
    console.error('loadAdminPaymentsView error:', err);
  }
}

// 15. VIEW 11: Bus Pass Applications Queue (Requirements 29, 30, 32)
async function loadPassAppsView(statusFilter = '') {
  const tbody = document.getElementById('passAppsTableBody');
  if (!tbody) return;

  try {
    const res = await api.get('/passes/applications', { status: statusFilter });
    if (!res.success) return;

    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted" style="padding: 2rem;">No bus pass applications match filter (${statusFilter || 'All'}).</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(app => `
      <tr>
        <td><strong>${app.student_name}</strong></td>
        <td>${app.student_id}</td>
        <td><strong style="color: #0d9488;">${app.roll_number}</strong></td>
        <td>${app.course}</td>
        <td>${app.bus_number}</td>
        <td>${app.route_number}</td>
        <td>${app.pickup_location_name}</td>
        <td><span class="badge badge-success">${app.fee_payment_status || 'PAID'}</span></td>
        <td>${new Date(app.applied_date).toLocaleDateString('en-IN')}</td>
        <td>
          <span class="badge ${app.status === 'APPROVED' ? 'badge-success' : (app.status === 'PENDING' ? 'badge-warning' : 'badge-danger')}">
            ${app.status}
          </span>
        </td>
        <td>
          ${app.status === 'PENDING' ? `
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-success btn-sm" onclick="approveBusPass(${app.id})">APPROVE</button>
              <button class="btn btn-danger btn-sm" onclick="rejectBusPass(${app.id})">REJECT</button>
            </div>
          ` : `<span style="font-size: 0.8rem; color: #64748b;">${app.status}</span>`}
        </td>
      </tr>
    `).join('');

    // Bind filter buttons
    document.querySelectorAll('.pass-filter-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.pass-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadPassAppsView(btn.getAttribute('data-filter'));
      };
    });
  } catch (err) {
    console.error('loadPassAppsView error:', err);
  }
}

window.approveBusPass = async (applicationId) => {
  if (!confirm('Approve this bus pass application and generate active digital transit pass?')) return;
  try {
    const res = await api.put(`/passes/applications/${applicationId}/approve`);
    if (res.success) {
      showToast('Bus Pass Approved', `Digital Pass ${res.passNumber} issued successfully.`, 'success');
      loadPassAppsView();
      loadDashboardData();
    } else {
      showToast('Error', res.message, 'error');
    }
  } catch (err) {
    showToast('Error', 'Failed to approve bus pass.', 'error');
  }
};

window.rejectBusPass = async (applicationId) => {
  const reason = prompt('Please provide the rejection reason to notify the student:');
  if (reason === null) return;

  try {
    const res = await api.put(`/passes/applications/${applicationId}/reject`, { reason });
    if (res.success) {
      showToast('Rejected', 'Bus pass application rejected.', 'info');
      loadPassAppsView();
    }
  } catch (err) {
    showToast('Error', 'Failed to reject bus pass.', 'error');
  }
};

// 16. VIEW 12: Active Bus Passes
async function loadPassesView() {
  const container = document.getElementById('passesContainer');
  if (!container) return;

  try {
    const res = await api.get('/passes?status=ACTIVE');
    if (!res.success) return;

    if (res.data.length === 0) {
      container.innerHTML = `<div class="text-center text-muted" style="grid-column: 1 / -1; padding: 2rem;">No active bus passes issued yet in database.</div>`;
      return;
    }

    container.innerHTML = res.data.map(p => `
      <div class="card" style="padding: 1.5rem; border-top: 4px solid #0d9488;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <div>
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #0d9488; font-weight: 800;">Digital Bus Transit Pass</div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #111827;">${p.student_name}</h3>
            <div style="font-size: 0.85rem; color: #475569; font-weight: 700;">Roll No: ${p.roll_number}</div>
          </div>
          <span class="badge badge-success">ACTIVE</span>
        </div>

        <div style="background: #f8fafc; padding: 0.85rem; border-radius: 8px; font-size: 0.82rem; margin-bottom: 1rem;">
          <div>🚌 Vehicle: <strong>${p.bus_number}</strong></div>
          <div style="margin-top: 0.25rem;">🗺️ Route: <strong>${p.route_number} - ${p.route_name}</strong></div>
          <div style="margin-top: 0.25rem;">📍 Stop: <strong>${p.pickup_location_name}</strong></div>
          <div style="margin-top: 0.25rem;">📅 Valid Until: <strong>${new Date(p.valid_until).toLocaleDateString('en-IN')}</strong></div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 0.75rem;">
          <code style="font-size: 0.75rem; color: #64748b;">${p.pass_number}</code>
          <span style="font-size: 0.75rem; color: #059669; font-weight: 700;">QR Cryptographically Verified ✓</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('loadPassesView error:', err);
  }
}

// 17. VIEW 13: Fleet Live Telemetry Radar (Requirement 34)
async function loadFleetTrackingView() {
  const container = document.getElementById('fleetTrackingContainer');
  if (!container) return;

  try {
    const res = await api.get('/tracking/buses');
    if (!res.success) return;

    if (res.data.length === 0) {
      container.innerHTML = `<div class="card" style="padding: 2rem; text-align: center; color: #64748b;">No fleet telemetry received yet. Drivers share GPS via driver console.</div>`;
      return;
    }

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.5rem;">
        ${res.data.map(b => `
          <div class="card" style="padding: 1.5rem; border-left: 4px solid ${b.trip_status === 'In Transit' ? '#10b981' : '#64748b'};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <div>
                <h3 style="font-size: 1.2rem; font-weight: 800; color: #111827;">${b.bus_number}</h3>
                <div style="font-size: 0.8rem; color: #64748b;">${b.registration_number}</div>
              </div>
              <span class="badge ${b.trip_status === 'In Transit' ? 'badge-success' : 'badge-secondary'}">
                ${b.trip_status || 'Standby'}
              </span>
            </div>

            <div style="background: #f8fafc; padding: 0.85rem; border-radius: 8px; font-size: 0.82rem; margin-bottom: 1rem;">
              <div>👮 Driver: <strong>${b.driver_name || 'Assigned Driver'}</strong> (${b.driver_phone || '-'})</div>
              <div style="margin-top: 0.25rem;">🗺️ Route: <strong>${b.route_number ? `${b.route_number} - ${b.route_name}` : 'Unassigned'}</strong></div>
              <div style="margin-top: 0.25rem;">📍 Current Telemetry: <strong>${b.latitude != null ? `${parseFloat(b.latitude).toFixed(4)}, ${parseFloat(b.longitude).toFixed(4)}` : 'Awaiting GPS broadcast'}</strong></div>
              <div style="margin-top: 0.25rem;">⚡ Speed: <strong>${b.speed_kmh ? `${Math.round(b.speed_kmh)} km/h` : '0 km/h'}</strong></div>
              <div style="margin-top: 0.25rem;">⏱️ Next Stop ETA: <strong>${b.eta_next_stop || 'N/A'}</strong></div>
            </div>

            <div style="font-size: 0.72rem; color: #9ca3af; text-align: right;">
              Last Updated: ${b.last_updated ? new Date(b.last_updated).toLocaleTimeString() : 'Never'}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    console.error('loadFleetTrackingView error:', err);
  }
}

// 18. VIEW 14: Cancellation Requests (Requirement 36)
async function loadCancellationsView() {
  const container = document.getElementById('cancellationsContainer');
  if (!container) return;

  try {
    const res = await api.get('/cancellations');
    if (!res.success) return;

    if (res.data.length === 0) {
      container.innerHTML = `<div class="card" style="padding: 2rem; text-align: center; color: #64748b;">No commute cancellation requests found in database.</div>`;
      return;
    }

    container.innerHTML = res.data.map(c => `
      <div class="card" style="padding: 1.5rem; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: #111827;">${c.studentName}</h3>
            <div style="font-size: 0.8rem; color: #64748b;">Roll: <strong>${c.rollNo}</strong> • Course: ${c.course} • Phone: ${c.phone}</div>
          </div>
          <span class="badge ${c.status === 'APPROVED' ? 'badge-success' : (c.status === 'PENDING' ? 'badge-warning' : 'badge-danger')}">
            ${c.status}
          </span>
        </div>

        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 0.85rem; border-radius: 8px; font-size: 0.85rem; color: #991b1b; margin-bottom: 1rem;">
          <div><strong>Reason:</strong> ${c.reason}</div>
          ${c.remarks ? `<div style="margin-top: 0.25rem;"><strong>Remarks:</strong> ${c.remarks}</div>` : ''}
          <div style="margin-top: 0.25rem; font-size: 0.75rem; color: #b91c1c;">Historical payments and receipts will be safely preserved in database upon approval.</div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.75rem; color: #9ca3af;">Requested: ${new Date(c.requestDate).toLocaleDateString('en-IN')}</span>
          ${c.status === 'PENDING' ? `
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-success btn-sm" onclick="approveCancellation(${c.id})">Approve Opt-Out</button>
              <button class="btn btn-danger btn-sm" onclick="rejectCancellation(${c.id})">Reject</button>
            </div>
          ` : `<span style="font-size: 0.8rem; color: #64748b;">${c.adminRemarks || c.status}</span>`}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('loadCancellationsView error:', err);
  }
}

window.approveCancellation = async (id) => {
  if (!confirm('Approve commute cancellation? Student transportation status will be set to CANCELLED and active bus pass will be revoked. Historical payment records remain archived.')) return;
  try {
    const res = await api.put(`/cancellations/${id}/approve`);
    if (res.success) {
      showToast('Approved', 'Cancellation approved successfully.', 'success');
      loadCancellationsView();
      loadDashboardData();
    } else {
      showToast('Error', res.message, 'error');
    }
  } catch (err) {
    showToast('Error', 'Failed to approve cancellation.', 'error');
  }
};

window.rejectCancellation = async (id) => {
  const remarks = prompt('Enter remarks for rejection:');
  if (remarks === null) return;
  try {
    const res = await api.put(`/cancellations/${id}/reject`, { adminRemarks: remarks });
    if (res.success) {
      showToast('Rejected', 'Cancellation request rejected.', 'info');
      loadCancellationsView();
    }
  } catch (err) {
    showToast('Error', 'Failed to reject cancellation.', 'error');
  }
};

// 19. VIEW 15: Notifications
async function loadAdminNotificationsView() {
  const container = document.getElementById('adminNotificationsListContainer');
  if (!container) return;

  try {
    const res = await api.get('/notifications?role=admin');
    if (!res.success) return;

    if (res.data.length === 0) {
      container.innerHTML = `<div class="card" style="padding: 2rem; text-align: center; color: #64748b;">No admin notifications recorded in MySQL.</div>`;
      return;
    }

    container.innerHTML = res.data.map(n => `
      <div class="card" style="padding: 1.25rem; margin-bottom: 0.85rem; border-left: 4px solid #0d9488;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <h4 style="font-size: 1rem; font-weight: 800; color: #111827;">${n.title}</h4>
          <span style="font-size: 0.72rem; color: #9ca3af;">${new Date(n.created_at).toLocaleString('en-IN')}</span>
        </div>
        <p style="font-size: 0.85rem; color: #475569; margin-bottom: 0;">${n.message}</p>
      </div>
    `).join('');
  } catch (err) {
    console.error('loadAdminNotificationsView error:', err);
  }
}

async function fetchUnreadNotificationsCount() {
  try {
    const res = await api.get('/notifications?role=admin');
    if (res.success && res.data) {
      const unread = res.data.filter(n => !n.is_read).length;
      const counter = document.getElementById('adminNotifCounter');
      if (counter) {
        counter.innerText = unread;
        counter.style.display = unread > 0 ? 'inline-block' : 'none';
      }
    }
  } catch (e) {}
}

// 20. Official Printable Receipt Modal (Requirements 18, 19, 21, 22, 23, 24)
window.viewReceiptModal = async (receiptIdOrNumber) => {
  const modal = document.getElementById('receiptPrintModal');
  const printArea = document.getElementById('receiptModalPrintArea');
  if (!modal || !printArea) return;

  printArea.innerHTML = `<div class="text-center" style="padding: 3rem;"><span class="spinner"></span> Retrieving receipt from MySQL...</div>`;
  modal.classList.add('active');

  try {
    const res = await api.get(`/receipts/${receiptIdOrNumber}`);
    if (!res.success) {
      printArea.innerHTML = `<div class="text-danger text-center" style="padding: 2rem;">Receipt could not be loaded.</div>`;
      return;
    }

    const { college, receipt, student, fee, transaction } = res.data;

    printArea.innerHTML = `
      <div style="border: 2px solid #111827; padding: 2rem; border-radius: 8px; background: #ffffff; color: #111827; font-family: 'Inter', sans-serif;">
        <!-- Header -->
        <div style="text-align: center; border-bottom: 2px solid #111827; padding-bottom: 1rem; margin-bottom: 1.5rem;">
          <div style="font-size: 1.4rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.03em;">${college.name}</div>
          <div style="font-size: 0.95rem; font-weight: 700; color: #0d9488; text-transform: uppercase; margin-top: 0.2rem;">${college.department}</div>
          <div style="font-size: 0.78rem; color: #4b5563; margin-top: 0.2rem;">${college.address} • Ph: ${college.phone}</div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.75rem; margin-bottom: 1.25rem;">
          <div>
            <span style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Receipt Number:</span>
            <span style="font-family: monospace; font-size: 1.15rem; font-weight: 900; color: #0f766e; margin-left: 0.5rem;">${receipt.receiptNumber}</span>
          </div>
          <div>
            <span style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Date:</span>
            <span style="font-size: 0.9rem; font-weight: 700; margin-left: 0.5rem;">${receipt.formattedDate}</span>
          </div>
        </div>

        <!-- Student Information -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 1rem; border-radius: 6px; margin-bottom: 1.25rem;">
          <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 800; color: #0d9488; margin-bottom: 0.5rem;">Student Particulars</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.88rem;">
            <div><strong>Name of Student:</strong> ${student.name}</div>
            <div><strong>Roll Number:</strong> <span style="font-family: monospace; font-weight: 800;">${student.rollNumber}</span></div>
            <div><strong>Course / Degree:</strong> ${student.course}</div>
            <div><strong>Admission Number:</strong> ${student.admissionNumber}</div>
            <div><strong>Parent / Guardian:</strong> ${student.parentName}</div>
            <div><strong>Assigned Route:</strong> ${student.assignedRoute}</div>
          </div>
        </div>

        <!-- Fee Particulars Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.25rem; font-size: 0.88rem;">
          <thead>
            <tr style="background: #0f172a; color: #ffffff;">
              <th style="padding: 0.6rem 0.85rem; text-align: left;">Fee Particulars</th>
              <th style="padding: 0.6rem 0.85rem; text-align: right;">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 0.75rem 0.85rem;">${fee.particulars}</td>
              <td style="padding: 0.75rem 0.85rem; text-align: right; font-weight: 800;">${fee.formattedAmount}</td>
            </tr>
            <tr style="background: #f0fdfa; font-weight: 900; font-size: 1rem;">
              <td style="padding: 0.75rem 0.85rem;">Grand Total Paid</td>
              <td style="padding: 0.75rem 0.85rem; text-align: right; color: #0f766e;">${fee.formattedAmount}</td>
            </tr>
          </tbody>
        </table>

        <!-- Total in Words & Payment Mode (Requirements 24 & 25) -->
        <div style="font-size: 0.85rem; margin-bottom: 1rem; line-height: 1.6;">
          <div><strong>Total in Words:</strong> <span style="font-style: italic; color: #1f2937;">${fee.amountInWords}</span></div>
          <div><strong>Payment Mode:</strong> <span style="font-weight: 700; color: #0d9488;">${fee.paymentMode}</span></div>
          <div><strong>Transaction ID:</strong> <code style="font-family: monospace; color: #334155;">${transaction.transactionId}</code></div>
          <div><strong>Payment Status:</strong> <strong style="color: #059669;">${transaction.paymentStatus}</strong></div>
        </div>

        <!-- Footer Signatures -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #cbd5e1; font-size: 0.8rem;">
          <div style="text-align: center;">
            <div style="font-size: 0.7rem; color: #64748b;">Computer Generated Receipt</div>
            <div style="font-weight: 700;">Verified Database Record</div>
          </div>
          <div style="text-align: center;">
            <div style="border-bottom: 1px solid #111827; width: 140px; margin-bottom: 0.35rem;"></div>
            <div style="font-weight: 800;">Authorized Signatory</div>
            <div style="font-size: 0.75rem; color: #64748b;">Transport Logistics Desk</div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('viewReceiptModal error:', err);
    printArea.innerHTML = `<div class="text-danger text-center" style="padding: 2rem;">Error retrieving receipt.</div>`;
  }
};

window.downloadCurrentReceipt = () => {
  const printArea = document.getElementById('receiptModalPrintArea');
  if (!printArea) return;
  const content = printArea.innerHTML;
  const blob = new Blob([`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Fee Payment Receipt</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; background: #fff; }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `], { type: 'text/html' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Payment_Receipt_${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Download Started', 'Receipt file downloaded successfully.', 'success');
};

window.closeAdminModal = () => {
  document.getElementById('adminGenericModal')?.classList.remove('active');
};

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

window.exportData = (type) => {
  window.open(`/api/${type}`, '_blank');
};
