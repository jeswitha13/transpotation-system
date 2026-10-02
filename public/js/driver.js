/**
 * Smart Bus Management System - Driver Console SPA Controller
 * Real Full-Stack MySQL Telemetry and Pass Verifier
 */

let currentDriver = null;
let geoWatchId = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentDriver = Auth.requireAuth(['driver']);
  if (!currentDriver) return;

  initDriverHeader();
  await loadDriverConsole();
});

function initDriverHeader() {
  const nameEl = document.getElementById('driverNameDisplay');
  if (nameEl) nameEl.innerText = `${currentDriver.name || 'Driver On Duty'} • Driver Console`;
}

async function loadDriverConsole() {
  const container = document.getElementById('driverMainConsole');
  if (!container) return;

  try {
    const drvRes = await api.get(`/drivers/${currentDriver.id}`);
    const drv = drvRes.success ? drvRes.data : currentDriver;
    const busId = drv.busId || (currentDriver && currentDriver.assignedBusId) || 1;

    const trkRes = await api.get(`/tracking/${busId}`);
    const t = trkRes.success ? trkRes.data : drv.telemetry;
    const route = drv.route;
    const stops = (route && route.stops && route.stops.length) ? route.stops : ((t && t.routeDetails && t.routeDetails.stops) ? t.routeDetails.stops : []);
    const students = drv.assignedStudents || [];

    const tripStatus = t ? t.tripStatus : 'Scheduled';
    const isTransit = tripStatus === 'In Transit';

    container.innerHTML = `
      <!-- Trip Status Overview Banner -->
      <div class="card driver-console-card">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; border-bottom: 1px solid var(--border-light); padding-bottom: 1.25rem;">
          <div>
            <span class="badge ${isTransit ? 'badge-success pulse-badge' : 'badge-neutral'}" style="margin-bottom: 0.4rem;">
              <span class="badge-dot"></span> ${tripStatus}
            </span>
            <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--navy-900);">
              ${drv.busNumber || 'Fleet Bus'} • ${route ? route.title : (drv.routeName || 'Campus Transit Route')}
            </h2>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">
              Vehicle Reg: <strong>${drv.busReg || 'COLLEGE-BUS'}</strong> • Driver: <strong>${drv.name}</strong> (${drv.phone})
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Current / Next Stop</div>
            <div style="font-size: 1.3rem; font-weight: 800; color: var(--primary);">${t ? (t.nextStop || t.currentStop) : 'Main Campus Terminal'}</div>
            <div style="font-size: 0.8rem; color: #10b981; font-weight: 700; margin-top: 0.2rem;">Speed: ${t ? t.speed : '0'} km/h</div>
          </div>
        </div>

        <!-- Trip Control Buttons -->
        <div class="driver-control-btns">
          <button class="btn ${isTransit ? 'btn-secondary' : 'btn-primary'}" onclick="updateDriverTrip('START_TRIP', ${busId})" ${isTransit ? 'disabled' : ''}>
            🚀 START TRIP &amp; BROADCAST GPS
          </button>
          <button class="btn btn-secondary" onclick="updateDriverTrip('ADVANCE_STOP', ${busId})" ${!isTransit ? 'disabled' : ''}>
            📍 ADVANCE TO NEXT STOP
          </button>
          <button class="btn btn-danger" onclick="updateDriverTrip('END_TRIP', ${busId})" ${!isTransit ? 'disabled' : ''}>
            🏁 END TRIP AT CAMPUS
          </button>
          <button class="btn btn-outline-primary" onclick="broadcastDelayAlert(${busId})">
            ⚠️ BROADCAST TRAFFIC DELAY
          </button>
        </div>
      </div>

      <!-- Two Column Layout: Stops Sequence & Pass Validator -->
      <div style="display: grid; grid-template-columns: 1.1fr 1fr; gap: 2rem;">
        
        <!-- Left: Stops Checklist -->
        <div class="card" style="padding: 1.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--navy-900);">
              Pickup Stops Sequence (${stops.length})
            </h3>
            <span class="badge badge-neutral">${route ? route.routeNumber : 'Route'}</span>
          </div>

          <div class="stops-checklist">
            ${stops.length ? stops.map((stop, idx) => {
              const isCurrent = t && ((t.currentStop && t.currentStop.toLowerCase() === stop.name?.toLowerCase()) || (t.nextStop && t.nextStop.toLowerCase() === stop.name?.toLowerCase()));
              return `
                <div class="stop-check-row ${isCurrent ? 'done' : ''}">
                  <div style="display: flex; align-items: center; gap: 0.85rem;">
                    <span style="width: 1.9rem; height: 1.9rem; border-radius: 50%; background: ${isCurrent ? 'var(--primary)' : 'var(--bg-subtle)'}; color: ${isCurrent ? '#ffffff' : 'var(--navy-900)'}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; border: 1px solid var(--border-light);">
                      ${idx + 1}
                    </span>
                    <div>
                      <div style="font-weight: 700; font-size: 0.95rem; color: var(--navy-900);">${stop.name || stop.stop_name}</div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">Scheduled: ${stop.time || '07:30 AM'}</div>
                    </div>
                  </div>
                  <span class="badge ${isCurrent ? 'badge-success' : 'badge-neutral'}">
                    ${isCurrent ? 'Active Stop' : 'Waypoint'}
                  </span>
                </div>
              `;
            }).join('') : `
              <p class="text-muted" style="padding: 1rem 0;">No stops configured for this route yet.</p>
            `}
          </div>
        </div>

        <!-- Right: Digital Bus Pass Scanner & Verifier -->
        <div class="card" style="padding: 1.75rem;">
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--navy-900); margin-bottom: 0.4rem;">
            Student Pass Verifier 📱
          </h3>
          <p style="font-size: 0.825rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
            Verify student boarding permission by Roll Number or Pass Code.
          </p>

          <form id="passScannerForm" onsubmit="handlePassVerify(event)" style="margin-bottom: 1.5rem;">
            <div style="display: flex; gap: 0.75rem;">
              <input type="text" id="scanRollNo" class="form-control" placeholder="Enter Roll Number (e.g. 23CS1048)" required style="text-transform: uppercase; font-family: var(--font-mono); font-weight: 700;" />
              <button type="submit" class="btn btn-primary" style="white-space: nowrap;">
                Verify Pass ✓
              </button>
            </div>
          </form>

          <div id="passVerificationResult"></div>

          <!-- Quick Passenger Roster for Assigned Bus -->
          <div style="border-top: 1px solid var(--border-light); padding-top: 1.25rem; margin-top: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">
                Assigned Students on this Bus (${students.length})
              </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 240px; overflow-y: auto;">
              ${students.length ? students.map(s => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.85rem; background: var(--bg-subtle); border-radius: var(--radius-sm); font-size: 0.85rem;">
                  <div>
                    <div style="font-weight: 700; color: var(--navy-900);">${s.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">
                      ${s.rollNo} • Stop: ${s.pickupLocation || 'Assigned Stop'}
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="badge ${s.passStatus === 'ACTIVE' ? 'badge-success' : 'badge-warning'}" style="font-size: 0.7rem;">
                      ${s.passStatus || 'No Pass'}
                    </span>
                    <button class="btn btn-secondary btn-sm" onclick="quickVerifyStudent('${s.rollNo}')">
                      Check
                    </button>
                  </div>
                </div>
              `).join('') : `
                <div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 1.5rem 0;">
                  No students assigned to this fleet bus yet.
                </div>
              `}
            </div>
          </div>
        </div>

      </div>
    `;
  } catch (err) {
    console.error('loadDriverConsole error:', err);
    container.innerHTML = `<p class="text-danger text-center">Failed to load driver console.</p>`;
  }
}

// Trip Management with Real-Time Geolocation Stream
window.updateDriverTrip = async (action, busId) => {
  try {
    const res = await api.post(`/tracking/${busId}/status`, { action, busId });
    if (res.success) {
      showToast('Trip Updated', res.message, 'success');

      if (action === 'START_TRIP') {
        // Start watching device GPS if supported
        if (navigator.geolocation) {
          if (geoWatchId) navigator.geolocation.clearWatch(geoWatchId);
          geoWatchId = navigator.geolocation.watchPosition(
            (pos) => {
              api.post('/tracking/location', {
                busId: busId,
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 38,
                heading: pos.coords.heading || 0,
                tripStatus: 'In Transit'
              });
            },
            (err) => console.log('Geolocation watch notification:', err.message),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        }
      } else if (action === 'END_TRIP') {
        if (geoWatchId && navigator.geolocation) {
          navigator.geolocation.clearWatch(geoWatchId);
          geoWatchId = null;
        }
      }

      await loadDriverConsole();
    } else {
      alert(res.message || 'Could not update trip.');
    }
  } catch (err) {
    alert('Server error updating trip status.');
  }
};

window.broadcastDelayAlert = async (busId) => {
  const mins = prompt('Enter traffic delay estimate in minutes (e.g. 15):', '15');
  if (!mins) return;

  try {
    const res = await api.post(`/tracking/${busId}/status`, {
      busId: busId,
      delayMinutes: parseInt(mins, 10)
    });

    if (res.success) {
      showToast('Alert Broadcasted', `Traffic delay notice of ${mins} mins sent to all students on this route.`, 'warning');
      await loadDriverConsole();
    }
  } catch (err) {
    alert('Error broadcasting traffic delay alert.');
  }
};

window.handlePassVerify = async (e) => {
  e.preventDefault();
  const code = document.getElementById('scanRollNo')?.value.trim();
  if (!code) return;
  await verifyPassCode(code);
};

window.quickVerifyStudent = async (rollNo) => {
  const input = document.getElementById('scanRollNo');
  if (input) input.value = rollNo;
  await verifyPassCode(rollNo);
};

async function verifyPassCode(code) {
  const resultDiv = document.getElementById('passVerificationResult');
  if (!resultDiv) return;

  resultDiv.innerHTML = `<div class="text-center" style="padding: 1rem;"><span class="spinner"></span></div>`;

  try {
    const res = await api.post('/passes/validate', { code });

    if (res.valid) {
      const p = res.data;
      resultDiv.innerHTML = `
        <div style="background: var(--success-light); border: 1.5px solid var(--success-border); border-radius: var(--radius-md); padding: 1.25rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <span style="font-size: 1.5rem; color: var(--success);">✓</span>
            <div>
              <div style="font-weight: 800; color: var(--success-dark); font-size: 1.05rem;">PASS VERIFIED &amp; ACTIVE</div>
              <div style="font-size: 0.75rem; color: var(--text-secondary);">Boarding Endorsed • ${p.passNumber}</div>
            </div>
          </div>
          <div style="font-size: 0.85rem; margin-top: 0.5rem; color: var(--navy-900);">
            Student: <strong>${p.studentName}</strong> (${p.rollNo})<br>
            Route: <strong>${p.routeName}</strong> | Stop: <strong>${p.pickupLocation}</strong><br>
            Valid until: <strong>${p.validUntil}</strong>
          </div>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `
        <div style="background: var(--danger-light); border: 1.5px solid var(--danger-border); border-radius: var(--radius-md); padding: 1.25rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <span style="font-size: 1.5rem; color: var(--danger);">✕</span>
            <div>
              <div style="font-weight: 800; color: var(--danger-dark); font-size: 1.05rem;">BOARDING NOT PERMITTED</div>
              <div style="font-size: 0.75rem; color: var(--text-secondary);">${res.reason || 'Verification Failed'}</div>
            </div>
          </div>
          <p style="font-size: 0.85rem; color: var(--danger-dark); margin: 0;">
            ${res.message}
          </p>
        </div>
      `;
    }
  } catch (err) {
    resultDiv.innerHTML = `<p class="text-danger">Verification server error.</p>`;
  }
}
