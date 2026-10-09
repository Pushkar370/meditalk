import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'meditalk_dev_secret_2026';
const BASE = 'http://localhost:3001/api';

function mintToken(user) {
  return jwt.sign(
    {
      jti: 'test-' + Date.now() + '-' + Math.random(),
      id: user.patientId || user.doctorId || user.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      doctorId: user.doctorId,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

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

async function runStage2Audit() {
  console.log('====================================================');
  console.log('MEDITALK STAGE 2 CLINICAL SAFETY & FEATURES AUDIT');
  console.log('====================================================\n');

  // Mint direct test tokens
  const p1Id = 'P-1001';
  const p1Token = mintToken({ id: 'U-patient-1', patientId: p1Id, name: 'Audit Patient 1', email: 'patient@meditalk.com', role: 'patient' });
  const adminToken = mintToken({ id: 'U-admin-1', name: 'Admin', email: 'admin@meditalk.com', role: 'admin' });
  const docToken = mintToken({ id: 'U-doc-1', doctorId: 'D-874', id_doc: 'D-874', name: 'Dr. Sarah Jenkins', email: 'sarah.jenkins@meditalk.com', role: 'doctor' });

  // Get doctor list
  const docList = await req('GET', '/doctors', { token: adminToken });
  const sampleDoc = docList.data?.[0] || { id: 'D-874', name: 'Dr. Sarah Jenkins', specialty: 'Cardiology' };
  console.log(`Target Doctor: ${sampleDoc?.name} (${sampleDoc?.id})`);

  // [TEST 1] EDGE CASES: EMPTY FIELDS & MISSING PARAMS
  console.log('\n--- [TEST 1] EMPTY FIELDS ---');
  // 1.1 Booking with empty date/time
  const emptyBooking = await req('POST', '/appointments', {
    token: p1Token,
    body: { patientId: p1Id, doctorId: sampleDoc?.id, date: '', time: '' }
  });
  console.log('Booking with empty date/time -> HTTP', emptyBooking.status, emptyBooking.data);

  // 1.2 Prescription with empty medications
  const emptyRx = await req('POST', '/prescriptions', {
    token: adminToken, // doctor role required, let's see if admin is rejected
    body: { patientId: p1Id, doctorId: sampleDoc?.id, medications: [] }
  });
  console.log('Admin calling POST /prescriptions -> HTTP', emptyRx.status, emptyRx.data);

  // 1.3 Consultations with nonsensical vitals (negative HR, impossible BP, extreme SpO2)
  // Let's create a doctor login or temporary token to test doctor actions
  // We can sign a doctor token or login
  console.log('Using minted doctor token for:', sampleDoc?.name);

  // If docToken available, test nonsensical vitals:
  if (docToken) {
    const nonsensicalVitals = {
      bp: "999/999",
      hr: -75,
      temp: 250.5,
      spo2: 500,
      weight: -20
    };
    const badConsult = await req('POST', '/consultations', {
      token: docToken,
      body: {
        patientId: p1Id,
        doctorId: sampleDoc?.id,
        reason: 'Nonsensical Vitals Test',
        vitals: nonsensicalVitals,
        diagnosis: 'Test Vitals Acceptance',
        symptoms: 'None'
      }
    });
    console.log('POST /consultations with negative/extreme vitals -> HTTP', badConsult.status, 'Saved Vitals:', badConsult.data?.consultation?.vitals);
  }

  // [TEST 2] VERY LONG TEXT (BUFFER/TEXT INJECTION)
  console.log('\n--- [TEST 2] VERY LONG TEXT ---');
  const hugeText = 'A'.repeat(50000);
  const longBooking = await req('POST', '/appointments', {
    token: p1Token,
    body: {
      patientId: p1Id,
      patientName: 'Test Patient',
      doctorId: sampleDoc?.id,
      doctorName: sampleDoc?.name,
      specialty: sampleDoc?.specialty,
      date: '2099-11-20',
      time: '11:00 AM',
      type: 'In-person',
      reason: hugeText
    }
  });
  console.log('Booking with 50,000 characters reason -> HTTP', longBooking.status, 'ID:', longBooking.data?.appointment?.id);

  // [TEST 3] SPECIAL CHARACTERS & XSS PAYLOADS IN CLINICAL FIELDS
  console.log('\n--- [TEST 3] SPECIAL CHARACTERS & XSS PAYLOADS ---');
  const xssPayload = `<script>alert('XSS')</script><img src=x onerror=alert(1)> ' OR '1'='1 -- 💉💊🩺`;
  const xssBooking = await req('POST', '/appointments', {
    token: p1Token,
    body: {
      patientId: p1Id,
      patientName: 'Test Patient',
      doctorId: sampleDoc?.id,
      doctorName: sampleDoc?.name,
      specialty: sampleDoc?.specialty,
      date: '2099-11-21',
      time: '02:00 PM',
      type: 'In-person',
      reason: xssPayload
    }
  });
  console.log('Booking with HTML/Script/Emoji payload -> HTTP', xssBooking.status);
  const savedReason = xssBooking.data?.appointment?.reason;
  console.log('Saved payload exactly as entered (unescaped at REST level):', savedReason);

  // [TEST 4] CONCURRENCY & RACE CONDITIONS (SIMULTANEOUS DOUBLE BOOKING)
  console.log('\n--- [TEST 4] CONCURRENCY: SIMULTANEOUS DOUBLE BOOKING ---');
  const conflictDate = '2099-12-25';
  const conflictTime = '09:00 AM';

  const bookingBodyA = {
    patientId: p1Id,
    patientName: 'Patient One',
    doctorId: sampleDoc?.id,
    doctorName: sampleDoc?.name,
    specialty: sampleDoc?.specialty,
    date: conflictDate,
    time: conflictTime,
    type: 'In-person',
    reason: 'Concurrent request A'
  };

  const bookingBodyB = {
    patientId: 'P-9999', // another patient
    patientName: 'Patient Two',
    doctorId: sampleDoc?.id,
    doctorName: sampleDoc?.name,
    specialty: sampleDoc?.specialty,
    date: conflictDate,
    time: conflictTime,
    type: 'In-person',
    reason: 'Concurrent request B'
  };

  console.log('Firing two simultaneous booking requests for exact same doctor, date and time...');
  const [resA, resB] = await Promise.all([
    req('POST', '/appointments', { token: p1Token, body: bookingBodyA }),
    req('POST', '/appointments', { token: p1Token, body: bookingBodyB })
  ]);
  console.log(`Simultaneous Request A: HTTP ${resA.status} (${resA.data?.appointment?.id || resA.data?.error})`);
  console.log(`Simultaneous Request B: HTTP ${resB.status} (${resB.data?.appointment?.id || resB.data?.error})`);

  // [TEST 5] EXPIRED / MALFORMED SESSIONS
  console.log('\n--- [TEST 5] EXPIRED / MALFORMED SESSIONS ---');
  const badTokenRes = await req('GET', '/appointments', { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature' });
  console.log('Invalid JWT signature -> HTTP', badTokenRes.status, badTokenRes.data);

  // [TEST 6] DRUG ALLERGY & INTERACTION CHECK LIMITATIONS
  console.log('\n--- [TEST 6] DRUG SAFETY ENGINE CLINICAL LIMITATIONS ---');
  if (docToken) {
    // 6.1 Brand Name Blindspot Test: Warfarin patient prescribed "Advil" (Ibuprofen)
    const brandTest = await req('POST', '/prescriptions/check-safety', {
      token: docToken,
      body: {
        patientId: p1Id,
        newMedications: ['Advil'] // Brand name for ibuprofen
      }
    });
    console.log('Prescribing "Advil" to patient: Alerts count:', brandTest.data?.alerts?.length, brandTest.data?.alerts);

    // 6.2 Spelling typo: "Penicilin"
    const typoTest = await req('POST', '/prescriptions/check-safety', {
      token: docToken,
      body: {
        patientId: p1Id,
        newMedications: ['Penicilin V'] // Common typo
      }
    });
    console.log('Prescribing with typo "Penicilin V": Alerts count:', typoTest.data?.alerts?.length, typoTest.data?.alerts);

    // 6.3 Polypharmacy / Triple Whammy (ACEi + Diuretic + NSAID)
    const polyTest = await req('POST', '/prescriptions/check-safety', {
      token: docToken,
      body: {
        patientId: p1Id,
        newMedications: ['Lisinopril', 'Furosemide', 'Ibuprofen']
      }
    });
    console.log('Triple whammy (Lisinopril + Furosemide + Ibuprofen) alerts:', polyTest.data?.alerts?.map(a => a.title));
  }

  // [TEST 7] AI TRIAGE CLINICAL RED FLAG HAZARDS
  console.log('\n--- [TEST 7] AI TRIAGE RED FLAG DOWNGRADE HAZARD ---');
  // 7.1 Emergency with severity rated 5/10 (e.g. crushing chest pain, stoic patient)
  const stoicChestPain = await req('POST', '/triage/assess', {
    token: p1Token,
    body: {
      symptoms: 'Crushing chest pain radiating to jaw and left arm',
      severity: 5, // patient rated 5
      duration: '30 minutes',
    }
  });
  console.log('Crushing chest pain (severity 5/10): Urgency:', stoicChestPain.data?.urgency, '| Label:', stoicChestPain.data?.urgencyLabel, '| Rationale:', stoicChestPain.data?.urgencyReason);

  // 7.2 Painless acute stroke: "Sudden facial droop and slurred speech", severity rated 4/10
  const painlessStroke = await req('POST', '/triage/assess', {
    token: p1Token,
    body: {
      symptoms: 'Sudden facial droop and slurred speech cannot move right arm',
      severity: 4, // stroke is often painless
      duration: '45 minutes',
    }
  });
  console.log('Acute Stroke (severity 4/10): Urgency:', painlessStroke.data?.urgency, '| Label:', painlessStroke.data?.urgencyLabel, '| Rationale:', painlessStroke.data?.urgencyReason);

  // [TEST 8] AI-DRAFTED NOTES HALLUCINATION CHECK
  console.log('\n--- [TEST 8] AI-DRAFTED NOTES DEFAULT HALLUCINATIONS ---');
  if (docToken) {
    const emptySoap = await req('POST', '/consultations/draft-soap-note', {
      token: docToken,
      body: {
        patientName: 'Test Patient',
        reason: 'Routine checkup',
        symptoms: '',
        vitals: {}, // NO VITALS PROVIDED
        observations: '' // NO OBSERVATIONS ENTERED
      }
    });
    console.log('AI SOAP Draft with empty vitals/observations:');
    console.log('  Objective:', emptySoap.data?.draft?.objective);
    console.log('  Subjective:', emptySoap.data?.draft?.subjective);
    console.log('  Assessment:', emptySoap.data?.draft?.assessment);
    console.log('  Source:', emptySoap.data?.draft?.source);
  }

  // [TEST 9] DOCTOR VERIFICATION & BYPASS
  console.log('\n--- [TEST 9] DOCTOR VERIFICATION WORKFLOW ---');
  // Register new unverified doctor
  const docReg = await req('POST', '/auth/register', {
    body: {
      name: 'Dr. Unverified Test',
      email: `unverified.doc.${Date.now()}@meditalk.com`,
      password: 'password123',
      role: 'doctor',
      specialty: 'Neurology'
    }
  });
  console.log('Doctor registered:', docReg.data?.message);

  // Attempt login as unverified doctor
  const unverifiedLogin = await req('POST', '/auth/login', {
    body: {
      email: docReg.body?.email || `unverified.doc.${Date.now()}@meditalk.com`,
      password: 'password123',
      role: 'doctor'
    }
  });
  console.log('Unverified doctor login attempt -> HTTP', unverifiedLogin.status, unverifiedLogin.data?.message);

  console.log('\n====================================================');
  console.log('STAGE 2 AUDIT RUN COMPLETED.');
  console.log('====================================================');
}

runStage2Audit();
