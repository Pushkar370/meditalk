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
  [NOTIFICATION_TYPES.REMINDER]: "text-accent",
  [NOTIFICATION_TYPES.CONFIRMED]: "text-success",
  [NOTIFICATION_TYPES.CANCELLED]: "text-danger",
  [NOTIFICATION_TYPES.PRESCRIPTION]: "text-primary",
  [NOTIFICATION_TYPES.FOLLOWUP]: "text-accent",
  [NOTIFICATION_TYPES.SYSTEM]: "text-ink/50",
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
    type === "pharmacy_order" ||
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
  const color = TYPE_COLOR[notification.type] || "text-ink/50";
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
      className={
        "group flex items-start gap-3 p-3.5 rounded-xl transition cursor-pointer " +
        (notification.read
          ? "bg-white hover:bg-sage/10 hover:border hover:border-sage/40"
          : "bg-cream/60 border border-accent/30 hover:bg-cream/80 hover:border-accent/50")
      }
    >
      <div className={"h-9 w-9 rounded-full bg-sage/20 flex items-center justify-center shrink-0 " + color}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-ink text-sm truncate group-hover:text-primary transition-colors">
            {notification.title}
          </p>
          {!notification.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
        </div>
        <p className="text-xs text-ink/60 mt-0.5 line-clamp-2">{notification.message}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <p className="text-[11px] text-ink/40">{formatDateTime(notification.date)}</p>
          <span className="text-[10px] text-primary/80 opacity-0 group-hover:opacity-100 transition-opacity font-medium flex items-center gap-0.5">
            Open <ArrowRight className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
        {!notification.read && onRead && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRead(notification.id);
            }}
            className="text-[11px] text-primary hover:underline px-1 py-0.5"
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
            className="text-[11px] text-danger hover:underline px-1 py-0.5"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
