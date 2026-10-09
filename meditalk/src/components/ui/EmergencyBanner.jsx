import { useState } from "react";
import { AlertTriangle, PhoneCall, ChevronDown, ChevronUp, X, ShieldAlert } from "lucide-react";

export default function EmergencyBanner({ dismissible = false, compact = false }) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (dismissed) return null;

  if (compact) {
    return (
      <aside aria-label="Emergency Medical Advisory" className="rounded-xl border border-rose-300 bg-rose-50/90 text-rose-950 p-3 shadow-xs">
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
            <span className="font-semibold text-rose-900">Emergency:</span>
            <span className="text-rose-800">Chest pain or severe symptoms? Call <strong>112 / 911</strong> immediately.</span>
          </div>
          <a
            href="tel:112"
            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-rose-700 transition"
          >
            <PhoneCall className="h-3 w-3" /> Call 112
          </a>
        </div>
      </aside>
    );
  }

  return (
    <aside aria-label="Emergency Medical Advisory" className="mb-5 rounded-2xl border-2 border-rose-400 bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 text-rose-950 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <AlertTriangle className="h-5 w-5 animate-pulse" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-rose-600 text-white shadow-xs">
                🚨 Urgent Medical Warning
              </span>
              <span className="text-xs font-bold text-rose-950">MediTalk is NOT for Life-Threatening Emergencies</span>
            </div>
            <p className="text-xs text-rose-900/90 leading-relaxed max-w-3xl">
              If you are experiencing <strong>chest pain</strong>, <strong>severe shortness of breath</strong>, <strong>sudden numbness/paralysis</strong>, uncontrolled bleeding, or signs of stroke, <strong>call emergency services immediately (112 / 911 / 108)</strong> or go to the nearest emergency room.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-800 hover:text-rose-950 px-2.5 py-1.5 rounded-lg hover:bg-rose-100 transition"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Less" : "Warning Signs"}
          </button>

          <a
            href="tel:112"
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 active:scale-95 transition"
          >
            <PhoneCall className="h-3.5 w-3.5" /> Call Emergency (112)
          </a>

          {dismissible && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-1 rounded-lg text-rose-700 hover:bg-rose-200/60 transition"
              title="Dismiss warning"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-rose-200/80 bg-white/70 px-4 py-3 sm:px-6 text-xs text-rose-950">
          <p className="font-bold text-rose-900 mb-1.5 flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-rose-600" /> Seek Immediate Emergency Department Care If Experiencing:
          </p>
          <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-rose-900/90 list-disc list-inside">
            <li>Pressure, tightness or squeezing in your chest</li>
            <li>Difficulty breathing or choking sensation</li>
            <li>Sudden weakness, facial droop, or speech difficulty (Stroke)</li>
            <li>Loss of consciousness, fainting, or acute confusion</li>
            <li>Sudden, excruciating, worst headache of life</li>
            <li>Severe anaphylaxis / throat closing after allergen</li>
          </ul>
        </div>
      )}
    </aside>
  );
}
