import { Star, Clock } from "lucide-react";
import { initials } from "../../constants";

export default function DoctorCard({ doctor, onSelect, selected = false }) {
  const d = doctor;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(d)}
      className={
        "card text-left transition-all duration-200 flex flex-col justify-between w-full cursor-pointer " +
        (selected
          ? "border-primary ring-2 ring-primary/20 shadow-card-hover"
          : "hover:-translate-y-0.5 hover:shadow-card-hover")
      }
    >
      <div className="flex items-center gap-3.5">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary dark:text-primary-light font-bold flex items-center justify-center text-sm shrink-0">
          {initials(d.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-ink dark:text-white truncate tracking-tight" title={d.name}>
            {d.name}
          </p>
          <p className="text-xs text-ink-secondary dark:text-neutral-400 mt-0.5 truncate" title={d.specialty}>
            {d.specialty}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary dark:text-neutral-400">
        <span className="inline-flex items-center gap-1 font-semibold text-ink dark:text-white">
          <Star className="h-3.5 w-3.5 text-warning fill-warning" />
          <span>{d.rating || "4.9"}</span>
        </span>
        <span>{d.experience || "5"} yrs exp</span>
        <span className="inline-flex items-center gap-1 text-primary dark:text-primary-light font-medium">
          <Clock className="h-3.5 w-3.5" />
          <span>{d.availability || "Available"}</span>
        </span>
      </div>
    </button>
  );
}
