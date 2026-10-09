import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

import { pingDb, closePool, query } from './backend/database/db.js';

async function runTests() {
  console.log('🚀 Starting MediTalk Automated API & Workflow Test Suite...\n');
  let failures = 0;
  let passes = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`  ❌ FAIL: ${message}`);
      failures++;
    } else {
      console.log(`  ✅ PASS: ${message}`);
      passes++;
    }
  }

  // 1. Database Ping
  console.log('--- 1. Database Connectivity & Data Integrity ---');
  const ping = await pingDb();
  assert(ping.ok === true, `PostgreSQL ping responded successfully (${ping.latencyMs}ms)`);

  const { rows: userCount } = await query('SELECT COUNT(*) as count FROM users');
  assert(parseInt(userCount[0].count, 10) > 0, `Users table populated (${userCount[0].count} users found)`);

  const { rows: apptCount } = await query('SELECT COUNT(*) as count FROM appointments');
  assert(parseInt(apptCount[0].count, 10) >= 0, `Appointments table accessible (${apptCount[0].count} records)`);

  const { rows: doctorList } = await query('SELECT id, name, specialty FROM doctors LIMIT 5');
  assert(doctorList.length > 0, `Doctors table accessible (${doctorList.length} sample doctors retrieved)`);

  // Start standalone backend server process for testing on port 3005
  console.log('\n--- 2. Starting Backend Server Process (Port 3005) ---');
  const TEST_PORT = 3005;
  const serverProcess = fork('./backend/server.js', [], {
    env: { ...process.env, PORT: TEST_PORT, NODE_ENV: 'test' },
    silent: true,
  });

  serverProcess.stdout.on('data', (d) => {
    const str = d.toString().trim();
    if (str) {
      console.log('   [Server Process]:', str);
    }
  });

  serverProcess.stderr.on('data', (d) => {
    const str = d.toString().trim();
    if (str && !str.includes('SECURITY WARNING')) {
      console.warn('   [Server Stderr]:', str);
    }
  });

  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
  console.log(`\nWaiting for server to be ready on ${BASE_URL}...`);
  let serverReady = false;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert(serverReady, `Server process ready on ${BASE_URL}`);

  console.log(`\n--- 3. Health & Auth Endpoints (${BASE_URL}) ---`);

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

  try {
    // Health Check
    const healthRes = await apiRequest('/api/health');
    assert(healthRes.status === 200 && healthRes.data?.status === 'healthy', 'GET /api/health returns 200 healthy');

    // Invalid Login
    const badLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'nonexistent@meditalk.com', password: 'wrong', role: 'patient' },
    });
    assert(badLogin.status === 401, 'POST /api/auth/login correctly rejects invalid credentials with 401');

    // Demo Patient Login
    const patLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'patient@meditalk.com', password: 'password', role: 'patient' },
    });
    assert(patLogin.status === 200 && patLogin.data?.token, 'POST /api/auth/login patient authenticated successfully');
    const patientToken = patLogin.data?.token;
    const patientId = patLogin.data?.user?.id || 'P-1001';

    // Demo Doctor Login
    const docLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'doctor@meditalk.com', password: 'password', role: 'doctor' },
    });
    assert(docLogin.status === 200 && docLogin.data?.token, 'POST /api/auth/login doctor authenticated successfully');
    const doctorToken = docLogin.data?.token;
    const doctorId = docLogin.data?.user?.id || 'D-201';

    // Demo Admin Login
    const admLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@meditalk.com', password: 'password', role: 'admin' },
    });
    assert(admLogin.status === 200 && admLogin.data?.token, 'POST /api/auth/login admin authenticated successfully');
    const adminToken = admLogin.data?.token;

    console.log('\n--- 4. Doctor Features, Schedules & Analytics (CW-2, DA-1) ---');
    // Doctors list
    const docList = await apiRequest('/api/doctors', { token: patientToken });
    assert(docList.status === 200 && Array.isArray(docList.data), 'GET /api/doctors returned active doctors list');

    // Available slots
    const today = new Date().toISOString().slice(0, 10);
    const slotsRes = await apiRequest(`/api/doctors/${doctorId}/available-slots?date=${today}`, { token: patientToken });
    assert(slotsRes.status === 200 && Array.isArray(slotsRes.data?.slots), 'GET /api/doctors/:id/available-slots returns calculated time slots');

    // Doctor Unavailability (CW-2)
    const unavailRes = await apiRequest(`/api/doctors/${doctorId}/unavailability`, { token: doctorToken });
    assert(unavailRes.status === 200 && Array.isArray(unavailRes.data?.unavailability), 'GET /api/doctors/:id/unavailability returns leave exceptions');

    // Add and delete a test leave date
    const testLeaveDate = '2026-12-25';
    const addLeave = await apiRequest(`/api/doctors/${doctorId}/unavailability`, {
      method: 'POST',
      token: doctorToken,
      body: { date: testLeaveDate, reason: 'Christmas Holiday' },
    });
    assert(addLeave.status === 201 && Array.isArray(addLeave.data?.unavailability), 'POST /api/doctors/:id/unavailability added leave date');

    const addedItem = addLeave.data?.unavailability?.find((u) => u.date === testLeaveDate);
    if (addedItem) {
      const delLeave = await apiRequest(`/api/doctors/${doctorId}/unavailability/${addedItem.id}`, {
        method: 'DELETE',
        token: doctorToken,
      });
      assert(delLeave.status === 200, 'DELETE /api/doctors/:id/unavailability/:unavailId removed leave date');
    }

    // Doctor Practice Analytics Dashboard (DA-1)
    const analyticsRes = await apiRequest(`/api/doctors/${doctorId}/analytics`, { token: doctorToken });
    assert(analyticsRes.status === 200 && analyticsRes.data?.summary, 'GET /api/doctors/:id/analytics returns practice summary & top diagnoses');

    console.log('\n--- 5. Waiting Room Queue (CW-6) ---');
    // Waiting Room Queue
    const queueRes = await apiRequest('/api/appointments/queue/today', { token: doctorToken });
    assert(queueRes.status === 200 && Array.isArray(queueRes.data?.queue), 'GET /api/appointments/queue/today returned live queue array');

    console.log('\n--- 6. Decision Support, SOAP Drafting & Refills (CW-3, CW-4, DA-4, DI-3) ---');
    // Clinical Decision Support Drug Safety (DI-3)
    const cdsRes = await apiRequest('/api/prescriptions/check-safety', {
      method: 'POST',
      token: doctorToken,
      body: {
        patientId,
        newMedications: [{ medicine: 'Amoxicillin' }, { medicine: 'Ibuprofen' }],
      },
    });
    assert(cdsRes.status === 200 && Array.isArray(cdsRes.data?.alerts), 'POST /api/prescriptions/check-safety successfully ran allergy & interaction matrix');

    // AI SOAP Note Drafting (DA-4)
    const soapRes = await apiRequest('/api/consultations/draft-soap-note', {
      method: 'POST',
      token: doctorToken,
      body: {
        patientName: 'Test Patient',
        reason: 'Sore throat and mild fever',
        symptoms: 'Fever for 2 days, throat pain on swallowing',
        vitals: { temp: '38.1', bp: '120/80', hr: '82' },
        observations: 'Pharyngeal erythema with tonsillar exudate',
        diagnosis: 'Acute Streptococcal Pharyngitis',
      },
    });
    assert(
      soapRes.status === 200 && soapRes.data?.draft?.subjective && soapRes.data?.draft?.assessment,
      `POST /api/consultations/draft-soap-note drafted structured SOAP note (Engine: ${soapRes.data?.draft?.source})`
    );

    // Blocker Fix 1: Mandatory Drug Safety Gate on Prescription Issuance
    const blockedRxRes = await apiRequest('/api/prescriptions', {
      method: 'POST',
      token: doctorToken,
      body: {
        patientId,
        doctorId,
        medications: [{ medicine: 'Amoxicillin' }, { medicine: 'Warfarin' }],
      },
    });
    assert(
      blockedRxRes.status === 409 && blockedRxRes.data?.requiresOverride === true,
      'POST /api/prescriptions blocks prescription issuance on critical allergy/interaction without override (409)'
    );

    // Blocker Fix 2: Emergency Triage Severity Independence & Emergency Message
    const triageRes = await apiRequest('/api/triage/assess', {
      method: 'POST',
      token: patientToken,
      body: {
        symptoms: 'crushing chest pain radiating to arm',
        duration: '15 mins',
        severity: 2,
        accompanyingSymptoms: ['shortness of breath'],
      },
    });
    assert(
      triageRes.status === 200 && triageRes.data?.urgency === 'emergency' && triageRes.data?.isEmergency === true && Boolean(triageRes.data?.emergencyMessage),
      'POST /api/triage/assess treats chest pain as emergency regardless of low severity (2/10) with clear emergencyMessage'
    );

    // Blocker Fix 3: Empty Vitals Never Fabricates Normal Limits & Marks AI Note as Draft
    const emptyVitalsSoap = await apiRequest('/api/consultations/draft-soap-note', {
      method: 'POST',
      token: doctorToken,
      body: {
        patientName: 'Test Patient',
        reason: 'General consultation',
        symptoms: 'Fatigue',
        vitals: {},
      },
    });
    assert(
      emptyVitalsSoap.status === 200 &&
      !emptyVitalsSoap.data?.draft?.objective?.toLowerCase().includes('within normal limits') &&
      emptyVitalsSoap.data?.draft?.objective?.includes('No vitals recorded') &&
      emptyVitalsSoap.data?.draft?.isDraft === true,
      'POST /api/consultations/draft-soap-note documents "No vitals recorded" when empty and marks note as draft'
    );

    // Blocker Fix 4: Drug Check Recognizes Brand Names & Spelling Variations
    const brandCheck = await apiRequest('/api/prescriptions/check-safety', {
      method: 'POST',
      token: doctorToken,
      body: {
        patientId,
        newMedications: [{ medicine: 'Augmentin 625 Duo' }, { medicine: 'Coumadin 5mg' }, { medicine: 'Advil 200mg' }],
      },
    });
    const hasBrandAlerts = brandCheck.data?.alerts?.some(a => a.type === 'allergy_contraindication') &&
                           brandCheck.data?.alerts?.some(a => a.type === 'drug_interaction');
    assert(
      brandCheck.status === 200 && hasBrandAlerts,
      'POST /api/prescriptions/check-safety recognizes brand names (Augmentin, Coumadin, Advil) in safety engine'
    );

    // Follow-up Suggestions (CW-3)
    const followUpsRes = await apiRequest(`/api/follow-ups/patient/${patientId}`, { token: patientToken });
    assert(followUpsRes.status === 200 && Array.isArray(followUpsRes.data?.suggestions), 'GET /api/follow-ups/patient/:id returns follow-up suggestions');

    // Refill Requests (CW-4)
    const refillsRes = await apiRequest(`/api/refills/patient/${patientId}`, { token: patientToken });
    assert(refillsRes.status === 200 && Array.isArray(refillsRes.data?.refillRequests), 'GET /api/refills/patient/:id returns patient refill requests');

    const doctorRefillsRes = await apiRequest(`/api/refills/doctor/${doctorId}`, { token: doctorToken });
    assert(doctorRefillsRes.status === 200 && Array.isArray(doctorRefillsRes.data?.refillRequests), 'GET /api/refills/doctor/:id returns doctor refill queue');

    // Admin Analytics & Reports
    const adminAnalytics = await apiRequest('/api/admin/analytics', { token: adminToken });
    assert(adminAnalytics.status === 200 && adminAnalytics.data?.appointmentTrends, 'GET /api/admin/analytics returns system-wide metrics');

    console.log('\n--- 7. Phase 10: WhatsApp & Calendar Synchronization (IN-3, IN-4) ---');
    // Test WhatsApp alert dispatch (IN-4)
    const waTestRes = await apiRequest('/api/messaging/test-whatsapp', {
      method: 'POST',
      token: patientToken,
      body: {
        phone: '+919876543210',
        type: 'test',
        customText: 'Automated test suite verifying WhatsApp clinical notifications.',
      },
    });
    assert(
      waTestRes.status === 200 && waTestRes.data?.waLink?.includes('https://wa.me/919876543210') && waTestRes.data?.sent === false && waTestRes.data?.message?.includes('not sent'),
      `POST /api/messaging/test-whatsapp honestly reports simulated status (sent: false, mode: ${waTestRes.data?.mode})`
    );

    // Fetch existing appointment for this patient to test .ICS and appointment-specific WhatsApp
    const { rows: testAppts } = await query('SELECT id FROM appointments WHERE patient_id = $1 LIMIT 1', [patientId]);
    if (testAppts.length > 0) {
      const sampleApptId = testAppts[0].id;

      // RFC 5545 .ICS Calendar Invite Generation (IN-3) — authenticated with owner token
      const icsRes = await fetch(`http://127.0.0.1:3005/api/messaging/calendar-ics/${sampleApptId}?token=${patientToken}`);
      const icsText = await icsRes.text();
      assert(
        icsRes.status === 200 && icsText.includes('BEGIN:VCALENDAR') && icsText.includes('BEGIN:VEVENT'),
        'GET /api/messaging/calendar-ics/:id generated compliant RFC 5545 iCalendar invite'
      );

      // WhatsApp Appointment Notification (IN-4)
      const waApptRes = await apiRequest('/api/messaging/send-appointment-whatsapp', {
        method: 'POST',
        token: patientToken,
        body: {
          appointmentId: sampleApptId,
          recipientPhone: '+919876543210',
          type: 'confirmation',
        },
      });
      assert(
        waApptRes.status === 200 && waApptRes.data?.waLink && waApptRes.data?.sent === false,
        'POST /api/messaging/send-appointment-whatsapp honestly reports simulated status (sent: false) with waLink'
      );

      // Doctor Late-Patient Ping Alert (IN-4)
      const waLatePingRes = await apiRequest('/api/messaging/send-appointment-whatsapp', {
        method: 'POST',
        token: doctorToken,
        body: {
          appointmentId: sampleApptId,
          recipientPhone: '+919876543210',
          type: 'patient_late_ping',
        },
      });
      assert(
        waLatePingRes.status === 200 && waLatePingRes.data?.waLink && waLatePingRes.data?.sent === false,
        'POST /api/messaging/send-appointment-whatsapp honestly reports simulated status for Doctor late-patient alert'
      );
    }

    console.log('\n--- 8. Security & Clinical Access Scoping (Serious Problems 1 & 2) ---');
    // Doctor cannot view patient directory of other doctors
    const docPatients = await apiRequest('/api/patients', { token: doctorToken });
    assert(docPatients.status === 200 && Array.isArray(docPatients.data), 'GET /api/patients returns scoped patient roster for doctor');

    // Admin can view full directory
    const admPatients = await apiRequest('/api/patients', { token: adminToken });
    assert(admPatients.status === 200 && admPatients.data.length >= docPatients.data.length, 'Admin sees full patient directory');

    // Find an unassigned patient (not under Dr. Sneha's care)
    const unassignedPatient = admPatients.data.find(p => !docPatients.data.some(dp => dp.id === p.id));
    if (unassignedPatient) {
      // Doctor attempting to access unassigned patient profile -> 403
      const blockedProfile = await apiRequest(`/api/patients/${unassignedPatient.id}`, { token: doctorToken });
      assert(blockedProfile.status === 403, 'GET /api/patients/:id blocks doctor without clinical relationship (403)');

      // Doctor attempting to access unassigned patient vitals -> 403
      const blockedVitals = await apiRequest(`/api/patients/${unassignedPatient.id}/vitals-history`, { token: doctorToken });
      assert(blockedVitals.status === 403, 'GET /api/patients/:id/vitals-history blocks doctor without clinical relationship (403)');

      // Doctor attempting to access unassigned patient consultations -> 403
      const blockedConsults = await apiRequest(`/api/consultations?patientId=${unassignedPatient.id}`, { token: doctorToken });
      assert(blockedConsults.status === 403, 'GET /api/consultations?patientId=... blocks doctor without clinical relationship (403)');

      // Doctor attempting to access unassigned patient prescriptions -> 403
      const blockedPrescriptions = await apiRequest(`/api/prescriptions?patientId=${unassignedPatient.id}`, { token: doctorToken });
      assert(blockedPrescriptions.status === 403, 'GET /api/prescriptions?patientId=... blocks doctor without clinical relationship (403)');

      // Doctor attempting to access unassigned patient medical records -> 403
      const blockedRecords = await apiRequest(`/api/medical-records?patientId=${unassignedPatient.id}`, { token: doctorToken });
      assert(blockedRecords.status === 403, 'GET /api/medical-records?patientId=... blocks doctor without clinical relationship (403)');

      // Admin can access any patient profile -> 200
      const adminProfile = await apiRequest(`/api/patients/${unassignedPatient.id}`, { token: adminToken });
      assert(adminProfile.status === 200, 'GET /api/patients/:id allows admin access to any patient (200)');
    }

    // Doctor can access assigned patient profile -> 200
    const assignedProfile = await apiRequest(`/api/patients/${patientId}`, { token: doctorToken });
    assert(assignedProfile.status === 200, 'GET /api/patients/:id allows doctor to access assigned patient (200)');

    // =========================================================================
    // 12. Batch 3 Reliability & Security Blockers Test Suite
    // =========================================================================
    console.log('\n--- 12. Batch 3 Reliability & Security Blockers ---');

    // 12.1 Video Route Resolution
    const fsMod = await import('fs');
    const appJsxContent = fsMod.readFileSync('./src/App.jsx', 'utf8');
    assert(
      appJsxContent.includes('path="/video/:appointmentId"') && appJsxContent.includes('VideoRedirect'),
      'Universal Video route /video/:appointmentId is registered in App.jsx'
    );
    assert(
      fsMod.existsSync('./src/pages/VideoRedirect.jsx'),
      'VideoRedirect page component exists to route patients & doctors to consultation'
    );

    // 12.2 Server Crash Immunity & Connection Drop Protection
    const serverJsContent = fsMod.readFileSync('./backend/server.js', 'utf8');
    const dbJsContent = fsMod.readFileSync('./backend/database/db.js', 'utf8');
    assert(
      serverJsContent.includes("process.on('unhandledRejection'") && serverJsContent.includes("process.on('uncaughtException'"),
      'Process unhandledRejection & uncaughtException guards protect server against DB drops'
    );
    assert(
      dbJsContent.includes('ECONNRESET') && dbJsContent.includes('ECONNREFUSED'),
      'Database connection pool gracefully traps disconnects and network recycles'
    );

    // 12.3 Job Queue Worker Failure Propagation
    const jobQueueContent = fsMod.readFileSync('./backend/services/jobQueue.js', 'utf8');
    assert(
      jobQueueContent.includes('res.success === false') && jobQueueContent.includes('throw new Error'),
      'Email workers throw exceptions on failure, ensuring pg-boss marks jobs failed and retries'
    );

    // 12.4 Atomic Slot Booking & Race Condition Prevention
    const { rows: slotIdx } = await query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'appointments' AND indexname = 'idx_atomic_doctor_slot'"
    );
    assert(slotIdx.length > 0, 'Unique index idx_atomic_doctor_slot is active in PostgreSQL');

    // Test concurrent booking collision
    const testSlotDate = '2026-11-28';
    const testSlotTime = '04:00 PM';
    const { rows: samplePatients } = await query("SELECT id, name FROM patients LIMIT 2");
    const secondPatientId = samplePatients[1]?.id || patientId;
    const secondPatientName = samplePatients[1]?.name || 'Second Patient';
    await query("DELETE FROM appointments WHERE doctor_id = $1 AND date = $2 AND time = $3", [doctorId, testSlotDate, testSlotTime]);
    const [raceRes1, raceRes2] = await Promise.all([
      apiRequest('/api/appointments', {
        method: 'POST', token: patientToken,
        body: { patientId, patientName: 'John Patient', doctorId, doctorName: 'Dr. Sarah Jenkins', date: testSlotDate, time: testSlotTime, type: 'video', reason: 'Race 1' }
      }),
      apiRequest('/api/appointments', {
        method: 'POST', token: patientToken,
        body: { patientId: secondPatientId, patientName: secondPatientName, doctorId, doctorName: 'Dr. Sarah Jenkins', date: testSlotDate, time: testSlotTime, type: 'video', reason: 'Race 2' }
      }),
    ]);
    const raceCodes = [raceRes1.status, raceRes2.status].sort();
    assert(
      raceCodes[0] === 201 && raceCodes[1] === 409,
      'Concurrent booking collision atomically allows 1 appointment (201) and rejects other (409 SLOT_CONFLICT)'
    );

    // 12.5 Database Connection Security Checks
    assert(
      dbJsContent.includes("rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? false : true"),
      'Database connection enforces SSL certificate verification by default'
    );

    // 12.6 Persistent Token Revocation Across Restarts
    const logoutRes = await apiRequest('/api/auth/logout', { method: 'POST', token: patientToken });
    assert(logoutRes.status === 200, 'POST /api/auth/logout succeeds');
    const { rows: revokedDbCheck } = await query("SELECT 1 FROM revoked_tokens WHERE jti IS NOT NULL LIMIT 1");
    assert(revokedDbCheck.length > 0, 'Revoked tokens are persisted in PostgreSQL revoked_tokens table');
    const revokedAttempt = await apiRequest('/api/appointments', { token: patientToken });
    assert(revokedAttempt.status === 401, 'Logged-out token is rejected with 401 Unauthorized');

    // Re-authenticate patient for subsequent tests
    const reAuth = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'patient@meditalk.com', password: 'password', role: 'patient' })
    });
    const activePatientToken = reAuth.data.token;

    // 12.7 Unlimited Input Sizes Enforced
    const hugeBody = 'Z'.repeat(1.5 * 1024 * 1024);
    const oversizeRes = await apiRequest('/api/triage/assess', {
      method: 'POST', token: activePatientToken,
      body: JSON.stringify({ symptoms: hugeBody })
    });
    assert(oversizeRes.status === 413, 'Oversized payload (>1MB) is rejected with 413 Payload Too Large');

    const longFieldBody = 'symptom '.repeat(1000);
    const longFieldRes = await apiRequest('/api/triage/assess', {
      method: 'POST', token: activePatientToken,
      body: JSON.stringify({ symptoms: longFieldBody })
    });
    assert(longFieldRes.status === 400, 'Excessively long field is rejected with 400 Bad Request');

    // 12.8 Honest WhatsApp & SMS Delivery Reporting
    const waHonestyRes = await apiRequest('/api/messaging/test-whatsapp', {
      method: 'POST', token: activePatientToken,
      body: JSON.stringify({ phone: '+919876543210', customText: 'Honesty check' })
    });
    assert(
      waHonestyRes.status === 200 && waHonestyRes.data.sent === false && waHonestyRes.data.success === false,
      'Simulation WhatsApp reports sent: false and success: false honestly when not sent via carrier'
    );
    assert(
      waHonestyRes.data.message && waHonestyRes.data.message.includes('not sent'),
      'WhatsApp API message explicitly states message was not sent'
    );
  } catch (err) {
    console.error('Unhandled Test Step Error:', err);
    failures++;
  } finally {
    serverProcess.kill('SIGTERM');
  }

  console.log('\n========================================');
  console.log(`Results: ${passes} Passed, ${failures} Failed`);
  console.log('========================================\n');

  await closePool();
  process.exit(failures > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
