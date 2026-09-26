import { apiFetch } from './apiClient';
import { getDoctors } from './doctorService';

export function getAppointments(filters = {}) {
  const params = new URLSearchParams();
  if (filters.patientId) params.set('patientId', filters.patientId);
  if (filters.doctorId) params.set('doctorId', filters.doctorId);
  if (filters.status) params.set('status', filters.status);
  if (filters.date) params.set('date', filters.date);
  const qs = params.toString();
  return apiFetch(`/appointments${qs ? `?${qs}` : ''}`);
}

export function getAppointmentById(id) {
  return apiFetch(`/appointments/${id}`);
}

export async function bookAppointment(payload) {
  const res = await apiFetch('/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res;
}

export function cancelAppointment(id, reason) {
  return apiFetch(`/appointments/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason: reason || '' }),
  });
}

export function rescheduleAppointment(id, { date, time }) {
  return apiFetch(`/appointments/${id}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify({ date, time }),
  });
}

export function updateAppointmentStatus(id, status) {
  return apiFetch(`/appointments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// --- Doctor Schedule Service Functions ---

export function getDoctorSchedule(doctorId) {
  return apiFetch(`/doctors/${doctorId}/schedule`);
}

export function saveDoctorSchedule(doctorId, scheduleData) {
  return apiFetch(`/doctors/${doctorId}/schedule`, {
    method: 'PUT',
    body: JSON.stringify(scheduleData),
  });
}

export function getAvailableSlots(doctorId, date) {
  return apiFetch(`/doctors/${doctorId}/available-slots?date=${date}`);
}

export function updateVideoStatus(id, videoStatus) {
  return apiFetch(`/appointments/${id}/video-status`, {
    method: 'PATCH',
    body: JSON.stringify({ videoStatus }),
  });
}

// --- Doctor Availability Exceptions / Leave (CW-2) ---
export function getDoctorUnavailability(doctorId) {
  return apiFetch(`/doctors/${doctorId}/unavailability`);
}

export function addDoctorUnavailability(doctorId, { date, reason }) {
  return apiFetch(`/doctors/${doctorId}/unavailability`, {
    method: 'POST',
    body: JSON.stringify({ date, reason }),
  });
}

export function deleteDoctorUnavailability(doctorId, unavailId) {
  return apiFetch(`/doctors/${doctorId}/unavailability/${unavailId}`, {
    method: 'DELETE',
  });
}

// ─── CW-6: Waiting Room Queue ─────────────────────────────────────────────

export function getWaitingRoomQueue(doctorId = null) {
  const qs = doctorId ? `?doctorId=${doctorId}` : '';
  return apiFetch(`/appointments/queue/today${qs}`);
}

export function checkInAppointment(appointmentId) {
  return apiFetch(`/appointments/${appointmentId}/check-in`, {
    method: 'PATCH',
  });
}

export function updateQueueStatus(appointmentId, checkInStatus) {
  return apiFetch(`/appointments/${appointmentId}/queue-status`, {
    method: 'PATCH',
    body: JSON.stringify({ checkInStatus }),
  });
}

// ─── DA-1: Doctor Analytics ───────────────────────────────────────────────

export function getDoctorAnalytics(doctorId) {
  return apiFetch(`/doctors/${doctorId}/analytics`);
}

// Delegates to doctor service — consistent API surface
export { getDoctors };


