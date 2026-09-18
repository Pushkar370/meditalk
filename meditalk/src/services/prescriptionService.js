import { apiFetch } from './apiClient';

// --- Prescriptions ---

export function getPrescriptions(filters = {}) {
  const params = new URLSearchParams();
  if (filters.patientId) params.set('patientId', filters.patientId);
  if (filters.doctorId) params.set('doctorId', filters.doctorId);
  const qs = params.toString();
  return apiFetch(`/prescriptions${qs ? `?${qs}` : ''}`);
}

export function getPrescriptionById(id) {
  return apiFetch(`/prescriptions/${id}`);
}

export async function savePrescription(payload) {
  const res = await apiFetch('/prescriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res;
}

// --- Consultations ---

export function getConsultations(filters = {}) {
  const params = new URLSearchParams();
  if (filters.patientId) params.set('patientId', filters.patientId);
  if (filters.doctorId) params.set('doctorId', filters.doctorId);
  const qs = params.toString();
  return apiFetch(`/consultations${qs ? `?${qs}` : ''}`);
}

export async function saveConsultation(payload) {
  const res = await apiFetch('/consultations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res;
}

// --- Medical Records ---

export function getMedicalRecords(patientId) {
  return apiFetch(`/medical-records?patientId=${patientId}`);
}

export async function saveMedicalRecord(recordData) {
  const res = await apiFetch('/medical-records', {
    method: 'POST',
    body: JSON.stringify(recordData),
  });
  return res;
}
