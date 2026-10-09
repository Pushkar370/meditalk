import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, hasClinicalRelationship } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { auditAccess, logAudit, getClientIp } from '../services/auditService.js';

const router = Router();

function safeJson(val, fallback) {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    if (Array.isArray(fallback) && typeof val === 'string') {
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return fallback;
  }
}

function parsePatient(row) {
  if (!row) return null;
  return {
    ...row,
    bloodGroup: row.blood_group,
    allergies: safeJson(row.allergies, []),
    chronicConditions: safeJson(row.chronic_conditions, []),
    currentMedications: safeJson(row.current_medications, []),
    emergencyContact: safeJson(row.emergency_contact, {}),
    insurance: safeJson(row.insurance, {}),
    registeredAt: row.registered_at,
  };
}

// GET /api/patients — doctors and admins only
router.get('/', requireAuth, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const { status, search } = req.query;
    let sql = 'SELECT * FROM patients';
    const conditions = [];
    const params = [];
    let idx = 1;

    // Doctor directory scoping: doctors can only view patients who have had
    // appointments, consultations, or prescriptions with them.
    if (req.user.role === 'doctor') {
      let doctorId = req.user.doctorId || req.user.id;
      if (doctorId && doctorId.startsWith('U-')) {
        const { rows: u } = await query('SELECT doctor_id FROM users WHERE id = $1', [doctorId]);
        if (u[0]?.doctor_id) doctorId = u[0].doctor_id;
      }
      conditions.push(`id IN (
        SELECT patient_id FROM appointments
        WHERE doctor_id = $${idx}
          AND status NOT IN ('cancelled')
          AND (
            booked_by = patient_id
            OR booked_by = 'patient'
            OR status IN ('confirmed', 'checked-in', 'in-progress', 'completed')
          )
        UNION
        SELECT patient_id FROM consultations WHERE doctor_id = $${idx}
        UNION
        SELECT patient_id FROM prescriptions WHERE doctor_id = $${idx}
      )`);
      params.push(doctorId);
      idx++;
    }

    if (status && status !== 'all') { conditions.push('status = $' + idx++); params.push(status); }
    if (search) { conditions.push('(name ILIKE $' + idx + ' OR id ILIKE $' + (idx+1) + ')'); params.push('%'+search+'%', '%'+search+'%'); idx += 2; }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY registered_at DESC';
    const { rows } = await query(sql, params);
    auditAccess(req, {
      action: `Viewed patient directory${search ? ` (search: "${search}")` : ''}`,
      entityType: 'Patient Directory',
      entityId: null,
    });
    res.json(rows.map(parsePatient));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch patients' }); }
});

// GET /api/patients/:id — patient themselves, doctor (with clinical relationship), or admin
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { id } = req.params;
    // Receptionists cannot view medical profiles (schedule information only)
    if (role === 'receptionist') {
      return res.status(403).json({ error: 'Forbidden — receptionists are not permitted to view patient medical profiles' });
    }
    // Patients can only view their own profile
    if (role === 'patient' && callerId !== id) {
      return res.status(403).json({ error: 'Forbidden — cannot access another patient\'s profile' });
    }
    // Doctors must have a clinical relationship with the patient
    if (role === 'doctor') {
      const callerDocId = req.user.doctorId || callerId;
      const allowed = await hasClinicalRelationship(callerDocId, id);
      if (!allowed) {
        return res.status(403).json({ error: 'Forbidden — you do not have an active clinical relationship with this patient' });
      }
    }
    const { rows } = await query('SELECT * FROM patients WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Patient not found' });
    auditAccess(req, {
      action: `Viewed patient chart for ${rows[0].name || id}`,
      entityType: 'Patient Chart',
      entityId: id,
    });
    res.json(parsePatient(rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch patient' }); }
});

// POST /api/patients — admin only (admin-created patient records)
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, phone, dob, gender, address, bloodGroup, height, weight, allergies = [], chronicConditions = [], currentMedications = [], emergencyContact = {}, insurance = {}, status = 'active' } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const id = 'P-' + Date.now();
    await query(
      'INSERT INTO patients (id, name, email, phone, dob, gender, address, blood_group, height, weight, allergies, chronic_conditions, current_medications, emergency_contact, insurance, status, registered_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())',
      [id, name, email, phone, dob, gender, address, bloodGroup, height, weight, JSON.stringify(allergies), JSON.stringify(chronicConditions), JSON.stringify(currentMedications), JSON.stringify(emergencyContact), JSON.stringify(insurance), status]
    );

    if (email) {
      try {
        // Generate a secure random temporary password — admin must share this with the patient
        const tempPassword = crypto.randomBytes(10).toString('base64url'); // e.g. 'aB3xK9mP2Q'
        const hash = await bcrypt.hash(tempPassword, 10);
        await query(
          'INSERT INTO users (id, name, email, password, role, patient_id, token_version) VALUES ($1,$2,$3,$4,$5,$6,1) ON CONFLICT (email) DO NOTHING',
          ['U-' + id, name, email, hash, 'patient', id]
        );
        // Attach the temp password to the response so admin can communicate it to the patient
        const { rows: created } = await query('SELECT * FROM patients WHERE id = $1', [id]);
        return res.status(201).json({ ...parsePatient(created[0]), _tempPassword: tempPassword, _tempPasswordNote: 'Share this password securely with the patient. It is shown only once.' });
      } catch (_) {}
    }

    logAudit({
      userId: req.user.userId || req.user.id,
      userName: req.user.name || 'Admin',
      role: 'Administrator',
      action: 'Created new patient profile',
      entityType: 'Patient',
      entityId: id,
      status: 'success',
      ipAddress: getClientIp(req),
      userAgent: req.headers?.['user-agent'],
    });

    const { rows } = await query('SELECT * FROM patients WHERE id = $1', [id]);
    res.status(201).json(parsePatient(rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create patient' }); }
});

// PUT /api/patients/:id — patient themselves, or admin
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: callerId } = req.user;
    if (role === 'nurse' || role === 'receptionist') {
      return res.status(403).json({ error: 'Forbidden — nurses and receptionists are not permitted to edit medical profiles' });
    }
    if (role !== 'patient' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden — unauthorized to update patient profile' });
    }
    if (role === 'patient' && callerId !== id) {
      return res.status(403).json({ error: 'Forbidden — cannot update another patient\'s profile' });
    }
    const { rows: ex } = await query('SELECT * FROM patients WHERE id = $1', [id]);
    if (!ex[0]) return res.status(404).json({ error: 'Patient not found' });
    const e = ex[0];
    const { name=e.name, email=e.email, phone=e.phone, dob=e.dob, gender=e.gender, address=e.address, bloodGroup=e.blood_group, height=e.height, weight=e.weight, allergies, chronicConditions, currentMedications, emergencyContact, insurance, status=e.status } = req.body;
    await query(
      'UPDATE patients SET name=$1,email=$2,phone=$3,dob=$4,gender=$5,address=$6,blood_group=$7,height=$8,weight=$9,allergies=$10,chronic_conditions=$11,current_medications=$12,emergency_contact=$13,insurance=$14,status=$15 WHERE id=$16',
      [name, email, phone, dob, gender, address, bloodGroup, height, weight,
        JSON.stringify(allergies ?? safeJson(e.allergies, [])),
        JSON.stringify(chronicConditions ?? safeJson(e.chronic_conditions, [])),
        JSON.stringify(currentMedications ?? safeJson(e.current_medications, [])),
        JSON.stringify(emergencyContact ?? safeJson(e.emergency_contact, {})),
        JSON.stringify(insurance ?? safeJson(e.insurance, {})),
        status, id]
    );

    // Sync changes across related tables (appointments, prescriptions, users)
    try {
      if (name) {
        await query('UPDATE appointments SET patient_name = $1 WHERE patient_id = $2', [name, id]);
        await query('UPDATE prescriptions SET patient_name = $1 WHERE patient_id = $2', [name, id]);
        await query('UPDATE users SET name = $1 WHERE patient_id = $2', [name, id]);
      }
      if (email) {
        await query('UPDATE users SET email = $1 WHERE patient_id = $2', [email, id]);
      }
      logAudit({
        userId: callerId,
        userName: req.user.name || name,
        role: role === 'admin' ? 'Administrator' : 'Patient',
        action: 'Updated patient medical profile',
        entityType: 'Patient',
        entityId: id,
        status: 'success',
        ipAddress: getClientIp(req),
        userAgent: req.headers?.['user-agent'],
      });
    } catch (_) {}

    const { rows: updated } = await query('SELECT * FROM patients WHERE id = $1', [id]);
    res.json(parsePatient(updated[0]));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update patient' }); }
});

// PATCH /api/patients/:id/status — admin only
router.patch('/:id/status', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const { rowCount } = await query('UPDATE patients SET status = $1 WHERE id = $2', [status, req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Patient not found' });
    res.json({ success: true, id: req.params.id, status });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update status' }); }
});

// GET /api/patients/:id/vitals-history — historical biometrics from consultations and nurse recordings
router.get('/:id/vitals-history', requireAuth, async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { id } = req.params;

    // Receptionists cannot see clinical notes or vitals
    if (role === 'receptionist') {
      return res.status(403).json({ error: 'Forbidden — receptionists are not permitted to access patient clinical vitals' });
    }

    // Patients can only access their own vitals
    if (role === 'patient') {
      const isSelf = callerId === id || req.user.patientId === id || req.user.userId === id;
      if (!isSelf) {
        return res.status(403).json({ error: 'Forbidden — cannot access another patient\'s vitals history' });
      }
    }
    // Doctors must have a clinical relationship with the patient
    if (role === 'doctor') {
      const callerDocId = req.user.doctorId || callerId;
      const allowed = await hasClinicalRelationship(callerDocId, id);
      if (!allowed) {
        return res.status(403).json({ error: 'Forbidden — you do not have an active clinical relationship with this patient' });
      }
    }
    // Nurses and Admins are permitted

    // Fetch both consultation vitals and nurse patient_vitals entries
    const [cRes, pvRes] = await Promise.all([
      query(
        `SELECT c.id, c.date, c.diagnosis, c.vitals, d.name as doctor_name
         FROM consultations c
         LEFT JOIN doctors d ON d.id = c.doctor_id
         WHERE c.patient_id = $1
         ORDER BY c.date ASC`,
        [id]
      ),
      query(
        `SELECT id, appointment_id, recorded_by_name, role, bp, systolic, diastolic, hr, temp, spo2, weight, blood_sugar, notes, recorded_at
         FROM patient_vitals
         WHERE patient_id = $1
         ORDER BY recorded_at ASC`,
        [id]
      ),
    ]);

    const history = [];

    // Map consultation entries
    cRes.rows.forEach(r => {
      const vitals = safeJson(r.vitals, {});
      const bpParts = (vitals.bp || '').split('/').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      if (vitals.bp || vitals.hr || vitals.spo2 || vitals.temp || vitals.weight) {
        history.push({
          consultationId: r.id,
          source: 'physician_consultation',
          date: r.date,
          diagnosis: r.diagnosis || 'Consultation',
          doctorName: r.doctor_name || 'Doctor',
          bp: vitals.bp || null,
          systolic: bpParts[0] || null,
          diastolic: bpParts[1] || null,
          hr: vitals.hr ? parseInt(vitals.hr, 10) : null,
          temp: vitals.temp ? parseFloat(vitals.temp) : null,
          spo2: vitals.spo2 ? parseInt(vitals.spo2, 10) : null,
          weight: vitals.weight ? parseFloat(vitals.weight) : null,
        });
      }
    });

    // Map nurse/staff recordings
    pvRes.rows.forEach(r => {
      history.push({
        vitalsId: r.id,
        appointmentId: r.appointment_id,
        source: 'nurse_triage',
        date: r.recorded_at,
        diagnosis: r.notes || 'Pre-consultation Vitals',
        doctorName: r.recorded_by_name ? `${r.recorded_by_name} (${r.role})` : 'Clinic Nurse',
        bp: r.bp || (r.systolic && r.diastolic ? `${r.systolic}/${r.diastolic}` : null),
        systolic: r.systolic || null,
        diastolic: r.diastolic || null,
        hr: r.hr || null,
        temp: r.temp ? parseFloat(r.temp) : null,
        spo2: r.spo2 || null,
        weight: r.weight ? parseFloat(r.weight) : null,
        bloodSugar: r.blood_sugar ? parseFloat(r.blood_sugar) : null,
        notes: r.notes || null,
      });
    });

    // Sort chronologically by date ASC
    history.sort((a, b) => new Date(a.date) - new Date(b.date));

    auditAccess(req, {
      action: `Viewed patient vitals history for ${id}`,
      entityType: 'Patient Vitals',
      entityId: id,
    });

    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vitals history' });
  }
});

// POST /api/patients/:id/vitals — Nurse, Doctor or Admin records vitals before the doctor
router.post('/:id/vitals', requireAuth, requireRole('nurse', 'doctor', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      bp, systolic, diastolic, hr, temp, spo2, weight, bloodSugar, notes, appointmentId
    } = req.body;

    const { rows: pCheck } = await query('SELECT id, name FROM patients WHERE id = $1', [id]);
    if (!pCheck[0]) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Doctors must have a real clinical relationship with the patient to record vitals
    if (req.user.role === 'doctor') {
      const callerDocId = req.user.doctorId || req.user.id;
      const allowed = await hasClinicalRelationship(callerDocId, id);
      if (!allowed) {
        return res.status(403).json({ error: 'Forbidden — you do not have an active clinical relationship with this patient' });
      }
    }

    const vitalsId = 'V-' + Date.now();
    let bpFinal = bp || null;
    let sysFinal = systolic ? parseInt(systolic, 10) : null;
    let diaFinal = diastolic ? parseInt(diastolic, 10) : null;
    if (bpFinal && (!sysFinal || !diaFinal)) {
      const parts = bpFinal.split('/').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      if (parts.length === 2) {
        sysFinal = parts[0];
        diaFinal = parts[1];
      }
    } else if (sysFinal && diaFinal && !bpFinal) {
      bpFinal = `${sysFinal}/${diaFinal}`;
    }

    const vitalsObj = {
      bp: bpFinal,
      hr: hr ? String(hr) : '',
      temp: temp ? String(temp) : '',
      spo2: spo2 ? String(spo2) : '',
      weight: weight ? String(weight) : '',
      bloodSugar: bloodSugar ? String(bloodSugar) : '',
      notes: notes || '',
    };

    await query(
      `INSERT INTO patient_vitals
       (id, patient_id, appointment_id, recorded_by_id, recorded_by_name, role, bp, systolic, diastolic, hr, temp, spo2, weight, blood_sugar, notes, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
      [
        vitalsId, id, appointmentId || null,
        req.user.id || req.user.userId, req.user.name || 'Nurse', req.user.role,
        bpFinal, sysFinal, diaFinal, hr ? parseInt(hr, 10) : null,
        temp ? parseFloat(temp) : null, spo2 ? parseInt(spo2, 10) : null,
        weight ? parseFloat(weight) : null, bloodSugar ? parseFloat(bloodSugar) : null,
        notes || null
      ]
    );

    // If appointment is provided, attach pre-recorded vitals to the appointment so doctor sees them immediately
    if (appointmentId) {
      await query(
        `UPDATE appointments
         SET vitals = $1, vitals_recorded_by = $2, vitals_recorded_at = NOW()
         WHERE id = $3`,
        [JSON.stringify(vitalsObj), req.user.name || 'Nurse', appointmentId]
      );
    }

    // Update patient's weight on demographic chart if weight provided
    if (weight) {
      await query('UPDATE patients SET weight = $1 WHERE id = $2', [`${weight} kg`, id]);
    }

    logAudit({
      userId: req.user.id || req.user.userId,
      userName: req.user.name || 'Nurse',
      role: req.user.role,
      action: `Recorded clinical vitals for patient ${id}`,
      entityType: 'Patient Vitals',
      entityId: vitalsId,
      status: 'success',
      ipAddress: getClientIp(req),
      userAgent: req.headers?.['user-agent'],
    });

    res.status(201).json({
      success: true,
      id: vitalsId,
      patientId: id,
      appointmentId: appointmentId || null,
      vitals: vitalsObj,
      recordedBy: req.user.name,
      role: req.user.role,
      message: 'Vitals recorded successfully before physician consultation.'
    });
  } catch (err) {
    console.error('[Patients] Error recording vitals:', err);
    res.status(500).json({ error: 'Failed to record vitals' });
  }
});

// GET /api/patients/:id/export — Export complete personal health data (GDPR / HIPAA Portability)
router.get('/:id/export', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: callerId } = req.user;

    // Scoping: Only the patient themselves or admin can export data
    const isSelf = callerId === id || req.user.patientId === id || req.user.userId === id;
    if (role !== 'admin' && !isSelf) {
      return res.status(403).json({ error: 'Forbidden — you can only export your own health data' });
    }

    const { rows: pRows } = await query('SELECT * FROM patients WHERE id = $1', [id]);
    if (!pRows[0]) return res.status(404).json({ error: 'Patient record not found' });
    const patientData = parsePatient(pRows[0]);

    // Fetch related health archives
    const [appts, consults, prescrs, recs, vitals, meds] = await Promise.all([
      query('SELECT * FROM appointments WHERE patient_id = $1 ORDER BY date DESC', [id]),
      query('SELECT * FROM consultations WHERE patient_id = $1 ORDER BY date DESC', [id]),
      query('SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY date DESC', [id]),
      query('SELECT * FROM medical_records WHERE patient_id = $1 ORDER BY date DESC', [id]),
      query('SELECT * FROM patient_vitals WHERE patient_id = $1 ORDER BY recorded_at DESC', [id]),
      query('SELECT * FROM medication_schedules WHERE patient_id = $1 ORDER BY start_date DESC', [id]),
    ]);

    const archive = {
      exportMetadata: {
        system: 'MediTalk Telehealth Platform',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        patientId: id,
        patientName: patientData.name,
        complianceStandard: 'HIPAA & GDPR Data Portability Standard',
        retentionPolicy: 'Official patient health archive copy.',
      },
      patientProfile: patientData,
      appointments: appts.rows,
      consultations: consults.rows.map(c => ({
        ...c,
        vitals: safeJson(c.vitals, {}),
      })),
      prescriptions: prescrs.rows.map(p => ({
        ...p,
        medications: safeJson(p.medications, []),
      })),
      medicalRecords: recs.rows.map(r => ({
        ...r,
        details: safeJson(r.details, {}),
        extractedDiagnoses: safeJson(r.extracted_diagnoses, []),
        extractedAllergies: safeJson(r.extracted_allergies, []),
        extractedMedications: safeJson(r.extracted_medications, []),
      })),
      patientVitals: vitals.rows,
      medicationSchedules: meds.rows,
    };

    // Audit log for GDPR/HIPAA compliance
    logAudit({
      userId: callerId,
      userName: req.user.name || callerId,
      role: role === 'admin' ? 'Administrator' : 'Patient',
      action: 'Exported personal health data archive',
      entityType: 'Patient Export',
      entityId: id,
      status: 'success',
      ipAddress: getClientIp(req),
      userAgent: req.headers?.['user-agent'],
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="meditalk-health-export-${id}.json"`);
    res.json(archive);
  } catch (err) {
    console.error('[Patients] Data export error:', err);
    res.status(500).json({ error: 'Failed to export patient data' });
  }
});

// POST /api/patients/:id/withdraw-consent — Patient withdraws medical consent and deletes account
router.post('/:id/withdraw-consent', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: callerId } = req.user;

    const isSelf = callerId === id || req.user.patientId === id || req.user.userId === id;
    if (role !== 'admin' && !isSelf) {
      return res.status(403).json({ error: 'Forbidden — you can only withdraw consent for your own account' });
    }

    const { rows: pRows } = await query('SELECT * FROM patients WHERE id = $1', [id]);
    if (!pRows[0]) return res.status(404).json({ error: 'Patient not found' });

    // Anonymize and redact PII in patients table (preserving email to identify closed/withdrawn account)
    await query(
      `UPDATE patients
       SET name = 'Anonymized Patient',
           phone = NULL,
           address = NULL,
           emergency_contact = '{}',
           insurance = '{}',
           status = 'withdrawn_consent',
           consent_withdrawn = TRUE,
           consent_withdrawn_at = NOW()
       WHERE id = $1`,
      [id]
    );

    // Update users table: remove credentials & deactivate account
    await query(
      `UPDATE users
       SET name = 'Anonymized Patient',
           password = 'ACCOUNT_DELETED_AND_CONSENT_WITHDRAWN'
       WHERE patient_id = $1 OR id = $2`,
      [id, callerId]
    );

    // Cancel all future upcoming or confirmed appointments
    await query(
      `UPDATE appointments
       SET status = 'cancelled',
           cancel_reason = 'Patient withdrew medical consent and closed account'
       WHERE patient_id = $1 AND status IN ('upcoming', 'confirmed')`,
      [id]
    );

    // Invalidate the current session token
    if (req.user?.jti) {
      const expiresAt = req.user.exp
        ? new Date(req.user.exp * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      try {
        await query(
          'INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING',
          [req.user.jti, expiresAt]
        );
      } catch (_) {}
    }

    // Log the withdrawal audit event
    logAudit({
      userId: callerId,
      userName: 'Anonymized Patient',
      role: 'patient',
      action: 'Patient withdrew consent and deleted account (GDPR Right to Erasure)',
      entityType: 'Patient',
      entityId: id,
      status: 'success',
      ipAddress: getClientIp(req),
      userAgent: req.headers?.['user-agent'],
    });

    res.json({
      success: true,
      message: 'Medical consent has been successfully withdrawn and your account has been deleted.'
    });
  } catch (err) {
    console.error('[Patients] Error withdrawing consent:', err);
    res.status(500).json({ error: 'Failed to withdraw consent and delete account' });
  }
});

// PATCH /api/patients/:id/adopt-ai-records — doctor merges AI-extracted allergies & meds into patient chart
router.patch('/:id/adopt-ai-records', requireAuth, requireRole('doctor', 'patient'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: callerId } = req.user;

    // Patients can only adopt into their own chart
    if (role === 'patient' && callerId !== id) {
      return res.status(403).json({ error: 'Forbidden — cannot modify another patient\'s chart' });
    }

    // Doctors must have an active clinical relationship with the patient
    if (role === 'doctor') {
      const callerDocId = req.user.doctorId || callerId;
      const allowed = await hasClinicalRelationship(callerDocId, id);
      if (!allowed) {
        return res.status(403).json({ error: 'Forbidden — you do not have an active clinical relationship with this patient' });
      }
    }

    const { allergies: newAllergies = [], medications: newMedications = [] } = req.body;

    // Fetch current values
    const { rows } = await query('SELECT allergies, current_medications FROM patients WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Patient not found' });

    const currentAllergies = safeJson(rows[0].allergies, []);
    const currentMeds = safeJson(rows[0].current_medications, []);

    // Merge — deduplicate by lowercased string comparison
    const mergedAllergies = [...new Set([
      ...currentAllergies,
      ...newAllergies.filter(a => !currentAllergies.map(x => x.toLowerCase()).includes(a.toLowerCase())),
    ])];

    const mergedMeds = [...currentMeds];
    for (const newMed of newMedications) {
      const medName = typeof newMed === 'string' ? newMed : newMed?.name || '';
      if (medName && !mergedMeds.map(m => m.toLowerCase()).includes(medName.toLowerCase())) {
        mergedMeds.push(medName);
      }
    }

    await query(
      'UPDATE patients SET allergies=$1, current_medications=$2 WHERE id=$3',
      [JSON.stringify(mergedAllergies), JSON.stringify(mergedMeds), id]
    );

    // Audit log
    logAudit({
      userId: callerId,
      userName: req.user.name || callerId,
      role,
      action: 'Adopted AI-extracted allergies and medications into patient chart',
      entityType: 'Patient',
      entityId: id,
      status: 'success',
      ipAddress: getClientIp(req),
      userAgent: req.headers?.['user-agent'],
    });

    const { rows: updated } = await query('SELECT * FROM patients WHERE id = $1', [id]);
    res.json({ success: true, patient: parsePatient(updated[0]), mergedAllergies, mergedMeds });
  } catch (err) {
    console.error('[Phase9] Adopt AI records error:', err);
    res.status(500).json({ error: 'Failed to adopt AI records' });
  }
});

export default router;



