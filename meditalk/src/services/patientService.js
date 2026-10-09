import { apiFetch } from './apiClient';

export function getPatients(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  const qs = params.toString();
  return apiFetch(`/patients${qs ? `?${qs}` : ''}`);
}

export function getPatientById(id) {
  return apiFetch(`/patients/${id}`);
}

export async function addPatient(payload) {
  const patient = await apiFetch('/patients', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { success: true, patient };
}

export async function updatePatient(id, payload) {
  const patient = await apiFetch(`/patients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return { success: true, patient };
}

export function setPatientStatus(id, status) {
  return apiFetch(`/patients/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// Phase 11: Export Patient Health Archive (GDPR / HIPAA Portability)
export async function exportPatientData(patientId) {
  return apiFetch(`/patients/${patientId}/export`);
}

// Phase 11: Withdraw Medical Consent & Delete Account
export async function withdrawConsent(patientId) {
  return apiFetch(`/patients/${patientId}/withdraw-consent`, {
    method: 'POST',
  });
}

// Phase 11: Nurse / Clinical Staff records vitals
export async function recordPatientVitals(patientId, payload) {
  return apiFetch(`/patients/${patientId}/vitals`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Phase 11: Vitals history
export async function getPatientVitalsHistory(patientId) {
  return apiFetch(`/patients/${patientId}/vitals-history`);
}

