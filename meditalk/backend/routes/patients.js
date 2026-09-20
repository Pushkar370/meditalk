import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

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
    if (status && status !== 'all') { conditions.push('status = $' + idx++); params.push(status); }
    if (search) { conditions.push('(name ILIKE $' + idx + ' OR id ILIKE $' + (idx+1) + ')'); params.push('%'+search+'%', '%'+search+'%'); idx += 2; }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY registered_at DESC';
    const { rows } = await query(sql, params);
    res.json(rows.map(parsePatient));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch patients' }); }
});

// GET /api/patients/:id — patient themselves, doctor, or admin
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { id } = req.params;
    // Patients can only view their own profile
    if (role === 'patient' && callerId !== id) {
      return res.status(403).json({ error: 'Forbidden — cannot access another patient\'s profile' });
    }
    const { rows } = await query('SELECT * FROM patients WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Patient not found' });
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
        const hash = bcrypt.hashSync('password', 10);
        await query(
          'INSERT INTO users (id, name, email, password, role, patient_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING',
          ['U-' + id, name, email, hash, 'patient', id]
        );
      } catch (_) {}
    }

    try {
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, $2, 'Administrator', 'Created new patient profile', 'Patient', $3, 'success')`,
        [req.user.userId, req.user.name, id]
      );
    } catch (_) {}

    const { rows } = await query('SELECT * FROM patients WHERE id = $1', [id]);
    res.status(201).json(parsePatient(rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create patient' }); }
});

// PUT /api/patients/:id — patient themselves, or admin
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: callerId } = req.user;
    if (role === 'patient' && callerId !== id) {
      return res.status(403).json({ error: 'Forbidden — cannot update another patient\'s profile' });
    }
    if (role === 'doctor') {
      return res.status(403).json({ error: 'Forbidden — doctors cannot update patient profiles directly' });
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
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, $2, 'Patient', 'Updated patient medical profile', 'Patient', $3, 'success')`,
        [id, name, id]
      );
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

// GET /api/patients/:id/vitals-history — historical biometrics from consultations
router.get('/:id/vitals-history', requireAuth, async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { id } = req.params;

    // Patients can only access their own vitals
    if (role === 'patient' && callerId !== id) {
      return res.status(403).json({ error: 'Forbidden — cannot access another patient\'s vitals history' });
    }

    const { rows } = await query(
      `SELECT c.id, c.date, c.diagnosis, c.vitals, d.name as doctor_name
       FROM consultations c
       LEFT JOIN doctors d ON d.id = c.doctor_id
       WHERE c.patient_id = $1
       ORDER BY c.date ASC`,
      [id]
    );

    const history = rows.map(r => {
      const vitals = safeJson(r.vitals, {});
      const bpParts = (vitals.bp || '').split('/').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      return {
        consultationId: r.id,
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
      };
    }).filter(entry => entry.bp || entry.hr || entry.spo2 || entry.temp || entry.weight);

    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch vitals history' });
  }
});

export default router;


