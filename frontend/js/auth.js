'use strict';

// ── Configuration ──────────────────────────────────────────────
// In production, nginx proxies /api/ to the backend.
// In local dev without nginx, set to 'http://localhost:3000'.
const API_BASE_URL = '';

const TOKEN_KEY = 'borbulhas_admin_token';
const USER_KEY  = 'borbulhas_admin_user';

// ── Auth Utilities ─────────────────────────────────────────────
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function logout() {
  clearAuth();
  window.location.href = 'index.html';
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Auth Guard (call on protected pages) ──────────────────────
function requireAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// ── Login Form Handler ─────────────────────────────────────────
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  // Redirect if already logged in
  if (getToken()) {
    window.location.href = 'admin.html';
  }

  const errorMsg = document.getElementById('errorMsg');
  const loginBtn = document.getElementById('loginBtn');

  function showError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.add('show');
  }

  function hideError() {
    errorMsg.classList.remove('show');
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showError('Por favor, preencha e-mail e senha.');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> Entrando…';

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Erro ao fazer login.');
        return;
      }

      setToken(data.token);
      setUser(data.user);
      window.location.href = 'admin.html';

    } catch (err) {
      console.error('Login fetch error:', err);
      showError('Não foi possível conectar ao servidor. Verifique sua conexão.');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Entrar';
    }
  });
}

// ── Admin Page Initializer ─────────────────────────────────────
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  // Guard
  if (!requireAuth()) {
    // will redirect
  }

  // Show user email
  const user = getUser();
  const userEmailEl = document.getElementById('userEmail');
  if (userEmailEl && user) {
    userEmailEl.textContent = user.email;
  }

  logoutBtn.addEventListener('click', () => {
    logout();
  });
}
