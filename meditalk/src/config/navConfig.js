import {
  LayoutDashboard, User, Users, Stethoscope, FileText, CalendarDays, CalendarPlus, History, Pill, Bell, Settings, LogOut, Calendar, ShieldCheck, Megaphone, Sparkles, BarChart2,
} from "lucide-react";

export const NAV_CONFIG = {
  patient: [
    { label: "Dashboard", to: "/patient/dashboard", icon: LayoutDashboard },
    { label: "Book Appointment", to: "/patient/book-appointment", icon: CalendarPlus },
    { label: "Appointments", to: "/patient/appointments", icon: CalendarDays },
    { label: "AI Symptom Triage", to: "/patient/triage", icon: Sparkles },
    { label: "My Profile", to: "/patient/profile", icon: User },
    { label: "Documents & Lab Reports", to: "/patient/records", icon: FileText },
    { label: "Consultation Timeline", to: "/patient/history", icon: History },
    { label: "Prescriptions", to: "/patient/prescriptions", icon: Pill },
    { label: "Notifications", to: "/patient/notifications", icon: Bell },
    { label: "Settings", to: "/patient/settings", icon: Settings },
  ],
  doctor: [
    { label: "Dashboard", to: "/doctor/dashboard", icon: LayoutDashboard },
    { label: "Appointments", to: "/doctor/appointments", icon: CalendarDays },
    { label: "Patients", to: "/doctor/patients", icon: Users },
    { label: "Calendar", to: "/doctor/calendar", icon: Calendar },
    { label: "Prescriptions", to: "/doctor/prescriptions", icon: Pill },
    { label: "Analytics", to: "/doctor/analytics", icon: BarChart2 },
    { label: "Notifications", to: "/doctor/notifications", icon: Bell },
    { label: "Settings", to: "/doctor/settings", icon: Settings },
  ],
  admin: [
    { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Patients", to: "/admin/patients", icon: Users },
    { label: "Doctors", to: "/admin/doctors", icon: Stethoscope },
    { label: "Appointments", to: "/admin/appointments", icon: CalendarDays },
    { label: "Announcements", to: "/admin/announcements", icon: Megaphone },
    { label: "Analytics", to: "/admin/analytics", icon: BarChart2 },
    { label: "Audit Logs", to: "/admin/audit-logs", icon: FileText },
    { label: "Notifications", to: "/admin/notifications", icon: Bell },
    { label: "Settings", to: "/admin/settings", icon: Settings },
  ],
};
