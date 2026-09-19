import { Router } from 'express';
import { query } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pushNotification } from '../server.js';

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
    const { rows } = await query('SELECT * FROM consultations WHERE id = $1', [id]);
    res.status(201).json({ success: true, consultation: parseConsultation(rows[0]) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create consultation' }); }
});

function parseMedicalRecord(row) {
  if (!row) return null;
  return { ...row, patientId: row.patient_id, details: safeJson(row.details, {}) };
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

export default router;
