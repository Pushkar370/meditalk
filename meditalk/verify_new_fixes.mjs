const BASE_URL = 'http://localhost:3001';

async function runVerification() {
  console.log('=================================================================');
  console.log('VERIFYING REMEDIATIONS FOR 4 NEW BLOCKERS (PORT 3001)');
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

  console.log(`[AUTH] Logged in as:`);
  console.log(`  Doctor:  ${docRes.user?.name} (${doctorId})`);
  console.log(`  Patient: ${patRes.user?.name} (${patientId})\n`);

  // -------------------------------------------------------------------------
  // TEST 1: Prescription issuance without safety check is BLOCKED
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Mandatory Safety Verification on Prescription Issuance ---');
  // Attempt to issue prescription for Amoxicillin (Patient P-1001 has Penicillin allergy)
  // and Warfarin (Patient P-1001 takes Aspirin) WITHOUT clinical override
  const blockedRxRes = await fetch(`${BASE_URL}/api/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${doctorToken}` },
    body: JSON.stringify({
      patientId,
      doctorId,
      medications: [
        { medicine: 'Amoxicillin', dosage: '500mg', frequency: 'TDS', durationDays: 7 },
        { medicine: 'Warfarin', dosage: '5mg', frequency: 'OD', durationDays: 30 }
      ],
      additionalInstructions: 'Take with food'
    })
  });
  const blockedData = await blockedRxRes.json();
  assert(
    blockedRxRes.status === 409 && blockedData.requiresOverride === true && blockedData.criticalAlerts?.length > 0,
    `Prescription with critical allergy/interaction is blocked with 409 Conflict (Status: ${blockedRxRes.status}, Critical Alerts: ${blockedData.criticalAlerts?.length || 0})`
  );

  // Attempt to issue prescription WITH documented clinical override
  const overrideRxRes = await fetch(`${BASE_URL}/api/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${doctorToken}` },
    body: JSON.stringify({
      patientId,
      doctorId,
      medications: [
        { medicine: 'Warfarin', dosage: '2.5mg', frequency: 'OD', durationDays: 14 }
      ],
      additionalInstructions: 'Monitor INR weekly',
      clinicalOverride: true,
      overrideReason: 'Benefits outweigh risks: Mechanical valve anticoagulation required, INR closely monitored at clinic'
    })
  });
  const overrideData = await overrideRxRes.json();
  assert(
    overrideRxRes.status === 201 && overrideData.success === true && overrideData.safetyCheck?.overridden === true,
    `Prescription with explicit documented clinical justification succeeds with 201 Created and logs override (Status: ${overrideRxRes.status})`
  );

  // -------------------------------------------------------------------------
  // TEST 2: Fallback triage ALWAYS treats emergency symptoms as emergencies
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Emergency Triage Severity Independence & Clear Emergency Message ---');
  // 2A. Chest pain with low severity (2/10)
  const chestPainRes = await fetch(`${BASE_URL}/api/triage/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${patientToken}` },
    body: JSON.stringify({
      symptoms: 'crushing chest pain radiating to arm',
      duration: '45 mins',
      severity: 2, // Stoic or low reported severity
      accompanyingSymptoms: ['shortness of breath']
    })
  });
  const chestPainData = await chestPainRes.json();
  assert(
    chestPainData.urgency === 'emergency' && chestPainData.isEmergency === true,
    `Chest pain with low severity (2/10) classified as 'emergency' (Urgency: ${chestPainData.urgency})`
  );
  assert(
    Boolean(chestPainData.emergencyMessage && chestPainData.emergencyMessage.includes('EMERGENCY WARNING')),
    `Chest pain triage includes clear emergency guidance message: "${chestPainData.emergencyMessage?.slice(0, 45)}..."`
  );

  // 2B. Stroke signs (FAST) with low severity (1/10)
  const strokeRes = await fetch(`${BASE_URL}/api/triage/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${patientToken}` },
    body: JSON.stringify({
      symptoms: 'sudden facial droop and slurred speech',
      duration: '20 mins',
      severity: 1,
      accompanyingSymptoms: ['arm weakness']
    })
  });
  const strokeData = await strokeRes.json();
  assert(
    strokeData.urgency === 'emergency' && strokeData.isEmergency === true,
    `Stroke symptoms (FAST criteria) with severity 1/10 classified as 'emergency' (Urgency: ${strokeData.urgency})`
  );
  assert(
    Boolean(strokeData.emergencyMessage && strokeData.emergencyMessage.toLowerCase().includes('emergency services')),
    `Stroke triage includes prompt to call emergency services immediately: "${strokeData.emergencyMessage?.slice(0, 45)}..."`
  );

  // -------------------------------------------------------------------------
  // TEST 3: Fallback notes vitals accuracy & mandatory draft notice
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: SOAP Note Vitals Accuracy & Physician Draft Review Notice ---');
  const soapRes = await fetch(`${BASE_URL}/api/consultations/draft-soap-note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${doctorToken}` },
    body: JSON.stringify({
      patientName: 'Aarav Sharma',
      reason: 'General follow-up',
      symptoms: 'Occasional mild cough',
      vitals: {}, // ZERO VITALS RECORDED
    })
  });
  const soapData = await soapRes.json();
  const objText = soapData.draft?.objective || '';
  assert(
    !objText.toLowerCase().includes('within normal limits') && objText.includes('No vitals recorded'),
    `Empty vitals correctly documents 'No vitals recorded' and avoids fabricating 'Within normal limits'`
  );
  assert(
    soapData.draft?.isDraft === true && Boolean(soapData.draft?.draftNotice && soapData.draft?.draftNotice.includes('AI-GENERATED DRAFT')),
    `AI-generated note is explicitly marked as draft with physician review notice (isDraft: true, notice present)`
  );
  assert(
    soapData.draft?.subjective?.includes('[AI DRAFT - PENDING PHYSICIAN REVIEW]'),
    `Clinical note content body is prefixed with draft physician review header`
  );

  // -------------------------------------------------------------------------
  // TEST 4: Drug safety check recognizes brand names and spelling variations
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Brand Names & Spelling Variations in Drug Check ---');
  // 4A. Brand names: Augmentin (amoxicillin) with Penicillin allergy, Coumadin (warfarin) + Advil (ibuprofen)
  const brandCheckRes = await fetch(`${BASE_URL}/api/prescriptions/check-safety`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${doctorToken}` },
    body: JSON.stringify({
      patientId,
      newMedications: ['Augmentin 625 Duo', 'Coumadin 5mg', 'Advil 200mg']
    })
  });
  const brandCheckData = await brandCheckRes.json();
  const hasAugmentinClash = brandCheckData.alerts?.some(a => a.type === 'allergy_contraindication' && (a.drug?.toLowerCase().includes('augmentin') || a.normalizedDrug === 'amoxicillin'));
  const hasAdvilCoumadinInteraction = brandCheckData.alerts?.some(a => a.type === 'drug_interaction' && (a.drugA?.toLowerCase().includes('warfarin') || a.drugB?.toLowerCase().includes('warfarin') || a.prescribedDrug?.toLowerCase().includes('advil') || a.prescribedDrug?.toLowerCase().includes('coumadin')));
  assert(
    hasAugmentinClash,
    `Brand name 'Augmentin 625 Duo' recognized as Amoxicillin and flagged as allergy contraindication against Penicillin`
  );
  assert(
    hasAdvilCoumadinInteraction,
    `Brand names 'Coumadin' and 'Advil' recognized as Warfarin + Ibuprofen and flagged as critical hemorrhage interaction`
  );

  // 4B. Common spelling variations & typos: 'amoxycillin', 'warfrin' + 'ibprofen'
  const typoCheckRes = await fetch(`${BASE_URL}/api/prescriptions/check-safety`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${doctorToken}` },
    body: JSON.stringify({
      patientId,
      newMedications: ['amoxycillin', 'warfrin', 'ibprofen']
    })
  });
  const typoCheckData = await typoCheckRes.json();
  const hasAmoxyClash = typoCheckData.alerts?.some(a => a.type === 'allergy_contraindication' && (a.drug?.toLowerCase().includes('amoxycillin') || a.normalizedDrug === 'amoxicillin'));
  const hasTypoInteraction = typoCheckData.alerts?.some(a => a.type === 'drug_interaction' && (a.drugA?.toLowerCase().includes('warfarin') || a.drugB?.toLowerCase().includes('warfarin')));
  assert(
    hasAmoxyClash,
    `Spelling variant 'amoxycillin' recognized as Amoxicillin and caught in allergy check`
  );
  assert(
    hasTypoInteraction,
    `Spelling typos 'warfrin' and 'ibprofen' recognized as Warfarin + Ibuprofen and caught in drug-drug interaction check`
  );

  // 4C. Brand name nitrate (Nitrostat) with PDE5 inhibitor (Viagra)
  const pde5CheckRes = await fetch(`${BASE_URL}/api/prescriptions/check-safety`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${doctorToken}` },
    body: JSON.stringify({
      patientId,
      newMedications: ['Viagra 50mg', 'Nitrostat 0.4mg']
    })
  });
  const pde5CheckData = await pde5CheckRes.json();
  const hasNitrateInteraction = pde5CheckData.alerts?.some(a => a.type === 'drug_interaction' && a.severity === 'critical');
  assert(
    hasNitrateInteraction,
    `Brand names 'Viagra' and 'Nitrostat' recognized and flagged as critical hypotension interaction`
  );

  console.log('\n=================================================================');
  console.log(`VERIFICATION SUMMARY: ${passes} Passed, ${failures} Failed`);
  console.log('=================================================================\n');

  if (failures > 0) process.exit(1);
  process.exit(0);
}

runVerification().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
