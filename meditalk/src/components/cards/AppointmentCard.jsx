import { Calendar, Clock, Stethoscope, Video } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";
import Button from "../ui/Button";

export default function AppointmentCard({ appointment, onView, onReschedule, onCancel, onCheckIn, noCard = false }) {
  const a = appointment;
  const isToday = a.date === new Date().toISOString().slice(0, 10);
  const isUpcoming = a.status === "upcoming" || a.status === "confirmed";

  return (
    <div className={noCard ? "p-4 rounded-xl bg-sage/10 border border-sage/20" : "card"}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-sage/20 flex items-center justify-center">
            <Stethoscope className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-ink">{a.doctorName}</p>
            <p className="text-xs text-ink/50">{a.specialty}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={a.status} />
          {a.checkInStatus === 'checked_in' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              Checked In · Waiting
            </span>
          )}
          {a.checkInStatus === 'in_room' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/20 text-primary border border-primary/30 animate-pulse">
              In Room · Calling
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-ink/70">
          <Calendar className="h-4 w-4 text-primary" /> {a.date}
        </div>
        <div className="flex items-center gap-2 text-ink/70">
          <Clock className="h-4 w-4 text-primary" /> {a.time}
        </div>
        <div className="col-span-2 flex items-center gap-2 text-ink/70">
          {a.type === "Video consultation" ? (
            <Video className="h-4 w-4 text-primary" />
          ) : (
            <Stethoscope className="h-4 w-4 text-primary" />
          )}
          {a.type}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {onCheckIn && isToday && isUpcoming && !a.checkInStatus && (
          <Button size="sm" onClick={() => onCheckIn(a)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
            Check In for Visit
          </Button>
        )}
        {onView && (
          <Button size="sm" variant="outline" onClick={() => onView(a)}>
            View Details
          </Button>
        )}
        {onReschedule && a.status !== "cancelled" && a.status !== "completed" && (
          <Button size="sm" variant="secondary" onClick={() => onReschedule(a)}>
            Reschedule
          </Button>
        )}
        {onCancel && a.status !== "cancelled" && a.status !== "completed" && (
          <Button size="sm" variant="ghost" onClick={() => onCancel(a)} className="text-danger hover:bg-danger/10">
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
