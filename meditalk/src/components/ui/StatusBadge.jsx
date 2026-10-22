import { APPOINTMENT_STATUS_LABELS } from "../../constants";

const STATUS_STYLES = {
  upcoming: {
    bg: "bg-warning/10 text-warning-dark dark:text-warning border-warning/20",
    dot: "bg-warning",
  },
  confirmed: {
    bg: "bg-primary/10 text-primary-dark dark:text-primary-light border-primary/20",
    dot: "bg-primary",
  },
  completed: {
    bg: "bg-success/10 text-success-dark dark:text-success-light border-success/20",
    dot: "bg-success",
  },
  cancelled: {
    bg: "bg-danger/10 text-danger-dark dark:text-danger-light border-danger/20",
    dot: "bg-danger",
  },
  pending: {
    bg: "bg-warning/10 text-warning-dark dark:text-warning border-warning/20",
    dot: "bg-warning",
  },
  active: {
    bg: "bg-success/10 text-success-dark dark:text-success-light border-success/20",
    dot: "bg-success",
  },
  inactive: {
    bg: "bg-black/[0.05] dark:bg-white/[0.08] text-ink-secondary dark:text-neutral-400 border-black/[0.08] dark:border-white/[0.1]",
    dot: "bg-ink-tertiary",
  },
  available: {
    bg: "bg-success/10 text-success-dark dark:text-success-light border-success/20",
    dot: "bg-success",
  },
  busy: {
    bg: "bg-danger/10 text-danger-dark dark:text-danger-light border-danger/20",
    dot: "bg-danger",
  },
  success: {
    bg: "bg-success/10 text-success-dark dark:text-success-light border-success/20",
    dot: "bg-success",
  },
  failed: {
    bg: "bg-danger/10 text-danger-dark dark:text-danger-light border-danger/20",
    dot: "bg-danger",
  },
};

export default function StatusBadge({ status, label, className = "" }) {
  const normalized = (status || "").toLowerCase();
  const text = label || APPOINTMENT_STATUS_LABELS[normalized] || status;
  const style = STATUS_STYLES[normalized] || STATUS_STYLES.inactive;

  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border " +
        style.bg +
        " " +
        className
      }
    >
      <span className={"h-1.5 w-1.5 rounded-full shrink-0 " + style.dot} aria-hidden="true" />
      <span className="capitalize">{text}</span>
    </span>
  );
}
