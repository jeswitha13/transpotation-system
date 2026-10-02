/**
 * Smart Bus Management System - Student Portal SPA Controller
 * Real Full-Stack MySQL Integration
 */

let currentStudent = null;
let trackingInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentStudent = Auth.requireAuth(['student']);
  if (!currentStudent) return;

  initStudentProfile();
  initStudentNavigation();
  await loadStudentOverview();
});

// 1. Initialize Profile Info in Sidebar and Headers
function initStudentProfile() {
  const nameEls = document.querySelectorAll('.student-profile-name');
  nameEls.forEach(el => el.innerText = currentStudent.name || 'Student');

  const rollEls = document.querySelectorAll('.student-profile-roll');
  rollEls.forEach(el => el.innerText = currentStudent.rollNo || currentStudent.rollNumber || '');
}

// 2. Sidebar Navigation for Student
function initStudentNavigation() {
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
        breadcrumbCurrent.innerText = link.querySelector('span:not(.sidebar-icon)')?.innerText || targetView;
      }

      // Stop tracking interval if navigating away from tracking
      if (targetView !== 'tracking' && trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
      }

      // Load specific view data
      if (targetView === 'overview') loadStudentOverview();
      else if (targetView === 'profile') loadStudentProfileView();
      else if (targetView === 'tracking') loadStudentTrackingView();
      else if (targetView === 'pay-fee') loadFeePaymentView();
      else if (targetView === 'bus-pass') loadBusPassView();
      else if (targetView === 'receipts') loadReceiptsView();
      else if (targetView === 'cancel') loadCancellationView();
      else if (targetView === 'notifications') loadStudentNotifications();

      document.querySelector('.sidebar')?.classList.remove('mobile-open');
    });
  });

  document.getElementById('sidebarToggleBtn')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('mobile-open');
  });
}

// 3. Load Main Student Overview
async function loadStudentOverview() {
  try {
    const res = await api.get(`/students/${currentStudent.id}`);
    if (!res.success) return;

    const s = res.data;
    currentStudent = { ...currentStudent, ...s };
    localStorage.setItem('sbms_user', JSON.stringify(currentStudent));
    initStudentProfile();

    // Fill Overview Cards safely
    const statEl = document.getElementById('overviewStatus');
    if (statEl) statEl.innerText = s.status ? s.status.toUpperCase() : 'PENDING';

    const locEl = document.getElementById('overviewLocation');
    if (locEl) locEl.innerText = s.location ? s.location.name : 'Not Assigned';

    const routeEl = document.getElementById('overviewRoute');
    if (routeEl) routeEl.innerText = s.route ? `${s.route.routeNumber} - ${s.route.title}` : 'Not Assigned';

    const busEl = document.getElementById('overviewBus');
    if (busEl) busEl.innerText = s.bus ? s.bus.busNumber : 'Unassigned';

    const drvEl = document.getElementById('overviewDriver');
    if (drvEl) drvEl.innerText = s.driver ? `${s.driver.name} (${s.driver.phone})` : 'Unassigned Driver';

    const feeAmount = s.feeRecord ? parseFloat(s.feeRecord.total_payable) : 0;
    const feeStatus = s.feeRecord ? s.feeRecord.payment_status : 'UNPAID';

    const feeValEl = document.getElementById('overviewFee');
    if (feeValEl) feeValEl.innerText = `₹${feeAmount.toLocaleString('en-IN')}`;

    const feeStatusEl = document.getElementById('overviewPaymentStatus');
    if (feeStatusEl) feeStatusEl.innerText = feeStatus;

    // Badges
    const feeBadge = document.getElementById('overviewFeeBadge');
    if (feeBadge) {
      feeBadge.className = `badge ${feeStatus === 'PAID' ? 'badge-success' : 'badge-warning'}`;
      feeBadge.innerText = feeStatus;
    }

    const passBadge = document.getElementById('overviewPassBadge');
    if (passBadge) {
      const isPassActive = s.pass && s.pass.status === 'ACTIVE';
      passBadge.className = `badge ${isPassActive ? 'badge-success' : 'badge-warning'}`;
      passBadge.innerText = isPassActive ? 'Active Pass' : (s.pass ? s.pass.status : 'No Pass');
    }

  } catch (err) {
    console.error('Error loading student overview:', err);
  }
}

// 4. Student Profile View
async function loadStudentProfileView() {
  const container = document.getElementById('studentProfileDetails');
  if (!container) return;

  try {
    const res = await api.get(`/students/${currentStudent.id}`);
    const s = res.success ? res.data : currentStudent;

    container.innerHTML = `
      <div class="card" style="padding: 2rem;">
        <div style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; border-bottom: 1px solid var(--border-light); padding-bottom: 1.5rem;">
          <div style="width: 5rem; height: 5rem; border-radius: 50%; background: var(--primary-100); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; border: 2px solid var(--primary);">
            👨‍🎓
          </div>
          <div>
            <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--navy-900);">${s.name}</h2>
            <div style="font-size: 1rem; font-weight: 800; color: var(--primary); font-family: var(--font-mono);">${s.rollNumber || s.rollNo}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">
              ${s.course || 'B.Tech'} • Year ${s.year || s.year_of_study || '1'} • Adm No: ${s.admissionNumber || 'N/A'}
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; font-size: 0.9rem;">
          <div>
            <div style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Official Student ID / Roll Number</div>
            <strong style="font-family: var(--font-mono); color: var(--primary);">${s.rollNumber || s.rollNo}</strong>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Department &amp; Semester</div>
            <strong>${s.course || 'Engineering'} • Semester ${s.semester || '1'}</strong>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Email Address</div>
            <strong>${s.email}</strong>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Phone Number</div>
            <strong>${s.phone || '-'}</strong>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Assigned Pickup Stop</div>
            <strong>${s.location ? s.location.name : 'Pending Stop Assignment'}</strong>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Assigned Transit Route</div>
            <strong>${s.route ? `${s.route.routeNumber} - ${s.route.title}` : 'Pending Route Assignment'}</strong>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Assigned Bus &amp; Driver</div>
            <strong>${s.bus ? s.bus.busNumber : 'Pending'} • ${s.driver ? `${s.driver.name} (${s.driver.phone})` : 'Driver Pending'}</strong>
          </div>
          <div>
            <div style="color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">Transportation Status</div>
            <span class="badge ${s.status === 'active' || s.status === 'approved' ? 'badge-success' : 'badge-warning'}">
              ${(s.status || 'Pending').toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('loadStudentProfileView error:', err);
  }
}

// 5. Dedicated Student Live Bus Tracking (Requirement 34: Student sees ONLY their assigned bus!)
async function loadStudentTrackingView() {
  const container = document.getElementById('studentTrackingMapContainer');
  if (!container) return;

  async function fetchTelemetry() {
    try {
      const res = await api.get(`/tracking/student/${currentStudent.id}`);
      if (!res.success) return;

      if (!res.hasBus || !res.data) {
        container.innerHTML = `
          <div class="card text-center" style="padding: 3rem 1.5rem; max-width: 540px; margin: 0 auto;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">📍</div>
            <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--navy-900); margin-bottom: 0.5rem;">
              No Bus Assigned Yet
            </h3>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
              Your transit route or fleet bus has not been allocated by the College Transport Office yet.
            </p>
            <button class="btn btn-secondary btn-sm" onclick="document.querySelector('[data-view=overview]').click()">
              ← Back to Overview
            </button>
          </div>
        `;
        return;
      }

      const t = res.data;
      const stops = t.stops || [];

      // Update Top Status Information
      const elBus = document.getElementById('trkBusNo');
      if (elBus) elBus.innerText = t.busNumber;

      const elDrv = document.getElementById('trkDriver');
      if (elDrv) elDrv.innerText = `${t.driverName} (${t.driverPhone})`;

      const elRte = document.getElementById('trkRoute');
      if (elRte) elRte.innerText = `${t.routeNumber} - ${t.routeName}`;

      const elStat = document.getElementById('trkStatus');
      if (elStat) elStat.innerText = t.tripStatus;

      const elNext = document.getElementById('trkNextStop');
      if (elNext) elNext.innerText = t.nextStop;

      const elSpd = document.getElementById('trkSpeed');
      if (elSpd) elSpd.innerText = `${t.speed}`;

      const elEta = document.getElementById('trkEta');
      if (elEta) elEta.innerText = t.etaNextStop;

      const elUpd = document.getElementById('trkUpdated');
      if (elUpd) elUpd.innerText = t.lastUpdated;

      // Render Visual Route Map
      container.innerHTML = `
        <div class="tracking-preview-card" style="margin-top: 1rem;">
          <div class="tracking-header">
            <div>
              <span class="badge ${t.tripStatus === 'In Transit' ? 'badge-success pulse-badge' : 'badge-neutral'}">
                ${t.tripStatus}
              </span>
              <h3 style="font-size: 1.35rem; font-weight: 800; margin-top: 0.35rem;">
                ${t.busNumber} • ${t.routeNumber || 'Transit Route'} 🚌
              </h3>
              <p style="font-size: 0.85rem; color: #94a3b8; margin: 0.2rem 0 0 0;">
                Assigned Route: ${t.routeName}
              </p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.8rem; color: #94a3b8;">Driver Contact</div>
              <div style="font-weight: 800; color: #ffffff; font-size: 0.95rem;">${t.driverName}</div>
              <a href="tel:${t.driverPhone}" class="btn btn-primary btn-sm" style="margin-top: 0.4rem;">
                📞 Call Driver (${t.driverPhone})
              </a>
            </div>
          </div>

          <!-- Route Canvas -->
          <div class="tracking-canvas-container">
            <div class="map-route-line">
              <div class="map-route-line-progress" style="width: ${t.tripStatus === 'In Transit' ? '55%' : '15%'};"></div>

              ${stops.map((stop, idx) => {
                const isCurrent = t.currentStop && t.currentStop.toLowerCase() === stop.stop_name.toLowerCase();
                const isPickup = currentStudent.location && currentStudent.location.name &&
                                 currentStudent.location.name.toLowerCase() === stop.stop_name.toLowerCase();

                return `
                  <div class="map-stop-node ${isCurrent ? 'current' : ''} ${isPickup ? 'target-location' : ''}">
                    <div class="map-stop-label">
                      ${stop.stop_name}
                      ${isPickup ? '<br><span style="color: #38bdf8; font-weight: 800;">(YOUR PICKUP)</span>' : ''}
                    </div>
                  </div>
                `;
              }).join('')}

              <!-- Moving Bus Marker -->
              <div class="moving-bus-marker" style="left: ${t.tripStatus === 'In Transit' ? '55%' : '15%'};">
                🚌
              </div>
            </div>
          </div>

          <div class="tracking-info-bar">
            <div class="info-item">
              <div class="info-label">Bus Number</div>
              <div class="info-value">${t.busNumber}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Current Speed</div>
              <div class="info-value">${t.speed}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Current / Next Stop</div>
              <div class="info-value">${t.nextStop}</div>
            </div>
            <div class="info-item">
              <div class="info-label">ETA to Stop</div>
              <div class="info-value" style="color: #38bdf8;">${t.etaNextStop}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Status</div>
              <div class="info-value">${t.tripStatus}</div>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      console.error('Tracking fetch error:', e);
    }
  }

  fetchTelemetry();
  if (trackingInterval) clearInterval(trackingInterval);
  trackingInterval = setInterval(fetchTelemetry, 4000);
}

// 6. Fee Payment View with Real MySQL Data & Breakdown
async function loadFeePaymentView() {
  const container = document.getElementById('feePaymentContainer');
  if (!container) return;

  container.innerHTML = `<div class="text-center" style="padding: 3rem;"><span class="spinner"></span></div>`;

  try {
    const res = await api.get(`/fees/student/${currentStudent.id}`);
    if (!res.success) {
      container.innerHTML = `<p class="text-danger text-center">Failed to load fee information.</p>`;
      return;
    }

    const fee = res.data;
    const isPaid = fee.paymentStatus === 'PAID';
    const isUnassigned = fee.paymentStatus === 'UNASSIGNED';

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 2rem;">
        <!-- Fee Breakdown Card -->
        <div class="card" style="padding: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--navy-900);">
              Fee Calculation Breakdown
            </h3>
            <span class="badge ${isPaid ? 'badge-success' : (isUnassigned ? 'badge-neutral' : 'badge-warning')}">
              ${fee.paymentStatus}
            </span>
          </div>

          <div style="background: var(--bg-subtle); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.65rem;">
              <span style="color: var(--text-secondary);">Academic Year / Semester</span>
              <strong>AY ${fee.academicYear} • Sem ${fee.semester}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.65rem;">
              <span style="color: var(--text-secondary);">Assigned Transit Route</span>
              <strong>${fee.routeNumber ? fee.routeNumber + ' (' + fee.routeName + ')' : 'Pending'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.65rem;">
              <span style="color: var(--text-secondary);">Calculated Route Distance</span>
              <strong>${fee.distanceKm} KM</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.65rem;">
              <span style="color: var(--text-secondary);">Tariff Structure</span>
              <strong>${fee.feeCalculationType === 'PER_KM' ? 'Per Kilometer Calculation' : 'Fixed Route Tariff'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.65rem;">
              <span style="color: var(--text-secondary);">Base Transit Fee</span>
              <strong>₹${fee.totalFee.toLocaleString('en-IN')}</strong>
            </div>
            ${fee.lateFee > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.65rem; color: var(--danger);">
                <span>Late Payment Fine</span>
                <strong>+ ₹${fee.lateFee.toLocaleString('en-IN')}</strong>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.65rem; color: var(--success-dark);">
              <span>Paid Amount to Date</span>
              <strong>- ₹${fee.paidAmount.toLocaleString('en-IN')}</strong>
            </div>
            <div style="border-top: 1.5px dashed var(--border-light); padding-top: 0.75rem; display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: 800;">
              <span>Net Payable Balance</span>
              <span style="color: var(--primary);">₹${fee.pendingAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.6;">
            🔒 All payments generate official college verification receipts with unique 11-character receipt numbers and transaction logs directly archived in the college database.
          </div>
        </div>

        <!-- Payment Action Box -->
        <div class="card" style="padding: 2rem; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
              <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--navy-900);">Total Balance Due</h3>
              <span class="badge ${isPaid ? 'badge-success' : 'badge-warning'}">${isPaid ? 'Paid in Full' : 'Payment Due'}</span>
            </div>

            <div style="font-size: 2.25rem; font-weight: 800; color: var(--navy-900); margin-bottom: 0.5rem;">
              ₹${fee.pendingAmount.toLocaleString('en-IN')} 
              <span style="font-size: 0.95rem; color: var(--text-muted); font-weight: 600;">/ AY ${fee.academicYear}</span>
            </div>

            <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 2rem;">
              ${isPaid 
                ? '✓ Your transportation fee for the current academic year is completely paid. You may now apply for or view your verified Digital Bus Pass.' 
                : 'Complete your transportation fee payment using our instant online sandbox or submit a cash payment request at the campus counter.'}
            </p>
          </div>

          ${isPaid ? `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <button class="btn btn-primary btn-lg" style="width: 100%;" onclick="document.querySelector('[data-view=bus-pass]').click()">
                🎫 View / Apply Digital Bus Pass →
              </button>
              <button class="btn btn-secondary" style="width: 100%;" onclick="document.querySelector('[data-view=receipts]').click()">
                📄 View Payment Receipts
              </button>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <button class="btn btn-primary btn-lg" style="width: 100%;" onclick='openPaymentGatewayModal(${JSON.stringify(fee)})'>
                💳 Pay Online via Demo Gateway →
              </button>
              <button class="btn btn-secondary" style="width: 100%;" onclick='openCashPaymentModal(${JSON.stringify(fee)})'>
                💵 Submit Cash Payment Request
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  } catch (err) {
    console.error('loadFeePaymentView error:', err);
    container.innerHTML = `<p class="text-danger text-center">Failed to load fee payment details.</p>`;
  }
}

// 7. Payment Gateway Simulator Modal (UPI / QR & Card)
window.openPaymentGatewayModal = (fee) => {
  const modal = document.getElementById('studentGenericModal');
  const modalTitle = document.getElementById('studentModalTitle');
  const modalBody = document.getElementById('studentModalBody');
  if (!modal) return;

  const payAmount = fee.pendingAmount || fee.totalFee || 15000;

  modalTitle.innerText = 'College Transport Fee Payment (Demo Gateway)';
  modalBody.innerHTML = `
    <div style="text-align: center; margin-bottom: 1.5rem;">
      <span class="badge badge-warning" style="margin-bottom: 0.5rem;">Sandbox Payment Mode</span>
      <h3 style="font-size: 1.6rem; font-weight: 800; color: var(--navy-900);">Pay: ₹${payAmount.toLocaleString('en-IN')}</h3>
      <p style="font-size: 0.8rem; color: var(--text-muted);">Instant simulated transaction directly updates MySQL student fee record.</p>
    </div>

    <!-- Payment Tabs -->
    <div class="role-tabs" style="margin-bottom: 1.5rem;">
      <div class="role-tab active" onclick="switchPayTab(this, 'upi')">📱 UPI / QR</div>
      <div class="role-tab" onclick="switchPayTab(this, 'card')">💳 Credit / Debit Card</div>
      <div class="role-tab" onclick="switchPayTab(this, 'netbank')">🏦 Net Banking</div>
    </div>

    <!-- UPI Tab Content -->
    <div id="payTabUpi" style="text-align: center; padding: 1rem;">
      <div style="width: 160px; height: 160px; margin: 0 auto 1rem auto; background: #ffffff; border: 2px dashed #cbd5e1; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <rect width="120" height="120" fill="#ffffff"/>
          <rect x="10" y="10" width="30" height="30" fill="#0f172a"/>
          <rect x="18" y="18" width="14" height="14" fill="#ffffff"/>
          <rect x="80" y="10" width="30" height="30" fill="#0f172a"/>
          <rect x="88" y="18" width="14" height="14" fill="#ffffff"/>
          <rect x="10" y="80" width="30" height="30" fill="#0f172a"/>
          <rect x="18" y="88" width="14" height="14" fill="#ffffff"/>
          <rect x="50" y="30" width="20" height="60" fill="#059669"/>
          <rect x="75" y="75" width="35" height="35" fill="#0d9488"/>
        </svg>
      </div>
      <div style="font-size: 0.85rem; font-weight: 700; color: var(--navy-900); margin-bottom: 0.25rem;">Scan with PhonePe / GPay / Paytm</div>
      <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1.5rem;">UPI ID: college.transport@bank</div>
      <button class="btn btn-primary btn-lg" style="width: 100%;" onclick="executeSimulatedPayment('UPI / PhonePe Demo', ${payAmount})">
        Simulate Instant UPI Approval ✓
      </button>
    </div>

    <!-- Card Tab Content -->
    <div id="payTabCard" style="display: none; padding: 0.5rem;">
      <div class="form-group">
        <label class="form-label">Card Number</label>
        <input type="text" class="form-control" value="4532 •••• •••• 8841" readonly />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Expiry Date</label>
          <input type="text" class="form-control" value="08/29" readonly />
        </div>
        <div class="form-group">
          <label class="form-label">CVV</label>
          <input type="password" class="form-control" value="882" readonly />
        </div>
      </div>
      <button class="btn btn-primary btn-lg" style="width: 100%; margin-top: 1rem;" onclick="executeSimulatedPayment('Card Demo', ${payAmount})">
        Simulate Card Payment Approval ✓
      </button>
    </div>

    <!-- Net Banking Tab Content -->
    <div id="payTabNetbank" style="display: none; padding: 0.5rem;">
      <div class="form-group">
        <label class="form-label">Select Bank</label>
        <select class="form-control form-select">
          <option>State Bank of India</option>
          <option>HDFC Bank</option>
          <option>ICICI Bank</option>
        </select>
      </div>
      <button class="btn btn-primary btn-lg" style="width: 100%; margin-top: 1rem;" onclick="executeSimulatedPayment('Card Demo', ${payAmount})">
        Simulate Net Banking Approval ✓
      </button>
    </div>
  `;

  modal.classList.add('active');
};

window.switchPayTab = (el, tab) => {
  const tabs = el.parentElement.querySelectorAll('.role-tab');
  tabs.forEach(t => t.classList.remove('active'));
  el.classList.add('active');

  document.getElementById('payTabUpi').style.display = tab === 'upi' ? 'block' : 'none';
  document.getElementById('payTabCard').style.display = tab === 'card' ? 'block' : 'none';
  document.getElementById('payTabNetbank').style.display = tab === 'netbank' ? 'block' : 'none';
};

window.executeSimulatedPayment = async (method, amount) => {
  const modalBody = document.getElementById('studentModalBody');
  modalBody.innerHTML = `
    <div style="text-align: center; padding: 3rem 1rem;">
      <div class="spinner" style="width: 3rem; height: 3rem; margin-bottom: 1.5rem;"></div>
      <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--navy-900);">Processing Payment in MySQL...</h3>
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">Generating unique Transaction ID and 11-character Receipt Number</p>
    </div>
  `;

  try {
    const res = await api.post('/payments/process', {
      studentId: currentStudent.id,
      amount: amount,
      paymentMethod: method,
      academicYear: '2026-27'
    });

    if (res.success) {
      const rc = res.receipt;
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem;">
          <div style="width: 4.5rem; height: 4.5rem; border-radius: 50%; background: var(--success-light); color: var(--success); display: flex; align-items: center; justify-content: center; font-size: 2.5rem; margin: 0 auto 1.5rem auto;">
            ✓
          </div>
          <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--navy-900); margin-bottom: 0.5rem;">Payment Successful!</h2>
          <div style="background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; text-align: left; font-size: 0.85rem;">
            <div>Receipt Number: <strong style="font-family: var(--font-mono); color: var(--primary);">${rc.receiptNumber}</strong></div>
            <div>Transaction ID: <strong style="font-family: var(--font-mono);">${rc.transactionId}</strong></div>
            <div>Amount Paid: <strong>₹${rc.amount.toLocaleString('en-IN')}</strong> (${rc.amountInWords})</div>
            <div>Status: <span class="badge badge-success">SUCCESSFUL</span></div>
          </div>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <button class="btn btn-primary" onclick="closeStudentModal(); document.querySelector('[data-view=bus-pass]').click();">
              🎫 Apply / View Digital Bus Pass
            </button>
            <button class="btn btn-secondary" onclick="closeStudentModal(); openOfficialReceiptModal('${rc.receiptNumber}');">
              📄 View Official Receipt
            </button>
          </div>
        </div>
      `;

      showToast('Payment Completed', 'Official receipt generated and fees updated in database.', 'success');
      loadStudentOverview();
    } else {
      modalBody.innerHTML = `<p class="text-danger text-center">${res.message || 'Payment processing failed.'}</p>`;
    }
  } catch (err) {
    modalBody.innerHTML = `<p class="text-danger text-center">Payment processing encountered an error.</p>`;
  }
};

// 8. Cash Payment Request Modal
window.openCashPaymentModal = (fee) => {
  const modal = document.getElementById('studentGenericModal');
  const modalTitle = document.getElementById('studentModalTitle');
  const modalBody = document.getElementById('studentModalBody');
  if (!modal) return;

  const payAmount = fee.pendingAmount || fee.totalFee || 15000;

  modalTitle.innerText = 'Submit Cash Payment Request';
  modalBody.innerHTML = `
    <form id="cashRequestForm" onsubmit="handleCashRequestSubmit(event, ${payAmount})">
      <div style="background: var(--bg-subtle); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.35rem;">
          Amount to Pay at Campus Counter:
        </div>
        <div style="font-size: 1.8rem; font-weight: 800; color: var(--navy-900);">
          ₹${payAmount.toLocaleString('en-IN')}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.35rem;">
          Note: Cash payments are set to <strong>PENDING ADMIN VERIFICATION</strong> until verified by the Transport Office counter administrator.
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Notes / Campus Receipt Ref (Optional)</label>
        <textarea id="cashNotes" class="form-control" rows="2" placeholder="e.g. Paid at Accounts Counter Counter 2, Ref #..."></textarea>
      </div>

      <button type="submit" class="btn btn-primary" style="width: 100%;">
        Submit Cash Payment for Admin Verification →
      </button>
    </form>
  `;

  modal.classList.add('active');
};

window.handleCashRequestSubmit = async (e, amount) => {
  e.preventDefault();
  const notes = document.getElementById('cashNotes')?.value;

  try {
    const res = await api.post('/payments/cash-request', {
      studentId: currentStudent.id,
      amount: amount,
      notes: notes || 'Cash payment submitted at college counter'
    });

    if (res.success) {
      closeStudentModal();
      showToast('Cash Submitted', 'Payment request set to PENDING ADMIN VERIFICATION.', 'warning');
      loadFeePaymentView();
      loadStudentOverview();
    } else {
      alert(res.message || 'Error submitting cash request.');
    }
  } catch (err) {
    alert('Server error submitting cash payment.');
  }
};

// 9. My Digital Bus Pass & Pass Application (Requirement 7 & 28: Read-only Roll Number auto-populated from DB!)
async function loadBusPassView() {
  const container = document.getElementById('studentBusPassContainer');
  if (!container) return;

  container.innerHTML = `<div class="text-center" style="padding: 3rem;"><span class="spinner"></span></div>`;

  try {
    const [passRes, stuRes] = await Promise.all([
      api.get(`/passes/student/${currentStudent.id}`),
      api.get(`/students/${currentStudent.id}`)
    ]);

    const s = stuRes.success ? stuRes.data : currentStudent;
    const hasPass = passRes.success && passRes.hasPass;
    const pass = hasPass ? passRes.data : null;
    const appStatus = passRes.applicationStatus || (hasPass ? 'APPROVED' : 'NOT_APPLIED');

    // Case 1: Active Bus Pass Approved!
    if (hasPass && pass && pass.status === 'ACTIVE') {
      container.innerHTML = `
        <div style="max-width: 480px; margin: 0 auto;">
          <div class="bus-pass-card" id="printableBusPass">
            <div class="pass-header">
              <div>
                <div class="pass-college-title">College of Engineering &amp; Technology</div>
                <div style="font-size: 0.7rem; color: #a7f3d0; text-transform: uppercase; letter-spacing: 0.5px;">Transportation Department</div>
              </div>
              <span class="pass-type-badge">OFFICIAL BUS PASS</span>
            </div>

            <div class="pass-body">
              <div class="pass-photo-row">
                <div class="pass-student-photo">👨‍🎓</div>
                <div class="pass-student-main">
                  <div class="pass-student-name">${pass.student_name}</div>
                  <div class="pass-student-roll">${pass.roll_number}</div>
                  <div class="pass-student-branch">${pass.course} • Year ${pass.year_of_study || '1'}</div>
                </div>
              </div>

              <div class="pass-grid-info">
                <div class="pass-info-cell">
                  <div class="cell-lbl">Bus Number</div>
                  <div class="cell-val">${pass.bus_number}</div>
                </div>
                <div class="pass-info-cell">
                  <div class="cell-lbl">Route Corridor</div>
                  <div class="cell-val">${pass.route_number}</div>
                </div>
                <div class="pass-info-cell">
                  <div class="cell-lbl">Designated Pickup Stop</div>
                  <div class="cell-val">${pass.pickup_location_name}</div>
                </div>
                <div class="pass-info-cell">
                  <div class="cell-lbl">Valid Until</div>
                  <div class="cell-val" style="color: var(--success-dark);">${new Date(pass.valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
              </div>

              <div class="pass-footer-row">
                <div class="pass-qr-box">
                  <svg width="52" height="52" viewBox="0 0 52 52">
                    <rect x="4" y="4" width="18" height="18" fill="#0f172a" />
                    <rect x="8" y="8" width="10" height="10" fill="#ffffff" />
                    <rect x="30" y="4" width="18" height="18" fill="#0f172a" />
                    <rect x="34" y="8" width="10" height="10" fill="#ffffff" />
                    <rect x="4" y="30" width="18" height="18" fill="#0f172a" />
                    <rect x="8" y="34" width="10" height="10" fill="#ffffff" />
                    <rect x="26" y="26" width="8" height="8" fill="#0f172a" />
                    <rect x="38" y="30" width="10" height="10" fill="#0f172a" />
                  </svg>
                </div>
                <div class="pass-hologram">
                  <span class="hologram-seal">STATUS: ${pass.status}</span>
                  <div style="font-size: 0.75rem; color: var(--navy-900); font-family: var(--font-mono); margin-top: 0.35rem; font-weight: 700;">
                    ${pass.pass_number}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 1rem; margin-top: 1.5rem; justify-content: center;">
            <button class="btn btn-primary" onclick="window.print()">
              🖨️ Print Bus Pass
            </button>
            <button class="btn btn-secondary" onclick="showToast('Pass Saved', 'Bus pass cached for offline transit boarding verification.', 'info')">
              💾 Save Offline Pass
            </button>
          </div>
        </div>
      `;
      return;
    }

    // Case 2: Bus Pass Application is PENDING Admin Review
    if (appStatus === 'PENDING') {
      container.innerHTML = `
        <div class="card text-center" style="padding: 2.5rem 1.5rem; max-width: 580px; margin: 0 auto;">
          <div style="width: 4rem; height: 4rem; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 1.25rem auto;">
            ⏳
          </div>
          <span class="badge badge-warning" style="margin-bottom: 0.75rem;">PENDING TRANSPORT OFFICE APPROVAL</span>
          <h3 style="font-size: 1.45rem; font-weight: 800; color: var(--navy-900); margin-bottom: 0.5rem;">
            Application Under Review
          </h3>
          <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.6;">
            Your bus pass application has been submitted and is currently being processed by the Transport Office. Once approved, your active QR bus pass will automatically appear here.
          </p>
          <div style="background: var(--bg-subtle); padding: 1.25rem; border-radius: var(--radius-md); text-align: left; font-size: 0.85rem; margin-bottom: 1.5rem;">
            <div>Roll Number: <strong style="font-family: var(--font-mono);">${s.rollNumber || s.rollNo}</strong></div>
            <div>Student Name: <strong>${s.name}</strong></div>
            <div>Route: <strong>${s.route ? s.route.routeNumber + ' - ' + s.route.title : 'Assigned Route'}</strong></div>
            <div>Bus: <strong>${s.bus ? s.bus.busNumber : 'Assigned Bus'}</strong></div>
            <div>Pickup: <strong>${s.location ? s.location.name : 'Assigned Stop'}</strong></div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="loadBusPassView()">
            🔄 Refresh Application Status
          </button>
        </div>
      `;
      return;
    }

    // Case 3: Application REJECTED
    if (appStatus === 'REJECTED') {
      container.innerHTML = `
        <div class="card text-center" style="padding: 2.5rem 1.5rem; max-width: 580px; margin: 0 auto;">
          <div style="width: 4rem; height: 4rem; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 1.25rem auto;">
            ✕
          </div>
          <span class="badge badge-danger" style="margin-bottom: 0.75rem;">APPLICATION REJECTED</span>
          <h3 style="font-size: 1.45rem; font-weight: 800; color: var(--navy-900); margin-bottom: 0.5rem;">
            Bus Pass Application Not Approved
          </h3>
          <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
            Reason: <strong>${passRes.rejectionReason || 'Documentation or fee criteria not met.'}</strong>
          </p>
          <button class="btn btn-primary" onclick="renderApplyPassForm(s)">
            Re-Apply for Bus Pass →
          </button>
        </div>
      `;
      return;
    }

    // Case 4: Not Applied Yet -> Render Apply for Bus Pass Form (Requirement 7 & 28)
    renderApplyPassForm(s);

  } catch (err) {
    console.error('loadBusPassView error:', err);
    container.innerHTML = `<p class="text-danger text-center">Failed to load bus pass application.</p>`;
  }
}

// Helper: Render the Apply for Bus Pass Form with Read-Only Roll Number (Requirement 7 & 28)
function renderApplyPassForm(s) {
  const container = document.getElementById('studentBusPassContainer');
  if (!container) return;

  const isFeePaid = s.feeRecord && (s.feeRecord.payment_status === 'PAID' || parseFloat(s.feeRecord.paid_amount) > 0);
  const hasRouteAndBus = s.assigned_route_id || (s.route && s.route.id);

  container.innerHTML = `
    <div class="card" style="max-width: 680px; margin: 0 auto; padding: 2.25rem;">
      <div style="border-bottom: 1px solid var(--border-light); padding-bottom: 1.25rem; margin-bottom: 1.75rem;">
        <span class="badge badge-neutral" style="margin-bottom: 0.4rem;">DIGITAL COMMUTE PASS APPLICATION</span>
        <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--navy-900);">
          Apply for College Bus Pass 🎫
        </h2>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.3rem 0 0 0;">
          All student credentials below are automatically pre-populated from the college transit database. Roll Number is strictly verified and read-only.
        </p>
      </div>

      <form id="applyBusPassForm" onsubmit="handleApplyBusPass(event)">
        <!-- Roll Number: Strictly Read-Only -->
        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label class="form-label" style="display: flex; justify-content: space-between;">
            <span>Student Roll Number (Read-Only) *</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">Auto-populated from DB • Locked</span>
          </label>
          <input type="text" class="form-control" id="applyRollNumber" 
                 value="${s.rollNumber || s.rollNo || ''}" 
                 readonly disabled 
                 style="background: #f1f5f9; cursor: not-allowed; font-weight: 800; font-family: var(--font-mono); color: var(--primary);" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem;">
          <div class="form-group">
            <label class="form-label">Student Full Name</label>
            <input type="text" class="form-control" value="${s.name || ''}" readonly disabled style="background: #f1f5f9;" />
          </div>
          <div class="form-group">
            <label class="form-label">Course / Branch</label>
            <input type="text" class="form-control" value="${s.course || 'B.Tech'}" readonly disabled style="background: #f1f5f9;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem;">
          <div class="form-group">
            <label class="form-label">Assigned Route</label>
            <input type="text" class="form-control" 
                   value="${s.route ? s.route.routeNumber + ' - ' + s.route.title : 'Pending Route Assignment'}" 
                   readonly disabled style="background: #f1f5f9;" />
          </div>
          <div class="form-group">
            <label class="form-label">Assigned Fleet Bus</label>
            <input type="text" class="form-control" 
                   value="${s.bus ? s.bus.busNumber : 'Pending Bus Assignment'}" 
                   readonly disabled style="background: #f1f5f9;" />
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 1.75rem;">
          <label class="form-label">Designated Pickup Stop</label>
          <input type="text" class="form-control" 
                 value="${s.location ? s.location.name : 'Pending Pickup Assignment'}" 
                 readonly disabled style="background: #f1f5f9;" />
        </div>

        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label">Reason for Bus Pass Application *</label>
          <textarea class="form-control" id="applyPassReason" rows="2" placeholder="e.g. Regular daily campus transit commute" required>Regular daily campus commute</textarea>
        </div>

        <!-- Fee Verification Status Notice -->
        <div style="background: ${isFeePaid ? 'var(--success-light)' : '#fef3c7'}; border: 1.5px solid ${isFeePaid ? 'var(--success-border)' : '#fde68a'}; border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.75rem;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <strong style="color: ${isFeePaid ? 'var(--success-dark)' : '#b45309'}; font-size: 0.95rem;">
                ${isFeePaid ? '✓ Fee Paid & Verified' : '⚠️ Fee Payment Required'}
              </strong>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">
                ${isFeePaid 
                  ? 'Your transportation fee is paid and verified. You are eligible to submit your bus pass application.' 
                  : 'You must complete your annual transportation fee before applying for an official bus pass.'}
              </div>
            </div>
            ${!isFeePaid ? `
              <button type="button" class="btn btn-warning btn-sm" onclick="document.querySelector('[data-view=pay-fee]').click()">
                Pay Fee →
              </button>
            ` : ''}
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;" ${!isFeePaid ? 'disabled' : ''}>
          ${isFeePaid ? 'Submit Bus Pass Application →' : 'Pay Fee to Enable Bus Pass Application'}
        </button>
      </form>
    </div>
  `;
}

// Submit Bus Pass Application (Requirement 7 & 28)
window.handleApplyBusPass = async (e) => {
  e.preventDefault();
  const reason = document.getElementById('applyPassReason')?.value.trim() || 'Regular daily campus commute';

  try {
    const res = await api.post('/passes/apply', {
      studentId: currentStudent.id,
      reason
    });

    if (res.success) {
      showToast('Application Submitted', 'Your bus pass application was sent to Transport Office for review.', 'success');
      loadBusPassView();
      loadStudentOverview();
    } else {
      showToast('Error', res.message || 'Could not submit application.', 'error');
    }
  } catch (err) {
    showToast('Error', 'Server error submitting bus pass application.', 'error');
  }
};

// 10. My Receipts View
async function loadReceiptsView() {
  const container = document.getElementById('studentReceiptsContainer');
  if (!container) return;

  container.innerHTML = `<div class="text-center" style="padding: 3rem;"><span class="spinner"></span></div>`;

  try {
    const res = await api.get(`/payments/student/${currentStudent.id}`);
    if (!res.success || !res.data.length) {
      container.innerHTML = `
        <div class="card text-center" style="padding: 3rem;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">📄</div>
          <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--navy-900);">No Fee Receipts Found</h3>
          <p class="text-muted" style="margin-bottom: 1.5rem;">Complete your transportation fee to view official payment receipts.</p>
          <button class="btn btn-primary" onclick="document.querySelector('[data-view=pay-fee]').click()">
            Pay Transport Fee →
          </button>
        </div>
      `;
      return;
    }

    const payments = res.data;

    container.innerHTML = `
      <div class="card" style="padding: 1.75rem;">
        <div style="margin-bottom: 1.25rem;">
          <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--navy-900);">Issued Payment Receipts</h3>
          <p style="font-size: 0.8rem; color: var(--text-muted);">Verified receipts with unique 11-character receipt numbers</p>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Receipt No</th>
                <th>Transaction ID</th>
                <th>Date</th>
                <th>Mode</th>
                <th>Amount</th>
                <th>Status</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(p => `
                <tr>
                  <td style="font-weight: 800; font-family: var(--font-mono); color: var(--primary);">
                    ${p.receipt_number || 'PENDING'}
                  </td>
                  <td style="font-family: var(--font-mono); font-size: 0.8rem;">
                    ${p.transaction_id || '-'}
                  </td>
                  <td style="font-size: 0.85rem;">
                    ${new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td>${p.payment_method}</td>
                  <td style="font-weight: 800; color: var(--navy-900);">
                    ₹${parseFloat(p.amount).toLocaleString('en-IN')}
                  </td>
                  <td>
                    <span class="badge ${p.payment_status === 'SUCCESSFUL' ? 'badge-success' : 'badge-warning'}">
                      ${p.payment_status}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    ${p.receipt_number ? `
                      <button class="btn btn-secondary btn-sm" onclick="openOfficialReceiptModal('${p.receipt_number}')">
                        📄 View Receipt
                      </button>
                    ` : `
                      <span style="font-size: 0.75rem; color: var(--text-muted);">Pending Verification</span>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('loadReceiptsView error:', err);
    container.innerHTML = `<p class="text-danger text-center">Failed to load receipts.</p>`;
  }
}

// 11. Printable Official Receipt Modal (Strictly Requirement 22 & 23 from MySQL)
window.openOfficialReceiptModal = async (receiptNo) => {
  const modal = document.getElementById('studentGenericModal');
  const modalTitle = document.getElementById('studentModalTitle');
  const modalBody = document.getElementById('studentModalBody');
  if (!modal) return;

  modalTitle.innerText = `Official Transportation Receipt #${receiptNo}`;
  modalBody.innerHTML = `<div class="text-center" style="padding: 2rem;"><span class="spinner"></span></div>`;
  modal.classList.add('active');

  try {
    const res = await api.get(`/receipts/${receiptNo}`);
    if (!res.success) {
      modalBody.innerHTML = `<p class="text-danger text-center">Receipt could not be loaded from database.</p>`;
      return;
    }

    const r = res.data;

    modalBody.innerHTML = `
      <div class="receipt-wrapper" id="printableReceiptModalContent">
        <div class="receipt-header">
          <div class="receipt-logo">🚌 ${r.college.name}</div>
          <div class="receipt-sub">${r.college.department} • ${r.college.address}</div>
          <div class="receipt-badge-title">OFFICIAL TRANSPORTATION FEE RECEIPT</div>
        </div>

        <div class="receipt-meta-grid">
          <div>
            <div>Receipt Number: <strong style="font-family: var(--font-mono); font-size: 1rem; color: var(--primary);">${r.receipt.receiptNumber}</strong></div>
            <div>Transaction ID: <strong style="font-family: var(--font-mono);">${r.transaction.transactionId}</strong></div>
            <div>Date &amp; Time: <strong>${r.receipt.formattedDate} • ${r.receipt.formattedTime}</strong></div>
          </div>
          <div style="text-align: right;">
            <div>Student Name: <strong>${r.student.name}</strong></div>
            <div>Roll Number: <strong style="font-family: var(--font-mono);">${r.student.rollNumber}</strong></div>
            <div>Course / Branch: <strong>${r.student.course}</strong></div>
            <div>Admission No: <strong>${r.student.admissionNumber}</strong></div>
            <div>Parent Name: <strong>${r.student.parentName}</strong></div>
          </div>
        </div>

        <table class="receipt-items-table">
          <thead>
            <tr>
              <th>Fee Particulars</th>
              <th>Assigned Route &amp; Pickup</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${r.fee.particulars}</td>
              <td>${r.student.assignedRoute} • Stop: ${r.student.pickupLocation}</td>
              <td style="text-align: right; font-weight: 800;">${r.fee.formattedAmount}</td>
            </tr>
          </tbody>
        </table>

        <div class="receipt-total-row">
          <div>
            Total Paid: <strong style="font-size: 1.25rem; color: var(--navy-900);">${r.fee.formattedAmount}</strong>
            <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal; margin-top: 0.2rem;">
              (${r.fee.amountInWords})
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 1.5rem;">
          <span class="receipt-stamp-paid">PAID &amp; VERIFIED</span>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-align: right;">
            Payment Mode: ${r.fee.paymentMode}<br>Status: ${r.transaction.paymentStatus}
          </div>
        </div>

        <div style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-secondary" onclick="downloadStudentReceipt()">
            📥 Download Receipt
          </button>
          <button class="btn btn-primary" onclick="window.print()">
            🖨️ Print Official Receipt
          </button>
          <button class="btn btn-secondary" onclick="closeStudentModal()">
            Close
          </button>
        </div>
      </div>
    `;
  } catch (err) {
    modalBody.innerHTML = `<p class="text-danger text-center">Failed to fetch receipt.</p>`;
  }
};

window.downloadStudentReceipt = () => {
  const content = document.getElementById('printableReceiptModalContent')?.innerHTML;
  if (!content) return;

  const blob = new Blob([`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Student Fee Receipt</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2rem; background: #fff; }
          .receipt-header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 1rem; margin-bottom: 1rem; }
          .receipt-logo { font-size: 1.4rem; font-weight: 800; }
          .receipt-sub { font-size: 0.85rem; color: #475569; }
          .receipt-badge-title { font-size: 0.95rem; font-weight: 700; color: #0d9488; margin-top: 0.5rem; }
          .receipt-meta-grid { display: flex; justify-content: space-between; border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.75rem; margin-bottom: 1rem; font-size: 0.88rem; }
          .receipt-items-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.88rem; }
          .receipt-items-table th, .receipt-items-table td { padding: 0.5rem; border-bottom: 1px solid #e2e8f0; }
          .receipt-total-row { background: #f0fdfa; padding: 0.75rem; border-radius: 6px; font-weight: 800; }
          .receipt-stamp-paid { background: #dcfce7; color: #15803d; padding: 0.25rem 0.75rem; border-radius: 9999px; font-weight: 800; font-size: 0.8rem; }
        </style>
      </head>
      <body>
        <div style="border: 2px solid #0f172a; padding: 2rem; border-radius: 8px;">
          ${content}
        </div>
      </body>
    </html>
  `], { type: 'text/html' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Student_Receipt_${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Downloaded', 'Receipt downloaded to your device.', 'success');
};

// 12. Cancel Transportation View
async function loadCancellationView() {
  const container = document.getElementById('studentCancellationContainer');
  if (!container) return;

  try {
    const res = await api.get(`/cancellations/student/${currentStudent.id}`);
    const existing = res.success && res.data.length ? res.data[0] : null;

    container.innerHTML = `
      <div class="card" style="padding: 2.25rem; max-width: 620px; margin: 0 auto;">
        <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--navy-900); margin-bottom: 0.5rem;">
          Cancel College Transportation
        </h3>
        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
          If you have shifted residence or commute by your own vehicle, you can submit a formal transportation opt-out request below.
        </p>

        ${existing ? `
          <div style="background: var(--bg-subtle); padding: 1.25rem; border-radius: var(--radius-md); border-left: 4px solid var(--warning);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
              <strong>Request Status</strong>
              <span class="badge ${existing.status === 'APPROVED' ? 'badge-success' : (existing.status === 'REJECTED' ? 'badge-danger' : 'badge-warning')}">
                ${existing.status}
              </span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.35rem;">
              Reason: <strong>${existing.reason}</strong>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              Admin Remarks: <em>"${existing.adminRemarks || 'Under review by Transport Director'}"</em>
            </div>
          </div>
        ` : `
          <form id="studentCancelForm">
            <div class="form-group">
              <label class="form-label">Reason for Cancellation *</label>
              <select class="form-control form-select" id="cancelReason" required>
                <option value="">-- Choose Reason --</option>
                <option value="Using Own Vehicle">Using Own Vehicle</option>
                <option value="Shifted Residence">Shifted Residence</option>
                <option value="No Longer Requires Bus">No Longer Requires Bus</option>
                <option value="Personal Reason">Personal Reason</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Additional Remarks / Feedback</label>
              <textarea class="form-control" id="cancelRemarks" rows="3" placeholder="Provide any details for transport office review..."></textarea>
            </div>
            <button type="submit" class="btn btn-danger" style="width: 100%;">
              Submit Cancellation Request
            </button>
          </form>
        `}
      </div>
    `;

    document.getElementById('studentCancelForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!confirm('Are you sure you want to submit a transportation cancellation request?')) return;

      const reason = document.getElementById('cancelReason').value;
      const remarks = document.getElementById('cancelRemarks').value;

      const submitRes = await api.post('/cancellations/submit', {
        studentId: currentStudent.id,
        reason,
        remarks
      });

      if (submitRes.success) {
        showToast('Submitted', 'Your cancellation request was sent to the Transport Office.', 'info');
        loadCancellationView();
      } else {
        alert(submitRes.message || 'Error submitting cancellation.');
      }
    });
  } catch (err) {
    console.error('loadCancellationView error:', err);
  }
}

// 13. Notifications View
async function loadStudentNotifications() {
  const container = document.getElementById('studentNotificationsContainer');
  if (!container) return;

  try {
    const res = await api.get('/notifications', { targetRole: 'student', userId: currentStudent.userId || currentStudent.id });
    if (!res.success || !res.data.length) {
      container.innerHTML = `<p class="text-muted text-center" style="padding: 2rem;">No new notifications.</p>`;
      return;
    }

    container.innerHTML = res.data.map(n => `
      <div class="card" style="padding: 1.25rem; margin-bottom: 1rem; border-left: 4px solid var(--primary);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
          <h4 style="font-size: 1rem; font-weight: 700; color: var(--navy-900);">${n.title}</h4>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${new Date(n.created_at || n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">${n.message}</p>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p class="text-danger text-center">Failed to load alerts.</p>`;
  }
}

window.closeStudentModal = () => {
  document.getElementById('studentGenericModal')?.classList.remove('active');
};
