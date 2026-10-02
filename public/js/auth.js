/**
 * Smart Bus Management System - Authentication Logic (Login & Registration)
 * Connected to MySQL Database
 */

document.addEventListener('DOMContentLoaded', () => {
  initRoleTabs();
  initPasswordToggles();
  initLoginForm();
  initRegistrationForm();
  initDriverRegistrationForm();
  initDemoAutofill();
});

let currentRole = 'admin';

// 1. Role Tabs Selector
function initRoleTabs() {
  const tabs = document.querySelectorAll('.role-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const role = tab.getAttribute('data-role');
      if (!role) return;
      tabs.forEach(t => {
        if (t.getAttribute('data-role')) t.classList.remove('active');
      });
      tab.classList.add('active');
      currentRole = role;

      const roleInput = document.getElementById('selectedRole');
      if (roleInput) roleInput.value = currentRole;

      const identifierInput = document.getElementById('loginIdentifier');
      if (identifierInput) {
        if (role === 'admin') {
          identifierInput.placeholder = 'e.g. admin@college.edu';
        } else if (role === 'student') {
          identifierInput.placeholder = 'Enter Student Roll Number / ID (e.g. 23CS1090) or Email';
        } else if (role === 'driver') {
          identifierInput.placeholder = 'Enter Driver ID (e.g. DRV101) or Registered Name';
        }
      }
    });
  });
}

// Global function to toggle between Student & Driver registration on register.html
window.switchRegRole = function(role) {
  const studentTab = document.getElementById('regTabStudent');
  const driverTab = document.getElementById('regTabDriver');
  const studentForm = document.getElementById('registerForm');
  const driverForm = document.getElementById('driverRegisterForm');
  const title = document.getElementById('regMainTitle');
  const subtitle = document.getElementById('regMainSubtitle');

  if (role === 'driver') {
    if (studentTab) studentTab.classList.remove('active');
    if (driverTab) driverTab.classList.add('active');
    if (studentForm) studentForm.style.display = 'none';
    if (driverForm) driverForm.style.display = 'block';
    if (title) title.innerText = 'Driver Bus Registration';
    if (subtitle) subtitle.innerText = 'Register your Driver profile and credentials for bus duty';
  } else {
    if (driverTab) driverTab.classList.remove('active');
    if (studentTab) studentTab.classList.add('active');
    if (driverForm) driverForm.style.display = 'none';
    if (studentForm) studentForm.style.display = 'block';
    if (title) title.innerText = 'Student Bus Registration';
    if (subtitle) subtitle.innerText = 'Provide your student details and select your daily pickup location';
  }
};

// 2. Password Show / Hide Toggle
function initPasswordToggles() {
  const toggleBtns = document.querySelectorAll('.password-toggle-btn');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.innerText = isPassword ? '🙈' : '👁️';
      }
    });
  });
}

// 3. One-Click Demo Credentials Autofill
function initDemoAutofill() {
  window.fillDemoCredentials = (role) => {
    const identifierInput = document.getElementById('loginIdentifier');
    const passwordInput = document.getElementById('loginPassword');
    const tabs = document.querySelectorAll('.role-tab');

    // Activate the role tab
    tabs.forEach(tab => {
      if (tab.getAttribute('data-role') === role) {
        tab.click();
      }
    });

    if (role === 'admin') {
      if (identifierInput) identifierInput.value = 'admin@college.edu';
      if (passwordInput) passwordInput.value = 'password123';
      showToast('Admin Credentials Filled', 'Initial Admin account: admin@college.edu', 'info');
    } else if (role === 'student') {
      if (identifierInput) identifierInput.value = '';
      if (passwordInput) passwordInput.value = 'password123';
      showToast('Student Login', 'Enter your registered Roll Number or Email.', 'info');
    } else if (role === 'driver') {
      if (identifierInput) identifierInput.value = '';
      if (passwordInput) passwordInput.value = 'password123';
      showToast('Driver Login', 'Enter your registered Driver ID (e.g. DRV101) or Name.', 'info');
    }
  };
}

// 4. Handle Login Submission
function initLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const identifier = document.getElementById('loginIdentifier')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!identifier || !password) {
      showToast('Missing Fields', 'Please enter your email, username, roll number, or driver ID and password.', 'error');
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner" style="width: 1.1rem; height: 1.1rem; border-width: 2px;"></span> Authenticating with MySQL...`;
      }

      // If logging in as driver, try /api/drivers/login or fallback to /api/auth/login
      const endpoint = currentRole === 'driver' ? '/drivers/login' : (currentRole === 'student' ? '/students/login' : '/auth/login');
      let res = await api.post(endpoint, {
        identifier,
        studentId: identifier,
        driverId: identifier,
        password,
        role: currentRole
      });

      // If specific route failed with 404, fallback to /auth/login
      if (!res.success && endpoint !== '/auth/login') {
        res = await api.post('/auth/login', {
          identifier,
          password,
          role: currentRole
        });
      }

      if (!res.success) {
        showToast('Login Failed', res.message || 'Invalid credentials.', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Login to Portal →';
        }
        return;
      }

      // Save user session & JWT token
      Auth.setUser(res.user, res.token);
      showToast('Welcome Back', `Logged in as ${res.user.name || res.user.full_name || identifier}`, 'success');

      // Redirect based on role
      setTimeout(() => {
        if (res.user.role === 'admin') {
          window.location.href = '/admin.html';
        } else if (res.user.role === 'student') {
          window.location.href = '/student.html';
        } else if (res.user.role === 'driver') {
          window.location.href = '/driver.html';
        } else {
          window.location.href = '/';
        }
      }, 600);

    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Login to Portal →';
      }
    }
  });
}

// 5. Handle Student Registration with Live MySQL Roll Number & Pickup Validation
async function initRegistrationForm() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  const pickupSelect = document.getElementById('regPickup');
  const feeCard = document.getElementById('feePreviewCard');
  const feeAmountEl = document.getElementById('feePreviewAmount');
  const feeZoneEl = document.getElementById('feePreviewZone');
  const rollInput = document.getElementById('regRollNo');
  const passwordInput = document.getElementById('regPassword');
  const strengthBar = document.getElementById('passwordStrengthBar');

  // Load locations from MySQL into select dropdown
  try {
    const locRes = await api.get('/locations');
    if (locRes.success && pickupSelect) {
      if (locRes.data.length === 0) {
        pickupSelect.innerHTML = `<option value="">No pickup locations created yet by Admin.</option>`;
      } else {
        pickupSelect.innerHTML = `<option value="">-- Choose Your Daily Pickup Location --</option>` +
          locRes.data.map(loc => `
            <option value="${loc.id}" data-dist="${loc.distanceKm}" data-zone="${loc.zone}">
              ${loc.name} (${loc.zone} • ${loc.distanceKm} km • ${loc.routeName})
            </option>
          `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load pickup locations:', err);
  }

  // Update preview when pickup changes
  pickupSelect?.addEventListener('change', () => {
    const opt = pickupSelect.options[pickupSelect.selectedIndex];
    if (!pickupSelect.value || !opt) {
      if (feeCard) feeCard.classList.remove('show');
      return;
    }

    const dist = opt.getAttribute('data-dist') || 15;
    const zone = opt.getAttribute('data-zone') || 'Zone 1';

    if (feeCard) feeCard.classList.add('show');
    if (feeAmountEl) feeAmountEl.innerText = `Route Distance: ${dist} km`;
    if (feeZoneEl) feeZoneEl.innerText = `${zone} • Applicable fee will be calculated based on route configuration`;
  });

  // Password strength meter
  passwordInput?.addEventListener('input', () => {
    const val = passwordInput.value;
    if (!strengthBar) return;

    strengthBar.className = 'strength-bar';
    if (!val) {
      strengthBar.style.width = '0%';
    } else if (val.length < 6) {
      strengthBar.classList.add('strength-weak');
    } else if (val.length < 10) {
      strengthBar.classList.add('strength-medium');
    } else {
      strengthBar.classList.add('strength-strong');
    }
  });

  // Real-time roll number formatting
  rollInput?.addEventListener('input', (e) => {
    rollInput.value = rollInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  // Submit student registration
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('regName')?.value.trim();
    const rollNo = rollInput?.value.trim().toUpperCase();
    const email = document.getElementById('regEmail')?.value.trim();
    const phone = document.getElementById('regPhone')?.value.trim();
    const branch = document.getElementById('regBranch')?.value;
    const year = document.getElementById('regYear')?.value;
    const semester = document.getElementById('regSemester')?.value || '1';
    const username = document.getElementById('regUsername')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const confirmPassword = document.getElementById('regConfirmPassword')?.value;
    const address = document.getElementById('regAddress')?.value.trim();
    const pickupId = pickupSelect?.value;

    if (!name || !rollNo || !email || !password || !pickupId) {
      showToast('Validation Error', 'Please complete all required fields.', 'error');
      return;
    }

    // Roll Number Validation (3 to 20 alphanumeric characters)
    const rollRegex = /^[A-Za-z0-9]{3,20}$/;
    if (!rollRegex.test(rollNo)) {
      showAlertModal(
        'Invalid Roll Number Format',
        'Student ID / Roll Number must contain letters and numbers (3-20 characters) without spaces or hyphens.',
        'warning'
      );
      showToast('Invalid Roll Number', 'Student ID must contain 3-20 letters/numbers.', 'error');
      if (rollInput) rollInput.focus();
      return;
    }

    if (password !== confirmPassword) {
      showToast('Password Mismatch', 'Password and confirmation do not match.', 'error');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner" style="width: 1.1rem; height: 1.1rem; border-width: 2px;"></span> Registering in MySQL...`;
      }

      const res = await api.post('/auth/register', {
        name,
        rollNo,
        email,
        phone,
        branch,
        course: branch,
        year,
        semester,
        username,
        password,
        address,
        pickupId
      });

      if (!res.success) {
        if (res.message && res.message.toLowerCase().includes('already exists')) {
          showAlertModal(
            'Duplicate Roll Number',
            res.message || 'Roll Number already exists. Please enter a different Roll Number.',
            'error'
          );
        } else {
          showToast('Registration Error', res.message || 'Could not register.', 'error');
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Complete Student Registration →';
        }
        return;
      }

      // Automatically log the new student in
      Auth.setUser(res.user, res.token);
      showToast('Registration Successful ✓', 'Welcome to College Transportation System!', 'success');

      setTimeout(() => {
        window.location.href = '/student.html';
      }, 700);

    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Complete Student Registration →';
      }
    }
  });
}

// 6. Handle Driver Registration
function initDriverRegistrationForm() {
  const form = document.getElementById('driverRegisterForm');
  if (!form) return;

  const drvIdInput = document.getElementById('drvRegId');
  drvIdInput?.addEventListener('input', () => {
    drvIdInput.value = drvIdInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('drvRegName')?.value.trim();
    const driverId = drvIdInput?.value.trim().toUpperCase();
    const phone = document.getElementById('drvRegPhone')?.value.trim();
    const password = document.getElementById('drvRegPassword')?.value;
    const confirmPassword = document.getElementById('drvRegConfirmPassword')?.value;
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!name || !driverId || !password) {
      showToast('Validation Error', 'Please complete Driver Name, Driver ID, and Password.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Password Mismatch', 'Password and confirmation password do not match.', 'error');
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner" style="width: 1.1rem; height: 1.1rem; border-width: 2px;"></span> Registering Driver in MySQL...`;
      }

      const res = await api.post('/drivers/register', {
        name,
        driverId,
        phone,
        password
      });

      if (!res.success) {
        showToast('Registration Error', res.message || 'Could not register driver.', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Complete Driver Registration →';
        }
        return;
      }

      Auth.setUser(res.user, res.token);
      showToast('Driver Registered ✓', 'Welcome to College Driver Console!', 'success');

      setTimeout(() => {
        window.location.href = '/driver.html';
      }, 700);

    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Complete Driver Registration →';
      }
    }
  });
}
