import { query } from './backend/database/db.js';
import { runDrugSafetyCheck } from './backend/data/drugInteractions.js';

console.log('====================================================');
console.log('      MEDITALK PHASE 9 FULL VERIFICATION SUITE      ');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

// ── TEST SUITE 1: DRUG SAFETY & ALLERGY ENGINE ──
console.log('--- TEST SUITE 1: Drug Interaction & Allergy Safety Engine ---');
const drugTests = [
  { name: 'Warfarin + Ibuprofen (CRITICAL)', newMeds: ['Ibuprofen'], currentMeds: ['Warfarin'], allergies: [], expectedAlert: true, severity: 'critical' },
  { name: 'Penicillin Allergy + Amoxicillin', newMeds: ['Amoxicillin'], currentMeds: [], allergies: ['Penicillin'], expectedAlert: true, severity: 'critical' },
  { name: 'Sildenafil + Nitroglycerin (CRITICAL)', newMeds: ['Sildenafil'], currentMeds: ['Nitroglycerin'], allergies: [], expectedAlert: true, severity: 'critical' },
  { name: 'Ciprofloxacin + Antacids (WARNING)', newMeds: ['Ciprofloxacin'], currentMeds: ['Antacids'], allergies: [], expectedAlert: true, severity: 'warning' },
  { name: 'Safe Combination (Paracetamol)', newMeds: ['Paracetamol'], currentMeds: [], allergies: [], expectedAlert: false },
  { name: 'NSAID Allergy + Aspirin (CRITICAL)', newMeds: ['Aspirin'], currentMeds: [], allergies: ['NSAID allergy'], expectedAlert: true, severity: 'critical' },
];

for (const t of drugTests) {
  const alerts = runDrugSafetyCheck({ newMeds: t.newMeds, currentMeds: t.currentMeds, allergies: t.allergies });
  if (t.expectedAlert) {
    assert(alerts.length > 0 && alerts.some(a => a.severity === t.severity), `${t.name} -> detected ${alerts[0]?.title}`);
  } else {
    assert(alerts.length === 0, `${t.name} -> no false alerts`);
  }
}

// ── TEST SUITE 2: API AUTHENTICATION & TOKENS ──
console.log('\n--- TEST SUITE 2: Authentication & Endpoints ---');
const API_BASE = 'http://localhost:3001/api';

const patLoginResp = await fetch(`${API_BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'patient@meditalk.com', password: 'password', role: 'patient' }),
});
const patAuth = await patLoginResp.json();
assert(patAuth.success && patAuth.token, 'Patient login successful with JWT');

const docLoginResp = await fetch(`${API_BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'doctor@meditalk.com', password: 'password', role: 'doctor' }),
});
const docAuth = await docLoginResp.json();
assert(docAuth.success && docAuth.token, 'Doctor login successful with JWT');

// ── TEST SUITE 3: SAFETY API ENDPOINT ──
console.log('\n--- TEST SUITE 3: POST /api/prescriptions/check-safety ---');
const safetyResp = await fetch(`${API_BASE}/prescriptions/check-safety`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${docAuth.token}`,
  },
  body: JSON.stringify({
    patientId: patAuth.user.id,
    newMedications: [{ medicine: 'Ibuprofen' }, { medicine: 'Warfarin' }],
  }),
});
const safetyData = await safetyResp.json();
assert(safetyResp.ok && safetyData.alerts.length > 0, `Safety check endpoint detected ${safetyData.alerts?.length} interaction(s)`);

// ── TEST SUITE 4: PRIOR RECORDS INGESTION & AI SYNTHESIS ──
console.log('\n--- TEST SUITE 4: Prior Medical Record AI Clinical Ingestion ---');
// 1. Upload external record
const uploadResp = await fetch(`${API_BASE}/medical-records`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${patAuth.token}`,
  },
  body: JSON.stringify({
    patientId: patAuth.user.id,
    type: 'Prior Clinic Record',
    description: 'Discharge Summary from City General Hospital: Patient diagnosed with Type 2 Diabetes and Hypertension. Prescribed Metformin 500mg and Amlodipine 5mg. Documented penicillin allergy with hives. Fasting Blood Sugar: 154 mg/dL, HbA1c: 8.2%, Creatinine: 1.1 mg/dL.',
    date: new Date().toISOString(),
    notes: 'Transferred care to MediTalk.',
  }),
});
const uploadData = await uploadResp.json();
assert(uploadResp.ok && uploadData.record?.id, `Uploaded prior medical record: ${uploadData.record?.id}`);

// 2. Synthesize AI summary
const synthResp = await fetch(`${API_BASE}/medical-records/ai-synthesize`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${patAuth.token}`,
  },
  body: JSON.stringify({
    recordId: uploadData.record.id,
    patientNotes: 'First time visiting MediTalk.',
  }),
});
const synthData = await synthResp.json();
assert(synthResp.ok && synthData.synthesis?.clinicalSummary, 'AI / Deterministic synthesis extracted clinical summary');
assert(synthData.synthesis?.extractedDiagnoses?.length > 0, `Extracted diagnoses: ${synthData.synthesis?.extractedDiagnoses?.join(', ')}`);
assert(synthData.synthesis?.extractedAllergies?.length > 0, `Extracted allergies: ${synthData.synthesis?.extractedAllergies?.map(a => a.allergen || a).join(', ')}`);
assert(synthData.synthesis?.extractedMedications?.length > 0, `Extracted medications: ${synthData.synthesis?.extractedMedications?.map(m => m.name || m).join(', ')}`);

// 3. Adopt AI records into patient chart
const adoptResp = await fetch(`${API_BASE}/patients/${patAuth.user.id}/adopt-ai-records`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${docAuth.token}`,
  },
  body: JSON.stringify({
    allergies: synthData.synthesis?.extractedAllergies?.map(a => typeof a === 'string' ? a : a.allergen) || [],
    medications: synthData.synthesis?.extractedMedications?.map(m => typeof m === 'string' ? m : m.name) || [],
  }),
});
const adoptData = await adoptResp.json();
assert(adoptResp.ok && adoptData.success, 'Adopted extracted allergies & medications into patient chart');

// ── TEST SUITE 5: E-PHARMACY ORDER LIFECYCLE ──
console.log('\n--- TEST SUITE 5: E-Pharmacy Order Lifecycle ---');
// 1. Create a test prescription for the patient
const rxId = 'RX-TEST-' + Date.now();
await query(
  `INSERT INTO prescriptions (id, patient_id, patient_name, doctor_id, doctor_name, date, medications, additional_instructions, status)
   VALUES ($1, $2, $3, $4, $5, NOW(), $6, 'Take after meals', 'active')`,
  [rxId, patAuth.user.id, patAuth.user.name, docAuth.user.id, docAuth.user.name, JSON.stringify([{ medicine: 'Paracetamol 500mg', dosage: '500mg', frequency: 'TDS' }])]
);

// 2. Place pharmacy fulfillment order
const orderResp = await fetch(`${API_BASE}/pharmacy/orders`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${patAuth.token}`,
  },
  body: JSON.stringify({
    prescriptionId: rxId,
    pharmacyName: 'MediTalk Central Dispensary',
    deliveryAddress: 'Flat 4B, Lotus Apartments, Mumbai',
    contactPhone: '+91 98765 43210',
    notes: 'Ring doorbell twice on arrival.',
  }),
});
const orderData = await orderResp.json();
assert(orderResp.ok && orderData.order?.id, `Created pharmacy order: ${orderData.order?.id} (Tracking: ${orderData.order?.trackingNumber})`);

// 3. Update order status transition (pending -> processing -> dispensed -> out_for_delivery -> delivered)
const statusUpdates = ['processing', 'dispensed', 'out_for_delivery', 'delivered'];
let allTransitionsPassed = true;
for (const st of statusUpdates) {
  const patchResp = await fetch(`${API_BASE}/pharmacy/orders/${orderData.order.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${docAuth.token}`,
    },
    body: JSON.stringify({ status: st }),
  });
  if (!patchResp.ok) allTransitionsPassed = false;
}
assert(allTransitionsPassed, 'Successfully transitioned order status through full fulfillment pipeline to "delivered"');

// ── TEST SUITE 6: MEDICATION ADHERENCE TIMETABLE & STREAK COUNTER ──
console.log('\n--- TEST SUITE 6: Daily Medication Adherence Timetable & Streak ---');
// 1. Explicitly create an adherence schedule
const createSchedResp = await fetch(`${API_BASE}/medications/adherence`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${patAuth.token}`,
  },
  body: JSON.stringify({
    patientId: patAuth.user.id,
    medications: [
      { name: 'Metformin 500mg', dosage: '500mg', frequency: 'BD', timingSlots: ['morning', 'evening'] },
    ],
  }),
});
const createdSchedData = await createSchedResp.json();
assert(createSchedResp.ok && createdSchedData.schedules?.length > 0, 'Explicit adherence schedule creation endpoint');

// 2. Fetch adherence schedules
const schedResp = await fetch(`${API_BASE}/medications/adherence?patientId=${patAuth.user.id}`, {
  headers: { 'Authorization': `Bearer ${patAuth.token}` },
});
const schedules = await schedResp.json();
assert(schedResp.ok && Array.isArray(schedules) && schedules.length > 0, `Adherence schedule list: ${schedules.length} active medication(s)`);

// 2. Log a dose as taken
if (schedules.length > 0) {
  const targetSchedule = schedules[0];
  const today = new Date().toISOString().split('T')[0];
  const slot = targetSchedule.timingSlots?.[0] || 'morning';

  const logResp = await fetch(`${API_BASE}/medications/adherence/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${patAuth.token}`,
    },
    body: JSON.stringify({
      scheduleId: targetSchedule.id,
      date: today,
      slot: slot,
    }),
  });
  const logData = await logResp.json();
  const streak = logData.streakCount ?? logData.streak ?? logData.schedule?.streakCount;
  assert(logResp.ok && logData.success && streak >= 1, `Logged adherence dose for ${today} (${slot}) -> Streak count: ${streak}`);
}

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log('====================================================\n');

process.exit(failCount > 0 ? 1 : 0);
