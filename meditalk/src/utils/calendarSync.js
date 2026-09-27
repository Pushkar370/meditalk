/**
 * Calendar Synchronization & WhatsApp Notification Utilities
 * Supports:
 * - 1-Click Google Calendar Event creation URL
 * - Standard RFC 5545 .ICS calendar invite file download (Apple Calendar, Outlook, Android)
 * - WhatsApp Click-to-Chat deep links
 */

/**
 * Normalizes appointment date & time into UTC representation for iCal/Google Calendar.
 */
function parseAppointmentDateTime(dateStr, timeStr) {
  try {
    let [t, modifier] = (timeStr || "10:00 AM").trim().split(/\s+/);
    let [hours, minutes] = t.split(":").map(Number);
    if (modifier) {
      if (modifier.toUpperCase() === "PM" && hours < 12) hours += 12;
      if (modifier.toUpperCase() === "AM" && hours === 12) hours = 0;
    }
    const pad = (n) => String(n).padStart(2, "0");
    const start = new Date(`${dateStr}T${pad(hours)}:${pad(minutes || 0)}:00`);
    if (isNaN(start.getTime())) {
      const now = new Date();
      return { start: now, end: new Date(now.getTime() + 30 * 60 * 1000) };
    }
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    return { start, end };
  } catch {
    const now = new Date();
    return { start: now, end: new Date(now.getTime() + 30 * 60 * 1000) };
  }
}

const pad = (n) => String(n).padStart(2, "0");

const toUtcString = (dt) =>
  dt.getUTCFullYear() +
  pad(dt.getUTCMonth() + 1) +
  pad(dt.getUTCDate()) +
  "T" +
  pad(dt.getUTCHours()) +
  pad(dt.getUTCMinutes()) +
  pad(dt.getUTCSeconds()) +
  "Z";

/**
 * Generates an instant 1-click Google Calendar web event URL
 */
export function generateGoogleCalendarUrl(appointment) {
  if (!appointment) return "https://calendar.google.com";
  const { start, end } = parseAppointmentDateTime(appointment.date, appointment.time);
  const dates = `${toUtcString(start)}/${toUtcString(end)}`;

  const title = `MediTalk: Dr. ${appointment.doctor_name || appointment.doctorName || "Doctor"} (${appointment.specialty || "Telehealth"})`;
  const isVideo = appointment.type === "video";
  const location = isVideo
    ? `${window.location.origin}/video/${appointment.id}`
    : "MediTalk Healthcare Center, Telehealth Plaza";

  const details =
    `MediTalk Telehealth Appointment\n\n` +
    `Doctor: Dr. ${appointment.doctor_name || appointment.doctorName}\n` +
    `Specialty: ${appointment.specialty || "General Medicine"}\n` +
    `Patient: ${appointment.patient_name || appointment.patientName || "Patient"}\n` +
    `Mode: ${isVideo ? "🎥 Video Call Consultation" : "🏥 In-Person Clinic Visit"}\n` +
    `Access Portal: ${window.location.origin}/patient/appointments\n\n` +
    `Reason: ${appointment.reason || "Consultation"}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: dates,
    details: details,
    location: location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates and triggers browser download of an RFC 5545 .ICS file
 */
export function downloadIcsFile(appointment) {
  if (!appointment) return;
  const { start, end } = parseAppointmentDateTime(appointment.date, appointment.time);
  const isVideo = appointment.type === "video";
  const location = isVideo
    ? `${window.location.origin}/video/${appointment.id}`
    : "MediTalk Healthcare Center, Telehealth Plaza";

  const description =
    `MediTalk Telehealth Appointment\\n` +
    `Doctor: Dr. ${appointment.doctor_name || appointment.doctorName}\\n` +
    `Specialty: ${appointment.specialty || "General Medicine"}\\n` +
    `Mode: ${isVideo ? "Video Call Consultation" : "In-Person Clinic Visit"}\\n` +
    `Portal: ${window.location.origin}/patient/appointments`;

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MediTalk Health Technologies//Telehealth Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:meditalk-${appointment.id || Date.now()}@meditalk.care`,
    `DTSTAMP:${toUtcString(new Date())}`,
    `DTSTART:${toUtcString(start)}`,
    `DTEND:${toUtcString(end)}`,
    `SUMMARY:MediTalk: Consultation with Dr. ${appointment.doctor_name || appointment.doctorName}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder: MediTalk Consultation in 15 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsLines], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute("download", `meditalk-appointment-${appointment.id || "consultation"}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Builds formatted clinical WhatsApp text for an appointment
 */
export function buildAppointmentWhatsAppText(appointment, type = "confirmation") {
  const patient = appointment.patient_name || appointment.patientName || "Patient";
  const doctor = appointment.doctor_name || appointment.doctorName || "Doctor";
  const specialty = appointment.specialty || "Specialist";
  const isVideo = appointment.type === "video";
  const joinUrl = isVideo && appointment.id ? `${window.location.origin}/video/${appointment.id}` : `${window.location.origin}/patient/appointments`;

  if (type === "patient_late_ping") {
    return (
      `🏥 *Dr. ${doctor} is waiting for you in your video consultation room!*\n\n` +
      `Hello *${patient}*,\n` +
      `Your consultation with *Dr. ${doctor}* (${specialty}) is ready to start.\n\n` +
      `👉 *Tap here to enter the video room now:*\n${joinUrl}\n\n` +
      `_If you are experiencing any technical issues, please reply directly to this message._`
    );
  }

  if (type === "reminder_2h") {
    return (
      `🔔 *MediTalk Alert: Appointment in 2 Hours*\n\n` +
      `Hello *${patient}*,\n` +
      `Your consultation with *Dr. ${doctor}* begins at *${appointment.time}*.\n\n` +
      `🎥 *Join Video Consultation:* ${joinUrl}\n\n` +
      `_Please ensure your camera and microphone are tested and working._`
    );
  }

  return (
    `🏥 *MediTalk Appointment Confirmed*\n\n` +
    `Hello *${patient}*,\n` +
    `Your appointment has been confirmed with *Dr. ${doctor}* (${specialty}).\n\n` +
    `📅 *Date:* ${appointment.date}\n` +
    `⏰ *Time:* ${appointment.time}\n` +
    `🩺 *Mode:* ${isVideo ? "🎥 Video Consultation" : "🏥 In-Person Clinic Visit"}\n` +
    `🔗 *Join/Details:* ${joinUrl}\n\n` +
    `_Please be ready 5 minutes before your scheduled time._`
  );
}

/**
 * Generates an instant Universal WhatsApp Click-to-Chat URL
 */
export function generateWhatsAppLink(phone, messageText) {
  if (!phone) {
    return `https://wa.me/?text=${encodeURIComponent(messageText)}`;
  }
  let clean = String(phone).replace(/[^\d]/g, "");
  if (clean.length === 10) clean = "91" + clean; // Default country code India if 10 digits
  return `https://wa.me/${clean}?text=${encodeURIComponent(messageText)}`;
}
