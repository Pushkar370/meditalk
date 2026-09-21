import { Calendar, Clock, Stethoscope, Video } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";
import Button from "../ui/Button";

export default function AppointmentCard({ appointment, onView, onReschedule, onCancel, noCard = false }) {
  const a = appointment;
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
        <StatusBadge status={a.status} />
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

      <div className="mt-4 flex flex-wrap gap-2">
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
