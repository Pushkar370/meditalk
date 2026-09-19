import { apiFetch } from './apiClient';
import { DASHBOARD_ROUTES } from '../constants';

export async function login({ email, password, role }) {
  try {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });
    // Store token in user object in localStorage (read by apiClient)
    if (res.success && res.token) {
      const userWithToken = { ...res.user, token: res.token };
      localStorage.setItem('meditrack_user', JSON.stringify(userWithToken));
    }
    return {
      success: res.success,
      token: res.token,
      user: res.user,
      redirectTo: DASHBOARD_ROUTES[role],
    };
  } catch (err) {
    return { success: false, message: err.message || 'Login failed.' };
  }
}

export async function register(payload) {
  try {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res;
  } catch (err) {
    return { success: false, message: err.message || 'Registration failed.' };
  }
}

export function logout() {
  // Client-side only — clear token
  return Promise.resolve({ success: true });
}

export async function changePassword({ currentPassword, nextPassword }) {
  return apiFetch('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, nextPassword }),
  });
}
