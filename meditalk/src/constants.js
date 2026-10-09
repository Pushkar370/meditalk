export const ROLES = {
  PATIENT: "patient",
  DOCTOR: "doctor",
  ADMIN: "admin",
  NURSE: "nurse",
  RECEPTIONIST: "receptionist",
};

export const ROLE_LABELS = {
  patient: "Patient",
  doctor: "Doctor",
  admin: "Administrator",
  nurse: "Nurse",
  receptionist: "Receptionist",
};

export const DASHBOARD_ROUTES = {
  patient: "/patient/dashboard",
  doctor: "/doctor/dashboard",
  admin: "/admin/dashboard",
  nurse: "/nurse/queue",
  receptionist: "/receptionist/queue",
};

export const APPOINTMENT_STATUS = {
  UPCOMING: "upcoming",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  PENDING: "pending",
};

export const APPOINTMENT_STATUS_LABELS = {
  upcoming: "Upcoming",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  pending: "Pending",
};

export const APPOINTMENT_TYPES = ["In-person", "Video consultation"];

export const SPECIALTIES = [
  "General Medicine",
  "Cardiology",
  "Dermatology",
  "Neurology",
  "Pediatrics",
  "Orthopedics",
];

export const TIME_SLOTS = [
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "02:00 PM",
  "02:30 PM",
  "03:00 PM",
  "03:30 PM",
];

export const GENDERS = ["Male", "Female", "Other"];

export const RECORD_TYPES = [
  "Consultation",
  "Lab Result",
  "Imaging",
  "Prescription",
  "Vital Signs",
];

export const NOTIFICATION_TYPES = {
  REMINDER: "appointment_reminder",
  CONFIRMED: "appointment_confirmed",
  CANCELLED: "appointment_cancelled",
  PRESCRIPTION: "prescription_available",
  FOLLOWUP: "follow_up_reminder",
  SYSTEM: "system",
};

export function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

export function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
