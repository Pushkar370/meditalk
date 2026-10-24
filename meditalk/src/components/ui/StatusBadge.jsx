import { CheckCircle2, Clock, XCircle, AlertCircle, MinusCircle } from "lucide-react";
import { APPOINTMENT_STATUS_LABELS } from "../../constants";

const STATUS_CONFIG = {
  upcoming: {
    bg: "bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-500/25",
    icon: Clock,
  },
  confirmed: {
    bg: "bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 border-emerald-500/25",
    icon: CheckCircle2,
  },
  completed: {
    bg: "bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 border-emerald-500/25",
    icon: CheckCircle2,
  },
  cancelled: {
    bg: "bg-rose-500/10 text-rose-900 dark:text-rose-300 border-rose-500/25",
    icon: XCircle,
  },
  pending: {
    bg: "bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-500/25",
    icon: Clock,
  },
  active: {
    bg: "bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 border-emerald-500/25",
    icon: CheckCircle2,
  },
  inactive: {
    bg: "bg-black/[0.05] dark:bg-white/[0.08] text-ink-secondary dark:text-neutral-300 border-black/[0.1] dark:border-white/[0.12]",
    icon: MinusCircle,
  },
  available: {
    bg: "bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 border-emerald-500/25",
    icon: CheckCircle2,
  },
  busy: {
    bg: "bg-rose-500/10 text-rose-900 dark:text-rose-300 border-rose-500/25",
    icon: AlertCircle,
  },
  success: {
    bg: "bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 border-emerald-500/25",
    icon: CheckCircle2,
  },
  failed: {
    bg: "bg-rose-500/10 text-rose-900 dark:text-rose-300 border-rose-500/25",
    icon: XCircle,
  },
};

export default function StatusBadge({ status, label, className = "" }) {
  const normalized = (status || "").toLowerCase();
  const text = label || APPOINTMENT_STATUS_LABELS[normalized] || status;
  const config = STATUS_CONFIG[normalized] || STATUS_CONFIG.inactive;
  const Icon = config.icon;

  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border whitespace-nowrap " +
        config.bg +
        " " +
        className
      }
    >
      <Icon className="h-3 w-3 shrink-0 stroke-[2.2]" aria-hidden="true" />
      <span className="capitalize">{text}</span>
    </span>
  );
}
