// reproduce_access_control.mjs
// Reproduce all 3 access control vulnerabilities with actual database accounts

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

async function setupTestData() {
  const hash = await bcrypt.hash('TestPass123!', 10);

  // 1. Clean existing repro test data
  await query("DELETE FROM users WHERE id IN ('U-PAT-101', 'U-PAT-102', 'U-DOC-201', 'U-DOC-202', 'U-NURSE-301', 'U-RECEPT-401')");
  await query("DELETE FROM appointments WHERE patient_id IN ('P-101', 'P-102')");
  await query("DELETE FROM consultations WHERE patient_id IN ('P-101', 'P-102')");
  await query("DELETE FROM prescriptions WHERE patient_id IN ('P-101', 'P-102')");
  await query("DELETE FROM medical_records WHERE patient_id IN ('P-101', 'P-102')");
  await query("DELETE FROM patient_vitals WHERE patient_id IN ('P-101', 'P-102')");
  await query("DELETE FROM patients WHERE id IN ('P-101', 'P-102')");
  await query("DELETE FROM doctors WHERE id IN ('D-201', 'D-202')");

  // 2. Insert test patients
  await query(
    `INSERT INTO patients (id, name, email, phone, blood_group, allergies, chronic_conditions, status)
     VALUES 
      ('P-101', 'Alice Patient', 'alice@test.com', '+919999900001', 'A+', '["Penicillin"]', '["Asthma"]', 'active'),
      ('P-102', 'Bob Patient', 'bob@test.com', '+919999900002', 'B+', '["Peanuts"]', '[]', 'active')`
  );

  // 3. Insert test doctors
  await query(
    `INSERT INTO doctors (id, name, email, specialty, status, verification_status)
     VALUES 
      ('D-201', 'Dr. Catherine Green', 'dr.catherine@test.com', 'Cardiology', 'active', 'approved'),
      ('D-202', 'Dr. David Brown', 'dr.david@test.com', 'Dermatology', 'active', 'approved')`
  );

  // 4. Insert test users
  await query(
    `INSERT INTO users (id, name, email, password, role, patient_id, doctor_id, token_version)
     VALUES 
      ('U-PAT-101', 'Alice Patient', 'alice@test.com', $1, 'patient', 'P-101', NULL, 1),
      ('U-PAT-102', 'Bob Patient', 'bob@test.com', $1, 'patient', 'P-102', NULL, 1),
      ('U-DOC-201', 'Dr. Catherine Green', 'dr.catherine@test.com', $1, 'doctor', NULL, 'D-201', 1),
      ('U-DOC-202', 'Dr. David Brown', 'dr.david@test.com', $1, 'doctor', NULL, 'D-202', 1),
      ('U-NURSE-301', 'Nancy Nurse', 'nurse.nancy@test.com', $1, 'nurse', NULL, NULL, 1),
      ('U-RECEPT-401', 'Ron Receptionist', 'ron.recept@test.com', $1, 'receptionist', NULL, NULL, 1)`,
    [hash]
  );

  // 5. Insert an appointment between Dr. David (D-202) and Alice (P-101) created without booking by patient (e.g. by doctor or unconfirmed)
  await query(
    `INSERT INTO appointments (id, patient_id, patient_name, doctor_id, doctor_name, specialty, date, time, type, status, reason, triage_summary, vitals)
     VALUES 
      ('A-REPRO-1', 'P-101', 'Alice Patient', 'D-202', 'Dr. David Brown', 'Dermatology', '2026-11-25', '10:00', 'in-person', 'upcoming', 'Doctor created appt', '{"clinicalSummary":"Sensitive triage notes: suspected condition"}', '{"bp":"120/80","hr":"72"}')`
  );

  console.log('✅ Database test fixtures inserted successfully.');
}

async function run() {
  await setupTestData();

  console.log('\n=== REPRODUCING ACCESS CONTROL FINDINGS (CURRENT STATE) ===\n');

  const pat1Token = makeToken({ id: 'P-101', userId: 'U-PAT-101', role: 'patient', name: 'Alice Patient', patientId: 'P-101' });
  const pat2Token = makeToken({ id: 'P-102', userId: 'U-PAT-102', role: 'patient', name: 'Bob Patient', patientId: 'P-102' });
  const doc2Token = makeToken({ id: 'D-202', userId: 'U-DOC-202', role: 'doctor', name: 'Dr. David Brown', doctorId: 'D-202' });
  const nurseToken = makeToken({ id: 'U-NURSE-301', userId: 'U-NURSE-301', role: 'nurse', name: 'Nancy Nurse' });
  const receptToken = makeToken({ id: 'U-RECEPT-401', userId: 'U-RECEPT-401', role: 'receptionist', name: 'Ron Receptionist' });

  // -------------------------------------------------------------
  // REPRODUCING FINDING 1: Doctor access solely via unconfirmed appointment
  // -------------------------------------------------------------
  console.log('--- [Finding 1] Doctor viewing patient with unconfirmed/doctor-created appointment alone ---');
  // Dr. David Brown (D-202) did NOT receive a booking from Alice, Alice never booked with him, no consultation took place.
  // Mere appointment A-REPRO-1 exists with status 'upcoming'.
  const docViewPat = await fetch(`${BASE_URL}/api/patients/P-101`, {
    headers: { Authorization: `Bearer ${doc2Token}` }
  });
  console.log(`Doctor GET /api/patients/P-101 status: ${docViewPat.status}`);
  const docViewPatData = await docViewPat.json();
  console.log(`Doctor saw patient name: "${docViewPatData.name}", allergies: ${JSON.stringify(docViewPatData.allergies)} (VULNERABILITY: Dr. David can see Alice's records merely because an appointment exists!)`);

  // -------------------------------------------------------------
  // REPRODUCING FINDING 2: Patient booking for another patient
  // -------------------------------------------------------------
  console.log('\n--- [Finding 2] Patient 1 (Alice) booking appointment for Patient 2 (Bob) ---');
  const proxyBooking = await fetch(`${BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pat1Token}` },
    body: JSON.stringify({
      patientId: 'P-102', // Bob's ID!
      patientName: 'Bob Patient',
      doctorId: 'D-201',
      doctorName: 'Dr. Catherine Green',
      specialty: 'Cardiology',
      date: '2026-11-28',
      time: '11:00',
      type: 'in-person',
      reason: 'Alice booking on behalf of Bob without permission'
    })
  });
  console.log(`Patient 1 POST /api/appointments for Patient 2 status: ${proxyBooking.status}`);
  const proxyData = await proxyBooking.json();
  console.log(`Booking created for patientId: ${proxyData.appointment?.patientId} (VULNERABILITY: Patient 1 successfully booked for Patient 2!)`);

  // -------------------------------------------------------------
  // REPRODUCING FINDING 3: Nurse & Receptionist unauthorized access
  // -------------------------------------------------------------
  console.log('\n--- [Finding 3] Nurse editing patient medical profile ---');
  const nurseEdit = await fetch(`${BASE_URL}/api/patients/P-101`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nurseToken}` },
    body: JSON.stringify({ name: 'Tampered by Nurse' })
  });
  console.log(`Nurse PUT /api/patients/P-101 status: ${nurseEdit.status} (VULNERABILITY: Nurse edited medical profile!)`);

  console.log('\n--- [Finding 3] Receptionist editing patient medical profile ---');
  const receptEdit = await fetch(`${BASE_URL}/api/patients/P-101`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${receptToken}` },
    body: JSON.stringify({ name: 'Tampered by Receptionist' })
  });
  console.log(`Receptionist PUT /api/patients/P-101 status: ${receptEdit.status} (VULNERABILITY: Receptionist edited medical profile!)`);

  console.log('\n--- [Finding 3] Nurse reading clinical consultation notes ---');
  const nurseConsults = await fetch(`${BASE_URL}/api/consultations`, {
    headers: { Authorization: `Bearer ${nurseToken}` }
  });
  console.log(`Nurse GET /api/consultations status: ${nurseConsults.status} (VULNERABILITY: Nurse can read clinical notes!)`);

  console.log('\n--- [Finding 3] Nurse adding medical records ---');
  const nurseAddRecord = await fetch(`${BASE_URL}/api/medical-records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nurseToken}` },
    body: JSON.stringify({
      patientId: 'P-101',
      type: 'Biopsy Report',
      description: 'Nurse uploaded clinical biopsy report'
    })
  });
  console.log(`Nurse POST /api/medical-records status: ${nurseAddRecord.status} (VULNERABILITY: Nurse added medical record!)`);

  console.log('\n--- [Finding 3] Receptionist viewing patient medical profile ---');
  const receptViewPat = await fetch(`${BASE_URL}/api/patients/P-101`, {
    headers: { Authorization: `Bearer ${receptToken}` }
  });
  console.log(`Receptionist GET /api/patients/P-101 status: ${receptViewPat.status} (VULNERABILITY: Receptionist viewed full medical profile!)`);

  console.log('\n--- [Finding 3] Receptionist viewing appointment schedule — triage & vitals exposure ---');
  const receptAppt = await fetch(`${BASE_URL}/api/appointments/A-REPRO-1`, {
    headers: { Authorization: `Bearer ${receptToken}` }
  });
  console.log(`Receptionist GET /api/appointments/A-REPRO-1 status: ${receptAppt.status}`);
  const receptApptData = await receptAppt.json();
  console.log(`Triage exposed to Receptionist:`, receptApptData.triageSummary);
  console.log(`Vitals exposed to Receptionist:`, receptApptData.vitals);
  console.log(`(VULNERABILITY: Receptionist saw clinical triage notes and vitals!)`);

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
