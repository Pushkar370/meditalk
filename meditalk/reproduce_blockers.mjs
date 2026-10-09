// Using built-in fetch

const BASE_URL = 'http://localhost:3001';

async function runReproduction() {
  console.log('=================================================================');
  console.log('REPRODUCING IDENTIFIED BLOCKERS AGAINST ACTIVE BACKEND (PORT 3001)');
  console.log('=================================================================\n');

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

  console.log(`[AUTH] Logged in as:`);
  console.log(`  Patient: ${patRes.user?.name} (${patientId})`);
  console.log(`  Doctor:  ${docRes.user?.name} (${doctorId})`);
  console.log(`  Admin:   ${adminRes.user?.name}\n`);

  // Fetch appointments and patients directory via Admin
  const allAppts = await fetch(`${BASE_URL}/api/appointments`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  }).then(r => r.json());
  const allPatients = await fetch(`${BASE_URL}/api/patients`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  }).then(r => r.json());

  // Pick an appointment belonging to another patient
  const targetAppt = allAppts.find(a => a.patientId !== patientId && a.status !== 'cancelled') || allAppts[0];
  console.log(`[TEST SETUP] Selected Target Appointment: ID=${targetAppt?.id}, Patient=${targetAppt?.patientName} (${targetAppt?.patientId}), Doctor=${targetAppt?.doctorName} (${targetAppt?.doctorId})\n`);

  // Find an unassigned patient for the doctor
  const docPatients = await fetch(`${BASE_URL}/api/patients`, {
    headers: { Authorization: `Bearer ${doctorToken}` }
  }).then(r => r.json());
  const unassignedPatient = allPatients.find(p => !docPatients.some(dp => dp.id === p.id));
  console.log(`[TEST SETUP] Selected Unassigned Patient for Dr. Sneha: ID=${unassignedPatient?.id}, Name=${unassignedPatient?.name}\n`);

  // ------------------------------------------------------------------------
  // BLOCKER 1: Unauthenticated calendar feed exposing appointment details
  // ------------------------------------------------------------------------
  console.log('--- TEST 1: Unauthenticated Calendar Feed (/api/messaging/calendar-ics/:id) ---');
  const icsRes = await fetch(`${BASE_URL}/api/messaging/calendar-ics/${targetAppt.id}`);
  const icsText = await icsRes.text();
  console.log(`HTTP Status: ${icsRes.status}`);
  console.log(`Content-Type: ${icsRes.headers.get('content-type')}`);
  console.log(`First 5 lines of .ics response:\n${icsText.split('\n').slice(0, 8).join('\n')}`);
  if (icsRes.status === 200 && icsText.includes('BEGIN:VCALENDAR')) {
    console.log('🚨 VULNERABILITY CONFIRMED: Appointment calendar feed is completely unauthenticated and accessible to anyone!\n');
  } else {
    console.log('Status: Protected\n');
  }

  // ------------------------------------------------------------------------
  // BLOCKER 2: Patients able to cancel / reschedule other patients' appointments
  // ------------------------------------------------------------------------
  console.log('--- TEST 2A: Patient BOLA - Cancelling Another Patient\'s Appointment ---');
  const cancelRes = await fetch(`${BASE_URL}/api/appointments/${targetAppt.id}/cancel`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${patientToken}` // Patient P-1001 cancelling another patient's appointment!
    },
    body: JSON.stringify({ reason: 'Hacked by another patient' })
  });
  const cancelData = await cancelRes.json();
  console.log(`HTTP Status: ${cancelRes.status}`);
  console.log(`Response:`, cancelData);
  if (cancelRes.status === 200 && cancelData.success) {
    console.log(`🚨 VULNERABILITY CONFIRMED: Patient ${patientId} successfully cancelled appointment ${targetAppt.id} belonging to ${targetAppt.patientName}!\n`);
  } else {
    console.log('Status: Protected\n');
  }

  console.log('--- TEST 2B: Patient BOLA - Rescheduling Another Patient\'s Appointment ---');
  const reschedRes = await fetch(`${BASE_URL}/api/appointments/${targetAppt.id}/reschedule`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${patientToken}`
    },
    body: JSON.stringify({ date: '2026-12-25', time: '09:00 AM' })
  });
  const reschedData = await reschedRes.json();
  console.log(`HTTP Status: ${reschedRes.status}`);
  console.log(`Response:`, reschedData);
  if (reschedRes.status === 200 && reschedData.success) {
    console.log(`🚨 VULNERABILITY CONFIRMED: Patient ${patientId} successfully rescheduled appointment ${targetAppt.id} belonging to ${targetAppt.patientName}!\n`);
  } else {
    console.log('Status: Protected\n');
  }

  // ------------------------------------------------------------------------
  // BLOCKER 3: Doctors accessing patients not under their care
  // ------------------------------------------------------------------------
  console.log('--- TEST 3A: Doctor Access - Drug Safety Check for Unassigned Patient ---');
  const safetyRes = await fetch(`${BASE_URL}/api/prescriptions/check-safety`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${doctorToken}`
    },
    body: JSON.stringify({
      patientId: unassignedPatient.id,
      newMedications: ['Aspirin']
    })
  });
  const safetyData = await safetyRes.json();
  console.log(`HTTP Status: ${safetyRes.status}`);
  console.log(`Response:`, safetyData);
  if (safetyRes.status === 200) {
    console.log(`🚨 VULNERABILITY CONFIRMED: Doctor ${doctorId} accessed drug/allergy records for unassigned patient ${unassignedPatient.id}!\n`);
  } else {
    console.log('Status: Protected\n');
  }

  console.log('--- TEST 3B: Doctor Access - Adopt AI Records for Unassigned Patient ---');
  const adoptRes = await fetch(`${BASE_URL}/api/patients/${unassignedPatient.id}/adopt-ai-records`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${doctorToken}`
    },
    body: JSON.stringify({
      allergies: ['Latex'],
      medications: ['Metformin']
    })
  });
  const adoptData = await adoptRes.json();
  console.log(`HTTP Status: ${adoptRes.status}`);
  console.log(`Response:`, adoptData);
  if (adoptRes.status === 200 && adoptData.success) {
    console.log(`🚨 VULNERABILITY CONFIRMED: Doctor ${doctorId} modified medical chart for unassigned patient ${unassignedPatient.id}!\n`);
  } else {
    console.log('Status: Protected\n');
  }

  console.log('--- TEST 3C: Doctor Access - Follow-ups & Refills for Unassigned Patient ---');
  const followUpRes = await fetch(`${BASE_URL}/api/follow-ups/patient/${unassignedPatient.id}`, {
    headers: { Authorization: `Bearer ${doctorToken}` }
  });
  const followUpData = await followUpRes.json();
  console.log(`Follow-ups Status: ${followUpRes.status}`);
  console.log(`Follow-ups Response:`, followUpData);

  const refillRes = await fetch(`${BASE_URL}/api/refills/patient/${unassignedPatient.id}`, {
    headers: { Authorization: `Bearer ${doctorToken}` }
  });
  const refillData = await refillRes.json();
  console.log(`Refills Status: ${refillRes.status}`);
  console.log(`Refills Response:`, refillData);
  if (followUpRes.status === 200 || refillRes.status === 200) {
    console.log(`🚨 VULNERABILITY CONFIRMED: Doctor ${doctorId} accessed follow-ups/refills for unassigned patient ${unassignedPatient.id}!\n`);
  }

  // ------------------------------------------------------------------------
  // BLOCKER 4: Notification stream accepting requests from any origin
  // ------------------------------------------------------------------------
  console.log('--- TEST 4: Arbitrary CORS Origin Reflection on Notification Stream ---');
  const evilOrigin = 'https://malicious-website.example.com';
  const streamRes = await fetch(`${BASE_URL}/api/notifications/stream?token=${patientToken}`, {
    headers: {
      Origin: evilOrigin,
    }
  });
  console.log(`HTTP Status: ${streamRes.status}`);
  const acao = streamRes.headers.get('access-control-allow-origin');
  const acac = streamRes.headers.get('access-control-allow-credentials');
  console.log(`Access-Control-Allow-Origin: ${acao}`);
  console.log(`Access-Control-Allow-Credentials: ${acac}`);
  if (acao === evilOrigin && acac === 'true') {
    console.log(`🚨 VULNERABILITY CONFIRMED: Notification stream reflected arbitrary origin '${evilOrigin}' with credentials: true!\n`);
  } else {
    console.log('Status: Protected\n');
  }

  // Close the stream response so script can exit
  try { streamRes.body?.destroy?.(); } catch(_) {}
  process.exit(0);
}

runReproduction().catch(err => {
  console.error('Fatal reproduction error:', err);
  process.exit(1);
});
