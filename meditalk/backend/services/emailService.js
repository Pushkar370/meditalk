/**
 * MediTalk Email Service — Powered by Resend
 * All transactional emails go through this module.
 * Gracefully degrades (console.log) in dev if RESEND_API_KEY is absent.
 */

import { Resend } from 'resend';

let resendInstance = null;
function getResendClient() {
  if (!resendInstance && process.env.RESEND_API_KEY) {
    try {
      resendInstance = new Resend(process.env.RESEND_API_KEY);
    } catch (e) {
      console.warn('[EmailService] Failed to initialize Resend client:', e.message);
      resendInstance = null;
    }
  }
  return resendInstance;
}

const FROM = process.env.EMAIL_FROM || 'MediTalk <onboarding@resend.dev>';
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── Shared HTML shell ─────────────────────────────────────────────────────────
function htmlShell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#f0f4f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width:600px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); padding:32px 40px; }
    .header h1 { color:#fff; margin:0; font-size:24px; font-weight:700; letter-spacing:-0.5px; }
    .header p { color:rgba(255,255,255,0.8); margin:4px 0 0; font-size:14px; }
    .body { padding:32px 40px; color:#1e293b; }
    .body h2 { font-size:20px; font-weight:600; margin:0 0 12px; color:#0f172a; }
    .body p { font-size:15px; line-height:1.7; color:#475569; margin:0 0 16px; }
    .detail-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:20px 24px; margin:20px 0; }
    .detail-box .row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #e2e8f0; font-size:14px; }
    .detail-box .row:last-child { border-bottom:none; }
    .detail-box .label { color:#64748b; font-weight:500; }
    .detail-box .value { color:#0f172a; font-weight:600; }
    .btn { display:inline-block; background:linear-gradient(135deg,#0ea5e9,#6366f1); color:#fff !important; text-decoration:none; padding:14px 28px; border-radius:8px; font-size:15px; font-weight:600; margin:8px 0; }
    .footer { background:#f8fafc; padding:20px 40px; text-align:center; font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0; }
    .badge { display:inline-block; padding:4px 12px; border-radius:999px; font-size:12px; font-weight:600; }
    .badge-blue { background:#dbeafe; color:#1d4ed8; }
    .badge-green { background:#dcfce7; color:#15803d; }
    .badge-amber { background:#fef3c7; color:#b45309; }
    .badge-red { background:#fee2e2; color:#b91c1c; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🏥 MediTalk</h1>
      <p>Your trusted telehealth platform</p>
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} MediTalk Health Technologies · <a href="${BASE_URL}" style="color:#6366f1">meditalk.care</a></p>
      <p style="margin:4px 0 0">This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Core send wrapper ─────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  const client = getResendClient();
  if (!client) {
    // Dev fallback — log the email instead of sending
    console.log(`\n📧 [EMAIL - SIMULATION/DEV MODE] To: ${to}\nSubject: ${subject}\n`);
    return { id: 'dev-mode', success: true };
  }
  try {
    const { data, error } = await client.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error('[EmailService] Resend send error:', error.message || error);
      return { success: false, error: error.message || error };
    }
    return { id: data?.id, success: true };
  } catch (err) {
    console.error('[EmailService] Send failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Email Templates ───────────────────────────────────────────────────────────

/** Appointment confirmation email to patient */
export async function sendAppointmentConfirmation({ to, patientName, doctorName, specialty, date, time, type, appointmentId }) {
  const urgencyLabel = type === 'video' ? '🎥 Video Consultation' : '🏥 In-Clinic Visit';
  const html = htmlShell('Appointment Confirmed — MediTalk', `
    <h2>Appointment Confirmed ✅</h2>
    <p>Hi <strong>${patientName}</strong>,</p>
    <p>Your appointment has been successfully booked. Here are your details:</p>
    <div class="detail-box">
      <div class="row"><span class="label">Doctor</span><span class="value">Dr. ${doctorName}</span></div>
      <div class="row"><span class="label">Specialty</span><span class="value">${specialty || 'General Medicine'}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${date}</span></div>
      <div class="row"><span class="label">Time</span><span class="value">${time}</span></div>
      <div class="row"><span class="label">Type</span><span class="value">${urgencyLabel}</span></div>
    </div>
    <p>Please arrive 5–10 minutes early. For video consultations, make sure your camera and microphone are working.</p>
    <a class="btn" href="${BASE_URL}/patient/appointments">View My Appointments →</a>
  `);
  return sendEmail({ to, subject: `Appointment Confirmed — ${date} at ${time} with Dr. ${doctorName}`, html });
}

/** 24-hour reminder email */
export async function sendAppointmentReminder24h({ to, patientName, doctorName, date, time, type, appointmentId }) {
  const isVideo = type === 'video';
  const html = htmlShell('Appointment Reminder — Tomorrow', `
    <h2>⏰ Reminder: Appointment Tomorrow</h2>
    <p>Hi <strong>${patientName}</strong>,</p>
    <p>This is a friendly reminder that you have an appointment <strong>tomorrow</strong>.</p>
    <div class="detail-box">
      <div class="row"><span class="label">Doctor</span><span class="value">Dr. ${doctorName}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${date}</span></div>
      <div class="row"><span class="label">Time</span><span class="value">${time}</span></div>
      <div class="row"><span class="label">Mode</span><span class="value">${isVideo ? '🎥 Video Call' : '🏥 In-Person'}</span></div>
    </div>
    ${isVideo ? '<p>💡 <strong>Tip:</strong> Test your camera and microphone before the call. Join from a quiet, well-lit location.</p>' : '<p>💡 <strong>Tip:</strong> Please bring any relevant reports or documents to your appointment.</p>'}
    <a class="btn" href="${BASE_URL}/patient/appointments">View Appointment Details →</a>
    <p style="margin-top:20px;font-size:13px;color:#94a3b8;">Need to reschedule? You can do so from the MediTalk portal at least 2 hours before your appointment.</p>
  `);
  return sendEmail({ to, subject: `Reminder: Appointment tomorrow at ${time} with Dr. ${doctorName}`, html });
}

/** 2-hour reminder email */
export async function sendAppointmentReminder2h({ to, patientName, doctorName, date, time, type, appointmentId }) {
  const isVideo = type === 'video';
  const html = htmlShell('Appointment in 2 Hours — MediTalk', `
    <h2>🔔 Your appointment is in 2 hours</h2>
    <p>Hi <strong>${patientName}</strong>,</p>
    <p>Your appointment with <strong>Dr. ${doctorName}</strong> is coming up soon!</p>
    <div class="detail-box">
      <div class="row"><span class="label">Time</span><span class="value">${time} today</span></div>
      <div class="row"><span class="label">Type</span><span class="value">${isVideo ? '🎥 Video Consultation' : '🏥 In-Clinic'}</span></div>
    </div>
    <a class="btn" href="${BASE_URL}/patient/${isVideo ? 'consultation/' + appointmentId : 'appointments'}">
      ${isVideo ? 'Join Video Call →' : 'View Details →'}
    </a>
  `);
  return sendEmail({ to, subject: `Your appointment with Dr. ${doctorName} is in 2 hours`, html });
}

/** Appointment cancellation email */
export async function sendAppointmentCancellation({ to, patientName, doctorName, date, time, cancelledBy, reason }) {
  const html = htmlShell('Appointment Cancelled — MediTalk', `
    <h2>Appointment Cancelled</h2>
    <p>Hi <strong>${patientName}</strong>,</p>
    <p>Your appointment has been cancelled${cancelledBy ? ` by ${cancelledBy}` : ''}.</p>
    <div class="detail-box">
      <div class="row"><span class="label">Doctor</span><span class="value">Dr. ${doctorName}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${date}</span></div>
      <div class="row"><span class="label">Time</span><span class="value">${time}</span></div>
      ${reason ? `<div class="row"><span class="label">Reason</span><span class="value">${reason}</span></div>` : ''}
    </div>
    <p>You can book a new appointment at any time from the MediTalk portal.</p>
    <a class="btn" href="${BASE_URL}/patient/book-appointment">Book New Appointment →</a>
  `);
  return sendEmail({ to, subject: `Appointment Cancelled — ${date} with Dr. ${doctorName}`, html });
}

/** Appointment rescheduled email */
export async function sendAppointmentRescheduled({ to, patientName, doctorName, oldDate, oldTime, newDate, newTime }) {
  const html = htmlShell('Appointment Rescheduled — MediTalk', `
    <h2>Appointment Rescheduled 📅</h2>
    <p>Hi <strong>${patientName}</strong>,</p>
    <p>Your appointment with <strong>Dr. ${doctorName}</strong> has been rescheduled.</p>
    <div class="detail-box">
      <div class="row"><span class="label">Previous Time</span><span class="value" style="text-decoration:line-through;color:#94a3b8">${oldDate} at ${oldTime}</span></div>
      <div class="row"><span class="label">New Time</span><span class="value" style="color:#0ea5e9">${newDate} at ${newTime}</span></div>
    </div>
    <a class="btn" href="${BASE_URL}/patient/appointments">View My Appointments →</a>
  `);
  return sendEmail({ to, subject: `Appointment Rescheduled — Now on ${newDate} at ${newTime}`, html });
}

/** Password reset email */
export async function sendPasswordReset({ to, name, resetToken }) {
  const resetUrl = `${BASE_URL}/reset-password?token=${resetToken}`;
  const html = htmlShell('Reset Your Password — MediTalk', `
    <h2>Reset Your Password 🔐</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>We received a request to reset your MediTalk password. Click the button below to choose a new password.</p>
    <a class="btn" href="${resetUrl}">Reset Password →</a>
    <p style="margin-top:20px;font-size:13px;color:#64748b;">
      This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
    </p>
    <p style="font-size:12px;color:#94a3b8;word-break:break-all;">
      Or paste this link: ${resetUrl}
    </p>
  `);
  return sendEmail({ to, subject: 'Reset your MediTalk password', html });
}

/** Consultation summary email to patient */
export async function sendConsultationSummary({ to, patientName, doctorName, date, diagnosis, treatmentPlan, medications, followUpDate, followUpInstructions }) {
  const medList = medications && medications.length > 0
    ? `<ul style="margin:8px 0;padding-left:20px;">${medications.map(m => `<li style="font-size:14px;color:#475569;padding:2px 0"><strong>${m.medicine || m.name}</strong> — ${m.dosage || ''} ${m.frequency || ''} ${m.instructions ? '(' + m.instructions + ')' : ''}</li>`).join('')}</ul>`
    : '<p style="color:#94a3b8;font-size:14px;font-style:italic;">No medications prescribed</p>';

  const html = htmlShell('Your Consultation Summary — MediTalk', `
    <h2>Consultation Summary 📋</h2>
    <p>Hi <strong>${patientName}</strong>,</p>
    <p>Here is a summary of your recent consultation with <strong>Dr. ${doctorName}</strong> on ${date}.</p>
    
    ${diagnosis ? `
    <div class="detail-box">
      <p style="font-weight:600;font-size:13px;color:#64748b;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px">Diagnosis</p>
      <p style="margin:0;font-size:15px;color:#0f172a">${diagnosis}</p>
    </div>` : ''}
    
    ${treatmentPlan ? `
    <div class="detail-box">
      <p style="font-weight:600;font-size:13px;color:#64748b;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px">Treatment Plan</p>
      <p style="margin:0;font-size:15px;color:#0f172a">${treatmentPlan}</p>
    </div>` : ''}
    
    <div class="detail-box">
      <p style="font-weight:600;font-size:13px;color:#64748b;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px">Medications Prescribed</p>
      ${medList}
    </div>
    
    ${followUpDate ? `
    <div class="detail-box" style="border-color:#bfdbfe;background:#eff6ff">
      <p style="font-weight:600;font-size:13px;color:#1d4ed8;margin:0 0 4px">📅 Follow-Up Scheduled</p>
      <p style="margin:0;font-size:15px;color:#0f172a">${followUpDate}${followUpInstructions ? ' — ' + followUpInstructions : ''}</p>
    </div>` : ''}
    
    <a class="btn" href="${BASE_URL}/patient/history">View Full History →</a>
    <p style="margin-top:20px;font-size:13px;color:#94a3b8;">This summary is for your records only. Always follow your doctor's advice. If you have concerns, please contact your clinic.</p>
  `);
  return sendEmail({ to, subject: `Your consultation summary — Dr. ${doctorName} on ${date}`, html });
}

/** New account welcome email with temporary password */
export async function sendWelcomeWithTempPassword({ to, name, role, tempPassword }) {
  const loginUrl = `${BASE_URL}/login`;
  const html = htmlShell('Welcome to MediTalk', `
    <h2>Welcome to MediTalk 🎉</h2>
    <p>Hi <strong>${name}</strong>,</p>
    <p>Your MediTalk ${role} account has been created. Here are your login credentials:</p>
    <div class="detail-box">
      <div class="row"><span class="label">Email</span><span class="value">${to}</span></div>
      <div class="row"><span class="label">Temporary Password</span><span class="value" style="font-family:monospace;font-size:16px;color:#6366f1">${tempPassword}</span></div>
    </div>
    <p>Please log in and change your password immediately from Settings → Security.</p>
    <a class="btn" href="${loginUrl}">Log In to MediTalk →</a>
    <p style="margin-top:20px;font-size:13px;color:#e11d48">⚠️ This temporary password will expire if not used. Do not share it with anyone.</p>
  `);
  return sendEmail({ to, subject: 'Welcome to MediTalk — Your login credentials', html });
}
