import { Router } from 'express';
import { query } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pushNotification } from '../server.js';

const router = Router();

function safeJson(val, fallback) {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function parseOrder(row) {
  if (!row) return null;
  return {
    ...row,
    patientId: row.patient_id,
    patientName: row.patient_name,
    prescriptionId: row.prescription_id,
    pharmacyName: row.pharmacy_name,
    deliveryAddress: row.delivery_address,
    contactPhone: row.contact_phone,
    medications: safeJson(row.medications, []),
    trackingNumber: row.tracking_number,
    estimatedDelivery: row.estimated_delivery,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

// ── Pharmacy Orders ───────────────────────────────────────────────────────────

// POST /api/pharmacy/orders — patient creates an order from a signed prescription
router.post('/pharmacy/orders', requireAuth, async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { prescriptionId, pharmacyName, deliveryAddress, contactPhone, notes } = req.body;

    if (!prescriptionId || !pharmacyName || !contactPhone) {
      return res.status(400).json({ error: 'prescriptionId, pharmacyName, and contactPhone are required' });
    }

    // Fetch prescription details
    const { rows: rxRows } = await query('SELECT * FROM prescriptions WHERE id = $1', [prescriptionId]);
    if (!rxRows[0]) return res.status(404).json({ error: 'Prescription not found' });
    const rx = rxRows[0];

    // Patients can only order their own prescriptions
    if (role === 'patient' && rx.patient_id !== callerId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Check if an active (non-cancelled) order already exists for this prescription
    const { rows: existingOrders } = await query(
      "SELECT id FROM pharmacy_orders WHERE prescription_id = $1 AND status != 'cancelled'",
      [prescriptionId]
    );
    if (existingOrders.length > 0) {
      return res.status(409).json({ error: 'An active pharmacy order already exists for this prescription.' });
    }

    const id = 'PO-' + Date.now();
    const trackingNumber = 'MT' + Math.random().toString(36).substring(2, 9).toUpperCase();
    // Estimated delivery: 24–48 hours from now
    const estimated = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();

    await query(
      `INSERT INTO pharmacy_orders (id, prescription_id, patient_id, patient_name, pharmacy_name, delivery_address, contact_phone, medications, status, tracking_number, estimated_delivery, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10,$11,NOW(),NOW())`,
      [id, prescriptionId, rx.patient_id, rx.patient_name, pharmacyName, deliveryAddress || null, contactPhone, rx.medications, trackingNumber, estimated, notes || null]
    );

    // Notify patient
    try {
      const { rows: uRows } = await query('SELECT id FROM users WHERE patient_id = $1', [rx.patient_id]);
      const patientUserId = uRows[0]?.id;
      if (patientUserId) {
        const notifId = 'N-' + Date.now();
        const msg = `Your prescription order has been placed with ${pharmacyName}. Tracking: ${trackingNumber}`;
        await query(
          `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'pharmacy_order','Order Placed',$3,false)`,
          [notifId, patientUserId, msg]
        );
        try { pushNotification(patientUserId, { id: notifId, type: 'pharmacy_order', title: 'Order Placed', message: msg }); } catch (_) {}
      }
    } catch (_) {}

    // Auto-create medication adherence schedules for this prescription if not already existing
    try {
      const parsedMeds = safeJson(rx.medications, []);
      for (const med of parsedMeds) {
        const medName = med.medicine || med.name;
        if (!medName) continue;
        const { rows: existingSched } = await query(
          'SELECT id FROM medication_schedules WHERE patient_id = $1 AND medicine_name = $2 AND is_active = TRUE',
          [rx.patient_id, medName]
        );
        if (existingSched.length === 0) {
          const schedId = 'MS-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
          const freq = med.frequency || 'OD';
          const slots = freq === 'OD' ? ['morning'] :
                        freq === 'BD' ? ['morning', 'evening'] :
                        freq === 'TDS' ? ['morning', 'afternoon', 'evening'] :
                        ['morning'];
          await query(
            `INSERT INTO medication_schedules (id, patient_id, prescription_id, medicine_name, dosage, frequency, timing_slots, instructions, taken_logs, streak_count, is_active, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'{}',0,TRUE,NOW())`,
            [schedId, rx.patient_id, prescriptionId, medName, med.dosage || '1 dose', freq, JSON.stringify(slots), med.instructions || null]
          );
        }
      }
    } catch (schedErr) {
      console.warn('[Phase9] Auto adherence schedule creation warning:', schedErr.message);
    }

    // Audit log
    try {
      await query(
        `INSERT INTO audit_logs (user_id, user_name, role, action, entity_type, entity_id, status) VALUES ($1,$2,$3,'Created pharmacy order','PharmacyOrder',$4,'success')`,
        [callerId, req.user.name || callerId, role, id]
      );
    } catch (_) {}

    const { rows: created } = await query('SELECT * FROM pharmacy_orders WHERE id = $1', [id]);
    res.status(201).json({ success: true, order: parseOrder(created[0]) });
  } catch (err) {
    console.error('[Phase9] Create pharmacy order error:', err);
    res.status(500).json({ error: 'Failed to create pharmacy order' });
  }
});

// GET /api/pharmacy/orders — patients see own, doctors/admins see all
router.get('/pharmacy/orders', requireAuth, async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { patientId, prescriptionId, status } = req.query;

    let sql = 'SELECT * FROM pharmacy_orders';
    const conditions = []; const params = []; let idx = 1;

    if (role === 'patient') {
      conditions.push('patient_id = $' + idx++);
      params.push(callerId);
    } else {
      if (patientId) { conditions.push('patient_id = $' + idx++); params.push(patientId); }
    }
    if (prescriptionId) { conditions.push('prescription_id = $' + idx++); params.push(prescriptionId); }
    if (status) { conditions.push('status = $' + idx++); params.push(status); }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC';

    const { rows } = await query(sql, params);
    res.json(rows.map(parseOrder));
  } catch (err) {
    console.error('[Phase9] Fetch pharmacy orders error:', err);
    res.status(500).json({ error: 'Failed to fetch pharmacy orders' });
  }
});

// PATCH /api/pharmacy/orders/:id/status — update fulfillment status (admin or simulated)
router.patch('/pharmacy/orders/:id/status', requireAuth, async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { status } = req.body;
    const validStatuses = ['pending', 'processing', 'dispensed', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const { rows: existing } = await query('SELECT * FROM pharmacy_orders WHERE id = $1', [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: 'Order not found' });

    // Patients can only cancel their own orders
    if (role === 'patient') {
      if (existing[0].patient_id !== callerId) return res.status(403).json({ error: 'Forbidden' });
      if (status !== 'cancelled') return res.status(403).json({ error: 'Patients can only cancel orders' });
    }

    await query('UPDATE pharmacy_orders SET status=$1, updated_at=NOW() WHERE id=$2', [status, req.params.id]);

    // Notify patient on key status changes
    const notifyStatuses = { processing: 'Order Processing', out_for_delivery: 'Out for Delivery', delivered: 'Order Delivered' };
    if (notifyStatuses[status]) {
      try {
        const { rows: uRows } = await query('SELECT id FROM users WHERE patient_id = $1', [existing[0].patient_id]);
        const patientUserId = uRows[0]?.id;
        if (patientUserId) {
          const notifId = 'N-' + Date.now();
          const msg = `Your pharmacy order (${existing[0].tracking_number}) status: ${notifyStatuses[status]}`;
          await query(
            `INSERT INTO notifications (id, user_id, type, title, message, read) VALUES ($1,$2,'pharmacy_order',$3,$4,false)`,
            [notifId, patientUserId, notifyStatuses[status], msg]
          );
          try { pushNotification(patientUserId, { id: notifId, type: 'pharmacy_order', title: notifyStatuses[status], message: msg }); } catch (_) {}
        }
      } catch (_) {}
    }

    const { rows: updated } = await query('SELECT * FROM pharmacy_orders WHERE id = $1', [req.params.id]);
    res.json({ success: true, order: parseOrder(updated[0]) });
  } catch (err) {
    console.error('[Phase9] Update pharmacy order error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

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
