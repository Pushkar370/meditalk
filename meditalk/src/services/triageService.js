import { apiFetch } from './apiClient';

/**
 * Request an AI clinical triage assessment for reported symptoms.
 * @param {Object} payload { symptoms, duration, severity, accompanyingSymptoms, age, gender }
 */
export function assessSymptoms(payload) {
  return apiFetch('/triage/assess', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch historical biometric vitals trends for a patient across completed consultations.
 * @param {string} patientId
 */
export function getPatientVitalsHistory(patientId) {
  return apiFetch(`/patients/${patientId}/vitals-history`);
}
