import { apiFetch } from './apiClient';

export function getAuditLogs(filters = {}) {
  const params = new URLSearchParams();
  if (filters.role) params.set('role', filters.role);
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const qs = params.toString();
  return apiFetch(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
}

export function getAuditLogStats() {
  return apiFetch('/admin/audit-logs/stats');
}

export function setUserStatus(userId, status) {
  return apiFetch(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function getAnalytics(from, to) {
  const qs = from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : '';
  return apiFetch(`/admin/analytics${qs}`);
}

export function getDashboardStats(role) {
  if (role === 'admin') return apiFetch('/admin/stats');
  return Promise.resolve({});
}

// ── Phase 5: Doctor Verification ────────────────────────────────────────────
export function getPendingDoctors() {
  return apiFetch('/admin/doctors/pending');
}

export function getAllDoctorsWithVerification() {
  return apiFetch('/admin/doctors/all');
}

export function verifyDoctor(id, action, notes) {
  return apiFetch(`/admin/doctors/${id}/verify`, {
    method: 'PATCH',
    body: JSON.stringify({ action, notes }),
  });
}

// ── Phase 5: Admin Appointment Management ───────────────────────────────────
export function cancelAppointmentAdmin(id, reason) {
  return apiFetch(`/admin/appointments/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export function rescheduleAppointmentAdmin(id, date, time, reason) {
  return apiFetch(`/admin/appointments/${id}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify({ date, time, reason }),
  });
}

// ── Phase 5: Broadcast Announcements ────────────────────────────────────────
export function sendBroadcast({ title, message, targetRole }) {
  return apiFetch('/admin/broadcast', {
    method: 'POST',
    body: JSON.stringify({ title, message, targetRole }),
  });
}

export function getBroadcastHistory() {
  return apiFetch('/admin/broadcasts');
}

