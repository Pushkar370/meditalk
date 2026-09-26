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
    const str = d.toString();
    if (str.includes('MediTalk API running') || str.includes('Connected')) {
      console.log('   [Server Process]:', str.trim());
    }
  });

  serverProcess.stderr.on('data', (d) => {
    const str = d.toString();
    if (!str.includes('Warning') && !str.includes('injected env')) {
      console.warn('   [Server Stderr]:', str.trim());
    }
  });

  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
  console.log(`\nWaiting for server to be ready on ${BASE_URL}...`);
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
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
    if (body) opts.body = JSON.stringify(body);
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
