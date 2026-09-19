// Comprehensive test suite for Bug Fixes & Phase 7 Production Hardening
import http from 'http';

const BASE_URL = 'http://localhost:3001';

async function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-bypass-ratelimit': 'test',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (_) {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Bug Fixes & Phase 7 Verification Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${extra}`);
      failed++;
    }
  }

  try {
    // ── Test 1: Deep Healthcheck Probe ──────────────────────────────────────
    console.log('▶ Testing Deep Healthcheck (/api/health)...');
    const healthRes = await request(`${BASE_URL}/api/health`);
    assert('Healthcheck returns HTTP 200', healthRes.status === 200);
    assert('Database status is connected', healthRes.data.database === 'connected');
    assert('Database latency is measured', typeof healthRes.data.latencyMs === 'number' && healthRes.data.latencyMs >= 0);
    assert('Pool statistics are exposed', healthRes.data.pool && typeof healthRes.data.pool.totalCount === 'number');

    // ── Test 2: Admin Authentication & System Diagnostics ───────────────────
    console.log('\n▶ Testing Admin System Diagnostics (/api/admin/system-health)...');
    const adminLogin = await request(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: { email: 'admin@meditalk.com', password: 'password', role: 'admin' },
    });
    assert('Admin login successful', adminLogin.status === 200 && adminLogin.data.token);
    const adminToken = adminLogin.data.token;

    const diagRes = await request(`${BASE_URL}/api/admin/system-health`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert('System health returns HTTP 200', diagRes.status === 200);
    assert('Platform status is operational', diagRes.data.status === 'operational');
    assert('Memory metrics reported (heap/rss)', typeof diagRes.data.memory?.heapUsedMb === 'number');
    assert('Active SSE streams reported', typeof diagRes.data.activeSseStreams === 'number');
    assert('Uptime seconds reported', typeof diagRes.data.uptimeSeconds === 'number');

    // ── Test 3: Doctor Auth & Prescription Notification FK Fix ───────────────
    console.log('\n▶ Testing Prescription Creation & Notification FK Resolution...');
    const doctorLogin = await request(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: { email: 'doctor@meditalk.com', password: 'password', role: 'doctor' },
    });
    assert('Doctor login successful', doctorLogin.status === 200 && doctorLogin.data.token);
    const doctorToken = doctorLogin.data.token;

    const patientLogin = await request(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: { email: 'patient@meditalk.com', password: 'password', role: 'patient' },
    });
    assert('Patient login successful', patientLogin.status === 200 && patientLogin.data.token);
    const patientToken = patientLogin.data.token;

    // Get patient notifications before prescription
    const notifsBefore = await request(`${BASE_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    const beforeCount = Array.isArray(notifsBefore.data) ? notifsBefore.data.length : 0;

    // Create prescription for patient using logged in IDs
    const rxRes = await request(`${BASE_URL}/api/prescriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${doctorToken}` },
      body: {
        patientId: patientLogin.data.user.id,
        doctorId: doctorLogin.data.user.id,
        medications: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', duration: '7 days' }],
        additionalInstructions: 'Take with food and full glass of water.',
      },
    });
    assert('Prescription created successfully', rxRes.status === 201 && rxRes.data.prescription?.id);

    // Get patient notifications after prescription — must have incremented and NOT dropped due to FK violation!
    const notifsAfter = await request(`${BASE_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    assert(
      'Patient received prescription notification (FK constraint satisfied)',
      Array.isArray(notifsAfter.data) && notifsAfter.data.length > beforeCount,
      `before=${beforeCount}, after=${notifsAfter.data?.length}`
    );

    // ── Test 4: Dynamic Slot Generator & Lunch Break Overlap Fix ────────────
    console.log('\n▶ Testing Slot Generator Lunch Break Interval Overlap Fix...');
    // Query available slots for doctor for a weekday
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + ((1 + 7 - tomorrow.getDay()) % 7 || 1)); // next Monday
    const dateStr = tomorrow.toISOString().slice(0, 10);

    const slotsRes = await request(`${BASE_URL}/api/doctors/${doctorLogin.data.user.id}/available-slots?date=${dateStr}`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    assert('Available slots endpoint returns HTTP 200', slotsRes.status === 200);
    const slots = slotsRes.data.slots || [];
    assert('Slots array generated', slots.length > 0);

    // Default break is 13:00 to 14:00 (1:00 PM to 2:00 PM).
    // Ensure NO slot is in or overlaps the 1:00 PM - 2:00 PM lunch window!
    const lunchSlots = slots.filter((s) => {
      const t = s.time;
      return t.startsWith('01:') && t.includes('PM');
    });
    assert(
      'No slots overlap doctor lunch break (1:00 PM - 2:00 PM)',
      lunchSlots.length === 0,
      `Found unexpected slots: ${JSON.stringify(lunchSlots)}`
    );

    // ── Test 5: Patient Doctor Directory Verification Filter ────────────────
    console.log('\n▶ Testing Patient Directory Doctor Verification Filtering...');
    const patDoctorsRes = await request(`${BASE_URL}/api/doctors`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    assert('Patient doctor list returned HTTP 200', patDoctorsRes.status === 200);
    const patDoctors = patDoctorsRes.data || [];
    const unapprovedVisible = patDoctors.filter(
      (d) => d.verification_status && d.verification_status !== 'approved'
    );
    assert(
      'No pending/rejected doctors are exposed to patients',
      unapprovedVisible.length === 0,
      `Unapproved doctors found: ${unapprovedVisible.length}`
    );

    // ── Summary ─────────────────────────────────────────────────────────────
    console.log(`\n=============================================`);
    console.log(`🏁 Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log(`=============================================`);

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('💥 Test suite crashed with error:', err);
    process.exit(1);
  }
}

runTests();
