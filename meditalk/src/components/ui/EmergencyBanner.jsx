import { useState } from "react";
import { AlertTriangle, PhoneCall, ChevronDown, ChevronUp, X, ShieldAlert } from "lucide-react";

export default function EmergencyBanner({ dismissible = false, compact = false }) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (dismissed) return null;

  if (compact) {
    return (
      <aside
        aria-label="Emergency Medical Advisory"
        className="rounded-2xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-[#251012] text-ink dark:text-white p-3.5 shadow-xs mb-4 min-w-0"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-2 w-2 rounded-full bg-danger animate-pulse shrink-0" />
            <span className="font-bold text-danger-dark dark:text-rose-200 shrink-0">Emergency:</span>
            <span className="text-ink-secondary dark:text-neutral-200 break-words">
              Chest pain or severe symptoms? Call <strong className="text-ink dark:text-white font-bold">112 / 911</strong> immediately.
            </span>
          </div>
          <a
            href="tel:112"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-danger px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-danger-dark active:scale-[0.98] transition-all shrink-0 self-start sm:self-auto"
          >
            <PhoneCall className="h-3 w-3" /> Call 112
          </a>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Emergency Medical Advisory"
      className="mb-6 rounded-2xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-[#251012] text-ink dark:text-white shadow-card overflow-hidden min-w-0"
    >
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-danger text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-danger text-white shadow-xs">
                Emergency Advisory
              </span>
              <span className="text-xs font-bold text-ink dark:text-white">
                MediTalk is for Non-Emergency Care
              </span>
            </div>
            <p className="text-xs text-ink-secondary dark:text-neutral-200 leading-relaxed max-w-3xl break-words">
              If you have <strong className="text-ink dark:text-white font-bold">chest pain</strong>, <strong className="text-ink dark:text-white font-bold">acute breathlessness</strong>, <strong className="text-ink dark:text-white font-bold">sudden weakness or numbness</strong>, severe bleeding, or stroke signs, <strong className="text-danger-dark dark:text-danger-light font-bold">call emergency services (112 / 911 / 108)</strong> or go to the nearest emergency department.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap self-start md:self-center">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-secondary dark:text-neutral-200 hover:text-ink dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Less" : "Warning Signs"}
          </button>

          <a
            href="tel:112"
            className="inline-flex items-center gap-1.5 rounded-full bg-danger px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-danger-dark active:scale-[0.98] transition-all"
          >
            <PhoneCall className="h-3.5 w-3.5" /> Call 112
          </a>

          {dismissible && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-1.5 rounded-full text-ink-secondary dark:text-neutral-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition"
              title="Dismiss warning"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-danger/15 bg-white/70 dark:bg-black/40 backdrop-blur-sm px-4 sm:px-5 py-4 text-xs text-ink dark:text-neutral-200">
          <p className="font-bold text-danger mb-2 flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" /> Seek Emergency Department Care Immediately If Experiencing:
          </p>
          <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-ink-secondary dark:text-neutral-200 list-disc list-inside">
            <li>Pressure, squeezing, or crushing pain in your chest</li>
            <li>Severe difficulty breathing or choking sensation</li>
            <li>Sudden weakness, facial droop, or slurred speech</li>
            <li>Loss of consciousness, syncope, or acute confusion</li>
            <li>Sudden, excruciating, worst headache of your life</li>
            <li>Uncontrolled hemorrhage or profound arterial bleeding</li>
          </ul>
        </div>
      )}
    </aside>
  );
}
