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

export default router;

