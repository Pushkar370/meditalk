// Using global fetch built into Node 24

const BASE = 'http://localhost:3001/api';

async function req(method, path, { body, token, headers = {} } = {}) {
  const reqHeaders = { 'Content-Type': 'application/json', ...headers };
  if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : await res.text();
    return { status: res.status, data, headers: Object.fromEntries(res.headers.entries()) };
  } catch (err) {
    return { status: 0, error: err.message };
  }
}

async function runAudit() {
  console.log('====================================================');
  console.log('MEDITALK STAGE 1 COMPREHENSIVE SECURITY AUDIT RUNNER');
  console.log('====================================================\n');

  // 1. Get Tokens
  console.log('[1] AUTHENTICATION & LOGIN');
  const patient1Login = await req('POST', '/auth/login', {
    body: { email: 'patient@meditalk.com', password: 'password', role: 'patient' }
  });
  console.log('Patient 1 Login status:', patient1Login.status, 'User ID:', patient1Login.data?.user?.id);
  const patient1Token = patient1Login.data?.token;

  // Let's register Patient 2 or check existing users
  const adminLogin = await req('POST', '/auth/login', {
    body: { email: 'admin@meditalk.com', password: 'password', role: 'admin' }
  });
  console.log('Admin Login status:', adminLogin.status);
  const adminToken = adminLogin.data?.token;

  // Let's login as Doctor 1
  const doctor1Login = await req('POST', '/auth/login', {
    body: { email: 'sarah.jenkins@meditalk.com', password: 'password', role: 'doctor' }
  });
  console.log('Doctor 1 Login status:', doctor1Login.status, 'Doctor ID:', doctor1Login.data?.user?.id);
  const doctor1Token = doctor1Login.data?.token;

  // Let's login as Doctor 2
  const doctor2Login = await req('POST', '/auth/login', {
    body: { email: 'marcus.chen@meditalk.com', password: 'password', role: 'doctor' }
  });
  console.log('Doctor 2 Login status:', doctor2Login.status, 'Doctor ID:', doctor2Login.data?.user?.id);
  const doctor2Token = doctor2Login.data?.token;

  // Register Patient 2 if needed
  let patient2Token = null;
  const p2Email = 'patient2_audit@test.com';
  const regP2 = await req('POST', '/auth/register', {
    body: { name: 'Audit Patient Two', email: p2Email, password: 'password123', role: 'patient' }
  });
  const p2Login = await req('POST', '/auth/login', {
    body: { email: p2Email, password: 'password123', role: 'patient' }
  });
  patient2Token = p2Login.data?.token;
  const patient2Id = p2Login.data?.user?.id;
  console.log('Patient 2 Registered/Logged in. User ID:', patient2Id);

  // 2. Unauthenticated endpoints check
  console.log('\n[2] UNAUTHENTICATED ACCESS CHECKS');
  const unauthTests = [
    { p: '/patients', m: 'GET' },
    { p: '/appointments', m: 'GET' },
    { p: '/prescriptions', m: 'GET' },
    { p: '/admin/stats', m: 'GET' },
    { p: '/admin/audit-logs', m: 'GET' },
  ];
  for (const t of unauthTests) {
    const r = await req(t.m, t.p);
    console.log(`Unauth ${t.m} ${t.p} -> HTTP ${r.status}`);
  }

  // Check Calendar ICS Unauthenticated Leak
  // Get an appointment ID
  const apptsRes = await req('GET', '/appointments', { token: adminToken });
  const sampleAppt = apptsRes.data?.[0];
  console.log('Sample appointment ID:', sampleAppt?.id);
  if (sampleAppt?.id) {
    const icsRes = await req('GET', `/messaging/calendar-ics/${sampleAppt.id}`);
    console.log(`Unauthenticated GET /messaging/calendar-ics/${sampleAppt.id} -> HTTP ${icsRes.status}`);
    console.log('ICS snippet:', typeof icsRes.data === 'string' ? icsRes.data.substring(0, 180) : 'Not text');
  }

  // Check Forgot Password Dev Token Exposure
  const forgotRes = await req('POST', '/auth/forgot-password', {
    body: { email: 'patient@meditalk.com' }
  });
  console.log('POST /auth/forgot-password response:', JSON.stringify(forgotRes.data));

  // 3. IDOR / Access Control Vulnerabilities
  console.log('\n[3] IDOR & PRIVILEGE CHECKS');

  // Test 3.1: Patient 1 accessing Patient 2 profile
  if (patient2Id) {
    const idorPat = await req('GET', `/patients/${patient2Id}`, { token: patient1Token });
    console.log(`Patient 1 accessing Patient 2 profile (/patients/${patient2Id}) -> HTTP ${idorPat.status}`);
  }

  // Test 3.2: Patient 1 accessing Patient 2 follow-ups
  if (patient2Id) {
    const idorFollowUp = await req('GET', `/follow-ups/patient/${patient2Id}`, { token: patient1Token });
    console.log(`Patient 1 accessing Patient 2 follow-ups (/follow-ups/patient/${patient2Id}) -> HTTP ${idorFollowUp.status}`, idorFollowUp.data);
  }

  // Test 3.3: Patient 1 accessing Patient 2 refills
  if (patient2Id) {
    const idorRefills = await req('GET', `/refills/patient/${patient2Id}`, { token: patient1Token });
    console.log(`Patient 1 accessing Patient 2 refills (/refills/patient/${patient2Id}) -> HTTP ${idorRefills.status}`, idorRefills.data);
  }

  // Test 3.4: Patient 2 cancelling Patient 1's appointment
  if (sampleAppt?.id && patient2Token) {
    console.log(`Patient 2 attempting to cancel Patient 1 appointment (${sampleAppt.id})...`);
    const cancelRes = await req('PATCH', `/appointments/${sampleAppt.id}/cancel`, {
      token: patient2Token,
      body: { reason: 'Malicious cancellation by another patient' }
    });
    console.log(`Patient 2 cancellation result -> HTTP ${cancelRes.status}:`, cancelRes.data);
  }

  // Test 3.5: Doctor 2 seeing a patient who is NOT theirs
  // Doctor 2 checking patient 1 profile
  const pat1Id = patient1Login.data?.user?.id;
  const doc2PatCheck = await req('GET', `/patients/${pat1Id}`, { token: doctor2Token });
  console.log(`Doctor 2 GET /patients/${pat1Id} (no clinical relationship) -> HTTP ${doc2PatCheck.status}:`, doc2PatCheck.data);

  // Doctor 2 accessing check-safety for patient 1 (unrelated patient)
  const doc2SafetyCheck = await req('POST', '/prescriptions/check-safety', {
    token: doctor2Token,
    body: { patientId: pat1Id, newMedications: ['Amoxicillin'] }
  });
  console.log(`Doctor 2 POST /prescriptions/check-safety for Patient ${pat1Id} -> HTTP ${doc2SafetyCheck.status}:`, doc2SafetyCheck.data);

  // Doctor 2 adopting AI records for patient 1 (unrelated patient)
  const doc2AdoptCheck = await req('PATCH', `/patients/${pat1Id}/adopt-ai-records`, {
    token: doctor2Token,
    body: { allergies: ['Maliciously Injected Allergy'], medications: [] }
  });
  console.log(`Doctor 2 PATCH /patients/${pat1Id}/adopt-ai-records -> HTTP ${doc2AdoptCheck.status}:`, doc2AdoptCheck.data?.success);

  // 4. Security Headers
  console.log('\n[4] SECURITY HEADERS & CORS');
  const healthRes = await req('GET', '/health');
  console.log('CSP Header:', healthRes.headers['content-security-policy'] || 'MISSING');
  console.log('Strict-Transport-Security:', healthRes.headers['strict-transport-security'] || 'MISSING');
  console.log('X-Frame-Options:', healthRes.headers['x-frame-options'] || 'MISSING');
  console.log('X-Content-Type-Options:', healthRes.headers['x-content-type-options'] || 'MISSING');

  // CORS reflection check on SSE
  const sseHead = await req('GET', `/notifications/stream?token=${patient1Token}`, {
    headers: { Origin: 'https://evil-attacker-website.com' }
  });
  console.log('SSE Access-Control-Allow-Origin with evil origin:', sseHead.headers['access-control-allow-origin']);
  console.log('SSE Access-Control-Allow-Credentials:', sseHead.headers['access-control-allow-credentials']);

  // 5. Rate limiting check
  console.log('\n[5] RATE LIMITING TEST');
  let blockedCount = 0;
  for (let i = 1; i <= 35; i++) {
    const rl = await req('POST', '/auth/login', {
      body: { email: 'invalid@test.com', password: 'bad', role: 'patient' }
    });
    if (rl.status === 429) {
      blockedCount++;
    }
  }
  console.log(`Auth rate limiter: 35 attempts made, 429 blocked count: ${blockedCount}`);

  // Test Rate limiter on forgot-password
  let fpBlocked = 0;
  for (let i = 1; i <= 35; i++) {
    const fpr = await req('POST', '/auth/forgot-password', {
      body: { email: 'invalid@test.com' }
    });
    if (fpr.status === 429) fpBlocked++;
  }
  console.log(`Forgot password: 35 attempts made, 429 blocked count: ${fpBlocked}`);

  console.log('\nAUDIT RUN COMPLETED.');
}

runAudit();
