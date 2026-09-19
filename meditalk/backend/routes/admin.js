import { Router } from 'express';
import { query } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pushNotification } from '../server.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(requireAuth, requireRole('admin'));


router.get('/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [tp, td, ta, cc, ca, pa, pv] = await Promise.all([
      query('SELECT COUNT(*) as count FROM patients'),
      query('SELECT COUNT(*) as count FROM doctors'),
      query('SELECT COUNT(*) as count FROM appointments WHERE date = $1', [today]),
      query("SELECT COUNT(*) as count FROM appointments WHERE status = 'completed'"),
      query("SELECT COUNT(*) as count FROM appointments WHERE status = 'cancelled'"),
      query("SELECT COUNT(*) as count FROM appointments WHERE status IN ('upcoming', 'confirmed')"),
      query("SELECT COUNT(*) as count FROM doctors WHERE verification_status = 'pending'"),
    ]);
    res.json({
      totalPatients: parseInt(tp.rows[0].count),
      totalDoctors: parseInt(td.rows[0].count),
      todayAppointments: parseInt(ta.rows[0].count),
      completedConsultations: parseInt(cc.rows[0].count),
      cancelledAppointments: parseInt(ca.rows[0].count),
      pendingAppointments: parseInt(pa.rows[0].count),
      pendingVerifications: parseInt(pv.rows[0].count),
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch admin stats' }); }
});

// ── Doctor Verification ─────────────────────────────────────────────────────

// GET /api/admin/doctors/pending — list pending doctors
router.get('/doctors/pending', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT d.*, u.id as user_id
       FROM doctors d
       LEFT JOIN users u ON u.doctor_id = d.id
       WHERE d.verification_status = 'pending'
       ORDER BY d.registered_at DESC`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch pending doctors' }); }
});

// GET /api/admin/doctors/all — list all doctors with verification status
router.get('/doctors/all', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT d.*, u.id as user_id
       FROM doctors d
       LEFT JOIN users u ON u.doctor_id = d.id
       ORDER BY d.registered_at DESC`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch doctors' }); }
});

// PATCH /api/admin/doctors/:id/verify
router.patch('/doctors/:id/verify', async (req, res) => {
  const { id } = req.params;
  const { action, notes } = req.body; // action: 'approve' | 'reject'
  try {
    const { rows: docRows } = await query('SELECT * FROM doctors WHERE id = $1', [id]);
    if (!docRows.length) return res.status(404).json({ error: 'Doctor not found' });
    const doc = docRows[0];

    if (action === 'approve') {
      await query(
        `UPDATE doctors SET verification_status = 'approved', verified_at = NOW(), rejection_notes = NULL WHERE id = $1`,
        [id]
      );
      // Notify the doctor
      const { rows: userRows } = await query('SELECT id FROM users WHERE doctor_id = $1', [id]);
      if (userRows.length) {
        const notifId = `N-${Date.now()}`;
        await query(
          `INSERT INTO notifications (id, user_id, title, message, type, read, date)
           VALUES ($1, $2, 'Account Approved ✅', $3, 'success', false, NOW())`,
          [notifId, userRows[0].id, `Your doctor account has been approved. You can now log in to MediTalk.`]
        );
        try { pushNotification(userRows[0].id, { id: notifId, title: 'Account Approved ✅', message: 'Your doctor account has been approved.', type: 'success' }); } catch (_) {}
      }
      // Audit log
      try {
        await query(
          `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
           VALUES ($1, 'Admin', 'Administrator', $2, 'Doctor', $3, 'success')`,
          [req.user.userId || req.user.id, `Approved doctor: ${doc.name}`, id]
        );
      } catch (_) {}
    } else if (action === 'reject') {
      await query(
        `UPDATE doctors SET verification_status = 'rejected', rejection_notes = $2 WHERE id = $1`,
        [id, notes || 'Application did not meet requirements.']
      );
      const { rows: userRows } = await query('SELECT id FROM users WHERE doctor_id = $1', [id]);
      if (userRows.length) {
        const notifId = `N-${Date.now()}`;
        await query(
          `INSERT INTO notifications (id, user_id, title, message, type, read, date)
           VALUES ($1, $2, 'Account Application Rejected', $3, 'error', false, NOW())`,
          [notifId, userRows[0].id, `Your doctor account was rejected. Reason: ${notes || 'Application did not meet requirements.'}`]
        );
        try { pushNotification(userRows[0].id, { id: notifId, title: 'Account Rejected', message: notes || 'Application did not meet requirements.', type: 'error' }); } catch (_) {}
      }
      try {
        await query(
          `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
           VALUES ($1, 'Admin', 'Administrator', $2, 'Doctor', $3, 'warning')`,
          [req.user.userId || req.user.id, `Rejected doctor: ${doc.name}`, id]
        );
      } catch (_) {}
    } else {
      return res.status(400).json({ error: 'Invalid action. Use approve or reject.' });
    }
    res.json({ success: true, action });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Verification action failed' }); }
});

// ── Admin Appointment Management ────────────────────────────────────────────

// PATCH /api/admin/appointments/:id/cancel
router.patch('/appointments/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
    const appt = rows[0];

    await query(
      `UPDATE appointments SET status = 'cancelled', cancel_reason = $2 WHERE id = $1`,
      [id, reason || 'Cancelled by administrator']
    );

    // Notify patient and doctor
    const msg = `Your appointment on ${appt.date} at ${appt.time} has been cancelled by Admin. Reason: ${reason || 'Administrative decision'}`;
    const notifBase = { type: 'warning', read: false };
    for (const [userField, roleLabel] of [['patient_id', 'patient'], ['doctor_id', 'doctor']]) {
      if (appt[userField]) {
        const { rows: uRows } = await query(`SELECT id FROM users WHERE ${roleLabel}_id = $1`, [appt[userField]]);
        if (uRows.length) {
          const notifId = `N-${Date.now()}-${roleLabel}`;
          await query(
            `INSERT INTO notifications (id, user_id, title, message, type, read, date) VALUES ($1, $2, 'Appointment Cancelled', $3, 'warning', false, NOW())`,
            [notifId, uRows[0].id, msg]
          );
          try { pushNotification(uRows[0].id, { id: notifId, title: 'Appointment Cancelled', message: msg, ...notifBase }); } catch (_) {}
        }
      }
    }
    try {
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, 'Admin', 'Administrator', $2, 'Appointment', $3, 'warning')`,
        [req.user.userId || req.user.id, `Cancelled appointment: ${id}`, id]
      );
    } catch (_) {}
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to cancel appointment' }); }
});

// PATCH /api/admin/appointments/:id/reschedule
router.patch('/appointments/:id/reschedule', async (req, res) => {
  const { id } = req.params;
  const { date, time, reason } = req.body;
  try {
    const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
    const appt = rows[0];

    await query(
      `UPDATE appointments SET date = $2, time = $3, status = 'upcoming' WHERE id = $1`,
      [id, date, time]
    );

    const msg = `Your appointment has been rescheduled to ${date} at ${time} by Admin. ${reason ? `Reason: ${reason}` : ''}`;
    for (const [userField, roleLabel] of [['patient_id', 'patient'], ['doctor_id', 'doctor']]) {
      if (appt[userField]) {
        const { rows: uRows } = await query(`SELECT id FROM users WHERE ${roleLabel}_id = $1`, [appt[userField]]);
        if (uRows.length) {
          const notifId = `N-${Date.now()}-${roleLabel}`;
          await query(
            `INSERT INTO notifications (id, user_id, title, message, type, read, date) VALUES ($1, $2, 'Appointment Rescheduled', $3, 'info', false, NOW())`,
            [notifId, uRows[0].id, msg]
          );
          try { pushNotification(uRows[0].id, { id: notifId, title: 'Appointment Rescheduled', message: msg, type: 'info' }); } catch (_) {}
        }
      }
    }
    try {
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, 'Admin', 'Administrator', $2, 'Appointment', $3, 'success')`,
        [req.user.userId || req.user.id, `Rescheduled appointment ${id} to ${date} ${time}`, id]
      );
    } catch (_) {}
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to reschedule appointment' }); }
});

// ── Broadcast Announcements ─────────────────────────────────────────────────

// POST /api/admin/broadcast
router.post('/broadcast', async (req, res) => {
  const { title, message, targetRole } = req.body; // targetRole: 'all' | 'patient' | 'doctor'
  try {
    let sql = 'SELECT id FROM users';
    const params = [];
    if (targetRole && targetRole !== 'all') {
      sql += ' WHERE role = $1';
      params.push(targetRole);
    }
    const { rows: users } = await query(sql, params);

    for (const user of users) {
      const notifId = `N-${Date.now()}-${user.id}`;
      await query(
        `INSERT INTO notifications (id, user_id, title, message, type, read, date) VALUES ($1, $2, $3, $4, 'info', false, NOW())`,
        [notifId, user.id, title, message]
      );
      try { pushNotification(user.id, { id: notifId, title, message, type: 'info' }); } catch (_) {}
    }

    try {
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status)
         VALUES ($1, 'Admin', 'Administrator', $2, 'Announcement', 'broadcast', 'success')`,
        [req.user.userId || req.user.id, `Broadcast: "${title}" to ${targetRole || 'all'}`]
      );
    } catch (_) {}

    res.json({ success: true, sent: users.length });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Broadcast failed' }); }
});

// GET /api/admin/broadcasts — history of past broadcasts from audit log
router.get('/broadcasts', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM audit_logs WHERE entity_type = 'Announcement' ORDER BY timestamp DESC LIMIT 50`
    );
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch broadcast history' }); }
});

// ── Analytics ───────────────────────────────────────────────────────────────

router.get('/analytics', async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = from && to
      ? `AND date BETWEEN '${from}' AND '${to}'`
      : '';
    const registeredFilter = from && to
      ? `AND registered_at BETWEEN '${from}' AND '${to}'`
      : '';

    const { rows: dayRows } = await query(`
      SELECT EXTRACT(DOW FROM date::date)::int as dow, COUNT(*) as count
      FROM appointments 
      WHERE date IS NOT NULL AND date ~ '^\\d{4}-\\d{2}-\\d{2}' ${dateFilter}
      GROUP BY dow
    `);
    const dayMap = Object.fromEntries(dayRows.map(r => [r.dow, parseInt(r.count)]));
    const appointmentTrends = {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      data: [1,2,3,4,5,6,0].map(d => dayMap[d] || 0),
    };

    const monthLabels = []; const monthData = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const ym = d.toISOString().slice(0, 7);
      monthLabels.push(d.toLocaleString('default', { month: 'short' }));
      const { rows } = await query("SELECT COUNT(*) as count FROM patients WHERE TO_CHAR(registered_at, 'YYYY-MM') = $1", [ym]);
      monthData.push(parseInt(rows[0].count));
    }
    const patientRegistrations = { labels: monthLabels, data: monthData };

    const consultLabels = []; const consultData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const ym = d.toISOString().slice(0, 7);
      consultLabels.push(d.toLocaleString('default', { month: 'short' }));
      const { rows } = await query("SELECT COUNT(*) as count FROM consultations WHERE TO_CHAR(date, 'YYYY-MM') = $1", [ym]);
      consultData.push(parseInt(rows[0].count));
    }
    const consultationTrends = { labels: consultLabels, data: consultData };

    const { rows: statusRows } = await query(`SELECT status, COUNT(*) as count FROM appointments ${dateFilter ? 'WHERE date IS NOT NULL ' + dateFilter : ''} GROUP BY status`);
    const statusMap = Object.fromEntries(statusRows.map(r => [r.status, parseInt(r.count)]));
    const appointmentStatus = {
      labels: ['Completed', 'Upcoming', 'Confirmed', 'Cancelled'],
      data: [statusMap['completed']||0, statusMap['upcoming']||0, statusMap['confirmed']||0, statusMap['cancelled']||0],
    };

    const { rows: ageRows } = await query("SELECT dob FROM patients WHERE dob IS NOT NULL AND dob != ''");
    const ageBuckets = { '0-18': 0, '19-35': 0, '36-50': 0, '51-65': 0, '65+': 0 };
    const cy = new Date().getFullYear();
    ageRows.forEach(({ dob }) => {
      const age = cy - new Date(dob).getFullYear();
      if (age <= 18) ageBuckets['0-18']++;
      else if (age <= 35) ageBuckets['19-35']++;
      else if (age <= 50) ageBuckets['36-50']++;
      else if (age <= 65) ageBuckets['51-65']++;
      else ageBuckets['65+']++;
    });
    const patientDemographics = { labels: Object.keys(ageBuckets), data: Object.values(ageBuckets) };

    const { rows: workloadRows } = await query(`
      SELECT d.name, COUNT(a.id) as count FROM doctors d
      LEFT JOIN appointments a ON d.id = a.doctor_id
      GROUP BY d.id, d.name ORDER BY count DESC LIMIT 5
    `);
    const doctorWorkload = {
      labels: workloadRows.map(r => r.name.split(' ').slice(0, 2).join(' ')),
      data: workloadRows.map(r => parseInt(r.count)),
    };

    const { rows: specialtyRows } = await query(`
      SELECT specialty, COUNT(*) as count FROM appointments WHERE specialty IS NOT NULL
      GROUP BY specialty ORDER BY count DESC
    `);
    const specialtyAppointments = {
      labels: specialtyRows.map(r => r.specialty),
      data: specialtyRows.map(r => parseInt(r.count)),
    };

    // KPI calculations
    const totalAppts = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const acceptedAppts = (statusMap['completed'] || 0) + (statusMap['upcoming'] || 0) + (statusMap['confirmed'] || 0);
    const doctorAcceptanceRate = totalAppts > 0 ? Math.round((acceptedAppts / totalAppts) * 100) : 0;

    const { rows: returnPatients } = await query(
      `SELECT COUNT(DISTINCT patient_id) as count FROM appointments GROUP BY patient_id HAVING COUNT(*) > 1`
    );
    const { rows: totalPatients } = await query('SELECT COUNT(DISTINCT patient_id) as count FROM appointments');
    const patientRetentionRate = parseInt(totalPatients[0]?.count || 0) > 0
      ? Math.round((returnPatients.length / parseInt(totalPatients[0].count)) * 100)
      : 0;

    res.json({
      appointmentTrends, patientRegistrations, consultationTrends, appointmentStatus,
      patientDemographics, doctorWorkload, specialtyAppointments,
      kpis: { doctorAcceptanceRate, patientRetentionRate, avgConsultDuration: 28 },
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch analytics' }); }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const { role, status, search } = req.query;
    let sql = 'SELECT * FROM audit_logs';
    const conditions = []; const params = []; let idx = 1;
    if (role) { conditions.push('role = $' + idx++); params.push(role); }
    if (status) { conditions.push('status = $' + idx++); params.push(status); }
    if (search) {
      conditions.push('(user_name ILIKE $' + idx + ' OR action ILIKE $' + (idx+1) + ')');
      params.push('%'+search+'%', '%'+search+'%'); idx += 2;
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY timestamp DESC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch audit logs' }); }
});

export default router;
