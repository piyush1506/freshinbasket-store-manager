const TOKEN_KEYS = {
  ACCESS: 'freshinbasket_access',
  REFRESH: 'freshinbasket_refresh',
  USER: 'freshinbasket_user',
};

let memoryToken = null;

let _refreshPromise = null;

function isBrowser() {
  return typeof window !== 'undefined';
}

const getApiBaseUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || '';
};

export function getAccessToken() {
  if (memoryToken) return memoryToken;
  if (isBrowser()) {
    return localStorage.getItem(TOKEN_KEYS.ACCESS) || localStorage.getItem('access');
  }
  return null;
}

export function setTokens(access, refresh) {
  memoryToken = access;
  if (isBrowser()) {
    localStorage.setItem(TOKEN_KEYS.ACCESS, access);
    localStorage.setItem(TOKEN_KEYS.REFRESH, refresh);
    localStorage.setItem('access', access);
    localStorage.setItem('refresh', refresh);
  }
}

export function setUser(userData) {
  if (isBrowser()) {
    localStorage.setItem(TOKEN_KEYS.USER, JSON.stringify(userData));
    localStorage.setItem('user', JSON.stringify(userData));
  }
}

export function getUser() {
  if (isBrowser()) {
    const data = localStorage.getItem(TOKEN_KEYS.USER) || localStorage.getItem('user');
    return data ? JSON.parse(data) : null;
  }
  return null;
}

export function clearAuth() {
  memoryToken = null;
  if (isBrowser()) {
    [TOKEN_KEYS.ACCESS, TOKEN_KEYS.REFRESH, TOKEN_KEYS.USER, 'access', 'refresh', 'user'].forEach(k => {
      localStorage.removeItem(k);
    });
  }
}

export function isAuthenticated() {
  return !!getAccessToken();
}

export async function authFetch(url, options = {}) {
  const token = getAccessToken();
  if (token) {
    options.headers = { ...options.headers, Authorization: `Bearer ${token}` };
  }

  let res = await fetch(url, options);

  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      options.headers = { ...options.headers, Authorization: `Bearer ${newToken}` };
      res = await fetch(url, options);
    }
  }

  return res;
}

export async function refreshAccessToken() {
  if (_refreshPromise) {
    return _refreshPromise;
  }

  const refresh = isBrowser()
    ? (localStorage.getItem(TOKEN_KEYS.REFRESH) || localStorage.getItem('refresh'))
    : null;

  if (!refresh) return null;

  _refreshPromise = (async () => {
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/v1/auth/refresh/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        }
      );
      if (!res.ok) {
        clearAuth();
        return null;
      }
      const data = await res.json();
      setTokens(data.access, data.refresh || refresh);
      return data.access;
    } catch {
      clearAuth();
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

export const AUTH_API = {
  async login(identifier, password) {
    const trimmed = (identifier || '').trim();
    const isEmail = trimmed.includes('@');
    let body;
    if (isEmail) {
      body = { email: trimmed.toLowerCase(), password };
    } else {
      let cleanPhone = trimmed.replace(/\D/g, '');
      if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
        cleanPhone = cleanPhone.slice(2);
      }
      body = { phone_number: cleanPhone, password };
    }

    const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data.non_field_errors?.[0] || data.detail || data.error || (typeof data === 'string' ? data : 'Invalid credentials')
      );
    }
    setTokens(data.access, data.refresh);
    setUser(data.user);
    return data;
  },

  async logout() {
    const token = getAccessToken();
    const refresh = isBrowser()
      ? (localStorage.getItem(TOKEN_KEYS.REFRESH) || localStorage.getItem('refresh'))
      : null;

    if (refresh) {
      try {
        await fetch(
          `${getApiBaseUrl()}/api/v1/auth/logout/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ refresh }),
          }
        );
      } catch {
        // Proceed with local logout
      }
    }
    clearAuth();
  },

  async sendOtp(phone_number) {
    const res = await fetch(
      `${getApiBaseUrl()}/api/v1/auth/send-otp/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number }),
      }
    );
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Failed to send OTP');
    }
    return result;
  },

  async verifyOtp(phone_number, otp_code, reqId) {
    const res = await fetch(
      `${getApiBaseUrl()}/api/v1/auth/verify-otp/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number, otp_code, reqId }),
      }
    );
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Invalid OTP');
    }
    setTokens(result.access, result.refresh);
    setUser(result.user);
    return result;
  },
};
