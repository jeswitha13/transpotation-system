/**
 * Smart Bus Management System - Central API Client & Utilities
 * Connected to MySQL backend
 */

const API_BASE = '/api';

// Toast Notification Manager
const showToast = (title, message, type = 'info') => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || 'ℹ'}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1.1rem;margin-left:auto;padding:0 0.25rem;">✕</button>
  `;

  container.appendChild(toast);

  // Trigger entrance
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 5000);
};

// Modal Alert Dialog (for critical confirmation/alerts)
const showAlertModal = (title, message, type = 'warning') => {
  let modal = document.getElementById('appGlobalAlertModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'appGlobalAlertModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const typeColors = {
    warning: '#f59e0b',
    error: '#ef4444',
    success: '#10b981',
    info: '#0d9488'
  };

  const typeIcons = {
    warning: '⚠️',
    error: '❌',
    success: '✅',
    info: 'ℹ️'
  };

  modal.innerHTML = `
    <div class="modal-container" style="max-width: 440px; text-align: center; padding: 2rem 1.5rem;">
      <div style="font-size: 3rem; margin-bottom: 1rem;">${typeIcons[type] || 'ℹ️'}</div>
      <h3 style="font-size: 1.35rem; font-weight: 800; color: #111827; margin-bottom: 0.75rem;">${title}</h3>
      <p style="font-size: 0.95rem; color: #4b5563; line-height: 1.5; margin-bottom: 1.75rem;">${message}</p>
      <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="document.getElementById('appGlobalAlertModal').classList.remove('active')">
        Acknowledge &amp; Continue
      </button>
    </div>
  `;

  modal.classList.add('active');
};

// Authentication & Session Helper
const Auth = {
  getUser: () => {
    try {
      const data = localStorage.getItem('sbms_user');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  getToken: () => {
    return localStorage.getItem('sbms_token') || '';
  },

  setUser: (user, token) => {
    localStorage.setItem('sbms_user', JSON.stringify(user));
    if (token) localStorage.setItem('sbms_token', token);
  },

  logout: () => {
    localStorage.removeItem('sbms_user');
    localStorage.removeItem('sbms_token');
    window.location.href = '/login.html';
  },

  requireAuth: (allowedRoles = []) => {
    const user = Auth.getUser();
    if (!user) {
      window.location.href = '/login.html';
      return null;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      showToast('Access Restricted', 'You do not have permission to view this portal.', 'warning');
      if (user.role === 'admin') window.location.href = '/admin.html';
      else if (user.role === 'student') window.location.href = '/student.html';
      else if (user.role === 'driver') window.location.href = '/driver.html';
      return null;
    }

    return user;
  }
};

// Build authenticated headers
const getAuthHeaders = () => {
  const user = Auth.getUser();
  const token = Auth.getToken();
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-auth-token'] = token;
  }
  if (user && user.id) {
    headers['x-user-id'] = user.id;
  }
  return headers;
};

// Generic Fetch Wrapper
const api = {
  async get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = `${API_BASE}${endpoint}${query ? `?${query}` : ''}`;

    try {
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });
      return await res.json();
    } catch (err) {
      console.error(`GET ${endpoint} failed:`, err);
      showToast('Network Error', 'Unable to communicate with the server.', 'error');
      throw err;
    }
  },

  async post(endpoint, data = {}) {
    const url = `${API_BASE}${endpoint}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok && !json.success) {
        // Return structured response with HTTP status code attached
        json._status = res.status;
      }
      return json;
    } catch (err) {
      console.error(`POST ${endpoint} failed:`, err);
      showToast('Network Error', 'Unable to complete the request.', 'error');
      throw err;
    }
  },

  async put(endpoint, data = {}) {
    const url = `${API_BASE}${endpoint}`;

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok && !json.success) {
        json._status = res.status;
      }
      return json;
    } catch (err) {
      console.error(`PUT ${endpoint} failed:`, err);
      showToast('Network Error', 'Unable to update record.', 'error');
      throw err;
    }
  },

  async delete(endpoint) {
    const url = `${API_BASE}${endpoint}`;

    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      return await res.json();
    } catch (err) {
      console.error(`DELETE ${endpoint} failed:`, err);
      showToast('Network Error', 'Unable to delete record.', 'error');
      throw err;
    }
  }
};
