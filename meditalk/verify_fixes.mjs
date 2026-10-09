const BASE_URL = 'http://localhost:3001';

async function runVerification() {
  console.log('=================================================================');
  console.log('VERIFYING REMEDIATIONS AGAINST ACTIVE BACKEND (PORT 3001)');
  console.log('=================================================================\n');

  let passes = 0;
  let failures = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passes++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failures++;
    }
  }

  // 1. Authenticate users
  const patRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@meditalk.com', password: 'password', role: 'patient' }),
  }).then(r => r.json());
  const patientToken = patRes.token;
  const patientId = patRes.user?.id || 'P-1001';

  const docRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'doctor@meditalk.com', password: 'password', role: 'doctor' }),
  }).then(r => r.json());
  const doctorToken = docRes.token;
  const doctorId = docRes.user?.id || 'D-201';

  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@meditalk.com', password: 'password', role: 'admin' }),
  }).then(r => r.json());
  const adminToken = adminRes.token;

  console.log(`[AUTH] Logged in successfully:`);
  console.log(`  Patient: ${patRes.user?.name} (${patientId})`);
  console.log(`  Doctor:  ${docRes.user?.name} (${doctorId})`);
  console.log(`  Admin:   ${adminRes.user?.name}\n`);

  // Fetch admin appointments and patients
  const allAppts = await fetch(`${BASE_URL}/api/appointments`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  }).then(r => r.json());
  const allPatients = await fetch(`${BASE_URL}/api/patients`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  }).then(r => r.json());

  // Find appointment of another patient
  const targetAppt = allAppts.find(a => a.patientId !== patientId && a.status !== 'cancelled') || allAppts[0];
  // Find appointment of current patient
  const ownAppt = allAppts.find(a => a.patientId === patientId) || allAppts[0];

  // Find unassigned patient for doctor
  const docPatients = await fetch(`${BASE_URL}/api/patients`, {
    headers: { Authorization: `Bearer ${doctorToken}` }
  }).then(r => r.json());
  const unassignedPatient = allPatients.find(p => !docPatients.some(dp => dp.id === p.id));
  const assignedPatient = allPatients.find(p => docPatients.some(dp => dp.id === p.id));

  // ------------------------------------------------------------------------
  // TEST 1: Calendar Feed Auth & Scoping (/api/messaging/calendar-ics/:id)
  // ------------------------------------------------------------------------
  console.log('--- TEST 1: Calendar Feed Protection ---');
  // 1A. Unauthenticated request must return 401
  const unauthIcs = await fetch(`${BASE_URL}/api/messaging/calendar-ics/${targetAppt.id}`);
  assert(unauthIcs.status === 401, `Unauthenticated request to calendar feed rejected with 401 (Status: ${unauthIcs.status})`);

  // 1B. Patient downloading another patient's appointment calendar must return 403
  const crossPatientIcs = await fetch(`${BASE_URL}/api/messaging/calendar-ics/${targetAppt.id}`, {
    headers: { Authorization: `Bearer ${patientToken}` }
  });
  assert(crossPatientIcs.status === 403, `Patient attempting to access another patient's calendar feed rejected with 403 (Status: ${crossPatientIcs.status})`);

  // 1C. Patient downloading own appointment calendar with token must succeed with 200
  if (ownAppt && ownAppt.patientId === patientId) {
    const ownIcs = await fetch(`${BASE_URL}/api/messaging/calendar-ics/${ownAppt.id}`, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    const ownIcsText = await ownIcs.text();
    assert(ownIcs.status === 200 && ownIcsText.includes('BEGIN:VCALENDAR'), `Patient downloading own appointment calendar succeeds with 200`);
  }

  // ------------------------------------------------------------------------
  // TEST 2: Patient BOLA Protection (Cancel & Reschedule)
  // ------------------------------------------------------------------------
  console.log('\n--- TEST 2: Appointment Ownership Guards ---');
  // 2A. Patient cancelling another patient's appointment must return 403
  const badCancel = await fetch(`${BASE_URL}/api/appointments/${targetAppt.id}/cancel`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${patientToken}` },
    body: JSON.stringify({ reason: 'Malicious cancellation attempt' })
  });
  assert(badCancel.status === 403, `Patient cancelling another patient's appointment rejected with 403 (Status: ${badCancel.status})`);

  // 2B. Patient rescheduling another patient's appointment must return 403
  const badResched = await fetch(`${BASE_URL}/api/appointments/${targetAppt.id}/reschedule`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${patientToken}` },
    body: JSON.stringify({ date: '2026-11-20', time: '10:00 AM' })
  });
  assert(badResched.status === 403, `Patient rescheduling another patient's appointment rejected with 403 (Status: ${badResched.status})`);

  // 2C. Patient check-in for another patient's appointment must return 403
  const badCheckIn = await fetch(`${BASE_URL}/api/appointments/${targetAppt.id}/check-in`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${patientToken}` }
  });
  assert(badCheckIn.status === 403, `Patient checking in for another patient's appointment rejected with 403 (Status: ${badCheckIn.status})`);

  // ------------------------------------------------------------------------
  // TEST 3: Doctor Clinical Access Scoping
  // ------------------------------------------------------------------------
  console.log('\n--- TEST 3: Doctor Clinical Relationship Scoping ---');
  // 3A. Doctor drug safety check on unassigned patient must return 403
  const badSafety = await fetch(`${BASE_URL}/api/prescriptions/check-safety`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${doctorToken}` },
    body: JSON.stringify({ patientId: unassignedPatient.id, newMedications: ['Aspirin'] })
  });
  assert(badSafety.status === 403, `Doctor accessing drug safety check for unassigned patient rejected with 403 (Status: ${badSafety.status})`);

  // 3B. Doctor drug safety check on assigned patient must succeed with 200
  if (assignedPatient) {
    const goodSafety = await fetch(`${BASE_URL}/api/prescriptions/check-safety`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${doctorToken}` },
      body: JSON.stringify({ patientId: assignedPatient.id, newMedications: ['Aspirin'] })
    });
    assert(goodSafety.status === 200, `Doctor accessing drug safety check for assigned patient succeeds with 200`);
  }

  // 3C. Doctor adopting AI records on unassigned patient must return 403
  const badAdopt = await fetch(`${BASE_URL}/api/patients/${unassignedPatient.id}/adopt-ai-records`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${doctorToken}` },
    body: JSON.stringify({ allergies: ['Latex'], medications: ['Metformin'] })
  });
  assert(badAdopt.status === 403, `Doctor adopting AI records for unassigned patient rejected with 403 (Status: ${badAdopt.status})`);

  // 3D. Doctor fetching follow-ups for unassigned patient must return 403
  const badFollowUps = await fetch(`${BASE_URL}/api/follow-ups/patient/${unassignedPatient.id}`, {
    headers: { Authorization: `Bearer ${doctorToken}` }
  });
  assert(badFollowUps.status === 403, `Doctor accessing follow-ups for unassigned patient rejected with 403 (Status: ${badFollowUps.status})`);

  // 3E. Doctor fetching refills for unassigned patient must return 403
  const badRefills = await fetch(`${BASE_URL}/api/refills/patient/${unassignedPatient.id}`, {
    headers: { Authorization: `Bearer ${doctorToken}` }
  });
  assert(badRefills.status === 403, `Doctor accessing refill requests for unassigned patient rejected with 403 (Status: ${badRefills.status})`);

  // 3F. Doctor fetching another doctor's refill queue must return 403
  const otherDoctorRefills = await fetch(`${BASE_URL}/api/refills/doctor/D-999`, {
    headers: { Authorization: `Bearer ${doctorToken}` }
  });
  assert(otherDoctorRefills.status === 403, `Doctor accessing another doctor's refill queue rejected with 403 (Status: ${otherDoctorRefills.status})`);

  // 3G. Doctor querying medication adherence for unassigned patient must return 403
  const badAdherence = await fetch(`${BASE_URL}/api/medications/adherence?patientId=${unassignedPatient.id}`, {
    headers: { Authorization: `Bearer ${doctorToken}` }
  });
  assert(badAdherence.status === 403, `Doctor accessing medication adherence for unassigned patient rejected with 403 (Status: ${badAdherence.status})`);

  // ------------------------------------------------------------------------
  // TEST 4: CORS & Notification Stream Protection
  // ------------------------------------------------------------------------
  console.log('\n--- TEST 4: CORS Policy & SSE Notification Stream ---');
  // 4A. Malicious origin attempting to connect to notification stream must be rejected with 403
  const evilOrigin = 'https://malicious-website.example.com';
  const evilStream = await fetch(`${BASE_URL}/api/notifications/stream?token=${patientToken}`, {
    headers: { Origin: evilOrigin }
  });
  assert(evilStream.status === 403, `Unauthorized cross-origin SSE request rejected with 403 Forbidden (Status: ${evilStream.status})`);

  const evilAcao = evilStream.headers.get('access-control-allow-origin');
  assert(evilAcao !== evilOrigin, `Disallowed origin is NOT reflected in Access-Control-Allow-Origin`);

  // 4B. Whitelisted origin connecting to notification stream succeeds with 200 and matches origin
  const allowedOrigin = 'http://localhost:5173';
  const goodStream = await fetch(`${BASE_URL}/api/notifications/stream?token=${patientToken}`, {
    headers: { Origin: allowedOrigin }
  });
  assert(goodStream.status === 200, `Whitelisted origin SSE request accepted with 200 (Status: ${goodStream.status})`);
  const goodAcao = goodStream.headers.get('access-control-allow-origin');
  assert(goodAcao === allowedOrigin, `Whitelisted origin correctly reflected in Access-Control-Allow-Origin (${goodAcao})`);
  try { goodStream.body?.destroy?.(); } catch(_) {}

  console.log('\n=================================================================');
  console.log(`VERIFICATION SUMMARY: ${passes} Passed, ${failures} Failed`);
  console.log('=================================================================\n');

  if (failures > 0) process.exit(1);
  process.exit(0);
}

runVerification().catch(err => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
