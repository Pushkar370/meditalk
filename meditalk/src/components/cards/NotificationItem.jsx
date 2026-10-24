import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  CheckCircle2,
  XCircle,
  Pill,
  BellRing,
  Info,
  ArrowRight,
} from "lucide-react";
import { formatDateTime, NOTIFICATION_TYPES } from "../../constants";
import { useAuth } from "../../context/AuthContext";

const TYPE_ICON = {
  [NOTIFICATION_TYPES.REMINDER]: CalendarClock,
  [NOTIFICATION_TYPES.CONFIRMED]: CheckCircle2,
  [NOTIFICATION_TYPES.CANCELLED]: XCircle,
  [NOTIFICATION_TYPES.PRESCRIPTION]: Pill,
  [NOTIFICATION_TYPES.FOLLOWUP]: BellRing,
  [NOTIFICATION_TYPES.SYSTEM]: Info,
};

const TYPE_COLOR = {
  [NOTIFICATION_TYPES.REMINDER]: "text-accent bg-accent/10 dark:bg-accent/20",
  [NOTIFICATION_TYPES.CONFIRMED]: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20",
  [NOTIFICATION_TYPES.CANCELLED]: "text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/20",
  [NOTIFICATION_TYPES.PRESCRIPTION]: "text-primary dark:text-primary-light bg-primary/10 dark:bg-primary/20",
  [NOTIFICATION_TYPES.FOLLOWUP]: "text-accent bg-accent/10 dark:bg-accent/20",
  [NOTIFICATION_TYPES.SYSTEM]: "text-ink-secondary dark:text-neutral-300 bg-black/5 dark:bg-white/10",
};

function getNotificationRoute(notification, userRole) {
  if (notification.target_url) return notification.target_url;
  if (notification.link) return notification.link;
  if (notification.url) return notification.url;

  const type = (notification.type || "").toLowerCase();
  const title = (notification.title || "").toLowerCase();
  const msg = (notification.message || "").toLowerCase();
  const role = userRole || "patient";
  const apptId = notification.appointmentId || notification.appointment_id;

  // Video call / consultation
  if (
    title.includes("video") ||
    title.includes("doctor is ready") ||
    title.includes("call started") ||
    msg.includes("video call")
  ) {
    if (role === "doctor") {
      return apptId ? `/doctor/consultation?appointmentId=${apptId}` : "/doctor/appointments";
    }
    return apptId ? `/patient/consultation/${apptId}` : "/patient/appointments";
  }

  // Prescriptions & Meds
  if (
    type === NOTIFICATION_TYPES.PRESCRIPTION ||
    type === "prescription_available" ||
    title.includes("prescription") ||
    title.includes("refill") ||
    msg.includes("prescription")
  ) {
    return role === "doctor" ? "/doctor/prescriptions" : "/patient/prescriptions";
  }

  // Follow-up
  if (
    type === NOTIFICATION_TYPES.FOLLOWUP ||
    type === "follow_up_reminder" ||
    title.includes("follow-up") ||
    title.includes("follow up")
  ) {
    return role === "doctor" ? "/doctor/appointments" : "/patient/appointments";
  }

  // Doctor Verification
  if (title.includes("verification") || title.includes("license") || type.includes("verification")) {
    if (role === "admin") return "/admin/doctors?tab=pending";
    return "/doctor/settings";
  }

  // Appointments (Booked, Confirmed, Cancelled, Rescheduled, Reminder)
  if (
    type === NOTIFICATION_TYPES.REMINDER ||
    type === NOTIFICATION_TYPES.CONFIRMED ||
    type === NOTIFICATION_TYPES.CANCELLED ||
    title.includes("appointment") ||
    msg.includes("appointment")
  ) {
    return role === "doctor" ? "/doctor/appointments" : "/patient/appointments";
  }

  // Role default
  if (role === "doctor") return "/doctor/dashboard";
  if (role === "admin") return "/admin/dashboard";
  return "/patient/dashboard";
}

export default function NotificationItem({ notification, onRead, onDelete }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user;
  const Icon = TYPE_ICON[notification.type] || Info;
  const colorClass = TYPE_COLOR[notification.type] || "text-ink-secondary dark:text-neutral-300 bg-black/5 dark:bg-white/10";
  const targetRoute = getNotificationRoute(notification, user?.role);

  const handleClick = () => {
    if (!notification.read && onRead) {
      onRead(notification.id);
    }
    if (targetRoute) {
      navigate(targetRoute);
    }
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={`group flex items-start gap-3.5 p-4 rounded-xl transition-all cursor-pointer ${
        notification.read
          ? "bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          : "bg-primary/5 dark:bg-primary/10 border border-primary/20 hover:border-primary/40"
      }`}
    >
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${colorClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-ink dark:text-white text-sm truncate group-hover:text-primary transition-colors" title={notification.title}>
            {notification.title}
          </p>
          {!notification.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 shadow-xs" />}
        </div>
        <p className="text-xs text-ink-secondary dark:text-neutral-300 mt-0.5 break-words leading-relaxed">{notification.message}</p>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <p className="text-[11px] text-ink-secondary dark:text-neutral-400 font-medium">{formatDateTime(notification.date)}</p>
          <span className="text-[11px] text-primary dark:text-primary-light opacity-0 group-hover:opacity-100 transition-opacity font-semibold flex items-center gap-1">
            Open <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
        {!notification.read && onRead && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRead(notification.id);
            }}
            className="text-[11px] font-semibold text-primary dark:text-primary-light hover:underline px-1.5 py-0.5 rounded"
          >
            Mark read
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification.id);
            }}
            className="text-[11px] font-semibold text-danger hover:underline px-1.5 py-0.5 rounded"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
