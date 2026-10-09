import { Router } from 'express';
import { query } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pushNotification } from '../server.js';
import { enqueueEmail, scheduleReminders, cancelReminders } from '../services/jobQueue.js';
import {
  sendWhatsAppMessage,
  buildWhatsAppTemplate,
  generateWhatsAppLink,
} from '../services/messagingService.js';
import { logAudit, getClientIp } from '../services/auditService.js';



const router = Router();

// All appointment routes require authentication
router.use(requireAuth);

function mapAppt(r, role = null) {
  let triageSummary = null;
  if (r.triage_summary && role !== 'receptionist') {
    try {
      triageSummary = typeof r.triage_summary === 'string' ? JSON.parse(r.triage_summary) : r.triage_summary;
    } catch (_) {
      triageSummary = { clinicalSummary: r.triage_summary };
    }
  }
  let vitals = {};
  if (r.vitals && role !== 'receptionist') {
    try {
      vitals = typeof r.vitals === 'string' ? JSON.parse(r.vitals) : r.vitals;
    } catch (_) {}
  } else if (role === 'receptionist') {
    vitals = null;
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
    telehealthConsent: r.telehealth_consent || false,
    telehealthConsentAt: r.telehealth_consent_at || null,
    vitals,
    vitalsRecordedBy: role === 'receptionist' ? null : (r.vitals_recorded_by || null),
    vitalsRecordedAt: role === 'receptionist' ? null : (r.vitals_recorded_at || null),
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
    res.json(rows.map(r => mapAppt(r, role)));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch appointments' }); }
});

// CW-6: GET /api/appointments/queue/today — Waiting Room Queue for today (ordered by check-in / room status)
router.get('/queue/today', async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { doctorId } = req.query;

    if (role === 'patient') {
      return res.status(403).json({ error: 'Forbidden — patients cannot view clinic waiting room queue' });
    }

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
      const appt = mapAppt(r, role);
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
    const appt = mapAppt(rows[0], role);

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

    const { role } = req.user;

    // Access control:
    // (1) Patients can ONLY book appointments for themselves.
    // (2) Doctors cannot create appointments directly to gain clinical access.
    // (3) Nurses cannot book appointments.
    if (role === 'patient') {
      const callerPatientId = req.user.patientId || req.user.id || req.user.userId;
      if (patientId !== callerPatientId && patientId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden — patients can only book appointments for themselves' });
      }
    } else if (role === 'doctor') {
      return res.status(403).json({ error: 'Forbidden — doctors cannot book appointments for patients directly' });
    } else if (role === 'nurse') {
      return res.status(403).json({ error: 'Forbidden — nurses cannot book appointments' });
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
    const bookedBy = role === 'patient' ? patientId : role;

    const id = 'A-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    await query(
      `INSERT INTO appointments (id, patient_id, patient_name, doctor_id, doctor_name, specialty, date, time, type, status, reason, triage_summary, urgency, booked_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'upcoming',$10,$11,$12,$13)`,
      [id, patientId, patientName, doctorId, doctorName, specialty, date, time, type, reason, serializedTriage, triageUrgency, bookedBy]
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

      logAudit({
        userId: req.user.id || req.user.userId,
        userName: req.user.name || 'User',
        role,
        action: `Booked appointment with ${doctorName || 'Doctor'}`,
        entityType: 'Appointment',
        entityId: id,
        status: 'success',
        ipAddress: getClientIp(req),
        userAgent: req.headers?.['user-agent'],
      });
    } catch (_) {}

    // Email & WhatsApp: send confirmation + schedule reminders
    let whatsappLink = null;
    try {
      const { rows: pRows } = await query('SELECT email, phone FROM patients WHERE id = $1', [patientId]);
      const patientEmail = pRows[0]?.email;
      const patientPhone = pRows[0]?.phone;
      const apptObj = { id, patient_name: patientName, doctor_name: doctorName, specialty, date, time, type };

      if (patientEmail) {
        // Queue immediate confirmation email
        await enqueueEmail('send-confirmation', { ...apptObj, patientEmail, appointmentId: id });
        // Schedule 24h and 2h email reminders
        await scheduleReminders(apptObj, patientEmail, patientPhone);
      }

      if (patientPhone) {
        // Build instant WhatsApp click-to-chat link
        const waText = buildWhatsAppTemplate('confirmation', {
          patientName,
          doctorName,
          specialty,
          date,
          time,
          appointmentType: type === 'video' ? 'Video Consultation' : 'In-Clinic Visit',
          appointmentId: id,
        });
        whatsappLink = generateWhatsAppLink(patientPhone, waText);

        // Queue or dispatch automated WhatsApp alert
        try {
          await sendWhatsAppMessage({
            to: patientPhone,
            type: 'confirmation',
            data: {
              patientName,
              doctorName,
              specialty,
              date,
              time,
              appointmentType: type === 'video' ? 'Video Consultation' : 'In-Clinic Visit',
              appointmentId: id,
            },
          });
        } catch (_) {}
      }
    } catch (msgErr) {
      console.warn('[Appointments] Notification scheduling failed (non-fatal):', msgErr.message);
    }

    const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [id]);
    res.status(201).json({ success: true, appointment: mapAppt(rows[0], role), whatsappLink });
  } catch (err) {
    if (err.code === '23505') {
      const isPatientConflict = (err.constraint && err.constraint.includes('patient')) ||
                                (err.detail && err.detail.includes('patient_id'));
      if (isPatientConflict) {
        return res.status(409).json({
          error: 'You already have an appointment at this time. Please choose a different slot.',
          code: 'PATIENT_CONFLICT',
        });
      }
      return res.status(409).json({
        error: 'This time slot has just been booked. Please select another time.',
        code: 'SLOT_CONFLICT',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

router.patch('/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body || {};
    const cancelledBy = req.user.role === 'patient' ? 'patient' : req.user.role;

    // Fetch appointment BEFORE update so we have old data for emails
    const { rows: preRows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!preRows[0]) return res.status(404).json({ error: 'Appointment not found' });
    const a = preRows[0];

    // Ownership guard: Patients can only cancel own appointments; Doctors only their own
    const { role, id: callerId, userId } = req.user;
    if (role === 'patient') {
      if (a.patient_id !== callerId && a.patient_id !== userId) {
        return res.status(403).json({ error: 'Forbidden — you can only cancel your own appointments' });
      }
    } else if (role === 'doctor') {
      const callerDocId = req.user.doctorId || callerId;
      if (a.doctor_id !== callerDocId) {
        return res.status(403).json({ error: 'Forbidden — you can only cancel appointments under your care' });
      }
    }

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
      logAudit({
        userId: a.patient_id,
        userName: a.patient_name,
        role: 'User',
        action: reason ? `Cancelled appointment. Reason: ${reason}` : 'Cancelled appointment',
        entityType: 'Appointment',
        entityId: req.params.id,
        status: 'success',
        ipAddress: getClientIp(req),
        userAgent: req.headers?.['user-agent'],
      });
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

    // Ownership guard: Patients can only reschedule own appointments; Doctors only their own
    const { role, id: callerId, userId } = req.user;
    if (role === 'patient') {
      if (preRows[0].patient_id !== callerId && preRows[0].patient_id !== userId) {
        return res.status(403).json({ error: 'Forbidden — you can only reschedule your own appointments' });
      }
    } else if (role === 'doctor') {
      const callerDocId = req.user.doctorId || callerId;
      if (doctorId !== callerDocId) {
        return res.status(403).json({ error: 'Forbidden — you can only reschedule appointments under your care' });
      }
    }

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
      logAudit({
        userId: a.patient_id,
        userName: a.patient_name,
        role: 'User',
        action: 'Rescheduled appointment',
        entityType: 'Appointment',
        entityId: req.params.id,
        status: 'success',
        ipAddress: getClientIp(req),
        userAgent: req.headers?.['user-agent'],
      });
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
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'That time slot is already booked. Please select another.',
        code: 'SLOT_CONFLICT',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to reschedule appointment' });
  }
});

// PATCH /api/appointments/:id/mark-no-show — doctors/admins record a no-show (CW-7)
router.patch('/:id/mark-no-show', requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const { rows: aRows } = await query('SELECT doctor_id FROM appointments WHERE id = $1', [req.params.id]);
    if (!aRows[0]) return res.status(404).json({ error: 'Appointment not found' });
    if (req.user.role === 'doctor') {
      const callerDocId = req.user.doctorId || req.user.id;
      if (aRows[0].doctor_id !== callerDocId) {
        return res.status(403).json({ error: 'Forbidden — you can only update appointments under your care' });
      }
    }

    const { reason } = req.body || {};
    const { rowCount } = await query(
      "UPDATE appointments SET status='no_show', no_show_reason=$1 WHERE id=$2",
      [reason || null, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });

    // Audit log
    const { rows } = await query('SELECT * FROM appointments WHERE id=$1', [req.params.id]);
    if (rows[0]) {
      const a = rows[0];
      logAudit({
        userId: a.doctor_id,
        userName: a.doctor_name,
        role: 'Doctor',
        action: 'Marked appointment as no-show',
        entityType: 'Appointment',
        entityId: req.params.id,
        status: 'success',
        ipAddress: getClientIp(req),
        userAgent: req.headers?.['user-agent'],
      });
    }

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

    const { rows: aRows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!aRows[0]) return res.status(404).json({ error: 'Appointment not found' });
    const a = aRows[0];

    const { role, id: callerId, userId } = req.user;
    if (role === 'patient' && a.patient_id !== callerId && a.patient_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (role === 'doctor') {
      const callerDocId = req.user.doctorId || callerId;
      if (a.doctor_id !== callerDocId) return res.status(403).json({ error: 'Forbidden' });
    }

    const { rowCount } = await query(
      'UPDATE appointments SET video_status = $1 WHERE id = $2',
      [videoStatus, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });

    // Notify patient when doctor starts the call
    if (videoStatus === 'in_progress') {
      try {
        const patientUserId = await getUserId(a.patient_id, null);
        const callMsg = `Dr. ${a.doctor_name} has started your video consultation. Join now!`;
        const callId = 'N-' + Date.now();
        await query(
          `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'appointment_confirmed','Video Call Started',$3,false)`,
          [callId, patientUserId, callMsg]
        );
        try { pushNotification(patientUserId, { id: callId, type: 'appointment_confirmed', title: 'Video Call Started', message: callMsg }); } catch (_) {}
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

    const { rows: aRows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!aRows[0]) return res.status(404).json({ error: 'Appointment not found' });
    const a = aRows[0];

    if (req.user.role === 'doctor') {
      const callerDocId = req.user.doctorId || req.user.id;
      if (a.doctor_id !== callerDocId) {
        return res.status(403).json({ error: 'Forbidden — you can only update appointments under your care' });
      }
    }

    const { rowCount } = await query('UPDATE appointments SET status = $1 WHERE id = $2', [status, req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });

    try {
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
      logAudit({
        userId: a.doctor_id,
        userName: a.doctor_name,
        role: 'Doctor',
        action: `Updated appointment status to ${status}`,
        entityType: 'Appointment',
        entityId: req.params.id,
        status: 'success',
        ipAddress: getClientIp(req),
        userAgent: req.headers?.['user-agent'],
      });
    } catch (_) {}

    res.json({ success: true, id: req.params.id, status });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update appointment' }); }
});

// CW-6: PATCH /api/appointments/:id/check-in — Patient or clinic staff/admin marks check-in
router.patch('/:id/check-in', async (req, res) => {
  try {
    const { rows: aRows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!aRows[0]) return res.status(404).json({ error: 'Appointment not found' });
    const a = aRows[0];

    const { role, id: callerId, userId, patientId } = req.user;
    if (role === 'patient') {
      const isOwner = a.patient_id === callerId || a.patient_id === userId || (patientId && a.patient_id === patientId);
      if (!isOwner) {
        return res.status(403).json({ error: 'Forbidden — you can only check in for your own appointments' });
      }
    } else if (role === 'doctor') {
      const callerDocId = req.user.doctorId || callerId;
      if (a.doctor_id !== callerDocId) {
        return res.status(403).json({ error: 'Forbidden — you can only check in for appointments under your care' });
      }
    } else if (role === 'receptionist' || role === 'nurse' || role === 'admin') {
      // Clinic staff & admins are explicitly authorized to manage check-ins
    } else {
      return res.status(403).json({ error: 'Forbidden — unauthorized role for patient check-in' });
    }

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

// PATCH /api/appointments/:id/telehealth-consent — Patient records informed consent for virtual visit
router.patch('/:id/telehealth-consent', async (req, res) => {
  try {
    const { rows: aRows } = await query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!aRows[0]) return res.status(404).json({ error: 'Appointment not found' });
    const a = aRows[0];

    const { role, id: callerId, userId, patientId } = req.user;
    if (role === 'patient') {
      const isOwner = a.patient_id === callerId || a.patient_id === userId || (patientId && a.patient_id === patientId);
      if (!isOwner) {
        return res.status(403).json({ error: 'Forbidden — you can only consent to your own appointments' });
      }
    } else if (role !== 'admin' && role !== 'doctor') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await query(
      `UPDATE appointments SET telehealth_consent = TRUE, telehealth_consent_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    res.json({
      success: true,
      id: req.params.id,
      telehealthConsent: true,
      message: 'Telehealth informed consent recorded successfully.'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record telehealth consent' });
  }
});

// CW-6: PATCH /api/appointments/:id/queue-status — Doctor, Staff or Admin updates patient queue status
router.patch('/:id/queue-status', requireRole('doctor', 'admin', 'receptionist', 'nurse'), async (req, res) => {
  try {
    const { checkInStatus } = req.body;
    const allowed = ['scheduled', 'checked_in', 'in_room', 'completed', 'no_show'];
    if (!checkInStatus || !allowed.includes(checkInStatus)) {
      return res.status(400).json({ error: `checkInStatus must be one of: ${allowed.join(', ')}` });
    }

    const { rows: aRows } = await query('SELECT doctor_id FROM appointments WHERE id = $1', [req.params.id]);
    if (!aRows[0]) return res.status(404).json({ error: 'Appointment not found' });
    if (req.user.role === 'doctor') {
      const callerDocId = req.user.doctorId || req.user.id;
      if (aRows[0].doctor_id !== callerDocId) {
        return res.status(403).json({ error: 'Forbidden — you can only manage queue for appointments under your care' });
      }
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
