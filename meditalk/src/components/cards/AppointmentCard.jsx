import { Calendar, Clock, Stethoscope, Video, MessageSquare } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";
import Button from "../ui/Button";

export default function AppointmentCard({
  appointment,
  onView,
  onReschedule,
  onCancel,
  onCheckIn,
  onWhatsApp,
  noCard = false,
}) {
  const a = appointment;
  const isToday = a.date === new Date().toISOString().slice(0, 10);
  const isUpcoming = a.status === "upcoming" || a.status === "confirmed";

  return (
    <div
      className={
        noCard
          ? "p-5 rounded-2xl bg-[#F5F5F7] dark:bg-[#2C2C2E]/60 border border-black/[0.06] dark:border-white/[0.08]"
          : "card"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center shrink-0">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink dark:text-white tracking-tight">
              {a.doctorName}
            </p>
            <p className="text-xs text-ink-secondary dark:text-neutral-400 mt-0.5">
              {a.specialty}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={a.status} />
          {a.checkInStatus === "checked_in" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-success/10 text-success-dark dark:text-success-light border border-success/20">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Checked In · Waiting
            </span>
          )}
          {a.checkInStatus === "in_room" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/15 text-primary dark:text-primary-light border border-primary/25 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              In Room · Calling
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3.5 border-t border-black/[0.04] dark:border-white/[0.06] grid grid-cols-2 gap-2.5 text-xs text-ink-secondary dark:text-neutral-300">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>{a.date}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>{a.time}</span>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          {a.type === "Video consultation" ? (
            <Video className="h-3.5 w-3.5 text-primary shrink-0" />
          ) : (
            <Stethoscope className="h-3.5 w-3.5 text-primary shrink-0" />
          )}
          <span>{a.type}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
        {onCheckIn && isToday && isUpcoming && !a.checkInStatus && (
          <Button
            size="sm"
            onClick={() => onCheckIn(a)}
            className="shadow-xs bg-success text-white hover:bg-success-dark"
          >
            Check In for Visit
          </Button>
        )}

        {onView && (
          <Button
            size="sm"
            variant={a.status === "completed" ? "primary" : "secondary"}
            onClick={() => onView(a)}
          >
            {a.status === "completed" ? "After-Visit Summary" : "View Details"}
          </Button>
        )}

        {onWhatsApp && a.status !== "cancelled" && (
          <button
            type="button"
            onClick={() => onWhatsApp(a)}
            title="WhatsApp Alert & Calendar"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/[0.08] dark:border-white/[0.12] bg-[#F5F5F7] dark:bg-[#2C2C2E] text-ink dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.08] text-xs font-semibold transition shadow-xs"
          >
            <MessageSquare className="h-3.5 w-3.5 text-success" />
            <span>WhatsApp</span>
          </button>
        )}

        {onReschedule && a.status !== "cancelled" && a.status !== "completed" && (
          <Button size="sm" variant="ghost" onClick={() => onReschedule(a)}>
            Reschedule
          </Button>
        )}

        {onCancel && a.status !== "cancelled" && a.status !== "completed" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCancel(a)}
            className="text-danger hover:bg-danger/10"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
