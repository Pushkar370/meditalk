import { Router } from 'express';
import { query } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pushNotification } from '../server.js';
import { enqueueEmail } from '../services/jobQueue.js';

import { runDrugSafetyCheck } from '../data/drugInteractions.js';


const router = Router();

function safeJson(val, fallback) {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function parsePrescription(row) {
  if (!row) return null;
  return {
    ...row, patientId: row.patient_id, patientName: row.patient_name,
    doctorId: row.doctor_id, doctorName: row.doctor_name,
    additionalInstructions: row.additional_instructions,
    medications: safeJson(row.medications, []),
  };
}

// GET /api/prescriptions — authenticated users; patients see only their own
router.get('/prescriptions', requireAuth, async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { patientId, doctorId } = req.query;

    let sql = 'SELECT * FROM prescriptions';
    const conditions = []; const params = []; let idx = 1;

    if (role === 'patient') {
      // Patients can only see their own prescriptions
      conditions.push('patient_id = $' + idx++);
      params.push(callerId);
    } else {
      if (patientId) { conditions.push('patient_id = $' + idx++); params.push(patientId); }
      if (doctorId) { conditions.push('doctor_id = $' + idx++); params.push(doctorId); }
    }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY date DESC';
    const { rows } = await query(sql, params);
    res.json(rows.map(parsePrescription));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch prescriptions' }); }
});

// GET /api/prescriptions/:id — authenticated; ownership checked below if needed
router.get('/prescriptions/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM prescriptions WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Prescription not found' });
    const rx = parsePrescription(rows[0]);
    const { role, id: callerId } = req.user;
    if (role === 'patient' && rx.patientId !== callerId) {
      return res.status(403).json({ error: 'Forbidden — cannot access another patient\'s prescription' });
    }
    res.json(rx);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch prescription' }); }
});

// POST /api/prescriptions — doctors only
router.post('/prescriptions', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const { patientId, patientName, doctorId, doctorName, medications = [], additionalInstructions = '', status = 'active' } = req.body;
    if (!patientId || !doctorId) return res.status(400).json({ error: 'patientId and doctorId are required' });
    let pName = patientName;
    let dName = doctorName;
    if (!pName) { const { rows } = await query('SELECT name FROM patients WHERE id = $1', [patientId]); pName = rows[0]?.name; }
    if (!dName) { const { rows } = await query('SELECT name FROM doctors WHERE id = $1', [doctorId]); dName = rows[0]?.name; }
    const id = 'RX-' + Date.now();
    await query(
      'INSERT INTO prescriptions (id, patient_id, patient_name, doctor_id, doctor_name, date, medications, additional_instructions, status) VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7,$8)',
      [id, patientId, pName, doctorId, dName, JSON.stringify(medications), additionalInstructions, status]
    );
    try {
      const { rows: uRows } = await query('SELECT id FROM users WHERE patient_id = $1', [patientId]);
      const patientUserId = uRows[0]?.id;
      if (patientUserId) {
        const rxNotifId = 'N-' + (Date.now() + 1);
        await query(
          `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'prescription_available','New Prescription','A new prescription has been issued for you.',false)`,
          [rxNotifId, patientUserId]
        );
        try { pushNotification(patientUserId, { id: rxNotifId, type: 'prescription_available', title: 'New Prescription', message: 'A new prescription has been issued for you.' }); } catch (_) {}
      }
    } catch (_) {}
    const { rows } = await query('SELECT * FROM prescriptions WHERE id = $1', [id]);
    res.status(201).json({ success: true, prescription: parsePrescription(rows[0]) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create prescription' }); }
});

function parseConsultation(row) {
  if (!row) return null;
  return {
    ...row, patientId: row.patient_id, doctorId: row.doctor_id,
    diagnosisCode: row.diagnosis_code, labResults: row.lab_results,
    treatmentPlan: row.treatment_plan, followUpDate: row.follow_up_date,
    followUpInstructions: row.follow_up_instructions,
    vitals: safeJson(row.vitals, {}),
  };
}

// GET /api/consultations — patients see own, doctors see their patients', admins see all
router.get('/consultations', requireAuth, async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { patientId, doctorId } = req.query;

    let sql = 'SELECT * FROM consultations';
    const conditions = []; const params = []; let idx = 1;

    if (role === 'patient') {
      conditions.push('patient_id = $' + idx++);
      params.push(callerId);
    } else {
      if (patientId) { conditions.push('patient_id = $' + idx++); params.push(patientId); }
      if (doctorId) { conditions.push('doctor_id = $' + idx++); params.push(doctorId); }
    }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY date DESC';
    const { rows } = await query(sql, params);
    res.json(rows.map(parseConsultation));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch consultations' }); }
});

// POST /api/consultations — doctors only
router.post('/consultations', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const { patientId, doctorId, reason, symptoms, vitals = {}, diagnosis, diagnosisCode, observations, labResults, treatmentPlan, followUpDate, followUpInstructions, status = 'completed', appointmentId } = req.body;
    if (!patientId || !doctorId) return res.status(400).json({ error: 'patientId and doctorId are required' });
    const id = 'C-' + Date.now();
    await query(
      'INSERT INTO consultations (id, patient_id, doctor_id, date, reason, symptoms, vitals, diagnosis, diagnosis_code, observations, lab_results, treatment_plan, follow_up_date, follow_up_instructions, status) VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
      [id, patientId, doctorId, reason, symptoms, JSON.stringify(vitals), diagnosis, diagnosisCode, observations, labResults, treatmentPlan, followUpDate, followUpInstructions, status]
    );
    try {
      const { rows: drRows } = await query('SELECT name FROM doctors WHERE id = $1', [doctorId]);
      const drName = drRows[0]?.name || doctorId;
      const mrId = 'MR-' + (Date.now()+1);
      await query(
        'INSERT INTO medical_records (id, patient_id, type, date, doctor, description, status, details) VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7)',
        [mrId, patientId, 'Consultation', drName, diagnosis || reason || 'Consultation', 'completed',
         JSON.stringify({ symptoms: symptoms ? symptoms.split(',').map(s => s.trim()) : [], diagnosis, treatment: treatmentPlan, notes: observations })]
      );
      const { rows: uRows } = await query('SELECT id FROM users WHERE patient_id = $1', [patientId]);
      const patientUserId = uRows[0]?.id;
      if (patientUserId) {
        const cNotifId = 'N-' + Date.now();
        const cMsg = `Your consultation with ${drName} has been documented in your health records.`;
        await query(
          `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'appointment_confirmed','Consultation Completed',$3,false)`,
          [cNotifId, patientUserId, cMsg]
        );
        try { pushNotification(patientUserId, { id: cNotifId, type: 'appointment_confirmed', title: 'Consultation Completed', message: cMsg }); } catch (_) {}
      }
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, $2, 'Doctor', 'Completed clinical consultation', 'Consultation', $3, 'success')`,
        [doctorId, drName, id]
      );
    } catch (_) {}
    if (appointmentId) {
      try { await query("UPDATE appointments SET status = 'completed' WHERE id = $1", [appointmentId]); } catch (_) {}
    }

    // Send consultation summary email to patient
    try {
      const { rows: ptRows } = await query('SELECT name, email FROM patients WHERE id = $1', [patientId]);
      const pt = ptRows[0];
      if (pt?.email) {
        const { rows: drRows2 } = await query('SELECT name FROM doctors WHERE id = $1', [doctorId]);
        const drName2 = drRows2[0]?.name || 'Doctor';
        // Get prescribed medications from the prescriptions table if linked by appointmentId
        let medications = [];
        if (appointmentId) {
          const { rows: rxRows } = await query(
            'SELECT medications FROM prescriptions WHERE patient_id=$1 AND doctor_id=$2 ORDER BY date DESC LIMIT 1',
            [patientId, doctorId]
          );
          if (rxRows[0]) {
            try { medications = JSON.parse(rxRows[0].medications); } catch (_) {}
          }
        }
        await enqueueEmail('send-consultation-summary', {
          patientEmail: pt.email,
          patientName: pt.name,
          doctorName: drName2,
          date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          diagnosis,
          treatmentPlan,
          medications,
          followUpDate,
          followUpInstructions,
        });
      }
    } catch (emailErr) {
      console.warn('[Prescriptions] Consultation summary email failed (non-fatal):', emailErr.message);
    }

    // CW-3: Follow-Up Appointment Automation — create pending suggestion
    if (followUpDate) {
      try {
        const { rows: drRows3 } = await query('SELECT name FROM doctors WHERE id = $1', [doctorId]);
        const drName3 = drRows3[0]?.name || doctorId;
        const fugId = 'FUG-' + Date.now();
        await query(
          `INSERT INTO follow_up_suggestions (id, consultation_id, patient_id, doctor_id, doctor_name, suggested_date, reason, instructions, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())`,
          [fugId, id, patientId, doctorId, drName3, followUpDate, diagnosis || reason || 'Follow-up visit', followUpInstructions || null]
        );
        const { rows: uRows2 } = await query('SELECT id FROM users WHERE patient_id = $1', [patientId]);
        const pUserId2 = uRows2[0]?.id;
        if (pUserId2) {
          const fnId = 'N-' + (Date.now() + 2);
          const fnMsg = `Dr. ${drName3} recommended a follow-up consultation on ${followUpDate}. One-click to book in your dashboard.`;
          await query(
            `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'appointment_confirmed','Follow-up Recommended',$3,false)`,
            [fnId, pUserId2, fnMsg]
          );
          try { pushNotification(pUserId2, { id: fnId, type: 'appointment_confirmed', title: 'Follow-up Recommended', message: fnMsg }); } catch (_) {}
        }
      } catch (fugErr) {
        console.warn('[Consultations] Follow-up suggestion creation failed (non-fatal):', fugErr.message);
      }
    }

    const { rows } = await query('SELECT * FROM consultations WHERE id = $1', [id]);
    res.status(201).json({ success: true, consultation: parseConsultation(rows[0]) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create consultation' }); }
});

function parseMedicalRecord(row) {
  if (!row) return null;
  return {
    ...row,
    patientId: row.patient_id,
    aiSummary: row.ai_summary || null,
    extractedDiagnoses: safeJson(row.extracted_diagnoses, []),
    extractedAllergies: safeJson(row.extracted_allergies, []),
    extractedMedications: safeJson(row.extracted_medications, []),
    extractedBiomarkers: safeJson(row.extracted_biomarkers, []),
    clinicalRisks: safeJson(row.clinical_risks, []),
    isExternalClinic: Boolean(row.is_external_clinic),
    externalFacilityName: row.external_facility_name || null,
    aiProcessedAt: row.ai_processed_at || null,
    details: safeJson(row.details, {}),
  };
}

// GET /api/medical-records — patients see own, doctors and admins see all (with filter)
router.get('/medical-records', requireAuth, async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { patientId, type } = req.query;

    let sql = 'SELECT * FROM medical_records';
    const conditions = []; const params = []; let idx = 1;

    if (role === 'patient') {
      conditions.push('patient_id = $' + idx++);
      params.push(callerId);
    } else {
      if (patientId) { conditions.push('patient_id = $' + idx++); params.push(patientId); }
    }

    if (type) { conditions.push('type = $' + idx++); params.push(type); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY date DESC';
    const { rows } = await query(sql, params);
    res.json(rows.map(parseMedicalRecord));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch medical records' }); }
});

// POST /api/medical-records — patients (own) and doctors can upload records
router.post('/medical-records', requireAuth, async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const {
      patientId, type, description, doctor: doctorName, date,
      fileData, fileName, fileType, fileSize, notes,
    } = req.body;

    // Patients can only upload for themselves
    const targetPatientId = role === 'patient' ? callerId : patientId;
    if (!targetPatientId) return res.status(400).json({ error: 'patientId is required' });
    if (!type) return res.status(400).json({ error: 'type is required' });

    const id = 'MR-' + Date.now();
    const details = JSON.stringify({
      notes: notes || '',
      fileData: fileData || null,
      fileName: fileName || null,
      fileType: fileType || null,
      fileSize: fileSize || null,
      uploadedBy: callerId,
      uploadedRole: role,
    });

    // Resolve doctor name for the record
    let resolvedDoctor = doctorName || null;
    if (!resolvedDoctor && role === 'doctor') {
      try {
        const { rows } = await query('SELECT name FROM doctors WHERE id = $1', [callerId]);
        resolvedDoctor = rows[0]?.name || callerId;
      } catch (_) {}
    }

    await query(
      `INSERT INTO medical_records (id, patient_id, type, description, doctor, details, date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, targetPatientId, type, description || fileName || type, resolvedDoctor || 'Patient Upload',
       details, date ? new Date(date).toISOString() : new Date().toISOString(), 'final']
    );

    // Notify the patient about new record
    try {
      const { rows: uRows } = await query('SELECT id FROM users WHERE patient_id = $1', [targetPatientId]);
      const patientUserId = uRows[0]?.id;
      if (patientUserId) {
        await query(
          `INSERT INTO notifications (id, user_id, type, title, message, read)
           VALUES ($1, $2, 'record_added', 'Health Record Added', $3, false)`,
          ['N-' + Date.now(), patientUserId, `A new ${type} record has been added to your health profile.`]
        );
      }
    } catch (_) {}

    // Audit log
    try {
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, $2, $3, 'Uploaded medical record', 'MedicalRecord', $4, 'success')`,
        [callerId, resolvedDoctor || callerId, role, id]
      );
    } catch (_) {}

    const { rows } = await query('SELECT * FROM medical_records WHERE id = $1', [id]);
    res.status(201).json({ success: true, record: parseMedicalRecord(rows[0]) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to save medical record' }); }
});


// ─── Phase 9: Drug-Drug & Allergy Safety Check ───────────────────────────────
// POST /api/prescriptions/check-safety
router.post('/prescriptions/check-safety', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const { patientId, newMedications = [] } = req.body;
    if (!patientId) return res.status(400).json({ error: 'patientId is required' });

    // Fetch patient allergies & current medications
    const { rows: patRows } = await query('SELECT allergies, current_medications FROM patients WHERE id = $1', [patientId]);
    if (!patRows[0]) return res.status(404).json({ error: 'Patient not found' });

    const pat = patRows[0];
    const allergies = safeJson(pat.allergies, []);
    const currentMeds = safeJson(pat.current_medications, []);

    // Also pull AI-extracted medications from recent external records
    const { rows: mrRows } = await query(
      `SELECT extracted_medications FROM medical_records WHERE patient_id = $1 AND is_external_clinic = TRUE AND ai_processed_at IS NOT NULL ORDER BY date DESC LIMIT 5`,
      [patientId]
    );
    const extractedMeds = mrRows.flatMap(r => {
      const parsed = safeJson(r.extracted_medications, []);
      return parsed.map(m => (typeof m === 'string' ? m : m?.name || ''));
    }).filter(Boolean);

    const allCurrentMeds = [...new Set([...currentMeds, ...extractedMeds])];
    const newMedNames = newMedications.map(m => (typeof m === 'string' ? m : m?.medicine || ''));

    const alerts = runDrugSafetyCheck({
      newMeds: newMedNames,
      currentMeds: allCurrentMeds,
      allergies,
    });

    res.json({ alerts, checked: true, newMedicationsCount: newMedNames.length });
  } catch (err) {
    console.error('[Phase9] Drug safety check error:', err);
    res.status(500).json({ error: 'Drug safety check failed', alerts: [] });
  }
});

// ─── Phase 9: Gemini AI Prior Records Clinical Synthesis ──────────────────────
// Deterministic fallback medical keyword extractor
function runKeywordMedicalExtraction(text) {
  if (!text || text.length < 10) return null;
  const lower = text.toLowerCase();

  const diagnosisKeywords = [
    'diabetes', 'hypertension', 'asthma', 'copd', 'chronic kidney disease', 'ckd',
    'heart failure', 'coronary artery disease', 'cad', 'stroke', 'epilepsy', 'seizure',
    'hypothyroidism', 'hyperthyroidism', 'anemia', 'tuberculosis', 'hiv', 'hepatitis',
    'cirrhosis', 'cancer', 'carcinoma', 'malignancy', 'depression', 'anxiety',
    'schizophrenia', 'bipolar', 'osteoporosis', 'rheumatoid arthritis', 'gout',
    'obesity', 'hyperlipidemia', 'dyslipidemia',
  ];
  const allergyKeywords = [
    'penicillin allergy', 'amoxicillin allergy', 'sulfa allergy', 'nsaid allergy',
    'aspirin allergy', 'contrast allergy', 'iodine allergy', 'latex allergy',
    'peanut allergy', 'cephalosporin allergy', 'allergic to penicillin',
    'allergic to sulfa', 'allergic to aspirin', 'drug allergy',
  ];
  const medicationKeywords = [
    'metformin', 'insulin', 'amlodipine', 'atenolol', 'lisinopril', 'enalapril',
    'ramipril', 'atorvastatin', 'simvastatin', 'aspirin', 'clopidogrel', 'warfarin',
    'prednisolone', 'levothyroxine', 'omeprazole', 'pantoprazole', 'salbutamol',
    'furosemide', 'spironolactone', 'losartan', 'metoprolol',
  ];
  const biomarkerPatterns = [
    { regex: /hba1c\s*[:\-]?\s*([\d.]+\s*%?)/i, test: 'HbA1c', ref: '< 5.7%', abnormalIf: v => parseFloat(v) > 6.5 },
    { regex: /blood\s*sugar\s*[:\-]?\s*([\d.]+)/i, test: 'Blood Sugar', ref: '70–100 mg/dL (fasting)', abnormalIf: v => parseFloat(v) > 126 },
    { regex: /creatinine\s*[:\-]?\s*([\d.]+)/i, test: 'Creatinine', ref: '0.6–1.2 mg/dL', abnormalIf: v => parseFloat(v) > 1.4 },
    { regex: /hemoglobin\s*[:\-]?\s*([\d.]+)/i, test: 'Hemoglobin', ref: '12–17 g/dL', abnormalIf: v => parseFloat(v) < 11 },
    { regex: /cholesterol\s*[:\-]?\s*([\d.]+)/i, test: 'Total Cholesterol', ref: '< 200 mg/dL', abnormalIf: v => parseFloat(v) > 239 },
  ];

  const extractedDiagnoses = diagnosisKeywords.filter(kw => lower.includes(kw));
  const extractedAllergies = allergyKeywords
    .filter(kw => lower.includes(kw))
    .map(kw => ({ allergen: kw.replace(' allergy', '').replace('allergic to ', ''), reaction: 'Documented in record', severity: 'moderate' }));
  const extractedMedications = medicationKeywords
    .filter(kw => lower.includes(kw))
    .map(kw => ({ name: kw.charAt(0).toUpperCase() + kw.slice(1), dosage: 'See record', frequency: 'See record', status: 'historical' }));
  const extractedBiomarkers = [];
  for (const bp of biomarkerPatterns) {
    const match = text.match(bp.regex);
    if (match) {
      const val = match[1];
      extractedBiomarkers.push({ test: bp.test, value: val, reference: bp.ref, isAbnormal: bp.abnormalIf(val) });
    }
  }

  const clinicalRisks = [];
  if (extractedDiagnoses.length > 2) clinicalRisks.push('Multiple chronic conditions requiring careful medication reconciliation');
  if (extractedBiomarkers.some(b => b.isAbnormal)) clinicalRisks.push('Abnormal biomarker values present — clinical review required');
  if (extractedAllergies.length > 0) clinicalRisks.push('Documented drug allergies — prescribe with caution');

  const clinicalSummary = extractedDiagnoses.length > 0
    ? `Patient's prior record indicates ${extractedDiagnoses.slice(0, 3).join(', ')}. ${extractedMedications.length > 0 ? `Previously on: ${extractedMedications.slice(0, 3).map(m => m.name).join(', ')}.` : ''} ${extractedAllergies.length > 0 ? `Known allergies: ${extractedAllergies.map(a => a.allergen).join(', ')}.` : ''} Clinical review recommended.`
    : 'Prior record uploaded. Automated clinical keyword extraction found limited structured data. Manual physician review of the attached document is recommended.';

  return {
    clinicalSummary,
    externalFacility: null,
    extractedDiagnoses,
    extractedAllergies,
    extractedMedications,
    extractedBiomarkers,
    clinicalRisks,
    source: 'keyword_fallback',
  };
}

async function callGeminiMedicalAnalysis(fileData, fileType, patientNotes) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;

  const modelsToTry = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];

  // Build parts: if image/pdf send inline, else text-only prompt
  const isImage = fileType && (fileType.startsWith('image/') || fileType === 'application/pdf');
  const textPrompt = `You are MediTalk Clinical Records Analyst. A patient has uploaded a prior clinic or hospital document. 
Extract all available clinical information and return ONLY valid JSON with this exact schema:
{
  "clinicalSummary": "3-4 sentence clinical overview for the consulting doctor — key diagnoses, prior treatments, critical risks",
  "externalFacility": "Hospital or clinic name if visible in document, else null",
  "extractedDiagnoses": ["Diagnosis 1", "Diagnosis 2"],
  "extractedAllergies": [{"allergen": "Penicillin", "reaction": "Anaphylaxis", "severity": "high"}],
  "extractedMedications": [{"name": "Metformin", "dosage": "500mg", "frequency": "BD", "status": "active"}],
  "extractedBiomarkers": [{"test": "HbA1c", "value": "8.4%", "reference": "< 5.7%", "isAbnormal": true}],
  "clinicalRisks": ["Risk 1", "Risk 2"]
}
${patientNotes ? `Patient's additional context: "${patientNotes}"` : ''}
If the document is not medical in nature, return clinicalSummary explaining that and empty arrays for all other fields.`;

  for (const model of modelsToTry) {
    try {
      const parts = [];
      if (isImage && fileData) {
        // Send base64 inline (strip the data:mime;base64, prefix)
        const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
        const mimeType = fileType === 'application/pdf' ? 'application/pdf' : fileType;
        parts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
      }
      parts.push({ text: textPrompt });

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        }),
      });

      if (!response.ok) {
        console.warn(`[GeminiMedical-${model}] HTTP ${response.status}: ${await response.text()}`);
        continue;
      }

      const data = await response.json();
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) continue;

      const parsed = JSON.parse(candidateText);
      return { ...parsed, source: 'gemini_ai' };
    } catch (err) {
      console.warn(`[GeminiMedical-${model}] Error:`, err.message);
    }
  }
  return null;
}

// POST /api/medical-records/ai-synthesize
router.post('/medical-records/ai-synthesize', requireAuth, async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { recordId, patientNotes } = req.body;
    if (!recordId) return res.status(400).json({ error: 'recordId is required' });

    // Fetch the record
    const { rows } = await query('SELECT * FROM medical_records WHERE id = $1', [recordId]);
    if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
    const record = rows[0];

    // Access control: patient can only synthesize own records, doctors any
    if (role === 'patient' && record.patient_id !== callerId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const details = safeJson(record.details, {});
    const fileData = details.fileData || null;
    const fileType = details.fileType || null;

    // Size guard: cap at ~8MB base64 for Gemini inline
    const FILE_SIZE_LIMIT = 8 * 1024 * 1024;
    if (fileData && fileData.length > FILE_SIZE_LIMIT) {
      // Fall back to keyword extraction on large files
      const rawText = record.description || '';
      const fallback = runKeywordMedicalExtraction(rawText);
      if (fallback) {
        await query(
          `UPDATE medical_records SET ai_summary=$1, extracted_diagnoses=$2, extracted_allergies=$3, extracted_medications=$4, extracted_biomarkers=$5, clinical_risks=$6, is_external_clinic=$7, ai_processed_at=NOW() WHERE id=$8`,
          [fallback.clinicalSummary, JSON.stringify(fallback.extractedDiagnoses), JSON.stringify(fallback.extractedAllergies), JSON.stringify(fallback.extractedMedications), JSON.stringify(fallback.extractedBiomarkers), JSON.stringify(fallback.clinicalRisks), true, recordId]
        );
        return res.json({ success: true, synthesis: fallback, source: 'keyword_fallback', warning: 'File too large for AI analysis; keyword extraction used.' });
      }
    }

    // Try Gemini first
    let synthesis = await callGeminiMedicalAnalysis(fileData, fileType, patientNotes);

    // Fallback to keyword extraction
    if (!synthesis) {
      const rawText = `${record.description || ''} ${record.type || ''} ${details.notes || ''}`;
      synthesis = runKeywordMedicalExtraction(rawText);
    }

    if (!synthesis) {
      return res.status(422).json({ error: 'Unable to analyze this document. Please ensure it contains readable text or medical content.' });
    }

    // Persist AI extraction results
    await query(
      `UPDATE medical_records 
       SET ai_summary=$1, extracted_diagnoses=$2, extracted_allergies=$3, extracted_medications=$4,
           extracted_biomarkers=$5, clinical_risks=$6, is_external_clinic=$7, external_facility_name=$8, ai_processed_at=NOW()
       WHERE id=$9`,
      [
        synthesis.clinicalSummary,
        JSON.stringify(synthesis.extractedDiagnoses || []),
        JSON.stringify(synthesis.extractedAllergies || []),
        JSON.stringify(synthesis.extractedMedications || []),
        JSON.stringify(synthesis.extractedBiomarkers || []),
        JSON.stringify(synthesis.clinicalRisks || []),
        true,
        synthesis.externalFacility || null,
        recordId,
      ]
    );

    // Audit log
    try {
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, $2, $3, 'AI clinical synthesis of prior medical record', 'MedicalRecord', $4, 'success')`,
        [callerId, req.user.name || callerId, role, recordId]
      );
    } catch (_) {}

    const { rows: updated } = await query('SELECT * FROM medical_records WHERE id = $1', [recordId]);
    res.json({ success: true, synthesis, record: parseMedicalRecord(updated[0]) });
  } catch (err) {
    console.error('[Phase9] AI synthesis error:', err);
    res.status(500).json({ error: 'AI synthesis failed' });
  }
});

// ─── CW-3: Follow-Up Appointment Suggestions ───────────────────────────────

// GET /api/follow-ups/patient/:patientId — fetch pending follow-up suggestions for patient
router.get('/follow-ups/patient/:patientId', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { rows } = await query(
      `SELECT f.*, d.specialty
       FROM follow_up_suggestions f
       LEFT JOIN doctors d ON f.doctor_id = d.id
       WHERE f.patient_id = $1 AND f.status = 'pending'
       ORDER BY f.suggested_date ASC`,
      [patientId]
    );
    res.json({ success: true, suggestions: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch follow-up suggestions' });
  }
});

// POST /api/follow-ups/:id/confirm — 1-click book suggested follow-up appointment
router.post('/follow-ups/:id/confirm', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { time, type = 'video' } = req.body;
    if (!time) return res.status(400).json({ error: 'Time slot is required' });

    const { rows: sRows } = await query('SELECT * FROM follow_up_suggestions WHERE id = $1', [id]);
    if (!sRows[0]) return res.status(404).json({ error: 'Follow-up suggestion not found' });
    const sug = sRows[0];

    const { role, id: callerId, userId } = req.user;
    if (role === 'patient' && sug.patient_id !== callerId && sug.patient_id !== userId) {
      return res.status(403).json({ error: 'You may only confirm follow-ups for yourself' });
    }
    if (sug.status === 'booked') {
      return res.status(400).json({ error: 'Follow-up appointment has already been booked' });
    }

    // Fetch patient name and doctor specialty
    const { rows: pRows } = await query('SELECT name, email FROM patients WHERE id = $1', [sug.patient_id]);
    const { rows: dRows } = await query('SELECT specialty FROM doctors WHERE id = $1', [sug.doctor_id]);
    const patientName = pRows[0]?.name || 'Patient';
    const patientEmail = pRows[0]?.email || null;
    const specialty = dRows[0]?.specialty || 'General Physician';

    // Book appointment
    const apptId = 'A-' + Date.now();
    await query(
      `INSERT INTO appointments (id, patient_id, patient_name, doctor_id, doctor_name, specialty, date, time, type, status, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'upcoming', $10)`,
      [apptId, sug.patient_id, patientName, sug.doctor_id, sug.doctor_name, specialty, sug.suggested_date, time, type, `Follow-up: ${sug.reason || 'Routine check'}`]
    );

    // Update suggestion status
    await query(
      `UPDATE follow_up_suggestions SET status = 'booked', booked_appointment_id = $1 WHERE id = $2`,
      [apptId, id]
    );

    // In-app notification
    const { rows: uRows } = await query('SELECT id FROM users WHERE doctor_id = $1', [sug.doctor_id]);
    const docUserId = uRows[0]?.id;
    if (docUserId) {
      const nId = 'N-' + Date.now();
      const nMsg = `${patientName} confirmed their follow-up appointment on ${sug.suggested_date} at ${time}.`;
      await query(
        `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'appointment_confirmed','Follow-up Confirmed',$3,false)`,
        [nId, docUserId, nMsg]
      );
      try { pushNotification(docUserId, { id: nId, type: 'appointment_confirmed', title: 'Follow-up Confirmed', message: nMsg }); } catch (_) {}
    }

    if (patientEmail) {
      try {
        await enqueueEmail('send-confirmation', {
          appointmentId: apptId,
          patientEmail,
          patientName,
          doctorName: sug.doctor_name,
          specialty,
          date: sug.suggested_date,
          time,
          type,
        });
      } catch (_) {}
    }

    res.status(201).json({ success: true, appointmentId: apptId, message: 'Follow-up appointment booked successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to confirm follow-up appointment' });
  }
});

// PATCH /api/follow-ups/:id/dismiss — dismiss follow-up suggestion
router.patch('/follow-ups/:id/dismiss', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await query("UPDATE follow_up_suggestions SET status = 'dismissed' WHERE id = $1", [id]);
    res.json({ success: true, message: 'Follow-up suggestion dismissed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to dismiss suggestion' });
  }
});

// ─── CW-4: Prescription Refill Requests ───────────────────────────────────

// POST /api/refills — patient requests refill on an existing prescription
router.post('/refills', requireAuth, async (req, res) => {
  try {
    const { prescriptionId, patientNotes } = req.body;
    if (!prescriptionId) return res.status(400).json({ error: 'prescriptionId is required' });

    const { rows: rxRows } = await query('SELECT * FROM prescriptions WHERE id = $1', [prescriptionId]);
    if (!rxRows[0]) return res.status(404).json({ error: 'Prescription not found' });
    const rx = rxRows[0];

    const { role, id: callerId, userId } = req.user;
    if (role === 'patient' && rx.patient_id !== callerId && rx.patient_id !== userId) {
      return res.status(403).json({ error: 'You may only request refills for your own prescriptions' });
    }

    const refillId = 'REF-' + Date.now();
    await query(
      `INSERT INTO refill_requests (id, prescription_id, patient_id, patient_name, doctor_id, doctor_name, medications, patient_notes, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW(), NOW())`,
      [refillId, rx.id, rx.patient_id, rx.patient_name, rx.doctor_id, rx.doctor_name, rx.medications, patientNotes || null]
    );

    // Notify doctor
    const { rows: uRows } = await query('SELECT id FROM users WHERE doctor_id = $1', [rx.doctor_id]);
    const doctorUserId = uRows[0]?.id;
    if (doctorUserId) {
      const nId = 'N-' + Date.now();
      const nMsg = `${rx.patient_name} requested a refill on prescription #${rx.id}.`;
      await query(
        `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'prescription_available','Refill Request Received',$3,false)`,
        [nId, doctorUserId, nMsg]
      );
      try { pushNotification(doctorUserId, { id: nId, type: 'prescription_available', title: 'Refill Request Received', message: nMsg }); } catch (_) {}
    }

    res.status(201).json({ success: true, id: refillId, message: 'Refill request submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit refill request' });
  }
});

// GET /api/refills/patient/:patientId — patient views their refill requests
router.get('/refills/patient/:patientId', requireAuth, async (req, res) => {
  try {
    const { patientId } = req.params;
    const { rows } = await query(
      'SELECT * FROM refill_requests WHERE patient_id = $1 ORDER BY created_at DESC',
      [patientId]
    );
    const parsed = rows.map((r) => ({
      ...r,
      medications: safeJson(r.medications, []),
    }));
    res.json({ success: true, refillRequests: parsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch refill requests' });
  }
});

// GET /api/refills/doctor/:doctorId — doctor views pending refill requests
router.get('/refills/doctor/:doctorId', requireAuth, async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { rows } = await query(
      `SELECT r.*, p.gender, p.blood_group, p.allergies
       FROM refill_requests r
       LEFT JOIN patients p ON r.patient_id = p.id
       WHERE r.doctor_id = $1
       ORDER BY (CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END), r.created_at DESC`,
      [doctorId]
    );
    const parsed = rows.map((r) => ({
      ...r,
      medications: safeJson(r.medications, []),
    }));
    res.json({ success: true, refillRequests: parsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch doctor refill requests' });
  }
});

// PATCH /api/refills/:id/approve — doctor approves refill and issues new prescription
router.patch('/refills/:id/approve', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { doctorNotes, modifications } = req.body || {};

    const { rows: rRows } = await query('SELECT * FROM refill_requests WHERE id = $1', [id]);
    if (!rRows[0]) return res.status(404).json({ error: 'Refill request not found' });
    const refill = rRows[0];

    // Determine final medications (either doctor modifications or original)
    const finalMeds = modifications && Array.isArray(modifications) && modifications.length > 0
      ? JSON.stringify(modifications)
      : refill.medications;

    // Generate new prescription
    const newRxId = 'RX-' + Date.now();
    await query(
      `INSERT INTO prescriptions (id, patient_id, patient_name, doctor_id, doctor_name, date, medications, additional_instructions, status)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, 'active')`,
      [newRxId, refill.patient_id, refill.patient_name, refill.doctor_id, refill.doctor_name, finalMeds, doctorNotes || 'Refill renewed as requested']
    );

    // Update refill request status
    await query(
      `UPDATE refill_requests SET status = 'approved', doctor_notes = $1, new_prescription_id = $2, updated_at = NOW() WHERE id = $3`,
      [doctorNotes || 'Approved', newRxId, id]
    );

    // Notify patient
    const { rows: uRows } = await query('SELECT id FROM users WHERE patient_id = $1', [refill.patient_id]);
    const patientUserId = uRows[0]?.id;
    if (patientUserId) {
      const nId = 'N-' + Date.now();
      const nMsg = `Your prescription refill request was approved by Dr. ${refill.doctor_name}. New prescription #${newRxId} is now active.`;
      await query(
        `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'prescription_available','Refill Approved',$3,false)`,
        [nId, patientUserId, nMsg]
      );
      try { pushNotification(patientUserId, { id: nId, type: 'prescription_available', title: 'Refill Approved', message: nMsg }); } catch (_) {}
    }

    res.json({ success: true, message: 'Refill approved', newPrescriptionId: newRxId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve refill request' });
  }
});

// PATCH /api/refills/:id/reject — doctor rejects refill
router.patch('/refills/:id/reject', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const { id } = req.params;
    const { doctorNotes } = req.body || {};
    if (!doctorNotes) return res.status(400).json({ error: 'Please provide a reason / note for the patient' });

    const { rows: rRows } = await query('SELECT * FROM refill_requests WHERE id = $1', [id]);
    if (!rRows[0]) return res.status(404).json({ error: 'Refill request not found' });
    const refill = rRows[0];

    await query(
      `UPDATE refill_requests SET status = 'rejected', doctor_notes = $1, updated_at = NOW() WHERE id = $2`,
      [doctorNotes, id]
    );

    // Notify patient
    const { rows: uRows } = await query('SELECT id FROM users WHERE patient_id = $1', [refill.patient_id]);
    const patientUserId = uRows[0]?.id;
    if (patientUserId) {
      const nId = 'N-' + Date.now();
      const nMsg = `Refill request for #${refill.prescription_id} was reviewed by Dr. ${refill.doctor_name}: ${doctorNotes}`;
      await query(
        `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'prescription_available','Refill Update',$3,false)`,
        [nId, patientUserId, nMsg]
      );
      try { pushNotification(patientUserId, { id: nId, type: 'prescription_available', title: 'Refill Update', message: nMsg }); } catch (_) {}
    }

    res.json({ success: true, message: 'Refill request rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reject refill request' });
  }
});

// ─── DA-4: AI Consultation Note Drafting (SOAP Format) ────────────────────

async function callGeminiSoapDraft({ patientName, age, gender, reason, symptoms, vitals = {}, diagnosis, diagnosisCode, observations, history = '' }) {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const modelsToTry = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];

  const prompt = `You are an expert clinical documentation assistant for a licensed physician.
Generate a structured, professional clinical consultation note in standard SOAP format (Subjective, Objective, Assessment, Plan) based on the following consultation inputs:

Patient: ${patientName || 'Patient'} (${age ? age + ' y/o' : ''} ${gender || ''})
Reason for Visit: ${reason || 'Consultation'}
Reported Symptoms: ${symptoms || 'None reported'}
Vitals: ${JSON.stringify(vitals)}
Observations / Physical Exam: ${observations || 'Non-contributory'}
Working Diagnosis: ${diagnosis || 'Clinical evaluation'} (ICD-10: ${diagnosisCode || 'Unspecified'})
Relevant History / Prior Context: ${history || 'None'}

Return ONLY a valid JSON object matching this exact schema:
{
  "subjective": "Concise summary of patient's chief complaint, history of present illness (HPI), and reported symptom duration/quality",
  "objective": "Documented vitals analysis (flagging abnormal values), physical/telehealth observations, and relevant findings",
  "assessment": "Primary clinical diagnosis, differential considerations, and acuity/risk level",
  "plan": "Step-by-step management: non-pharmacological advice, prescribed therapies, red-flag warning signs, and follow-up guidance",
  "clinical_recommendations": "Bullet points of key clinical reminders for the patient"
}`;

  if (apiKey) {
    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            const parsed = JSON.parse(candidateText);
            return { ...parsed, source: 'gemini_ai' };
          }
        }
      } catch (err) {
        console.warn(`[GeminiSOAP-${model}] Error:`, err.message);
      }
    }
  }

  // Deterministic clinical fallback if Gemini is offline
  const vitalsText = Object.entries(vitals).filter(([_, v]) => v).map(([k, v]) => `${k.toUpperCase()}: ${v}`).join(', ') || 'Within normal limits';
  return {
    subjective: `Patient presented for consultation regarding: ${reason || 'unspecified complaints'}. Symptoms reported: ${symptoms || 'None documented'}. Patient reports functional impact and seeks medical guidance.`,
    objective: `Telehealth clinical evaluation. Documented vitals: ${vitalsText}. Clinical observations: ${observations || 'Patient alert and oriented, in no acute distress during video evaluation.'}`,
    assessment: `Primary Assessment: ${diagnosis || reason || 'Clinical consultation evaluation'} (${diagnosisCode || 'Clinical evaluation'}). Condition appears stable based on presented clinical parameters.`,
    plan: `1. Implement clinical management as discussed with patient.\n2. Adhere to prescribed medications and instructions.\n3. Return for reassessment or seek emergency care immediately if red flag symptoms develop.\n4. Follow-up as advised.`,
    clinical_recommendations: `• Maintain regular hydration and rest\n• Monitor vitals daily\n• Seek urgent care if breathing difficulty or acute pain arises`,
    source: 'clinical_matrix',
  };
}

// POST /api/consultations/draft-soap-note — doctors draft AI SOAP note
router.post('/consultations/draft-soap-note', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const draft = await callGeminiSoapDraft(req.body);
    res.json({ success: true, draft });
  } catch (err) {
    console.error('[Consultations] SOAP draft failed:', err);
    res.status(500).json({ error: 'Failed to generate SOAP note draft' });
  }
});

export default router;

