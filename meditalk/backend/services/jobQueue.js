/**
 * MediTalk Job Queue — pg-boss powered background jobs
 *
 * Workers registered here:
 *  - reminder-24h     → appointment reminder 24 hours before
 *  - reminder-2h      → appointment reminder 2 hours before
 *  - send-confirmation → appointment confirmation email on booking
 *  - send-cancellation → cancellation email
 *  - send-reschedule   → reschedule email
 *  - send-consultation-summary → post-consultation email
 *
 * pg-boss stores jobs in the same PostgreSQL DB — no Redis needed.
 */

import { PgBoss } from 'pg-boss';
import {
  sendAppointmentConfirmation,
  sendAppointmentReminder24h,
  sendAppointmentReminder2h,
  sendAppointmentCancellation,
  sendAppointmentRescheduled,
  sendConsultationSummary,
  sendPasswordReset,
  sendWelcomeWithTempPassword,
} from './emailService.js';
import { sendWhatsAppMessage } from './messagingService.js';

let boss = null;

export async function initJobQueue(connectionString) {
  if (boss) return boss;

  boss = new PgBoss({
    connectionString: connectionString.replace(/[?&]channel_binding=[^&]+/g, ''),
    ssl: (connectionString.includes('neon.tech') || connectionString.includes('sslmode=require'))
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false' ? false : true }
      : false,
    // Retry failed jobs up to 3 times with 5-minute delay
    retryLimit: 3,
    retryDelay: 300,
    // Expire jobs after 24 hours if not processed
    expireInHours: 24,
  });

  boss.on('error', (err) => {
    // Don't crash the server on queue errors — log and continue
    console.error('[JobQueue] pg-boss error:', err.message);
  });

  await boss.start();
  console.log('⚙️  Job queue started (pg-boss)');

  // ── Ensure Queues Exist ──────────────────────────────────────────────────
  const queueNames = [
    'send-confirmation',
    'reminder-24h',
    'reminder-2h',
    'send-cancellation',
    'send-reschedule',
    'send-consultation-summary',
    'send-password-reset',
    'send-welcome',
    'send-whatsapp-confirmation',
    'send-whatsapp-reminder',
  ];
  for (const q of queueNames) {
    try { await boss.createQueue(q); } catch (_) {}
  }

  // ── Register Workers ──────────────────────────────────────────────────────

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '***@***';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? name.charAt(0) + '*' : name.slice(0, 2) + '***';
  return `${maskedName}@${domain}`;
}

function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '***';
  const clean = phone.trim();
  if (clean.length <= 4) return '***';
  return clean.slice(0, 3) + '****' + clean.slice(-4);
}

  // Appointment confirmation (sent immediately on booking)
  await boss.work('send-confirmation', async ([job]) => {
    const d = job.data;
    const res = await sendAppointmentConfirmation({
      to: d.patientEmail,
      patientName: d.patientName,
      doctorName: d.doctorName,
      specialty: d.specialty,
      date: d.date,
      time: d.time,
      type: d.type,
      appointmentId: d.appointmentId,
    });
    if (res && res.success === false) {
      throw new Error(`Failed to send confirmation email to ${maskEmail(d.patientEmail)}: ${res.error || 'Unknown error'}`);
    }
    console.log(`[Queue] Confirmation email sent → ${maskEmail(d.patientEmail)}`);
  });

  // 24-hour reminder
  await boss.work('reminder-24h', async ([job]) => {
    const d = job.data;
    const res = await sendAppointmentReminder24h({
      to: d.patientEmail,
      patientName: d.patientName,
      doctorName: d.doctorName,
      date: d.date,
      time: d.time,
      type: d.type,
      appointmentId: d.appointmentId,
    });
    if (res && res.success === false) {
      throw new Error(`Failed to send 24h reminder to ${maskEmail(d.patientEmail)}: ${res.error || 'Unknown error'}`);
    }
    console.log(`[Queue] 24h reminder sent → ${maskEmail(d.patientEmail)}`);
  });

  // 2-hour reminder
  await boss.work('reminder-2h', async ([job]) => {
    const d = job.data;
    const res = await sendAppointmentReminder2h({
      to: d.patientEmail,
      patientName: d.patientName,
      doctorName: d.doctorName,
      date: d.date,
      time: d.time,
      type: d.type,
      appointmentId: d.appointmentId,
    });
    if (res && res.success === false) {
      throw new Error(`Failed to send 2h reminder to ${maskEmail(d.patientEmail)}: ${res.error || 'Unknown error'}`);
    }
    console.log(`[Queue] 2h reminder sent → ${maskEmail(d.patientEmail)}`);
  });

  // Cancellation email
  await boss.work('send-cancellation', async ([job]) => {
    const d = job.data;
    const res = await sendAppointmentCancellation({
      to: d.patientEmail,
      patientName: d.patientName,
      doctorName: d.doctorName,
      date: d.date,
      time: d.time,
      cancelledBy: d.cancelledBy,
      reason: d.reason,
    });
    if (res && res.success === false) {
      throw new Error(`Failed to send cancellation email to ${maskEmail(d.patientEmail)}: ${res.error || 'Unknown error'}`);
    }
    console.log(`[Queue] Cancellation email sent → ${maskEmail(d.patientEmail)}`);
  });

  // Reschedule email
  await boss.work('send-reschedule', async ([job]) => {
    const d = job.data;
    const res = await sendAppointmentRescheduled({
      to: d.patientEmail,
      patientName: d.patientName,
      doctorName: d.doctorName,
      oldDate: d.oldDate,
      oldTime: d.oldTime,
      newDate: d.newDate,
      newTime: d.newTime,
    });
    if (res && res.success === false) {
      throw new Error(`Failed to send reschedule email to ${maskEmail(d.patientEmail)}: ${res.error || 'Unknown error'}`);
    }
    console.log(`[Queue] Reschedule email sent → ${maskEmail(d.patientEmail)}`);
  });

  // Consultation summary email
  await boss.work('send-consultation-summary', async ([job]) => {
    const d = job.data;
    const res = await sendConsultationSummary({
      to: d.patientEmail,
      patientName: d.patientName,
      doctorName: d.doctorName,
      date: d.date,
      diagnosis: d.diagnosis,
      treatmentPlan: d.treatmentPlan,
      medications: d.medications,
      followUpDate: d.followUpDate,
      followUpInstructions: d.followUpInstructions,
    });
    if (res && res.success === false) {
      throw new Error(`Failed to send consultation summary to ${maskEmail(d.patientEmail)}: ${res.error || 'Unknown error'}`);
    }
    console.log(`[Queue] Consultation summary sent → ${maskEmail(d.patientEmail)}`);
  });

  // Password reset email
  await boss.work('send-password-reset', async ([job]) => {
    const d = job.data;
    const res = await sendPasswordReset({ to: d.email, name: d.name, resetToken: d.resetToken });
    if (res && res.success === false) {
      throw new Error(`Failed to send password reset email to ${maskEmail(d.email)}: ${res.error || 'Unknown error'}`);
    }
    console.log(`[Queue] Password reset email sent → ${maskEmail(d.email)}`);
  });

  // Welcome with temp password
  await boss.work('send-welcome', async ([job]) => {
    const d = job.data;
    const res = await sendWelcomeWithTempPassword({ to: d.email, name: d.name, role: d.role, tempPassword: d.tempPassword });
    if (res && res.success === false) {
      throw new Error(`Failed to send welcome email to ${maskEmail(d.email)}: ${res.error || 'Unknown error'}`);
    }
    console.log(`[Queue] Welcome email sent → ${maskEmail(d.email)}`);
  });

  // Automated WhatsApp confirmation worker
  await boss.work('send-whatsapp-confirmation', async ([job]) => {
    const d = job.data;
    if (d.phone) {
      const res = await sendWhatsAppMessage({
        to: d.phone,
        type: 'confirmation',
        data: d,
      });
      if (res && res.sent === false && res.mode === 'twilio_error') {
        throw new Error(`Failed to deliver WhatsApp message to ${maskPhone(d.phone)}: ${res.error || 'Carrier error'}`);
      }
      console.log(`[Queue] WhatsApp confirmation dispatched → ${maskPhone(d.phone)}`);
    }
  });

  // Automated WhatsApp reminder worker
  await boss.work('send-whatsapp-reminder', async ([job]) => {
    const d = job.data;
    if (d.phone) {
      const res = await sendWhatsAppMessage({
        to: d.phone,
        type: d.reminderType || 'reminder_2h',
        data: d,
      });
      if (res && res.sent === false && res.mode === 'twilio_error') {
        throw new Error(`Failed to deliver WhatsApp reminder to ${maskPhone(d.phone)}: ${res.error || 'Carrier error'}`);
      }
      console.log(`[Queue] WhatsApp reminder dispatched → ${maskPhone(d.phone)}`);
    }
  });

  return boss;
}

// ── Job Scheduling Helpers ────────────────────────────────────────────────────

/**
 * Schedule both reminders for a new appointment.
 * @param {object} appt - appointment details
 * @param {string} patientEmail - patient's email address
 * @param {string} [patientPhone] - optional patient phone for WhatsApp reminder
 */
export async function scheduleReminders(appt, patientEmail, patientPhone = null) {
  if (!boss || (!patientEmail && !patientPhone)) return;

  const jobData = {
    appointmentId: appt.id,
    patientEmail,
    phone: patientPhone,
    patientName: appt.patient_name || appt.patientName,
    doctorName: appt.doctor_name || appt.doctorName,
    specialty: appt.specialty,
    date: appt.date,
    time: appt.time,
    type: appt.type,
  };

  // Parse the appointment datetime
  const apptDateTime = parseApptDateTime(appt.date, appt.time);
  if (!apptDateTime) {
    console.warn('[Queue] Could not parse appointment datetime for reminders:', appt.date, appt.time);
    return;
  }

  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;
  const ms2h  =  2 * 60 * 60 * 1000;

  const reminder24hAt = new Date(apptDateTime.getTime() - ms24h);
  const reminder2hAt  = new Date(apptDateTime.getTime() - ms2h);

  // Only schedule if the reminder time is still in the future
  try {
    if (patientEmail && reminder24hAt > new Date(now + 60000)) {
      const opts = { singletonKey: `reminder-24h-${appt.id}`, singletonSeconds: 60, startAfter: reminder24hAt };
      if (typeof boss.sendAt === 'function') {
        await boss.sendAt('reminder-24h', jobData, reminder24hAt, opts);
      } else {
        await boss.send('reminder-24h', jobData, opts);
      }
      console.log(`[Queue] 24h reminder scheduled for ${reminder24hAt.toISOString()}`);
    }

    if (patientEmail && reminder2hAt > new Date(now + 60000)) {
      const opts = { singletonKey: `reminder-2h-${appt.id}`, singletonSeconds: 60, startAfter: reminder2hAt };
      if (typeof boss.sendAt === 'function') {
        await boss.sendAt('reminder-2h', jobData, reminder2hAt, opts);
      } else {
        await boss.send('reminder-2h', jobData, opts);
      }
      console.log(`[Queue] 2h reminder scheduled for ${reminder2hAt.toISOString()}`);
    }

    if (patientPhone && reminder2hAt > new Date(now + 60000)) {
      const opts = { singletonKey: `whatsapp-reminder-2h-${appt.id}`, singletonSeconds: 60, startAfter: reminder2hAt };
      const waJobData = { ...jobData, reminderType: 'reminder_2h' };
      if (typeof boss.sendAt === 'function') {
        await boss.sendAt('send-whatsapp-reminder', waJobData, reminder2hAt, opts);
      } else {
        await boss.send('send-whatsapp-reminder', waJobData, opts);
      }
      console.log(`[Queue] 2h WhatsApp reminder scheduled for ${reminder2hAt.toISOString()}`);
    }
  } catch (err) {
    console.warn('[Queue] Failed to schedule reminders:', err.message);
  }
}

/**
 * Cancel all pending reminders for a cancelled/rescheduled appointment.
 */
export async function cancelReminders(appointmentId) {
  if (!boss) return;
  try {
    await boss.cancel('reminder-24h', `reminder-24h-${appointmentId}`);
    await boss.cancel('reminder-2h', `reminder-2h-${appointmentId}`);
  } catch (err) {
    // Jobs may already be processed or not exist — non-fatal
    console.debug('[Queue] cancelReminders:', err.message);
  }
}

/**
 * Enqueue an immediate (or very-soon) email job.
 */
export async function enqueueEmail(jobName, data, delaySeconds = 0) {
  if (!boss) {
    console.warn('[Queue] Boss not initialized — falling back to direct send');
    return;
  }
  const options = delaySeconds > 0 ? { startAfter: delaySeconds } : {};
  try {
    await boss.send(jobName, data, options);
  } catch (err) {
    console.warn(`[Queue] Failed to enqueue ${jobName}:`, err.message);
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Parse date string (YYYY-MM-DD) + time string (HH:MM or "09:00 AM") into a Date.
 */
function parseApptDateTime(dateStr, timeStr) {
  try {
    if (!dateStr || !timeStr) return null;
    // Normalise 12h format ("09:00 AM") to 24h
    let normalTime = timeStr.trim();
    if (/am|pm/i.test(normalTime)) {
      const [timePart, meridiem] = normalTime.split(/\s+/);
      let [h, m] = timePart.split(':').map(Number);
      if (/pm/i.test(meridiem) && h !== 12) h += 12;
      if (/am/i.test(meridiem) && h === 12) h = 0;
      normalTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return new Date(`${dateStr}T${normalTime}:00`);
  } catch {
    return null;
  }
}

export function getQueue() { return boss; }
