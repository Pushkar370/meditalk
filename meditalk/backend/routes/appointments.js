import { Router } from 'express';
import { query } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pushNotification } from '../server.js';
import { enqueueEmail, scheduleReminders, cancelReminders } from '../services/jobQueue.js';



const router = Router();

// All appointment routes require authentication
router.use(requireAuth);

function mapAppt(r) {
  let triageSummary = null;
  if (r.triage_summary) {
    try {
      triageSummary = typeof r.triage_summary === 'string' ? JSON.parse(r.triage_summary) : r.triage_summary;
    } catch (_) {
      triageSummary = { clinicalSummary: r.triage_summary };
    }
  }
  return {
    id: r.id, patientId: r.patient_id, patientName: r.patient_name,
    doctorId: r.doctor_id, doctorName: r.doctor_name, specialty: r.specialty,
    date: r.date, time: r.time, type: r.type, status: r.status, reason: r.reason,
    videoStatus: r.video_status || null,
    urgency: r.urgency || 'routine',
    triageSummary,
    cancelledBy: r.cancelled_by || null,
    noShowReason: r.no_show_reason || null,
    checkInStatus: r.check_in_status || null,
    checkedInAt: r.checked_in_at || null,
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

// CW-6: GET /api/appointments/queue/today — Waiting Room Queue for today (ordered by check-in / room status)
router.get('/queue/today', async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { doctorId } = req.query;

    const todayStr = new Date().toISOString().slice(0, 10);
    let sql = `SELECT * FROM appointments WHERE date = $1 AND status NOT IN ('cancelled')`;
    const params = [todayStr];
    let idx = 2;

    if (role === 'doctor') {
      sql += ` AND doctor_id = $${idx++}`;
      params.push(callerId);
    } else if (doctorId) {
      sql += ` AND doctor_id = $${idx++}`;
      params.push(doctorId);
    }

    sql += ` ORDER BY
      CASE
        WHEN check_in_status = 'in_room' THEN 1
        WHEN check_in_status = 'checked_in' THEN 2
        WHEN status IN ('confirmed', 'upcoming') THEN 3
        ELSE 4
      END,
      time ASC`;

    const { rows } = await query(sql, params);
    const queue = rows.map((r) => {
      const appt = mapAppt(r);
      const waitMins = r.checked_in_at
        ? Math.max(0, Math.floor((Date.now() - new Date(r.checked_in_at).getTime()) / 60000))
        : null;
      return {
        ...appt,
        checkInStatus: r.check_in_status || 'scheduled',
        checkedInAt: r.checked_in_at,
        waitMinutes: waitMins,
      };
    });

    res.json({ success: true, date: todayStr, queue });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch waiting room queue' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Appointment not found' });
    const appt = mapAppt(rows[0]);

    // Ownership guard: patients can only read their own appointments
    if (role === 'patient' && appt.patientId !== callerId) {
      return res.status(403).json({ error: 'Forbidden — cannot access another patient\'s appointment' });
    }
    // Doctors can only read their own appointment records
    if (role === 'doctor' && appt.doctorId !== callerId) {
      return res.status(403).json({ error: 'Forbidden — cannot access another doctor\'s appointment' });
    }

    res.json(appt);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch appointment' }); }
});

// POST /api/appointments — book a new appointment with double-booking protection
router.post('/', async (req, res) => {
  try {
    const { patientId, patientName, doctorId, doctorName, specialty, date, time, type, reason, triageSummary, urgency } = req.body;
    if (!patientId || !doctorId || !date || !time) {
      return res.status(400).json({ error: 'patientId, doctorId, date and time are required' });
    }

    // --- Doctor Verification Guard ---
    const { rows: docCheck } = await query('SELECT verification_status, status FROM doctors WHERE id = $1', [doctorId]);
    if (docCheck.length > 0) {
      const doc = docCheck[0];
      if (doc.verification_status && doc.verification_status !== 'approved') {
        return res.status(403).json({
          error: 'This doctor is currently unavailable for bookings.',
          code: 'DOCTOR_UNVERIFIED',
        });
      }
    }

    // CW-2: Check if doctor has scheduled leave on this date
    const { rows: unavailCheck } = await query(
      'SELECT reason FROM doctor_unavailability WHERE doctor_id = $1 AND date = $2',
      [doctorId, date]
    );
    if (unavailCheck.length > 0) {
      return res.status(409).json({
        error: `Doctor is unavailable on this date (${unavailCheck[0].reason || 'On Leave'}). Please choose another date.`,
        code: 'DOCTOR_UNAVAILABLE',
      });
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

    const serializedTriage = triageSummary ? (typeof triageSummary === 'string' ? triageSummary : JSON.stringify(triageSummary)) : null;
    const triageUrgency = urgency || (triageSummary?.urgency) || 'routine';

    const id = 'A-' + Date.now();
    await query(
      `INSERT INTO appointments (id, patient_id, patient_name, doctor_id, doctor_name, specialty, date, time, type, status, reason, triage_summary, urgency) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'upcoming',$10,$11,$12)`,
      [id, patientId, patientName, doctorId, doctorName, specialty, date, time, type, reason, serializedTriage, triageUrgency]
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

    // Email: send confirmation + schedule reminders
    try {
      const { rows: pRows } = await query('SELECT email FROM patients WHERE id = $1', [patientId]);
      const patientEmail = pRows[0]?.email;
      if (patientEmail) {
        const apptObj = { id, patient_name: patientName, doctor_name: doctorName, specialty, date, time, type };
        // Queue immediate confirmation email
        await enqueueEmail('send-confirmation', { ...apptObj, patientEmail, appointmentId: id });
        // Schedule 24h and 2h reminders
        await scheduleReminders(apptObj, patientEmail);
      }
    } catch (emailErr) {
      console.warn('[Appointments] Email scheduling failed (non-fatal):', emailErr.message);
    }

    const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [id]);
    res.status(201).json({ success: true, appointment: mapAppt(rows[0]) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create appointment' }); }
});

router.patch('/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body || {};
    const cancelledBy = req.user.role === 'patient' ? 'patient' : req.user.role;

    // Fetch appointment BEFORE update so we have old data for emails
    const { rows: preRows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!preRows[0]) return res.status(404).json({ error: 'Appointment not found' });
    const a = preRows[0];

    const { rowCount } = await query(
      "UPDATE appointments SET status='cancelled', cancelled_by=$1 WHERE id=$2",
      [cancelledBy, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });

    // In-app notifications
    try {
      const patientUserId = await getUserId(a.patient_id, null);
      const doctorUserId  = await getUserId(null, a.doctor_id);
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
      try { pushNotification(doctorUserId,  { id: ndId, type: 'appointment_cancelled', title: 'Appointment Cancelled', message: dMsg }); } catch (_) {}
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, $2, 'User', $3, 'Appointment', $4, 'success')`,
        [a.patient_id, a.patient_name, reason ? `Cancelled appointment. Reason: ${reason}` : 'Cancelled appointment', req.params.id]
      );
    } catch (_) {}

    // Cancel scheduled reminders + send cancellation email
    try {
      await cancelReminders(req.params.id);
      const { rows: pRows } = await query('SELECT email FROM patients WHERE id = $1', [a.patient_id]);
      const patientEmail = pRows[0]?.email;
      if (patientEmail) {
        await enqueueEmail('send-cancellation', {
          patientEmail,
          patientName: a.patient_name,
          doctorName:  a.doctor_name,
          date:        a.date,
          time:        a.time,
          cancelledBy: cancelledBy === 'patient' ? 'you' : `the clinic`,
          reason,
        });
      }
    } catch (_) {}

    res.json({ success: true, id: req.params.id });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to cancel appointment' }); }
});

router.patch('/:id/reschedule', async (req, res) => {
  try {
    const { date, time } = req.body;
    if (!date || !time) return res.status(400).json({ error: 'date and time are required' });

    // Fetch full appointment BEFORE update so we have old date/time for the email
    const { rows: preRows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!preRows[0]) return res.status(404).json({ error: 'Appointment not found' });
    const oldDate = preRows[0].date;
    const oldTime = preRows[0].time;
    const doctorId = preRows[0].doctor_id;

    // CW-2: Check if doctor has scheduled leave on this date
    const { rows: unavailConflict } = await query(
      'SELECT reason FROM doctor_unavailability WHERE doctor_id = $1 AND date = $2',
      [doctorId, date]
    );
    if (unavailConflict.length > 0) {
      return res.status(409).json({
        error: `Doctor is unavailable on this date (${unavailConflict[0].reason || 'On Leave'}). Please choose another date.`,
        code: 'DOCTOR_UNAVAILABLE',
      });
    }

    // Conflict check: doctor already booked at new slot (exclude this appointment)
    const { rows: conflict } = await query(
      `SELECT id FROM appointments WHERE doctor_id = $1 AND date = $2 AND time = $3
         AND status NOT IN ('cancelled') AND id != $4 LIMIT 1`,
      [doctorId, date, time, req.params.id]
    );
    if (conflict.length > 0) {
      return res.status(409).json({ error: 'That time slot is already booked. Please select another.', code: 'SLOT_CONFLICT' });
    }

    const { rowCount } = await query(
      "UPDATE appointments SET date=$1, time=$2, status='confirmed' WHERE id=$3",
      [date, time, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });

    // In-app notifications
    try {
      const a = preRows[0];
      const patientUserId = await getUserId(a.patient_id, null);
      const doctorUserId  = await getUserId(null, a.doctor_id);
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
      try { pushNotification(doctorUserId,  { id: nrdId, type: 'appointment_confirmed', title: 'Appointment Rescheduled', message: dRMsg }); } catch (_) {}
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, $2, 'User', 'Rescheduled appointment', 'Appointment', $3, 'success')`,
        [a.patient_id, a.patient_name, req.params.id]
      );
    } catch (_) {}

    // Cancel old reminders, send reschedule email with correct old/new times, schedule new reminders
    try {
      await cancelReminders(req.params.id);
      const a = preRows[0];
      const { rows: pRows } = await query('SELECT email FROM patients WHERE id = $1', [a.patient_id]);
      const patientEmail = pRows[0]?.email;
      if (patientEmail) {
        await enqueueEmail('send-reschedule', {
          patientEmail,
          patientName: a.patient_name,
          doctorName:  a.doctor_name,
          oldDate,           // correct: fetched before UPDATE
          oldTime,           // correct: fetched before UPDATE
          newDate: date,
          newTime: time,
        });
        await scheduleReminders({ ...a, date, time }, patientEmail);
      }
    } catch (_) {}

    res.json({ success: true, id: req.params.id });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to reschedule appointment' }); }
});

// PATCH /api/appointments/:id/mark-no-show — doctors/admins record a no-show (CW-7)
router.patch('/:id/mark-no-show', requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const { reason } = req.body || {};
    const { rowCount } = await query(
      "UPDATE appointments SET status='no_show', no_show_reason=$1 WHERE id=$2",
      [reason || null, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });

    // Audit log
    try {
      const { rows } = await query('SELECT * FROM appointments WHERE id=$1', [req.params.id]);
      if (rows[0]) {
        const a = rows[0];
        await query(
          `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
           VALUES ($1, $2, 'Doctor', 'Marked appointment as no-show', 'Appointment', $3, 'success')`,
          [a.doctor_id, a.doctor_name, req.params.id]
        );
      }
    } catch (_) {}

    res.json({ success: true, id: req.params.id, status: 'no_show' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to mark no-show' }); }
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

// PATCH /api/appointments/:id — status update (doctors and admins only)
router.patch('/:id', requireAuth, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const { rowCount } = await query('UPDATE appointments SET status = $1 WHERE id = $2', [status, req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });

    try {
      const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
      if (rows[0]) {
        const a = rows[0];
        const patientUserId = await getUserId(a.patient_id, null);
        if (patientUserId) {
          const statNotifId = 'N-' + Date.now();
          const statMsg = `Your appointment status is now: ${status}.`;
          await query(
            `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'appointment_confirmed','Appointment Updated',$3,false)`,
            [statNotifId, patientUserId, statMsg]
          );
          try { pushNotification(patientUserId, { id: statNotifId, type: 'appointment_confirmed', title: 'Appointment Updated', message: statMsg }); } catch (_) {}
        }
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

// CW-6: PATCH /api/appointments/:id/check-in — Patient or receptionist marks check-in
router.patch('/:id/check-in', async (req, res) => {
  try {
    const { rows: aRows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!aRows[0]) return res.status(404).json({ error: 'Appointment not found' });
    const a = aRows[0];

    const { rowCount } = await query(
      "UPDATE appointments SET check_in_status = 'checked_in', checked_in_at = NOW() WHERE id = $1",
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });

    // Notify doctor
    try {
      const docUserId = await getUserId(null, a.doctor_id);
      if (docUserId) {
        const nId = 'N-' + Date.now();
        const msg = `Patient ${a.patient_name} has checked in and is waiting in the clinic.`;
        await query(
          `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'appointment_confirmed','Patient Checked In',$3,false)`,
          [nId, docUserId, msg]
        );
        try { pushNotification(docUserId, { id: nId, type: 'appointment_confirmed', title: 'Patient Checked In', message: msg, appointmentId: req.params.id }); } catch (_) {}
      }
    } catch (_) {}

    res.json({ success: true, id: req.params.id, checkInStatus: 'checked_in' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

// CW-6: PATCH /api/appointments/:id/queue-status — Doctor/Admin updates patient queue status
router.patch('/:id/queue-status', requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const { checkInStatus } = req.body;
    const allowed = ['scheduled', 'checked_in', 'in_room', 'completed', 'no_show'];
    if (!checkInStatus || !allowed.includes(checkInStatus)) {
      return res.status(400).json({ error: `checkInStatus must be one of: ${allowed.join(', ')}` });
    }

    let extraSet = '';
    const params = [checkInStatus, req.params.id];
    if (checkInStatus === 'checked_in') {
      extraSet = ', checked_in_at = COALESCE(checked_in_at, NOW())';
    } else if (checkInStatus === 'completed') {
      extraSet = ", status = 'completed'";
    } else if (checkInStatus === 'no_show') {
      extraSet = ", status = 'no_show'";
    }

    const { rowCount } = await query(
      `UPDATE appointments SET check_in_status = $1 ${extraSet} WHERE id = $2`,
      params
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });

    // Notify patient if called into room
    if (checkInStatus === 'in_room') {
      try {
        const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
        if (rows[0]) {
          const a = rows[0];
          const patientUserId = await getUserId(a.patient_id, null);
          if (patientUserId) {
            const nId = 'N-' + Date.now();
            const msg = `Dr. ${a.doctor_name} is ready for you! Please proceed to consultation.`;
            await query(
              `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'appointment_confirmed','Doctor Is Ready',$3,false)`,
              [nId, patientUserId, msg]
            );
            try { pushNotification(patientUserId, { id: nId, type: 'appointment_confirmed', title: 'Doctor Is Ready', message: msg, appointmentId: req.params.id }); } catch (_) {}
          }
        }
      } catch (_) {}
    }

    res.json({ success: true, id: req.params.id, checkInStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update queue status' });
  }
});

export default router;
