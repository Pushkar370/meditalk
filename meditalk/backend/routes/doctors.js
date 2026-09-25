import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/doctors — all authenticated users (needed for appointment booking)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, specialty, search } = req.query;
    let sql = 'SELECT * FROM doctors';
    const conditions = [];
    const params = [];
    let idx = 1;
    if (status && status !== 'all') { conditions.push('status = $' + idx++); params.push(status); }
    if (specialty) { conditions.push('specialty = $' + idx++); params.push(specialty); }
    if (search) { conditions.push('(name ILIKE $' + idx + ' OR specialty ILIKE $' + (idx+1) + ')'); params.push('%'+search+'%','%'+search+'%'); idx += 2; }
    // Patients should only see approved and active doctors
    if (req.user.role === 'patient') {
      conditions.push("(verification_status = 'approved' OR verification_status IS NULL)");
      conditions.push("status = 'active'");
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY name ASC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch doctors' }); }
});

// GET /api/doctors/:id — all authenticated users
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM doctors WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Doctor not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch doctor' }); }
});

// POST /api/doctors — admin only
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, phone, specialty, experience = 0, availability = 'Available', status = 'active', bio = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const id = 'D-' + Date.now();
    await query(
      'INSERT INTO doctors (id, name, email, phone, specialty, experience, availability, status, bio) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [id, name, email, phone, specialty, experience, availability, status, bio]
    );

    if (email) {
      try {
        // Generate a secure random temporary password — admin must communicate this to the doctor
        const tempPassword = crypto.randomBytes(10).toString('base64url');
        const hash = bcrypt.hashSync(tempPassword, 10);
        await query(
          'INSERT INTO users (id, name, email, password, role, doctor_id) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING',
          ['U-' + id, name, email, hash, 'doctor', id]
        );
        // Return the temp password in the response (shown only once)
        const { rows: created } = await query('SELECT * FROM doctors WHERE id = $1', [id]);
        return res.status(201).json({ ...created[0], _tempPassword: tempPassword, _tempPasswordNote: 'Share this password securely with the doctor. It is shown only once.' });
      } catch (_) {}
    }

    try {
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, $2, 'Administrator', 'Added new doctor to directory', 'Doctor', $3, 'success')`,
        ['ADMIN', name, id]
      );
    } catch (_) {}

    const { rows } = await query('SELECT * FROM doctors WHERE id = $1', [id]);
    res.status(201).json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create doctor' }); }
});

// PUT /api/doctors/:id — admin only
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: ex } = await query('SELECT * FROM doctors WHERE id = $1', [id]);
    if (!ex[0]) return res.status(404).json({ error: 'Doctor not found' });
    const e = ex[0];
    const { name=e.name, email=e.email, phone=e.phone, specialty=e.specialty, experience=e.experience, availability=e.availability, status=e.status, bio=e.bio } = req.body;
    await query(
      'UPDATE doctors SET name=$1,email=$2,phone=$3,specialty=$4,experience=$5,availability=$6,status=$7,bio=$8 WHERE id=$9',
      [name, email, phone, specialty, experience, availability, status, bio, id]
    );

    // Sync doctor changes across appointments, prescriptions, and users
    try {
      if (name || specialty) {
        await query('UPDATE appointments SET doctor_name = COALESCE($1, doctor_name), specialty = COALESCE($2, specialty) WHERE doctor_id = $3', [name, specialty, id]);
        await query('UPDATE prescriptions SET doctor_name = COALESCE($1, doctor_name) WHERE doctor_id = $2', [name, id]);
      }
      if (name) {
        await query('UPDATE users SET name = $1 WHERE doctor_id = $2', [name, id]);
      }
      if (email) {
        await query('UPDATE users SET email = $1 WHERE doctor_id = $2', [email, id]);
      }
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, $2, 'Administrator', 'Updated doctor details', 'Doctor', $3, 'success')`,
        ['ADMIN', name, id]
      );
    } catch (_) {}

    const { rows: updated } = await query('SELECT * FROM doctors WHERE id = $1', [id]);
    res.json(updated[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update doctor' }); }
});

// PATCH /api/doctors/:id/status — admin only
router.patch('/:id/status', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const { rowCount } = await query('UPDATE doctors SET status = $1 WHERE id = $2', [status, req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Doctor not found' });
    res.json({ success: true, id: req.params.id, status });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update status' }); }
});

// GET /api/doctors/:id/schedule — fetch working hours config
router.get('/:id/schedule', requireAuth, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM doctor_schedules WHERE doctor_id = $1', [req.params.id]);
    if (!rows[0]) {
      // Return sensible defaults if no schedule set yet
      return res.json({
        doctor_id: req.params.id,
        work_days: [1, 2, 3, 4, 5],
        start_time: '09:00',
        end_time: '17:00',
        slot_mins: 30,
        break_start: '13:00',
        break_end: '14:00',
      });
    }
    const s = rows[0];
    res.json({
      ...s,
      work_days: typeof s.work_days === 'string' ? JSON.parse(s.work_days) : s.work_days,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch schedule' }); }
});

// PUT /api/doctors/:id/schedule — doctor (self) or admin
router.put('/:id/schedule', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    // Allow doctor to update their own schedule or admin to update any
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { work_days, start_time, end_time, slot_mins, break_start, break_end } = req.body;
    const schedId = 'SCH-' + id;
    const workDaysJson = JSON.stringify(work_days || [1, 2, 3, 4, 5]);

    await query(
      `INSERT INTO doctor_schedules (id, doctor_id, work_days, start_time, end_time, slot_mins, break_start, break_end, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (doctor_id) DO UPDATE SET
         work_days=$3, start_time=$4, end_time=$5, slot_mins=$6, break_start=$7, break_end=$8, updated_at=NOW()`,
      [schedId, id, workDaysJson, start_time || '09:00', end_time || '17:00', slot_mins || 30, break_start || '13:00', break_end || '14:00']
    );

    const { rows } = await query('SELECT * FROM doctor_schedules WHERE doctor_id = $1', [id]);
    const s = rows[0];
    res.json({ ...s, work_days: typeof s.work_days === 'string' ? JSON.parse(s.work_days) : s.work_days });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to save schedule' }); }
});

// GET /api/doctors/:id/available-slots?date=YYYY-MM-DD — dynamic slot generator
router.get('/:id/available-slots', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param is required' });

    // Fetch schedule config
    const { rows: schedRows } = await query('SELECT * FROM doctor_schedules WHERE doctor_id = $1', [id]);
    const sched = schedRows[0] || { start_time: '09:00', end_time: '17:00', slot_mins: 30, break_start: '13:00', break_end: '14:00', work_days: '[1,2,3,4,5]' };
    const workDays = typeof sched.work_days === 'string' ? JSON.parse(sched.work_days) : sched.work_days;

    // Check if requested date falls on a working day (0=Sun, 6=Sat)
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    if (!workDays.includes(dayOfWeek)) {
      return res.json({ date, slots: [], reason: 'Doctor does not work on this day' });
    }

    // Generate all slots
    function toMins(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
    function fromMins(m) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }

    const startM = toMins(sched.start_time);
    const endM = toMins(sched.end_time);
    const breakStartM = toMins(sched.break_start);
    const breakEndM = toMins(sched.break_end);
    const slotMins = sched.slot_mins || 30;

    const allSlots = [];
    for (let cur = startM; cur + slotMins <= endM; cur += slotMins) {
      const slotEnd = cur + slotMins;
      // Skip if slot overlaps with lunch break window
      if (cur < breakEndM && slotEnd > breakStartM) continue;
      // Format as 12-hour for display
      const h24 = fromMins(cur);
      const [hh, mm] = h24.split(':').map(Number);
      const ampm = hh < 12 ? 'AM' : 'PM';
      const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
      const label = `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
      allSlots.push({ value: label, raw: h24 });
    }

    // Fetch already-booked slots on this date
    const { rows: booked } = await query(
      `SELECT time FROM appointments WHERE doctor_id = $1 AND date = $2 AND status NOT IN ('cancelled')`,
      [id, date]
    );
    const bookedTimes = new Set(booked.map((r) => r.time));

    const slots = allSlots.map((s) => ({
      time: s.value,
      available: !bookedTimes.has(s.value),
    }));

    res.json({ date, slots });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to generate slots' }); }
});

export default router;
