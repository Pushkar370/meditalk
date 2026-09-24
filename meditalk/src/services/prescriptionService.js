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

// ─── Phase 9: Drug Safety, AI Records & Pharmacy ─────────────────────────────

export async function checkDrugSafety(patientId, newMedications) {
  return apiFetch('/prescriptions/check-safety', {
    method: 'POST',
    body: JSON.stringify({ patientId, newMedications }),
  });
}

export async function synthesizeAiRecord(recordId, patientNotes) {
  return apiFetch('/medical-records/ai-synthesize', {
    method: 'POST',
    body: JSON.stringify({ recordId, patientNotes }),
  });
}

export async function adoptAiRecords(patientId, { allergies = [], medications = [] }) {
  return apiFetch(`/patients/${patientId}/adopt-ai-records`, {
    method: 'PATCH',
    body: JSON.stringify({ allergies, medications }),
  });
}

// --- Pharmacy Orders ---
export function getPharmacyOrders(filters = {}) {
  const params = new URLSearchParams();
  if (filters.patientId) params.set('patientId', filters.patientId);
  if (filters.prescriptionId) params.set('prescriptionId', filters.prescriptionId);
  if (filters.status) params.set('status', filters.status);
  return apiFetch(`/pharmacy/orders?${params.toString()}`);
}

export async function createPharmacyOrder(payload) {
  return apiFetch('/pharmacy/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateOrderStatus(orderId, status) {
  return apiFetch(`/pharmacy/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// --- Medication Adherence ---
export function getAdherenceSchedules(patientId) {
  return apiFetch(`/medications/adherence?patientId=${patientId}`);
}

export async function createAdherenceSchedules(patientId, prescriptionId, medications) {
  return apiFetch('/medications/adherence', {
    method: 'POST',
    body: JSON.stringify({ patientId, prescriptionId, medications }),
  });
}

export async function logAdherenceDose(scheduleId, slot, date) {
  return apiFetch('/medications/adherence/log', {
    method: 'POST',
    body: JSON.stringify({ scheduleId, slot, date }),
  });
}

export async function deactivateSchedule(scheduleId) {
  return apiFetch(`/medications/adherence/${scheduleId}`, { method: 'DELETE' });
}
