/**
 * Smart Bus Management System - Landing Page Interactive Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initAnimatedCounters();
  loadRoutesPreview();
  initTrackingPreview();
  initContactForm();
});

// 1. Sticky Navbar & Mobile Drawer
function initNavbar() {
  const header = document.querySelector('.site-header');
  const mobileToggle = document.getElementById('mobileMenuToggle');
  const navLinks = document.getElementById('navLinks');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  });

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      const isVisible = navLinks.style.display === 'flex';
      navLinks.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        navLinks.style.flexDirection = 'column';
        navLinks.style.position = 'absolute';
        navLinks.style.top = '100%';
        navLinks.style.left = '0';
        navLinks.style.right = '0';
        navLinks.style.background = '#ffffff';
        navLinks.style.padding = '1.5rem';
        navLinks.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
      }
    });
  }
}

// 2. Animated Counters when scrolled into view
function initAnimatedCounters() {
  const counters = document.querySelectorAll('.stat-number');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-target'), 10) || 0;
        const suffix = el.getAttribute('data-suffix') || '';
        let current = 0;
        const step = Math.ceil(target / 40);
        
        const timer = setInterval(() => {
          current += step;
          if (current >= target) {
            current = target;
            clearInterval(timer);
          }
          el.innerText = `${current}${suffix}`;
        }, 35);

        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(c => observer.observe(c));
}

// 3. Load Bus Routes from Backend API
async function loadRoutesPreview() {
  const container = document.getElementById('routesContainer');
  if (!container) return;

  try {
    const res = await api.get('/routes');
    if (!res.success || !res.data.length) {
      container.innerHTML = `<p class="text-center text-muted">No bus routes available at the moment.</p>`;
      return;
    }

    container.innerHTML = res.data.map(route => `
      <div class="route-card">
        <div class="route-header">
          <span class="route-number">${route.routeNumber}</span>
          <span class="badge ${route.status === 'In Transit' ? 'badge-success pulse-badge' : 'badge-neutral'}">
            <span class="badge-dot"></span> ${route.status}
          </span>
        </div>
        <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--navy-900);">${route.title}</h4>
        
        <div class="route-path">
          <div class="route-path-item">
            <span>🏁 ${route.startPoint}</span>
          </div>
          <div class="route-path-arrow">↓ via ${route.totalStops} pickup stops</div>
          <div class="route-path-item">
            <span>🎓 ${route.endPoint}</span>
          </div>
        </div>

        <div class="route-meta">
          <div class="route-meta-item">
            <div class="meta-val">${route.totalStops}</div>
            <div class="meta-lbl">Stops</div>
          </div>
          <div class="route-meta-item">
            <div class="meta-val">${route.distance}</div>
            <div class="meta-lbl">Distance</div>
          </div>
          <div class="route-meta-item">
            <div class="meta-val">${route.busNumber}</div>
            <div class="meta-lbl">Bus</div>
          </div>
        </div>

        <div style="margin-top: auto; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 0.8rem; color: var(--text-muted);">🕒 ${route.timing}</span>
          <button class="btn btn-outline-primary btn-sm" onclick="viewRouteDetails('${route.id}')">
            View Route →
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading routes preview:', err);
    container.innerHTML = `<p class="text-center text-muted">Failed to load routes.</p>`;
  }
}

// Global function to view route details in a modal
window.viewRouteDetails = async (routeId) => {
  const modal = document.getElementById('routeModal');
  const modalBody = document.getElementById('routeModalBody');
  if (!modal || !modalBody) return;

  try {
    modalBody.innerHTML = `<div class="text-center" style="padding: 2rem;"><span class="spinner"></span></div>`;
    modal.classList.add('active');

    const res = await api.get(`/routes/${routeId}`);
    if (!res.success) throw new Error(res.message);

    const r = res.data;
    modalBody.innerHTML = `
      <div style="margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
          <span class="badge badge-info">${r.routeNumber}</span>
          <span class="badge ${r.status === 'In Transit' ? 'badge-success' : 'badge-neutral'}">${r.status}</span>
        </div>
        <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--navy-900);">${r.title}</h3>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.25rem;">
          Distance: <strong>${r.distance}</strong> | Timetable: <strong>${r.timing}</strong>
        </p>
      </div>

      <div style="background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
          <div>Assigned Vehicle: <strong>${r.bus ? r.bus.busNumber : 'Unassigned'}</strong></div>
          <div>Driver: <strong>${r.driver ? r.driver.name : 'Unassigned'}</strong> (${r.driver ? r.driver.phone : '-'})</div>
        </div>
      </div>

      <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 1rem; color: var(--navy-900);">Stops Sequence</h4>
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${(r.stops || []).map((stop, idx) => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="width: 1.75rem; height: 1.75rem; border-radius: 50%; background: var(--primary-100); color: var(--primary); font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                ${stop.order}
              </span>
              <div>
                <div style="font-weight: 700; font-size: 0.9rem; color: var(--navy-900);">${stop.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Pickup Time: ${stop.time}</div>
              </div>
            </div>
            <span class="badge badge-neutral">${stop.studentsCount || 0} Students</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    modalBody.innerHTML = `<p class="text-danger text-center">Failed to load route details.</p>`;
  }
};

window.closeRouteModal = () => {
  document.getElementById('routeModal')?.classList.remove('active');
};

// 4. Live Tracking Preview Simulator
function initTrackingPreview() {
  const marker = document.getElementById('previewBusMarker');
  const progressBar = document.getElementById('previewProgressBar');
  const speedEl = document.getElementById('previewSpeed');
  const etaEl = document.getElementById('previewEta');
  const updatedEl = document.getElementById('previewUpdated');

  if (!marker) return;

  // Keyframe percentages corresponding to the 6 nodes on the preview line
  const stopPositions = [
    { left: '6%', progress: '0%', speed: '0 km/h', eta: '32 mins' },
    { left: '24%', progress: '20%', speed: '42 km/h', eta: '25 mins' },
    { left: '42%', progress: '38%', speed: '48 km/h', eta: '18 mins' },
    { left: '60%', progress: '58%', speed: '36 km/h', eta: '12 mins' },
    { left: '78%', progress: '78%', speed: '40 km/h', eta: '6 mins' },
    { left: '94%', progress: '100%', speed: '0 km/h', eta: 'Arrived' }
  ];

  let currentIdx = 2; // start at STOP 2

  setInterval(() => {
    currentIdx = (currentIdx + 1) % stopPositions.length;
    const pos = stopPositions[currentIdx];

    marker.style.left = pos.left;
    if (progressBar) progressBar.style.width = pos.progress;
    if (speedEl) speedEl.innerText = pos.speed;
    if (etaEl) etaEl.innerText = pos.eta;
    if (updatedEl) updatedEl.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Highlight stop nodes
    const nodes = document.querySelectorAll('.map-stop-node');
    nodes.forEach((node, idx) => {
      node.classList.remove('passed', 'current');
      if (idx < currentIdx) node.classList.add('passed');
      else if (idx === currentIdx) node.classList.add('current');
    });
  }, 4000);
}

// 5. Contact Form Validation and Submission
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('contactName')?.value.trim();
    const email = document.getElementById('contactEmail')?.value.trim();
    const subject = document.getElementById('contactSubject')?.value.trim();
    const message = document.getElementById('contactMessage')?.value.trim();

    if (!name || !email || !subject || !message) {
      showToast('Validation Error', 'Please fill out all contact fields.', 'error');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Invalid Email', 'Please enter a valid email address.', 'error');
      return;
    }

    // Simulate sending message
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner" style="width: 1rem; height: 1rem; border-width: 2px;"></span> Sending...`;
    }

    setTimeout(() => {
      showToast('Message Dispatched', 'Thank you! The Transportation Office will reply shortly.', 'success');
      form.reset();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Send Message';
      }
    }, 1000);
  });
}
