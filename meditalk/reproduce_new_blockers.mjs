// Native fetch used
const BASE_URL = 'http://localhost:3001';

async function runReproduction() {
  console.log('=================================================================');
  console.log('REPRODUCING 4 NEW BLOCKERS AGAINST CURRENT BACKEND (PORT 3001)');
  console.log('=================================================================\n');

  // 1. Authenticate doctor & patient
  const docRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'doctor@meditalk.com', password: 'password', role: 'doctor' }),
  }).then(r => r.json());
  const doctorToken = docRes.token;
  const doctorId = docRes.user?.id || 'D-201';

  const patRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient@meditalk.com', password: 'password', role: 'patient' }),
  }).then(r => r.json());
  const patientToken = patRes.token;
  const patientId = patRes.user?.id || 'P-1001';

  // -------------------------------------------------------------------------
  // REPRODUCTION 1: Prescription issued without allergy & interaction check
  // -------------------------------------------------------------------------
  console.log('--- REPRODUCTION 1: Prescription Issued Without Safety Check ---');
  // Patient P-1001 has known Penicillin allergy and takes Metformin/Aspirin
  // Doctor creates prescription for Amoxicillin (contraindicated) + Warfarin (interacts with Aspirin)
  const rxRes = await fetch(`${BASE_URL}/api/prescriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${doctorToken}`
    },
    body: JSON.stringify({
      patientId: patientId,
      doctorId: doctorId,
      medications: [
        { medicine: 'Amoxicillin', dosage: '500mg', frequency: 'TDS', durationDays: 7 },
        { medicine: 'Warfarin', dosage: '5mg', frequency: 'OD', durationDays: 30 }
      ],
      additionalInstructions: 'Take with water'
    })
  });
  const rxData = await rxRes.json();
  console.log(`HTTP Status: ${rxRes.status}`);
  console.log(`Prescription Created:`, rxData.prescription ? { id: rxData.prescription.id, status: rxData.prescription.status } : rxData);
  if (rxRes.status === 201 && rxData.prescription) {
    console.log('🚨 VULNERABILITY CONFIRMED: Prescription with direct allergy clash and dangerous drug interaction was issued and activated without ANY safety check or override requirement!\n');
  } else {
    console.log('Blocked / Checked\n');
  }

  // -------------------------------------------------------------------------
  // REPRODUCTION 2: Fallback triage downgrades emergencies with low severity
  // -------------------------------------------------------------------------
  console.log('--- REPRODUCTION 2: Fallback Triage Downgrades Chest Pain / Stroke Signs ---');
  // Patient with crushing chest pain radiating to arm reports severity 2
  const chestPainRes = await fetch(`${BASE_URL}/api/triage/assess`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${patientToken}`
    },
    body: JSON.stringify({
      symptoms: 'crushing chest pain radiating to arm',
      duration: '1 hour',
      severity: 2, // low self-reported severity!
      accompanyingSymptoms: ['shortness of breath']
    })
  });
  const chestPainData = await chestPainRes.json();
  console.log(`Chest Pain Triage Result:`);
  console.log(`  Urgency: ${chestPainData.urgency}`);
  console.log(`  Urgency Label: ${chestPainData.urgencyLabel}`);
  console.log(`  Urgency Reason: ${chestPainData.urgencyReason}`);
  console.log(`  Emergency Message: ${chestPainData.emergencyMessage || 'NONE'}`);

  // Patient with stroke signs (facial droop, slurred speech) reports severity 3
  const strokeRes = await fetch(`${BASE_URL}/api/triage/assess`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${patientToken}`
    },
    body: JSON.stringify({
      symptoms: 'sudden facial droop and slurred speech',
      duration: '30 mins',
      severity: 3,
      accompanyingSymptoms: ['sudden numbness']
    })
  });
  const strokeData = await strokeRes.json();
  console.log(`Stroke Triage Result:`);
  console.log(`  Urgency: ${strokeData.urgency}`);
  console.log(`  Urgency Label: ${strokeData.urgencyLabel}`);
  console.log(`  Emergency Message: ${strokeData.emergencyMessage || 'NONE'}`);

  if (chestPainData.urgency !== 'emergency' || strokeData.urgency !== 'emergency' || !chestPainData.emergencyMessage) {
    console.log('🚨 VULNERABILITY CONFIRMED: Triage downgraded emergency symptoms because self-reported severity was low, and failed to provide an emergency message!\n');
  } else {
    console.log('Emergency Handled Correctly\n');
  }

  // -------------------------------------------------------------------------
  // REPRODUCTION 3: Fallback notes fabricate "vitals within normal limits" & missing draft disclaimer
  // -------------------------------------------------------------------------
  console.log('--- REPRODUCTION 3: Fallback Notes Fabricate Vitals & Lack Draft Notice ---');
  const soapRes = await fetch(`${BASE_URL}/api/consultations/draft-soap-note`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${doctorToken}`
    },
    body: JSON.stringify({
      patientName: 'Aarav Sharma',
      reason: 'Routine checkup',
      symptoms: 'Mild fatigue',
      vitals: {}, // NO VITALS RECORDED!
    })
  });
  const soapData = await soapRes.json();
  console.log(`SOAP Draft Result:`);
  console.log(`  Objective:`, soapData.draft?.objective);
  console.log(`  isDraft / Draft Notice:`, soapData.draft?.draftNotice || soapData.draft?.isDraft || 'NONE');
  if (soapData.draft?.objective?.includes('Within normal limits')) {
    console.log('🚨 VULNERABILITY CONFIRMED: Fallback note fabricated "Within normal limits" when zero vitals were recorded!\n');
  }
  if (!soapData.draft?.draftNotice && !soapData.draft?.isDraft) {
    console.log('🚨 VULNERABILITY CONFIRMED: AI-generated note is not clearly marked as a draft needing doctor review!\n');
  }

  // -------------------------------------------------------------------------
  // REPRODUCTION 4: Drug check fails on brand names & spelling variations
  // -------------------------------------------------------------------------
  console.log('--- REPRODUCTION 4: Drug Check Fails on Brand Names & Misspellings ---');
  // Patient P-1001 has Penicillin allergy
  // Test brand name Augmentin (amoxicillin) & Advil (ibuprofen) with Warfarin
  const brandRes = await fetch(`${BASE_URL}/api/prescriptions/check-safety`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${doctorToken}`
    },
    body: JSON.stringify({
      patientId: patientId,
      newMedications: ['Augmentin', 'Advil'] // Brand names for amoxicillin-clavulanate and ibuprofen
    })
  });
  const brandData = await brandRes.json();
  console.log(`Brand Name Check ('Augmentin', 'Advil') Alerts Count: ${brandData.alerts?.length || 0}`);
  console.log(`Alerts:`, brandData.alerts);

  // Test spelling variations: 'amoxycillin' (common variant), 'ibprofen'
  const typoRes = await fetch(`${BASE_URL}/api/prescriptions/check-safety`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${doctorToken}`
    },
    body: JSON.stringify({
      patientId: patientId,
      newMedications: ['amoxycillin', 'ibprofen']
    })
  });
  const typoData = await typoRes.json();
  console.log(`Typo Check ('amoxycillin', 'ibprofen') Alerts Count: ${typoData.alerts?.length || 0}`);
  console.log(`Alerts:`, typoData.alerts);

  if ((brandData.alerts?.length || 0) === 0 || (typoData.alerts?.length || 0) === 0) {
    console.log('🚨 VULNERABILITY CONFIRMED: Brand names (Augmentin, Advil) and common spelling variations (amoxycillin, ibprofen) bypassed the drug check completely!\n');
  }

  process.exit(0);
}

runReproduction().catch(err => {
  console.error('Fatal reproduction error:', err);
  process.exit(1);
});
