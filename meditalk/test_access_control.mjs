// test_access_control.mjs
// Comprehensive verification test suite for all 3 access control findings

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { query } from './backend/database/db.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const BASE_URL = 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET;

function makeToken(payload) {
  const jti = 'jti_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  return jwt.sign({
    jti,
    tokenVersion: 1,
    ...payload,
  }, JWT_SECRET, { expiresIn: '1h' });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function setup() {
  const hash = await bcrypt.hash('TestPass123!', 10);

  // Clean test fixtures
  await query("DELETE FROM users WHERE email IN ('alice.ac@test.com', 'bob.ac@test.com', 'dr.catherine.ac@test.com', 'dr.david.ac@test.com', 'nurse.nancy.ac@test.com', 'ron.recept.ac@test.com', 'admin.alice.ac@test.com')");
  await query("DELETE FROM appointments WHERE patient_id IN ('P-AC1', 'P-AC2')");
  await query("DELETE FROM consultations WHERE patient_id IN ('P-AC1', 'P-AC2')");
  await query("DELETE FROM prescriptions WHERE patient_id IN ('P-AC1', 'P-AC2')");
  await query("DELETE FROM medical_records WHERE patient_id IN ('P-AC1', 'P-AC2')");
  await query("DELETE FROM patient_vitals WHERE patient_id IN ('P-AC1', 'P-AC2')");
  await query("DELETE FROM follow_up_suggestions WHERE patient_id IN ('P-AC1', 'P-AC2')");
  await query("DELETE FROM refill_requests WHERE patient_id IN ('P-AC1', 'P-AC2')");
  await query("DELETE FROM medication_schedules WHERE patient_id IN ('P-AC1', 'P-AC2')");
  await query("DELETE FROM patients WHERE id IN ('P-AC1', 'P-AC2') OR email IN ('alice.ac@test.com', 'bob.ac@test.com')");
  await query("DELETE FROM doctors WHERE id IN ('D-AC1', 'D-AC2') OR email IN ('dr.catherine.ac@test.com', 'dr.david.ac@test.com')");

  // Insert patients
  await query(
    `INSERT INTO patients (id, name, email, phone, blood_group, allergies, chronic_conditions, status)
     VALUES 
      ('P-AC1', 'Alice Carroll', 'alice.ac@test.com', '+919888800001', 'A+', '["Penicillin"]', '["Hypertension"]', 'active'),
      ('P-AC2', 'Bob Builder', 'bob.ac@test.com', '+919888800002', 'O-', '["Peanuts"]', '[]', 'active')`
  );

  // Insert doctors
  await query(
    `INSERT INTO doctors (id, name, email, specialty, status, verification_status)
     VALUES 
      ('D-AC1', 'Dr. Catherine Green', 'dr.catherine.ac@test.com', 'Cardiology', 'active', 'approved'),
      ('D-AC2', 'Dr. David Brown', 'dr.david.ac@test.com', 'Dermatology', 'active', 'approved')`
  );

  // Insert users
  await query(
    `INSERT INTO users (id, name, email, password, role, patient_id, doctor_id, token_version)
     VALUES 
      ('U-PAT-AC1', 'Alice Carroll', 'alice.ac@test.com', $1, 'patient', 'P-AC1', NULL, 1),
      ('U-PAT-AC2', 'Bob Builder', 'bob.ac@test.com', $1, 'patient', 'P-AC2', NULL, 1),
      ('U-DOC-AC1', 'Dr. Catherine Green', 'dr.catherine.ac@test.com', $1, 'doctor', NULL, 'D-AC1', 1),
      ('U-DOC-AC2', 'Dr. David Brown', 'dr.david.ac@test.com', $1, 'doctor', NULL, 'D-AC2', 1),
      ('U-NURSE-AC1', 'Nancy Nurse', 'nurse.nancy.ac@test.com', $1, 'nurse', NULL, NULL, 1),
      ('U-RECEPT-AC1', 'Ron Receptionist', 'ron.recept.ac@test.com', $1, 'receptionist', NULL, NULL, 1),
      ('U-ADMIN-AC1', 'Alice Admin', 'admin.alice.ac@test.com', $1, 'admin', NULL, NULL, 1)`,
    [hash]
  );
}

async function run() {
  console.log('🧪 Starting Access Control Verification Test Suite...\n');
  await setup();

  const pat1Token = makeToken({ id: 'P-AC1', userId: 'U-PAT-AC1', role: 'patient', name: 'Alice Carroll', patientId: 'P-AC1' });
  const pat2Token = makeToken({ id: 'P-AC2', userId: 'U-PAT-AC2', role: 'patient', name: 'Bob Builder', patientId: 'P-AC2' });
  const doc1Token = makeToken({ id: 'D-AC1', userId: 'U-DOC-AC1', role: 'doctor', name: 'Dr. Catherine Green', doctorId: 'D-AC1' });
  const doc2Token = makeToken({ id: 'D-AC2', userId: 'U-DOC-AC2', role: 'doctor', name: 'Dr. David Brown', doctorId: 'D-AC2' });
  const nurseToken = makeToken({ id: 'U-NURSE-AC1', userId: 'U-NURSE-AC1', role: 'nurse', name: 'Nancy Nurse' });
  const receptToken = makeToken({ id: 'U-RECEPT-AC1', userId: 'U-RECEPT-AC1', role: 'receptionist', name: 'Ron Receptionist' });
  const adminToken = makeToken({ id: 'U-ADMIN-AC1', userId: 'U-ADMIN-AC1', role: 'admin', name: 'Alice Admin' });

  // =========================================================================
  // FINDING 1: Confirmed Clinical Relationship Rule
  // =========================================================================
  console.log('--- FINDING 1: Confirmed Clinical Relationship Rule ---');

  // Scenario 1.1: Doctor D-AC2 has an appointment created alone by staff/unconfirmed (booked_by = 'receptionist', status = 'upcoming')
  await query(
    `INSERT INTO appointments (id, patient_id, patient_name, doctor_id, doctor_name, specialty, date, time, type, status, reason, booked_by, triage_summary, vitals)
     VALUES ('A-TEST-UNCONF', 'P-AC1', 'Alice Carroll', 'D-AC2', 'Dr. David Brown', 'Dermatology', '2026-11-29', '10:00', 'in-person', 'upcoming', 'Unconfirmed appt', 'receptionist', '{"clinicalSummary":"Private triage notes"}', '{"bp":"120/80"}')`
  );

  // Doctor D-AC2 must NOT be able to see Alice's records!
  const docViewPat = await fetch(`${BASE_URL}/api/patients/P-AC1`, {
    headers: { Authorization: `Bearer ${doc2Token}` }
  });
  assert(docViewPat.status === 403, `Doctor blocked from patient profile without confirmed relationship: status ${docViewPat.status} (expected 403)`);

  const docViewRx = await fetch(`${BASE_URL}/api/prescriptions?patientId=P-AC1`, {
    headers: { Authorization: `Bearer ${doc2Token}` }
  });
  assert(docViewRx.status === 403, `Doctor blocked from prescriptions without confirmed relationship: status ${docViewRx.status} (expected 403)`);

  const docViewRecords = await fetch(`${BASE_URL}/api/medical-records?patientId=P-AC1`, {
    headers: { Authorization: `Bearer ${doc2Token}` }
  });
  assert(docViewRecords.status === 403, `Doctor blocked from medical records without confirmed relationship: status ${docViewRecords.status} (expected 403)`);

  const docViewConsults = await fetch(`${BASE_URL}/api/consultations?patientId=P-AC1`, {
    headers: { Authorization: `Bearer ${doc2Token}` }
  });
  assert(docViewConsults.status === 403, `Doctor blocked from consultations without confirmed relationship: status ${docViewConsults.status} (expected 403)`);

  const docRecordVitals = await fetch(`${BASE_URL}/api/patients/P-AC1/vitals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${doc2Token}` },
    body: JSON.stringify({ bp: '120/80' })
  });
  assert(docRecordVitals.status === 403, `Doctor blocked from recording vitals without confirmed relationship: status ${docRecordVitals.status} (expected 403)`);

  // Scenario 1.2: Cancelled appointment alone must NEVER grant access
  await query(
    `INSERT INTO appointments (id, patient_id, patient_name, doctor_id, doctor_name, specialty, date, time, type, status, reason, booked_by)
     VALUES ('A-TEST-CANCELLED', 'P-AC2', 'Bob Builder', 'D-AC2', 'Dr. David Brown', 'Dermatology', '2026-11-20', '15:00', 'in-person', 'cancelled', 'Cancelled appt', 'P-AC2')`
  );
  const docViewCancelledPat = await fetch(`${BASE_URL}/api/patients/P-AC2`, {
    headers: { Authorization: `Bearer ${doc2Token}` }
  });
  assert(docViewCancelledPat.status === 403, `Doctor blocked from patient records when appointment is cancelled: status ${docViewCancelledPat.status} (expected 403)`);

  // Scenario 1.3: Patient P-AC1 books with Doctor D-AC1 (patient-initiated booking)
  const bookWithDoc1 = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({
      patientId: 'P-AC1',
      patientName: 'Alice Carroll',
      doctorId: 'D-AC1',
      doctorName: 'Dr. Catherine Green',
      specialty: 'Cardiology',
      date: '2026-11-25',
      time: '09:30',
      type: 'in-person',
      reason: 'Chest tightness evaluation'
    })
  });
  assert(bookWithDoc1.status === 201, `Patient 1 booked with Doctor 1: status ${bookWithDoc1.status} (expected 201)`);

  // Doctor D-AC1 CAN view Alice's records because Alice booked with Dr. Catherine!
  const doc1ViewPat = await fetch(`${BASE_URL}/api/patients/P-AC1`, {
    headers: { Authorization: `Bearer ${doc1Token}` }
  });
  assert(doc1ViewPat.status === 200, `Doctor 1 can view patient who booked with them: status ${doc1ViewPat.status} (expected 200)`);

  // Scenario 1.4: Confirming the appointment for Dr. David Brown grants access
  await query("UPDATE appointments SET status = 'confirmed' WHERE id = 'A-TEST-UNCONF'");
  const doc2ViewConfirmedPat = await fetch(`${BASE_URL}/api/patients/P-AC1`, {
    headers: { Authorization: `Bearer ${doc2Token}` }
  });
  assert(doc2ViewConfirmedPat.status === 200, `Doctor 2 can view patient once appointment is confirmed: status ${doc2ViewConfirmedPat.status} (expected 200)`);

  // =========================================================================
  // FINDING 2: Patient Self-Booking Only
  // =========================================================================
  console.log('\n--- FINDING 2: Patient Self-Booking Only ---');

  // 2.1: Patient P-AC1 attempts to book appointment passing P-AC2 (Bob)
  const proxyBooking = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({
      patientId: 'P-AC2', // Bob's ID
      patientName: 'Bob Builder',
      doctorId: 'D-AC1',
      date: '2026-11-27',
      time: '14:00',
      type: 'in-person',
      reason: 'Unauthorized proxy booking attempt'
    })
  });
  assert(proxyBooking.status === 403, `Patient blocked from booking for another patient: status ${proxyBooking.status} (expected 403)`);

  // 2.2: Patient P-AC1 books for themselves
  const selfBooking = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({
      patientId: 'P-AC1',
      patientName: 'Alice Carroll',
      doctorId: 'D-AC2',
      date: '2026-11-28',
      time: '14:00',
      type: 'in-person',
      reason: 'Self booking'
    })
  });
  assert(selfBooking.status === 201, `Patient can book for themselves: status ${selfBooking.status} (expected 201)`);
  const selfBookingData = await selfBooking.json();
  assert(selfBookingData.appointment?.patientId === 'P-AC1', 'Appointment created for authenticated patient');

  // 2.3: Doctor attempts to call POST /api/appointments directly for a patient
  const docDirectBooking = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${doc1Token}` },
    body: JSON.stringify({
      patientId: 'P-AC2',
      doctorId: 'D-AC1',
      date: '2026-11-28',
      time: '15:00',
      type: 'in-person',
      reason: 'Doctor trying to gain relationship by self-booking'
    })
  });
  assert(docDirectBooking.status === 403, `Doctor blocked from booking appointments for patients directly: status ${docDirectBooking.status} (expected 403)`);

  // 2.4: Nurse attempts to call POST /api/appointments
  const nurseBooking = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nurseToken}` },
    body: JSON.stringify({
      patientId: 'P-AC1',
      doctorId: 'D-AC1',
      date: '2026-11-28',
      time: '16:00',
      type: 'in-person',
      reason: 'Nurse booking attempt'
    })
  });
  assert(nurseBooking.status === 403, `Nurse blocked from booking appointments: status ${nurseBooking.status} (expected 403)`);

  // =========================================================================
  // FINDING 3: Role Scoping for Nurse & Receptionist
  // =========================================================================
  console.log('\n--- FINDING 3: Role Scoping for Nurse & Receptionist ---');

  // 3.1: Nurse recording vitals -> ALLOWED (201)
  const nurseVitals = await fetch(`${BASE_URL}/api/patients/P-AC1/vitals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nurseToken}` },
    body: JSON.stringify({
      bp: '122/82',
      systolic: 122,
      diastolic: 82,
      hr: 74,
      temp: 98.6,
      spo2: 99,
      notes: 'Pre-consultation triage vitals recorded by nurse'
    })
  });
  assert(nurseVitals.status === 201, `Nurse can record vitals: status ${nurseVitals.status} (expected 201)`);

  // 3.2: Nurse viewing vitals history -> ALLOWED (200)
  const nurseVitalsHistory = await fetch(`${BASE_URL}/api/patients/P-AC1/vitals-history`, {
    headers: { Authorization: `Bearer ${nurseToken}` }
  });
  assert(nurseVitalsHistory.status === 200, `Nurse can view vitals history: status ${nurseVitalsHistory.status} (expected 200)`);

  // 3.3: Nurse attempting to edit medical profile -> BLOCKED (403)
  const nurseEditProfile = await fetch(`${BASE_URL}/api/patients/P-AC1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nurseToken}` },
    body: JSON.stringify({ name: 'Tampered by Nurse' })
  });
  assert(nurseEditProfile.status === 403, `Nurse blocked from editing medical profile: status ${nurseEditProfile.status} (expected 403)`);

  // 3.4: Nurse attempting to view clinical consultation notes -> BLOCKED (403)
  const nurseConsults = await fetch(`${BASE_URL}/api/consultations`, {
    headers: { Authorization: `Bearer ${nurseToken}` }
  });
  assert(nurseConsults.status === 403, `Nurse blocked from viewing clinical consultation notes: status ${nurseConsults.status} (expected 403)`);

  // 3.5: Nurse attempting to view medical records -> BLOCKED (403)
  const nurseMedRecords = await fetch(`${BASE_URL}/api/medical-records`, {
    headers: { Authorization: `Bearer ${nurseToken}` }
  });
  assert(nurseMedRecords.status === 403, `Nurse blocked from viewing medical records: status ${nurseMedRecords.status} (expected 403)`);

  // 3.6: Nurse attempting to add medical record -> BLOCKED (403)
  const nurseAddRecord = await fetch(`${BASE_URL}/api/medical-records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nurseToken}` },
    body: JSON.stringify({
      patientId: 'P-AC1',
      type: 'Lab Report',
      description: 'Nurse uploading lab report'
    })
  });
  assert(nurseAddRecord.status === 403, `Nurse blocked from adding medical records: status ${nurseAddRecord.status} (expected 403)`);

  // 3.7: Nurse attempting to synthesize medical record -> BLOCKED (403)
  const nurseSynth = await fetch(`${BASE_URL}/api/medical-records/ai-synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nurseToken}` },
    body: JSON.stringify({ recordId: 'MR-TEST-1' })
  });
  assert(nurseSynth.status === 403, `Nurse blocked from synthesizing medical records: status ${nurseSynth.status} (expected 403)`);

  // 3.8: Nurse attempting to view prescriptions -> BLOCKED (403)
  const nurseRx = await fetch(`${BASE_URL}/api/prescriptions`, {
    headers: { Authorization: `Bearer ${nurseToken}` }
  });
  assert(nurseRx.status === 403, `Nurse blocked from viewing prescriptions: status ${nurseRx.status} (expected 403)`);

  // 3.9: Receptionist viewing waiting queue -> ALLOWED (200)
  const receptQueue = await fetch(`${BASE_URL}/api/appointments/queue/today`, {
    headers: { Authorization: `Bearer ${receptToken}` }
  });
  assert(receptQueue.status === 200, `Receptionist can view today queue: status ${receptQueue.status} (expected 200)`);

  // 3.10: Receptionist managing check-in -> ALLOWED (200)
  const receptCheckIn = await fetch(`${BASE_URL}/api/appointments/A-TEST-UNCONF/check-in`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${receptToken}` }
  });
  assert(receptCheckIn.status === 200, `Receptionist can manage check-ins: status ${receptCheckIn.status} (expected 200)`);

  // 3.11: Receptionist updating queue status -> ALLOWED (200)
  const receptQueueStatus = await fetch(`${BASE_URL}/api/appointments/A-TEST-UNCONF/queue-status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${receptToken}` },
    body: JSON.stringify({ checkInStatus: 'in_room' })
  });
  assert(receptQueueStatus.status === 200, `Receptionist can update queue status: status ${receptQueueStatus.status} (expected 200)`);

  // 3.12: Receptionist viewing appointment schedule -> triage & vitals REDACTED!
  const receptAppt = await fetch(`${BASE_URL}/api/appointments/A-TEST-UNCONF`, {
    headers: { Authorization: `Bearer ${receptToken}` }
  });
  assert(receptAppt.status === 200, `Receptionist can view appointment schedule: status ${receptAppt.status} (expected 200)`);
  const receptApptData = await receptAppt.json();
  assert(receptApptData.triageSummary === null, `Receptionist appointment triage summary is stripped/null (value: ${receptApptData.triageSummary})`);
  assert(receptApptData.vitals === null, `Receptionist appointment vitals are stripped/null (value: ${receptApptData.vitals})`);
  assert(receptApptData.date === '2026-11-29' && receptApptData.time === '10:00', `Receptionist sees schedule coordination info (date: ${receptApptData.date}, time: ${receptApptData.time})`);

  // 3.13: Receptionist attempting to view medical profile -> BLOCKED (403)
  const receptViewPat = await fetch(`${BASE_URL}/api/patients/P-AC1`, {
    headers: { Authorization: `Bearer ${receptToken}` }
  });
  assert(receptViewPat.status === 403, `Receptionist blocked from viewing medical profile: status ${receptViewPat.status} (expected 403)`);

  // 3.14: Receptionist attempting to edit medical profile -> BLOCKED (403)
  const receptEditPat = await fetch(`${BASE_URL}/api/patients/P-AC1`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${receptToken}` },
    body: JSON.stringify({ name: 'Tampered by Receptionist' })
  });
  assert(receptEditPat.status === 403, `Receptionist blocked from editing medical profile: status ${receptEditPat.status} (expected 403)`);

  // 3.15: Receptionist attempting to view clinical notes -> BLOCKED (403)
  const receptConsults = await fetch(`${BASE_URL}/api/consultations`, {
    headers: { Authorization: `Bearer ${receptToken}` }
  });
  assert(receptConsults.status === 403, `Receptionist blocked from viewing clinical consultation notes: status ${receptConsults.status} (expected 403)`);

  // 3.16: Receptionist attempting to view medical records -> BLOCKED (403)
  const receptRecords = await fetch(`${BASE_URL}/api/medical-records`, {
    headers: { Authorization: `Bearer ${receptToken}` }
  });
  assert(receptRecords.status === 403, `Receptionist blocked from viewing medical records: status ${receptRecords.status} (expected 403)`);

  // 3.17: Receptionist attempting to add medical records -> BLOCKED (403)
  const receptAddRecord = await fetch(`${BASE_URL}/api/medical-records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${receptToken}` },
    body: JSON.stringify({ patientId: 'P-AC1', type: 'Clinical Note' })
  });
  assert(receptAddRecord.status === 403, `Receptionist blocked from adding medical records: status ${receptAddRecord.status} (expected 403)`);

  // 3.18: Receptionist attempting to view prescriptions -> BLOCKED (403)
  const receptRx = await fetch(`${BASE_URL}/api/prescriptions`, {
    headers: { Authorization: `Bearer ${receptToken}` }
  });
  assert(receptRx.status === 403, `Receptionist blocked from viewing prescriptions: status ${receptRx.status} (expected 403)`);

  // 3.19: Receptionist attempting to view vitals history -> BLOCKED (403)
  const receptVitalsHist = await fetch(`${BASE_URL}/api/patients/P-AC1/vitals-history`, {
    headers: { Authorization: `Bearer ${receptToken}` }
  });
  assert(receptVitalsHist.status === 403, `Receptionist blocked from viewing vitals history: status ${receptVitalsHist.status} (expected 403)`);

  // 3.20: Receptionist attempting to access medication adherence -> BLOCKED (403)
  const receptAdherence = await fetch(`${BASE_URL}/api/medications/adherence?patientId=P-AC1`, {
    headers: { Authorization: `Bearer ${receptToken}` }
  });
  assert(receptAdherence.status === 403, `Receptionist blocked from medication adherence: status ${receptAdherence.status} (expected 403)`);

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
