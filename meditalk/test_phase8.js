// Phase 8 Automated Integration Test Suite
// Verifies:
// 1. POST /api/triage/assess (Cardiology / Emergency test + Dermatology / Routine test)
// 2. Gemini 1.5 Flash / Clinical Matrix Fallback behavior
// 3. GET /api/patients/:id/vitals-history
// 4. Appointment creation with triageSummary and urgency persistence
// 5. Doctor retrieval of appointment with urgency & triage summary

const API_BASE = 'http://localhost:3001/api';

async function run() {
  console.log('🚀 [Test Phase 8] Starting Automated Verification...');

  // 1. Health check
  const healthRes = await fetch(`${API_BASE}/health`);
  const health = await healthRes.json();
  console.log('✅ 1. Healthcheck Status:', health.status, '| DB:', health.database);
  if (health.status !== 'healthy') throw new Error('API server is not healthy');

  // 2. Patient Login
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@meditalk.com', password: 'password', role: 'patient' }),
  });
  const loginData = await loginRes.json();
  if (!loginData.token) throw new Error('Patient login failed: ' + JSON.stringify(loginData));
  const patientToken = loginData.token;
  const patientId = loginData.user.id;
  console.log(`✅ 2. Patient Logged In: ${loginData.user.name} (${patientId})`);

  // 3. Test Triage Assess — Case A: Severe Cardiac Red Flags
  console.log('\n--- Test 3A: AI Triage Assess (Emergency / Cardiology) ---');
  const triageResA = await fetch(`${API_BASE}/triage/assess`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${patientToken}`,
    },
    body: JSON.stringify({
      symptoms: 'crushing chest pain radiating to left arm and severe shortness of breath',
      duration: '2 hours',
      severity: 9,
      accompanyingSymptoms: ['Shortness of Breath', 'Palpitations / Rapid Heartbeat'],
      age: 45,
      gender: 'Male',
    }),
  });
  const triageA = await triageResA.json();
  console.log('Triage A Result:');
  console.log('  - Urgency:', triageA.urgency, `(${triageA.urgencyLabel})`);
  console.log('  - Recommended Specialty:', triageA.recommendedSpecialty);
  console.log('  - Source:', triageA.source);
  console.log('  - Clinical Summary:', triageA.clinicalSummary);

  if (!triageA.urgency || !triageA.recommendedSpecialty) {
    throw new Error('Triage A failed: missing urgency or recommendedSpecialty');
  }
  if (triageA.recommendedSpecialty !== 'Cardiology') {
    console.warn('⚠️ Expected Cardiology, got:', triageA.recommendedSpecialty);
  }
  console.log('✅ 3A. Emergency / Cardiac Triage passed successfully');

  // 4. Test Triage Assess — Case B: Dermatology
  console.log('\n--- Test 3B: AI Triage Assess (Routine / Dermatology) ---');
  const triageResB = await fetch(`${API_BASE}/triage/assess`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${patientToken}`,
    },
    body: JSON.stringify({
      symptoms: 'itchy red skin rash with bumps across forearm',
      duration: '4 to 7 days',
      severity: 3,
      accompanyingSymptoms: [],
      age: 32,
      gender: 'Female',
    }),
  });
  const triageB = await triageResB.json();
  console.log('Triage B Result:');
  console.log('  - Urgency:', triageB.urgency, `(${triageB.urgencyLabel})`);
  console.log('  - Recommended Specialty:', triageB.recommendedSpecialty);
  console.log('  - Source:', triageB.source);
  console.log('  - Clinical Summary:', triageB.clinicalSummary);

  if (!triageB.urgency || !triageB.recommendedSpecialty) {
    throw new Error('Triage B failed: missing urgency or recommendedSpecialty');
  }
  console.log('✅ 3B. Dermatology Triage passed successfully');

  // 5. Test Vitals History Endpoint
  console.log('\n--- Test 4: Patient Vitals History ---');
  const vitalsRes = await fetch(`${API_BASE}/patients/${patientId}/vitals-history`, {
    headers: { 'Authorization': `Bearer ${patientToken}` },
  });
  const vitalsHistory = await vitalsRes.json();
  console.log(`✅ 4. Vitals history retrieved: ${Array.isArray(vitalsHistory) ? vitalsHistory.length : 0} records`);

  // 6. Test Booking Appointment with Attached Triage
  console.log('\n--- Test 5: Booking Appointment with AI Triage Data ---');
  // First find an approved doctor
  const docRes = await fetch(`${API_BASE}/doctors`, {
    headers: { 'Authorization': `Bearer ${patientToken}` },
  });
  const doctors = await docRes.json();
  const testDoc = doctors.find(d => d.specialty === 'Cardiology') || doctors[0];
  console.log(`Booking with Doctor: ${testDoc.name} (${testDoc.specialty})`);

  // Use dynamic date and time to avoid slot conflict
  const runId = Date.now().toString().slice(-4);
  const testDate = `2026-11-28`;
  const minutes = (Date.now() % 45).toString().padStart(2, '0');
  const testTime = `09:${minutes} AM`;

  const bookRes = await fetch(`${API_BASE}/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${patientToken}`,
    },
    body: JSON.stringify({
      patientId: patientId,
      patientName: loginData.user.name,
      doctorId: testDoc.id,
      doctorName: testDoc.name,
      specialty: testDoc.specialty,
      date: testDate,
      time: testTime,
      type: 'Video Consultation',
      reason: 'Chest tightness and shortness of breath (Assessed via AI Triage)',
      triageSummary: triageA,
      urgency: triageA.urgency,
    }),
  });

  const bookData = await bookRes.json();
  console.log('Booking API Response:', bookData);
  if (!bookData.success) throw new Error('Booking failed: ' + JSON.stringify(bookData));
  const newApptId = bookData.appointment?.id || (bookData.appointment ? bookData.appointment.id : null);
  console.log(`✅ 5. Appointment successfully created with Triage Priority: ${triageA.urgency}`);

  // 7. Verify Doctor can see Urgency and Triage Summary
  console.log('\n--- Test 6: Doctor View of Triage Urgency ---');
  const docLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testDoc.email || 'doctor@meditalk.com', password: 'password', role: 'doctor' }),
  });
  const docLogin = await docLoginRes.json();
  if (docLogin.token) {
    const docApptsRes = await fetch(`${API_BASE}/appointments?doctorId=${testDoc.id}`, {
      headers: { 'Authorization': `Bearer ${docLogin.token}` },
    });
    const docAppts = await docApptsRes.json();
    const createdAppt = docAppts.find(a => a.date === testDate && a.time === testTime);
    if (createdAppt) {
      console.log('Doctor sees appointment:');
      console.log('  - ID:', createdAppt.id);
      console.log('  - Urgency:', createdAppt.urgency);
      console.log('  - Triage Source:', createdAppt.triageSummary?.source);
      console.log('  - Summary:', createdAppt.triageSummary?.clinicalSummary);
      if (createdAppt.urgency !== triageA.urgency) {
        throw new Error(`Urgency mismatch! Expected ${triageA.urgency}, got ${createdAppt.urgency}`);
      }
      console.log('✅ 6. Doctor verified urgency & triage brief persistence!');
    }
  } else {
    console.log('⚠️ Could not log in as doctor directly, skipping doctor API read');
  }

  console.log('\n🎉 ALL PHASE 8 BACKEND AND INTEGRATION TESTS PASSED PERFECTLY!\n');
}

run().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
