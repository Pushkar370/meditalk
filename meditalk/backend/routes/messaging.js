import { Router } from 'express';
import { query } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import {
  sendWhatsAppMessage,
  sendSmsMessage,
  buildWhatsAppTemplate,
  generateWhatsAppLink,
  normalizePhoneNumber,
} from '../services/messagingService.js';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://meditalk.onrender.com';

/**
 * Format date and time into UTC string for iCalendar (YYYYMMDDTHHMMSSZ)
 */
function toIcsDateTime(dateStr, timeStr) {
  try {
    // Normalizing time e.g. "10:00 AM" or "14:30"
    let [t, modifier] = timeStr.trim().split(/\s+/);
    let [hours, minutes] = t.split(':').map(Number);
    if (modifier) {
      if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
      if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date(`${dateStr}T${pad(hours)}:${pad(minutes || 0)}:00`);
    if (isNaN(d.getTime())) return null;

    // 30 minute end time
    const end = new Date(d.getTime() + 30 * 60 * 1000);

    const formatUtc = (dt) =>
      dt.getUTCFullYear() +
      pad(dt.getUTCMonth() + 1) +
      pad(dt.getUTCDate()) +
      'T' +
      pad(dt.getUTCHours()) +
      pad(dt.getUTCMinutes()) +
      pad(dt.getUTCSeconds()) +
      'Z';

    return { start: formatUtc(d), end: formatUtc(end) };
  } catch {
    return null;
  }
}

/**
 * POST /api/messaging/test-whatsapp
 * Allows patient, doctor, or admin to send a test WhatsApp message to ANY mobile number
 */
router.post('/test-whatsapp', requireAuth, async (req, res) => {
  try {
    const { phone, type = 'test', customText, data = {} } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required (e.g. +919876543210)' });
    }

    const payloadData = {
      patientName: req.user.name || 'User',
      doctorName: data.doctorName || 'Dr. Sarah Jenkins',
      specialty: data.specialty || 'Cardiology',
      date: data.date || new Date().toISOString().slice(0, 10),
      time: data.time || '10:00 AM',
      appointmentType: data.appointmentType || 'Video Consultation',
      ...data,
      customText,
    };

    const result = await sendWhatsAppMessage({
      to: phone,
      type,
      data: payloadData,
      customText,
    });

    res.json({
      success: true,
      message: 'WhatsApp notification generated successfully',
      ...result,
    });
  } catch (err) {
    console.error('[MessagingRouter] test-whatsapp error:', err);
    res.status(500).json({ error: 'Failed to dispatch WhatsApp test message', details: err.message });
  }
});

/**
 * POST /api/messaging/send-appointment-whatsapp
 * Dispatches an appointment notification via WhatsApp for an existing appointment
 */
router.post('/send-appointment-whatsapp', requireAuth, async (req, res) => {
  try {
    const { appointmentId, recipientPhone, type = 'confirmation' } = req.body;
    if (!appointmentId) return res.status(400).json({ error: 'appointmentId is required' });

    const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [appointmentId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    const appt = rows[0];

    // Determine phone number (from payload, or patient profile)
    let phone = recipientPhone;
    if (!phone && appt.patient_id) {
      const { rows: pRows } = await query('SELECT phone FROM patients WHERE id = $1', [appt.patient_id]);
      phone = pRows[0]?.phone;
    }

    if (!phone) {
      return res.status(400).json({
        error: 'No phone number available for this patient. Please provide recipientPhone.',
      });
    }

    const result = await sendWhatsAppMessage({
      to: phone,
      type,
      data: {
        patientName: appt.patient_name,
        doctorName: appt.doctor_name,
        specialty: appt.specialty,
        date: appt.date,
        time: appt.time,
        appointmentType: appt.type === 'video' ? 'Video Consultation' : 'In-Clinic Consultation',
        appointmentId: appt.id,
      },
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[MessagingRouter] send-appointment-whatsapp error:', err);
    res.status(500).json({ error: 'Failed to send appointment WhatsApp message' });
  }
});

/**
 * GET /api/messaging/calendar-ics/:appointmentId
 * Returns RFC 5545 compliant .ics calendar file download
 */
router.get('/calendar-ics/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { rows } = await query('SELECT * FROM appointments WHERE id = $1', [appointmentId]);
    if (rows.length === 0) return res.status(404).send('Appointment not found');
    const a = rows[0];

    const dt = toIcsDateTime(a.date, a.time) || {
      start: '20261015T090000Z',
      end: '20261015T093000Z',
    };

    const isVideo = a.type === 'video';
    const location = isVideo
      ? `${FRONTEND_URL}/video/${a.id}`
      : 'MediTalk Healthcare Center, Telehealth Plaza';

    const description = `MediTalk Telehealth Appointment\\nDoctor: Dr. ${a.doctor_name} (${a.specialty || 'Physician'})\\nPatient: ${a.patient_name}\\nType: ${isVideo ? 'Video Consultation' : 'In-Clinic Visit'}\\nJoin or View: ${FRONTEND_URL}/patient/appointments`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MediTalk Health//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:meditalk-${a.id}@meditalk.care`,
      `DTSTAMP:${dt.start}`,
      `DTSTART:${dt.start}`,
      `DTEND:${dt.end}`,
      `SUMMARY:MediTalk: Consultation with Dr. ${a.doctor_name}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder: MediTalk Consultation in 15 minutes',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="meditalk-appointment-${a.id}.ics"`
    );
    res.send(icsContent);
  } catch (err) {
    console.error('[MessagingRouter] calendar-ics error:', err);
    res.status(500).send('Failed to generate calendar invite');
  }
});

export default router;
