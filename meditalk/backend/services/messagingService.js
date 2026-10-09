/**
 * MediTalk Omnichannel Messaging Service (WhatsApp & SMS)
 * 
 * Supports:
 * 1. Direct Universal WhatsApp Click-to-Chat (wa.me) deep links (Works instantly on mobile & desktop with 0 configuration)
 * 2. Automated WhatsApp & SMS delivery via Twilio API / Meta Cloud API (if configured in env)
 * 3. Graceful simulation mode for local dev, testing, and sandboxing without paid carrier fees
 */

const BASE_URL = process.env.FRONTEND_URL || 'https://meditalk.onrender.com';

/**
 * Normalizes phone numbers to standard E.164 international format.
 * Defaults to +91 (India) if 10 digits without country code.
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = '+91' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
      cleaned = '+91' + cleaned.slice(1);
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
}

export function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '***';
  const clean = phone.trim();
  if (clean.length <= 4) return '***';
  return clean.slice(0, 3) + '****' + clean.slice(-4);
}

/**
 * Formats standardized WhatsApp clinical notification copy.
 */
export function buildWhatsAppTemplate(type, data = {}) {
  const {
    patientName = 'Patient',
    doctorName = 'Doctor',
    specialty = 'General Physician',
    date = '',
    time = '',
    appointmentType = 'Video Consultation',
    appointmentId = '',
    customText = '',
  } = data;

  const rawDoctor = (doctorName || 'Doctor').trim();
  const cleanDoctor = rawDoctor.replace(/^Dr\.?\s*/i, '');

  const apptUrl = `${BASE_URL}/patient/appointments`;
  const videoUrl = appointmentId ? `${BASE_URL}/video/${appointmentId}` : apptUrl;

  switch (type) {
    case 'confirmation':
      return (
        `🏥 *MediTalk Appointment Confirmed*\n\n` +
        `Hello *${patientName}*,\n` +
        `Your appointment has been confirmed with *Dr. ${cleanDoctor}* (${specialty}).\n\n` +
        `📅 *Date:* ${date}\n` +
        `⏰ *Time:* ${time}\n` +
        `🩺 *Type:* ${appointmentType}\n\n` +
        `🔗 *View Details:* ${apptUrl}\n\n` +
        `_Please be available 5 minutes prior to your scheduled time._`
      );

    case 'reminder_24h':
      return (
        `⏰ *MediTalk Reminder: Appointment Tomorrow*\n\n` +
        `Hello *${patientName}*,\n` +
        `You have an upcoming consultation with *Dr. ${cleanDoctor}* tomorrow.\n\n` +
        `📅 *Date:* ${date}\n` +
        `⏰ *Time:* ${time}\n` +
        `🔗 *Appointment Link:* ${apptUrl}\n\n` +
        `_Need to reschedule? Please do so through the portal._`
      );

    case 'reminder_2h':
      return (
        `🔔 *MediTalk Alert: Appointment in 2 Hours*\n\n` +
        `Hello *${patientName}*,\n` +
        `Your consultation with *Dr. ${cleanDoctor}* begins at *${time}*.\n\n` +
        `🎥 *Join Video Consultation:* ${videoUrl}\n\n` +
        `_Please ensure your camera and microphone are tested and working._`
      );

    case 'patient_late_ping':
      return (
        `🏥 *Dr. ${cleanDoctor} is waiting for you in your video consultation room!*\n\n` +
        `Hello *${patientName}*,\n` +
        `Your consultation with *Dr. ${cleanDoctor}* (${specialty}) is ready to start.\n\n` +
        `👉 *Tap here to enter the video room now:*\n${videoUrl}\n\n` +
        `_If you are experiencing any technical issues, please reply directly to this message._`
      );

    case 'prescription_ready':
      return (
        `💊 *MediTalk: Digital Prescription Issued*\n\n` +
        `Hello *${patientName}*,\n` +
        `Dr. ${cleanDoctor} has issued your verified digital prescription.\n\n` +
        `📋 *View & Download PDF Prescription:* ${BASE_URL}/patient/prescriptions\n\n` +
        `_Adhere strictly to prescribed dosages and instructions._`
      );

    case 'test':
    default:
      return (
        `🏥 *MediTalk WhatsApp Test Alert*\n\n` +
        `Hello *${patientName || 'User'}*!\n` +
        `This is a verified test notification from MediTalk Telehealth Platform.\n\n` +
        `💬 *Message:* ${customText || 'WhatsApp messaging integration is active and operating normally.'}\n` +
        `🌐 *Portal:* ${BASE_URL}\n` +
        `⏱️ *Timestamp:* ${new Date().toLocaleString('en-IN')}`
      );
  }
}

/**
 * Generates an instant Universal WhatsApp Click-to-Chat URI.
 * Works seamlessly on iOS, Android, and Desktop WhatsApp Web.
 */
export function generateWhatsAppLink(phone, messageText) {
  const normalized = normalizePhoneNumber(phone).replace(/^\+/, '');
  return `https://wa.me/${normalized}?text=${encodeURIComponent(messageText)}`;
}

/**
 * Dispatches an automated WhatsApp message via Twilio (if credentials exist),
 * or records in simulation/sandbox mode.
 */
export async function sendWhatsAppMessage({ to, type = 'confirmation', data = {}, customText = '' }) {
  const normalizedTo = normalizePhoneNumber(to);
  const messageText = customText || buildWhatsAppTemplate(type, data);
  const waLink = generateWhatsAppLink(to, messageText);

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Twilio sandbox default

  if (twilioSid && twilioToken) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const body = new URLSearchParams({
        From: twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`,
        To: `whatsapp:${normalizedTo}`,
        Body: messageText,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const result = await response.json();
      if (response.ok) {
        console.log(`📲 [WhatsApp Live Sent via Twilio] SID: ${result.sid} To: ${normalizedTo}`);
        return {
          success: true,
          sent: true,
          delivered: true,
          mode: 'twilio',
          message: 'WhatsApp message sent successfully via carrier',
          messageSid: result.sid,
          to: normalizedTo,
          waLink,
          messagePreview: messageText,
        };
      } else {
        console.warn('[WhatsApp Twilio Error]:', result.message);
        return {
          success: false,
          sent: false,
          delivered: false,
          mode: 'twilio_error',
          error: result.message,
          message: `WhatsApp message not sent: carrier error (${result.message})`,
          to: normalizedTo,
          waLink,
          messagePreview: messageText,
        };
      }
    } catch (err) {
      console.error('[WhatsApp Service Exception]:', err.message);
      return {
        success: false,
        sent: false,
        delivered: false,
        mode: 'twilio_error',
        error: err.message,
        message: `WhatsApp message not sent: carrier request failed (${err.message})`,
        to: normalizedTo,
        waLink,
        messagePreview: messageText,
      };
    }
  }

  // Simulation mode (honest: message was NOT dispatched via carrier)
  // Protected log: phone number masked and message body redacted to prevent PHI exposure
  console.log(`📱 [WHATSAPP - SIMULATION] Dispatched ${type} message to: ${maskPhoneNumber(normalizedTo)} (details redacted for privacy)`);
  return {
    success: false,
    sent: false,
    delivered: false,
    mode: 'simulation',
    message: 'WhatsApp message not sent: carrier credentials not configured (simulation only). Use direct link to send manually.',
    to: normalizedTo,
    waLink,
    messagePreview: messageText,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Dispatches an automated SMS message via Twilio (if credentials exist),
 * or falls back to simulation mode.
 */
export async function sendSmsMessage({ to, text }) {
  const normalizedTo = normalizePhoneNumber(to);
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const body = new URLSearchParams({
        From: twilioFrom,
        To: normalizedTo,
        Body: text,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const result = await response.json();
      if (response.ok) {
        console.log(`💬 [SMS Sent via Twilio] SID: ${result.sid} To: ${maskPhoneNumber(normalizedTo)}`);
        return { success: true, sent: true, delivered: true, mode: 'twilio', messageSid: result.sid, message: 'SMS sent successfully via carrier' };
      } else {
        console.warn('[SMS Twilio Error]:', result.message);
        return { success: false, sent: false, delivered: false, mode: 'twilio_error', error: result.message, message: `SMS not sent: carrier error (${result.message})` };
      }
    } catch (err) {
      console.warn('[SMS Twilio Exception]:', err.message);
      return { success: false, sent: false, delivered: false, mode: 'twilio_error', error: err.message, message: `SMS not sent: carrier exception (${err.message})` };
    }
  }

  console.log(`💬 [SMS - SIMULATION] Dispatched SMS to: ${maskPhoneNumber(normalizedTo)} (details redacted for privacy)`);
  return { success: false, sent: false, delivered: false, mode: 'simulation', message: 'SMS not sent: carrier credentials not configured (simulation only)', to: normalizedTo, text };
}
