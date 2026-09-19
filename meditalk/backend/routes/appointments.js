import { Router } from 'express';
import { query } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { pushNotification } from '../server.js';

const router = Router();

// All appointment routes require authentication
router.use(requireAuth);

function mapAppt(r) {
  return {
    id: r.id, patientId: r.patient_id, patientName: r.patient_name,
    doctorId: r.doctor_id, doctorName: r.doctor_name, specialty: r.specialty,
    date: r.date, time: r.time, type: r.type, status: r.status, reason: r.reason,
    videoStatus: r.video_status || null,
  };
}

// Helper: resolve the users.id for a given patient_id or doctor_id
// Notifications table has FK → users.id, not patient_id/doctor_id
async function getUserId(patientId, doctorId) {
  if (patientId) {
    const { rows } = await query('SELECT id FROM users WHERE patient_id = $1 LIMIT 1', [patientId]);
    if (rows[0]) return rows[0].id;
  }
  if (doctorId) {
    const { rows } = await query('SELECT id FROM users WHERE doctor_id = $1 LIMIT 1', [doctorId]);
    if (rows[0]) return rows[0].id;
  }
  return patientId || doctorId; // fallback
}


// GET /api/appointments — filtered by role automatically
router.get('/', async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { patientId, doctorId, status, date, specialty, type } = req.query;

    let sql = 'SELECT * FROM appointments';
    const conditions = []; const params = []; let idx = 1;

    // Enforce data scoping by role
    if (role === 'patient') {
      conditions.push('patient_id = $' + idx++);
      params.push(callerId);
    } else if (role === 'doctor') {
      conditions.push('doctor_id = $' + idx++);
      params.push(callerId);
    } else {
      // admin can filter freely
      if (patientId) { conditions.push('patient_id = $' + idx++); params.push(patientId); }
      if (doctorId) { conditions.push('doctor_id = $' + idx++); params.push(doctorId); }
    }

    if (status) { conditions.push('status = $' + idx++); params.push(status); }
    if (date) { conditions.push('date = $' + idx++); params.push(date); }
    if (specialty) { conditions.push('specialty = $' + idx++); params.push(specialty); }
    if (type) { conditions.push('type = $' + idx++); params.push(type); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY date DESC, time ASC';
    const { rows } = await query(sql, params);
    res.json(rows.map(mapAppt));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch appointments' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appointment not found' });
    res.json(mapAppt(rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch appointment' }); }
});

// POST /api/appointments — book a new appointment with double-booking protection
router.post('/', async (req, res) => {
  try {
    const { patientId, patientName, doctorId, doctorName, specialty, date, time, type, reason } = req.body;
    if (!patientId || !doctorId || !date || !time) {
      return res.status(400).json({ error: 'patientId, doctorId, date and time are required' });
    }

    // --- Double-booking collision detection ---
    // Check: is the doctor already booked at this exact date+time with an active status?
    const { rows: doctorConflict } = await query(
      `SELECT id FROM appointments
       WHERE doctor_id = $1 AND date = $2 AND time = $3
         AND status NOT IN ('cancelled')
       LIMIT 1`,
      [doctorId, date, time]
    );
    if (doctorConflict.length > 0) {
      return res.status(409).json({
        error: 'This time slot has just been booked. Please select another time.',
        code: 'SLOT_CONFLICT',
      });
    }

    // Check: does the patient already have an active appointment at the same date+time?
    const { rows: patientConflict } = await query(
      `SELECT id FROM appointments
       WHERE patient_id = $1 AND date = $2 AND time = $3
         AND status NOT IN ('cancelled')
       LIMIT 1`,
      [patientId, date, time]
    );
    if (patientConflict.length > 0) {
      return res.status(409).json({
        error: 'You already have an appointment at this time. Please choose a different slot.',
        code: 'PATIENT_CONFLICT',
      });
    }
    // ------------------------------------------

    const id = 'A-' + Date.now();
    await query(
      `INSERT INTO appointments (id, patient_id, patient_name, doctor_id, doctor_name, specialty, date, time, type, status, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'upcoming',$10)`,
      [id, patientId, patientName, doctorId, doctorName, specialty, date, time, type, reason]
    );

    // Notify both Patient and Doctor (resolve users.id via getUserId for FK constraint)
    try {
      const patientUserId = await getUserId(patientId, null);
      const doctorUserId = await getUserId(null, doctorId);
      const nPatientId = 'N-' + Date.now();
      const nDoctorId = 'N-' + (Date.now() + 1);
      const patientMsg = `Your appointment with ${doctorName || 'Doctor'} on ${date} at ${time} is scheduled.`;
      const doctorMsg = `New appointment booked by ${patientName || 'Patient'} on ${date} at ${time}.`;

      await query(
        `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'appointment_confirmed','Appointment Booked',$3,false)`,
        [nPatientId, patientUserId, patientMsg]
      );
      await query(
        `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'appointment_confirmed','New Patient Appointment',$3,false)`,
        [nDoctorId, doctorUserId, doctorMsg]
      );

      try { pushNotification(patientUserId, { id: nPatientId, type: 'appointment_confirmed', title: 'Appointment Booked', message: patientMsg }); } catch (_) {}
      try { pushNotification(doctorUserId, { id: nDoctorId, type: 'appointment_confirmed', title: 'New Patient Appointment', message: doctorMsg }); } catch (_) {}

      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, $2, 'Patient', 'Booked appointment with ' || $3, 'Appointment', $4, 'success')`,
        [patientId, patientName || 'Patient', doctorName || 'Doctor', id]
      );
    } catch (_) {}

    const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [id]);
    res.status(201).json({ success: true, appointment: mapAppt(rows[0]) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create appointment' }); }
});

router.patch('/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body || {};
    const { rowCount } = await query("UPDATE appointments SET status = 'cancelled' WHERE id = $1", [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });

    try {
      const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
      if (rows[0]) {
        const a = rows[0];
        const patientUserId = await getUserId(a.patient_id, null);
        const doctorUserId = await getUserId(null, a.doctor_id);
        const npId = 'N-' + Date.now();
        const ndId = 'N-' + (Date.now() + 1);
        const pMsg = `Your appointment on ${a.date} at ${a.time} has been cancelled.${reason ? ' Reason: ' + reason : ''}`;
        const dMsg = `Appointment with ${a.patient_name} on ${a.date} has been cancelled.${reason ? ' Reason: ' + reason : ''}`;

        await query(
          `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'appointment_cancelled','Appointment Cancelled',$3,false)`,
          [npId, patientUserId, pMsg]
        );
        await query(
          `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'appointment_cancelled','Appointment Cancelled',$3,false)`,
          [ndId, doctorUserId, dMsg]
        );

        try { pushNotification(patientUserId, { id: npId, type: 'appointment_cancelled', title: 'Appointment Cancelled', message: pMsg }); } catch (_) {}
        try { pushNotification(doctorUserId, { id: ndId, type: 'appointment_cancelled', title: 'Appointment Cancelled', message: dMsg }); } catch (_) {}
        await query(
          `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
           VALUES ($1, $2, 'User', $3, 'Appointment', $4, 'success')`,
          [a.patient_id, a.patient_name, reason ? `Cancelled appointment. Reason: ${reason}` : 'Cancelled appointment', req.params.id]
        );
      }
    } catch (_) {}

    res.json({ success: true, id: req.params.id });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to cancel appointment' }); }
});

router.patch('/:id/reschedule', async (req, res) => {
  try {
    const { date, time } = req.body;
    if (!date || !time) return res.status(400).json({ error: 'date and time are required' });

    // Check if new slot is already taken by the same doctor
    const { rows: existing } = await query('SELECT doctor_id FROM appointments WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Appointment not found' });

    const doctorId = existing[0].doctor_id;
    const { rows: conflict } = await query(
      `SELECT id FROM appointments WHERE doctor_id = $1 AND date = $2 AND time = $3
         AND status NOT IN ('cancelled') AND id != $4 LIMIT 1`,
      [doctorId, date, time, req.params.id]
    );
    if (conflict.length > 0) {
      return res.status(409).json({ error: 'That time slot is already booked. Please select another.', code: 'SLOT_CONFLICT' });
    }

    const { rowCount } = await query("UPDATE appointments SET date = $1, time = $2, status = 'confirmed' WHERE id = $3", [date, time, req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });

    try {
      const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
      if (rows[0]) {
        const a = rows[0];
        const patientUserId = await getUserId(a.patient_id, null);
        const doctorUserId = await getUserId(null, a.doctor_id);
        const nrpId = 'N-' + Date.now();
        const nrdId = 'N-' + (Date.now() + 1);
        const pRMsg = `Your appointment has been rescheduled to ${date} at ${time}.`;
        const dRMsg = `Appointment with ${a.patient_name} rescheduled to ${date} at ${time}.`;

        await query(
          `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'appointment_confirmed','Appointment Rescheduled',$3,false)`,
          [nrpId, patientUserId, pRMsg]
        );
        await query(
          `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'appointment_confirmed','Appointment Rescheduled',$3,false)`,
          [nrdId, doctorUserId, dRMsg]
        );

        try { pushNotification(patientUserId, { id: nrpId, type: 'appointment_confirmed', title: 'Appointment Rescheduled', message: pRMsg }); } catch (_) {}
        try { pushNotification(doctorUserId, { id: nrdId, type: 'appointment_confirmed', title: 'Appointment Rescheduled', message: dRMsg }); } catch (_) {}
        await query(
          `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
           VALUES ($1, $2, 'User', 'Rescheduled appointment', 'Appointment', $3, 'success')`,
          [a.patient_id, a.patient_name, req.params.id]
        );
      }
    } catch (_) {}

    res.json({ success: true, id: req.params.id });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to reschedule appointment' }); }
});

// PATCH /api/appointments/:id/video-status — update video call lifecycle
router.patch('/:id/video-status', async (req, res) => {
  try {
    const { videoStatus } = req.body;
    const allowed = ['waiting', 'in_progress', 'ended'];
    if (!videoStatus || !allowed.includes(videoStatus)) {
      return res.status(400).json({ error: `videoStatus must be one of: ${allowed.join(', ')}` });
    }
    const { rowCount } = await query(
      'UPDATE appointments SET video_status = $1 WHERE id = $2',
      [videoStatus, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });

    // Notify patient when doctor starts the call
    if (videoStatus === 'in_progress') {
      try {
        const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
        if (rows[0]) {
          const a = rows[0];
          const patientUserId = await getUserId(a.patient_id, null);
          const callMsg = `Dr. ${a.doctor_name} has started your video consultation. Join now!`;
          const callId = 'N-' + Date.now();
          await query(
            `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'appointment_confirmed','Video Call Started',$3,false)`,
            [callId, patientUserId, callMsg]
          );
          try { pushNotification(patientUserId, { id: callId, type: 'appointment_confirmed', title: 'Video Call Started', message: callMsg }); } catch (_) {}
        }
      } catch (_) {}
    }

    res.json({ success: true, id: req.params.id, videoStatus });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update video status' }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const { rowCount } = await query('UPDATE appointments SET status = $1 WHERE id = $2', [status, req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });

    try {
      const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
      if (rows[0]) {
        const a = rows[0];
        await query(
          `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'appointment_confirmed','Appointment Updated',$3,false)`,
          ['N-' + Date.now(), a.patient_id, `Your appointment status is now: ${status}.`]
        );
        await query(
          `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
           VALUES ($1, $2, 'Doctor', 'Updated appointment status to ' || $3, 'Appointment', $4, 'success')`,
          [a.doctor_id, a.doctor_name, status, req.params.id]
        );
      }
    } catch (_) {}

    res.json({ success: true, id: req.params.id, status });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update appointment' }); }
});

export default router;
