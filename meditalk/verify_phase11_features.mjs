import pg from 'pg';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false'
    ? { rejectUnauthorized: false }
    : { rejectUnauthorized: true },
});

const BASE_URL = process.env.TEST_API_URL || 'http://127.0.0.1:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'meditalk_dev_secret_2026';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function apiRequest(endpoint, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${endpoint}`, opts);
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data, ok: res.ok };
}

async function runVerification() {
  console.log('================================================================');
  console.log('🧪 VERIFYING CONSENT, PRIVACY, EMERGENCY & STAFF RBAC FEATURES');
  console.log('================================================================\n');

  try {
    // ── 1. Static Artifacts: Privacy Policy, Terms, Emergency Banner ───────────
    console.log('--- 1. Static Frontend Pages & Components ---');
    const privacyExists = fs.existsSync('./src/pages/PrivacyPolicy.jsx');
    const termsExists = fs.existsSync('./src/pages/TermsOfService.jsx');
    const emergencyExists = fs.existsSync('./src/components/ui/EmergencyBanner.jsx');
    const appJsx = fs.readFileSync('./src/App.jsx', 'utf8');

    assert(privacyExists, 'PrivacyPolicy.jsx component exists');
    assert(termsExists, 'TermsOfService.jsx component exists');
    assert(emergencyExists, 'EmergencyBanner.jsx component exists');
    assert(appJsx.includes('path="/privacy"') && appJsx.includes('path="/terms"'), 'Routes /privacy and /terms registered in App.jsx');
    assert(appJsx.includes('ReceptionistLayout') && appJsx.includes('NurseLayout'), 'Staff routes for Receptionist and Nurse registered in App.jsx');

    // ── 2. Registration Consent Checkbox & Privacy Notice ─────────────────────
    console.log('\n--- 2. Registration Consent Enforcement ---');
    const testRegEmail = `test.consent.${Date.now()}@example.com`;
    // Attempt registration without consent
    const regNoConsent = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Consent Tester',
        email: testRegEmail,
        password: 'Password123!',
        role: 'patient',
        phone: '+919999900001',
        consent: false,
      },
    });
    assert(
      regNoConsent.status === 400 && regNoConsent.data?.message?.includes('consent'),
      'Registration without accepting Privacy Notice & Terms is rejected with 400 Bad Request'
    );

    // Registration with explicit consent
    const regWithConsent = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Consent Tester',
        email: testRegEmail,
        password: 'Password123!',
        role: 'patient',
        phone: '+919999900001',
        consent: true,
      },
    });
    assert(regWithConsent.status === 201, 'Registration with explicit consent succeeds with 201 Created');

    // Verify DB stores consent metadata
    const { rows: consentDb } = await pool.query(
      'SELECT consent_accepted, consent_accepted_at, consent_version FROM patients WHERE email = $1',
      [testRegEmail]
    );
    assert(
      consentDb[0]?.consent_accepted === true && !!consentDb[0]?.consent_accepted_at,
      'PostgreSQL stores consent_accepted = TRUE and consent_accepted_at timestamp'
    );

    // ── 3. Authenticate Personas for Staff & Patient Tests ────────────────────
    console.log('\n--- 3. Authenticating Test Personas ---');
    const pLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: testRegEmail, password: 'Password123!', role: 'patient' },
    });
    const testPatientToken = pLogin.data.token;
    const testPatientId = pLogin.data.user.id;

    // Login default Aarav Sharma patient
    const p1Login = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'patient@meditalk.com', password: 'password', role: 'patient' },
    });
    const aaravToken = p1Login.data.token;
    const aaravId = p1Login.data.user.id;

    // Login default Doctor Sneha Menon
    const dLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'doctor@meditalk.com', password: 'password', role: 'doctor' },
    });
    const docToken = dLogin.data.token;
    const docId = dLogin.data.user.id;

    // Login default Receptionist
    const rLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'receptionist@meditalk.com', password: 'password', role: 'receptionist' },
    });
    assert(rLogin.status === 200 && rLogin.data.token, 'Receptionist can log in (receptionist@meditalk.com)');
    const receptionistToken = rLogin.data.token;

    // Login default Nurse
    const nLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'nurse@meditalk.com', password: 'password', role: 'nurse' },
    });
    assert(nLogin.status === 200 && nLogin.data.token, 'Nurse can log in (nurse@meditalk.com)');
    const nurseToken = nLogin.data.token;

    // Login Admin
    const aLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@meditalk.com', password: 'password', role: 'admin' },
    });
    const adminToken = aLogin.data.token;

    // ── 4. Telehealth Consent Step ────────────────────────────────────────────
    console.log('\n--- 4. Telehealth Consent Step ---');
    // Book an appointment for test patient
    const testSlotDate = '2026-12-05';
    const testSlotTime = '11:00 AM';
    await pool.query('DELETE FROM appointments WHERE doctor_id = $1 AND date = $2 AND time = $3', ['D-201', testSlotDate, testSlotTime]);
    const bookRes = await apiRequest('/api/appointments', {
      method: 'POST',
      token: testPatientToken,
      body: {
        patientId: testPatientId,
        patientName: 'Consent Tester',
        doctorId: 'D-201',
        doctorName: 'Dr. Sneha Menon',
        date: testSlotDate,
        time: testSlotTime,
        type: 'video',
        reason: 'Telehealth visit evaluation',
      },
    });
    const testApptId = bookRes.data.appointment.id;

    // Another patient attempts to record consent for this appointment -> blocked (403)
    const unauthorizedConsent = await apiRequest(`/api/appointments/${testApptId}/telehealth-consent`, {
      method: 'PATCH',
      token: aaravToken,
    });
    assert(unauthorizedConsent.status === 403, 'Another patient cannot consent to someone else\'s appointment (403)');

    // Patient records telehealth consent
    const consentRes = await apiRequest(`/api/appointments/${testApptId}/telehealth-consent`, {
      method: 'PATCH',
      token: testPatientToken,
    });
    assert(
      consentRes.status === 200 && consentRes.data.telehealthConsent === true,
      'Patient records informed telehealth consent (PATCH /api/appointments/:id/telehealth-consent)'
    );

    // Verify appointment details show telehealth consent
    const apptCheck = await apiRequest(`/api/appointments/${testApptId}`, { token: testPatientToken });
    assert(
      apptCheck.data?.telehealthConsent === true || apptCheck.data?.appointment?.telehealthConsent === true,
      'Appointment reflects telehealthConsent: true'
    );

    // ── 5. Receptionist Role Permissions & Security Restrictions ──────────────
    console.log('\n--- 5. Receptionist Role: Permissions & Restrictions ---');
    // Receptionist CAN manage queue
    const queueRes = await apiRequest('/api/appointments/queue/today', { token: receptionistToken });
    assert(queueRes.status === 200 && Array.isArray(queueRes.data.queue), 'Receptionist can view today\'s queue (GET /api/appointments/queue/today)');

    // Receptionist CAN update queue status
    const queueStatusRes = await apiRequest(`/api/appointments/${testApptId}/queue-status`, {
      method: 'PATCH',
      token: receptionistToken,
      body: { checkInStatus: 'in_room' },
    });
    assert(queueStatusRes.status === 200, 'Receptionist can manage queue status (PATCH /api/appointments/:id/queue-status)');

    // Receptionist CANNOT view clinical notes
    const recepConsult = await apiRequest('/api/consultations', { token: receptionistToken });
    assert(recepConsult.status === 403, 'Receptionist CANNOT view clinical consultation notes (403 Forbidden)');

    // Receptionist CANNOT view prescriptions
    const recepRx = await apiRequest('/api/prescriptions', { token: receptionistToken });
    assert(recepRx.status === 403, 'Receptionist CANNOT view prescriptions (403 Forbidden)');

    // Receptionist CANNOT view medical records
    const recepMedRec = await apiRequest('/api/medical-records', { token: receptionistToken });
    assert(recepMedRec.status === 403, 'Receptionist CANNOT view medical records (403 Forbidden)');

    // Receptionist CANNOT access admin tools
    const recepAdmin = await apiRequest('/api/admin/stats', { token: receptionistToken });
    assert(recepAdmin.status === 403, 'Receptionist CANNOT access admin tools (403 Forbidden)');

    // ── 6. Nurse Role: Vitals Recording & Prescribing Restriction ─────────────
    console.log('\n--- 6. Nurse Role: Vitals Recording & Restrictions ---');
    // Nurse CAN record vitals before doctor consult
    const vitalsRecordRes = await apiRequest(`/api/patients/${testPatientId}/vitals`, {
      method: 'POST',
      token: nurseToken,
      body: {
        systolic: 118,
        diastolic: 76,
        hr: 70,
        temp: 98.4,
        spo2: 99,
        weight: 68.5,
        bloodSugar: 98,
        notes: 'Pre-consultation nurse intake: patient resting comfortably',
        appointmentId: testApptId,
      },
    });
    assert(
      vitalsRecordRes.status === 201 && vitalsRecordRes.data.vitals.bp === '118/76',
      'Nurse can record pre-consultation vitals (POST /api/patients/:id/vitals)'
    );

    // Nurse CAN view vitals history
    const nurseVitalsHist = await apiRequest(`/api/patients/${testPatientId}/vitals-history`, { token: nurseToken });
    assert(
      nurseVitalsHist.status === 200 && nurseVitalsHist.data.length > 0,
      'Nurse can view patient vitals history (GET /api/patients/:id/vitals-history)'
    );

    // Receptionist CANNOT view vitals history
    const recepVitalsHist = await apiRequest(`/api/patients/${testPatientId}/vitals-history`, { token: receptionistToken });
    assert(recepVitalsHist.status === 403, 'Receptionist CANNOT view clinical vitals history (403 Forbidden)');

    // Nurse CANNOT prescribe
    const nursePrescribe = await apiRequest('/api/prescriptions', {
      method: 'POST',
      token: nurseToken,
      body: {
        patientId: testPatientId,
        patientName: 'Consent Tester',
        doctorId: 'D-201',
        medications: [{ name: 'Amoxicillin', dosage: '500mg' }],
      },
    });
    assert(nursePrescribe.status === 403, 'Nurse CANNOT prescribe medications (403 Forbidden)');

    // Nurse CANNOT approve refills
    const nurseRefill = await apiRequest('/api/refills/R-1001/approve', {
      method: 'PATCH',
      token: nurseToken,
    });
    assert(nurseRefill.status === 403, 'Nurse CANNOT approve prescription refills (403 Forbidden)');

    // ── 7. Check-in Route Identity Verification ───────────────────────────────
    console.log('\n--- 7. Check-in Route Identity Verification ---');
    // Patient attempts to check in for another patient's appointment -> 403
    const badPatientCheckIn = await apiRequest(`/api/appointments/${testApptId}/check-in`, {
      method: 'PATCH',
      token: aaravToken,
    });
    assert(badPatientCheckIn.status === 403, 'Patient cannot check in for another patient\'s appointment (403 Forbidden)');

    // Doctor not assigned to appointment attempts to check in -> 403
    const docArjunToken = (await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'arjun.patel@meditalk.com', password: 'password', role: 'doctor' }
    })).data.token;
    const badDoctorCheckIn = await apiRequest(`/api/appointments/${testApptId}/check-in`, {
      method: 'PATCH',
      token: docArjunToken,
    });
    assert(badDoctorCheckIn.status === 403, 'Doctor not assigned to appointment cannot check in patient (403 Forbidden)');

    // Patient checking in for own appointment -> 200
    const selfCheckIn = await apiRequest(`/api/appointments/${testApptId}/check-in`, {
      method: 'PATCH',
      token: testPatientToken,
    });
    assert(selfCheckIn.status === 200, 'Patient checking in for their own appointment succeeds (200 OK)');

    // Receptionist checking in -> 200
    const recepCheckIn = await apiRequest(`/api/appointments/${testApptId}/check-in`, {
      method: 'PATCH',
      token: receptionistToken,
    });
    assert(recepCheckIn.status === 200, 'Receptionist checking in clinic appointment succeeds (200 OK)');

    // Nurse checking in -> 200
    const nurseCheckIn = await apiRequest(`/api/appointments/${testApptId}/check-in`, {
      method: 'PATCH',
      token: nurseToken,
    });
    assert(nurseCheckIn.status === 200, 'Nurse checking in clinic appointment succeeds (200 OK)');

    // ── 8. Patient Data Portability (Export Own Data) ─────────────────────────
    console.log('\n--- 8. Data Export (GDPR / HIPAA Portability) ---');
    // Another patient tries to export data -> 403
    const badExport = await apiRequest(`/api/patients/${testPatientId}/export`, { token: aaravToken });
    assert(badExport.status === 403, 'Patient cannot export another patient\'s health data (403 Forbidden)');

    // Patient exports own data -> 200 with complete archive
    const exportRes = await apiRequest(`/api/patients/${testPatientId}/export`, { token: testPatientToken });
    assert(
      exportRes.status === 200 &&
      exportRes.data.exportMetadata &&
      Array.isArray(exportRes.data.appointments) &&
      Array.isArray(exportRes.data.patientVitals),
      'Patient can export complete health data archive (GET /api/patients/:id/export)'
    );

    // ── 9. Withdraw Consent & Delete Account ──────────────────────────────────
    console.log('\n--- 9. Withdraw Consent & Account Deletion (Right to Erasure) ---');
    // Another patient tries to withdraw consent -> 403
    const badWithdraw = await apiRequest(`/api/patients/${testPatientId}/withdraw-consent`, {
      method: 'POST',
      token: aaravToken,
    });
    assert(badWithdraw.status === 403, 'Patient cannot withdraw consent or delete another patient\'s account (403)');

    // Patient withdraws consent and deletes account
    const withdrawRes = await apiRequest(`/api/patients/${testPatientId}/withdraw-consent`, {
      method: 'POST',
      token: testPatientToken,
    });
    assert(
      withdrawRes.status === 200 && withdrawRes.data.success === true,
      'Patient withdraws consent and deletes account (POST /api/patients/:id/withdraw-consent)'
    );

    // Verify DB anonymized patient record
    const { rows: anonCheck } = await pool.query('SELECT name, status, consent_withdrawn FROM patients WHERE id = $1', [testPatientId]);
    assert(
      anonCheck[0]?.name === 'Anonymized Patient' && anonCheck[0]?.consent_withdrawn === true && anonCheck[0]?.status === 'withdrawn_consent',
      'Database anonymizes patient name and records consent_withdrawn = TRUE'
    );

    // Verify deleted account token is rejected
    const deletedTokenAttempt = await apiRequest('/api/appointments', { token: testPatientToken });
    assert(deletedTokenAttempt.status === 401, 'Logged-out token after account deletion is rejected (401 Unauthorized)');

    // Verify deleted account cannot log in anymore
    const deletedLoginAttempt = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: testRegEmail, password: 'password123', role: 'patient' },
    });
    assert(
      deletedLoginAttempt.status === 403 && deletedLoginAttempt.data?.message?.includes('withdrawn'),
      'Deleted / withdrawn account is blocked from signing in (403 Forbidden)'
    );

  } catch (err) {
    console.error('Fatal Verification Error:', err);
    failed++;
  } finally {
    await pool.end();
  }

  console.log('\n================================================================');
  console.log(`Phase 11 Verification Summary: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runVerification();
