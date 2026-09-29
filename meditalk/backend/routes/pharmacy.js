import { Router } from 'express';
import { query } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

function safeJson(val, fallback) {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function parseSchedule(row) {
  if (!row) return null;
  return {
    ...row,
    patientId: row.patient_id,
    prescriptionId: row.prescription_id,
    medicineName: row.medicine_name,
    timingSlots: safeJson(row.timing_slots, ['morning']),
    takenLogs: safeJson(row.taken_logs, {}),
    streakCount: row.streak_count || 0,
    isActive: row.is_active,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
  };
}

// ── Medication Adherence ──────────────────────────────────────────────────────

// GET /api/medications/adherence — get patient's active medication schedules
router.get('/medications/adherence', requireAuth, async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { patientId } = req.query;
    const targetId = role === 'patient' ? callerId : (patientId || callerId);

    if (role === 'patient' && patientId && patientId !== callerId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { rows } = await query(
      'SELECT * FROM medication_schedules WHERE patient_id = $1 AND is_active = TRUE ORDER BY created_at ASC',
      [targetId]
    );
    res.json(rows.map(parseSchedule));
  } catch (err) {
    console.error('[Phase9] Fetch adherence schedules error:', err);
    res.status(500).json({ error: 'Failed to fetch medication schedules' });
  }
});

// POST /api/medications/adherence — create schedule from a prescription (called when patient marks "set up adherence")
router.post('/medications/adherence', requireAuth, async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { patientId, prescriptionId, medications = [] } = req.body;

    const targetId = role === 'patient' ? callerId : patientId;
    if (!targetId) return res.status(400).json({ error: 'patientId is required' });

    const created = [];
    for (const med of medications) {
      const { name, dosage = '', frequency = 'OD', timingSlots, instructions, durationDays } = med;
      if (!name) continue;

      // Map frequency to timing slots
      const slots = timingSlots || (
        frequency === 'OD' ? ['morning'] :
        frequency === 'BD' ? ['morning', 'evening'] :
        frequency === 'TDS' ? ['morning', 'afternoon', 'evening'] :
        frequency === 'QID' ? ['morning', 'afternoon', 'evening', 'night'] :
        ['morning']
      );

      const endDate = durationDays
        ? new Date(Date.now() + durationDays * 86400000).toISOString()
        : null;

      // Deduplicate: if already active for this patient and medicine, avoid creating duplicate cards
      const { rows: existingSched } = await query(
        'SELECT * FROM medication_schedules WHERE patient_id = $1 AND medicine_name = $2 AND is_active = TRUE',
        [targetId, name]
      );
      if (existingSched.length > 0) {
        created.push(parseSchedule(existingSched[0]));
        continue;
      }

      const id = 'MS-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      await query(
        `INSERT INTO medication_schedules (id, patient_id, prescription_id, medicine_name, dosage, frequency, timing_slots, end_date, instructions, taken_logs, streak_count, is_active, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'{}',0,TRUE,NOW())`,
        [id, targetId, prescriptionId || null, name, dosage, frequency, JSON.stringify(slots), endDate, instructions || null]
      );

      const { rows } = await query('SELECT * FROM medication_schedules WHERE id = $1', [id]);
      if (rows[0]) created.push(parseSchedule(rows[0]));
    }

    res.status(201).json({ success: true, schedules: created });
  } catch (err) {
    console.error('[Phase9] Create adherence schedule error:', err);
    res.status(500).json({ error: 'Failed to create medication schedules' });
  }
});

// POST /api/medications/adherence/log — mark a dose as taken
router.post('/medications/adherence/log', requireAuth, async (req, res) => {
  try {
    const { id: callerId } = req.user;
    const { scheduleId, slot, date: dateStr } = req.body;
    // slot: 'morning' | 'afternoon' | 'evening' | 'night'
    // date: 'YYYY-MM-DD' (server validates)

    if (!scheduleId || !slot) return res.status(400).json({ error: 'scheduleId and slot are required' });

    const { rows } = await query('SELECT * FROM medication_schedules WHERE id = $1', [scheduleId]);
    if (!rows[0]) return res.status(404).json({ error: 'Schedule not found' });
    const schedule = rows[0];

    if (schedule.patient_id !== callerId && req.user.role !== 'doctor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const today = dateStr || new Date().toISOString().split('T')[0];
    const logKey = `${today}-${slot}`;
    const takenLogs = safeJson(schedule.taken_logs, {});
    takenLogs[logKey] = new Date().toISOString();

    // Calculate streak: count consecutive days where at least one dose was logged
    const dates = [...new Set(Object.keys(takenLogs).map(k => k.split('-').slice(0, 3).join('-')))].sort();
    let streak = 0;
    const todayDate = new Date(today);
    for (let i = dates.length - 1; i >= 0; i--) {
      const diff = Math.round((todayDate - new Date(dates[i])) / 86400000);
      if (diff === streak) streak++;
      else break;
    }

    await query(
      'UPDATE medication_schedules SET taken_logs=$1, streak_count=$2 WHERE id=$3',
      [JSON.stringify(takenLogs), streak, scheduleId]
    );

    const { rows: updated } = await query('SELECT * FROM medication_schedules WHERE id = $1', [scheduleId]);
    res.json({ success: true, schedule: parseSchedule(updated[0]), streak, streakCount: streak });
  } catch (err) {
    console.error('[Phase9] Log adherence dose error:', err);
    res.status(500).json({ error: 'Failed to log dose' });
  }
});

// DELETE /api/medications/adherence/:id — deactivate a medication schedule
router.delete('/medications/adherence/:id', requireAuth, async (req, res) => {
  try {
    const { id: callerId, role } = req.user;
    const { rows } = await query('SELECT * FROM medication_schedules WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Schedule not found' });
    if (rows[0].patient_id !== callerId && role !== 'doctor' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await query('UPDATE medication_schedules SET is_active=FALSE WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[Phase9] Deactivate schedule error:', err);
    res.status(500).json({ error: 'Failed to deactivate schedule' });
  }
});

export default router;
