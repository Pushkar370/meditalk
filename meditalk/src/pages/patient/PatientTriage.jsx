import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowRight,
  RotateCcw,
  Calendar,
  Stethoscope,
  ShieldAlert,
  HeartPulse,
  ChevronRight,
  PhoneCall,
  Check,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { assessSymptoms } from "../../services/triageService";

const QUICK_CHIPS = [
  { label: "🫀 Chest Discomfort", text: "Chest discomfort with mild tightness on exertion" },
  { label: "🌡️ Fever & Chills", text: "Fever and body aches with chills" },
  { label: "🧴 Itchy Skin Rash", text: "Red itchy skin rash with small bumps" },
  { label: "🧠 Severe Migraine", text: "Throbbing one-sided headache with light sensitivity" },
  { label: "🫁 Shortness of Breath", text: "Shortness of breath and persistent dry cough" },
  { label: "🦴 Joint / Knee Pain", text: "Sharp joint stiffness and pain in the knee" },
  { label: "🤢 Stomach Pain", text: "Cramping abdominal pain with nausea after eating" },
  { label: "👶 Child Fever & Rash", text: "Toddler with high fever, irritability, and skin rash" },
];

const DURATION_OPTIONS = [
  "Less than 24 hours",
  "1 to 3 days",
  "4 to 7 days",
  "1 to 2 weeks",
  "More than 2 weeks",
  "Chronic / Recurring",
];

const ACCOMPANYING_LIST = [
  "High Fever",
  "Dizziness / Lightheadedness",
  "Extreme Fatigue",
  "Nausea / Vomiting",
  "Night Sweats",
  "Swelling in Legs/Ankles",
  "Shortness of Breath",
  "Difficulty Swallowing",
  "Palpitations / Rapid Heartbeat",
];

export default function PatientTriage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [symptoms, setSymptoms] = useState("");
  const [duration, setDuration] = useState(DURATION_OPTIONS[1]);
  const [severity, setSeverity] = useState(5);
  const [accompanying, setAccompanying] = useState([]);
  const [assessing, setAssessing] = useState(false);
  const [result, setResult] = useState(null);

  function toggleAccompanying(item) {
    setAccompanying((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  }

  function handleQuickChip(text) {
    setSymptoms((prev) => (prev ? `${prev}. ${text}` : text));
  }

  async function handleRunAssessment() {
    if (!symptoms.trim()) {
      toast.error("Please describe your primary symptoms first.");
      return;
    }
    setAssessing(true);
    try {
      const data = await assessSymptoms({
        symptoms,
        duration,
        severity,
        accompanyingSymptoms: accompanying,
        age: user?.age || null,
        gender: user?.gender || null,
      });
      setResult(data);
      setStep(3);
      toast.success("Triage assessment generated successfully.");
    } catch (err) {
      toast.error(err.message || "Failed to complete triage assessment.");
    } finally {
      setAssessing(false);
    }
  }

  function handleReset() {
    setStep(1);
    setSymptoms("");
    setDuration(DURATION_OPTIONS[1]);
    setSeverity(5);
    setAccompanying([]);
    setResult(null);
  }

  function handleProceedToBooking() {
    if (!result) return;
    navigate("/patient/book-appointment", {
      state: {
        recommendedSpecialty: result.recommendedSpecialty,
        triageSummary: result,
        reason: symptoms,
      },
    });
  }

  function getSeverityColor(val) {
    if (val <= 3) return "text-emerald-600 dark:text-emerald-400";
    if (val <= 6) return "text-amber-500 dark:text-amber-400";
    if (val <= 8) return "text-orange-500 dark:text-orange-400";
    return "text-rose-600 dark:text-rose-400";
  }

  function getUrgencyBadge(urgency) {
    switch (urgency) {
      case "emergency":
        return {
          bg: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
          icon: ShieldAlert,
          title: "Emergency Care Required",
          badgeTone: "danger",
        };
      case "urgent":
        return {
          bg: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30",
          icon: AlertTriangle,
          title: "Urgent Consultation (24–48h)",
          badgeTone: "warning",
        };
      case "self_care":
        return {
          bg: "bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/30",
          icon: Info,
          title: "Mild / Home Monitoring",
          badgeTone: "info",
        };
      default:
        return {
          bg: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
          icon: CheckCircle2,
          title: "Routine Scheduled Visit",
          badgeTone: "success",
        };
    }
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
      <PageHeader
        title="AI Clinical Triage Assistant"
        subtitle="Conversational symptom checker providing triage urgency levels and intelligent specialty guidance."
        action={
          step === 3 && (
            <Button variant="outline" size="sm" onClick={handleReset} className="text-xs">
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Start New Triage
            </Button>
          )
        }
      />

      {/* Clinical Guidance Notice Banner */}
      <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle text-ink dark:text-dark-ink">
        <div className="h-6 w-6 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
          <Info className="w-4 h-4" />
        </div>
        <p className="text-xs sm:text-sm text-ink/75 dark:text-dark-ink/75 leading-relaxed">
          <strong className="font-semibold text-ink dark:text-dark-ink">Clinical Guidance Notice:</strong>{" "}
          This AI tool assesses urgency and recommends medical specialties based on evidence-based triage logic. It is not an official medical diagnosis. In life-threatening emergencies,{" "}
          <strong className="font-semibold text-rose-600 dark:text-rose-400">
            dial emergency services (911 / 112 / 108) immediately.
          </strong>
        </p>
      </div>

      {/* ── Step 1 & 2: Assessment Input Flow ───────────────────────── */}
      {step < 3 && (
        <div className="space-y-6">
          <Card>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-ink dark:text-dark-ink mb-1">
                  1. What symptoms are you experiencing? <span className="text-rose-500">*</span>
                </label>
                <p className="text-xs text-ink/50 dark:text-dark-ink/50 mb-2.5">
                  Describe what you feel, where the discomfort is located, and how it started.
                </p>
                <textarea
                  rows={4}
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="e.g., I've had sharp chest pain radiating to my shoulder for the past 2 hours, especially when taking deep breaths..."
                  className="w-full bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-4 text-sm text-ink dark:text-dark-ink placeholder:text-ink/30 dark:placeholder:text-dark-ink/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition resize-none"
                />
              </div>

              {/* Quick Suggestion Chips */}
              <div>
                <p className="text-[11px] font-semibold text-ink/50 dark:text-dark-ink/50 uppercase tracking-wider mb-2">
                  Quick Examples (Click to append)
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_CHIPS.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickChip(chip.text)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle hover:border-primary/40 text-ink/80 dark:text-dark-ink/80 transition active:scale-[0.97]"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card title="2. Clinical Context & Severity">
            <div className="space-y-6">
              {/* Duration */}
              <div>
                <label className="block text-xs font-semibold text-ink/60 dark:text-dark-ink/60 uppercase tracking-wider mb-2.5">
                  How long have these symptoms persisted?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setDuration(opt)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-medium border text-left transition-all active:scale-[0.98] ${
                        duration === opt
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-surface dark:bg-dark-surface border-border-subtle dark:border-dark-border-subtle text-ink/80 dark:text-dark-ink/80 hover:border-primary/30"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-ink/60 dark:text-dark-ink/60 uppercase tracking-wider">
                    Severity Level (1 to 10 scale)
                  </label>
                  <span className={`text-sm font-bold ${getSeverityColor(severity)}`}>
                    {severity} / 10 ·{" "}
                    {severity <= 3
                      ? "Mild"
                      : severity <= 6
                      ? "Moderate"
                      : severity <= 8
                      ? "Severe"
                      : "Critical"}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={severity}
                  onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
                  className="w-full accent-primary h-2 bg-canvas dark:bg-dark-surface-elevated rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-ink/40 dark:text-dark-ink/40 mt-1.5">
                  <span>1 (Barely noticeable)</span>
                  <span>5 (Noticeable discomfort)</span>
                  <span>10 (Unbearable / Debilitating)</span>
                </div>
              </div>

              {/* Accompanying Symptoms */}
              <div>
                <label className="block text-xs font-semibold text-ink/60 dark:text-dark-ink/60 uppercase tracking-wider mb-2.5">
                  Any accompanying symptoms? (Select all that apply)
                </label>
                <div className="flex flex-wrap gap-2">
                  {ACCOMPANYING_LIST.map((item) => {
                    const active = accompanying.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleAccompanying(item)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-[0.97] ${
                          active
                            ? "bg-primary text-white border-primary shadow-sm font-semibold"
                            : "bg-surface dark:bg-dark-surface border-border-subtle dark:border-dark-border-subtle text-ink/70 dark:text-dark-ink/70 hover:border-primary/30"
                        }`}
                      >
                        {item} {active && "✓"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  onClick={handleRunAssessment}
                  loading={assessing}
                  disabled={!symptoms.trim()}
                  className="w-full sm:w-auto px-6 py-3 text-xs"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Analyze Symptoms & Run Triage
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── Step 3: Triage Results Dashboard ─────────────────────────── */}
      {step === 3 && result && (
        <div className="space-y-6 animate-fade-in">
          {/* Urgency Status Banner */}
          {(() => {
            const badge = getUrgencyBadge(result.urgency);
            const IconComponent = badge.icon;
            return (
              <div
                className={`p-6 rounded-3xl border ${badge.bg} shadow-card dark:shadow-none space-y-3`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle shadow-sm">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider opacity-75">
                        Triage Urgency Level
                      </span>
                      <h2 className="text-xl font-bold tracking-tight">{badge.title}</h2>
                    </div>
                  </div>

                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-surface/80 dark:bg-dark-surface/80 border border-current/20">
                    {result.source === "gemini_ai"
                      ? "Powered by Google Gemini ✨"
                      : "Evidence-Based Clinical Matrix ⚙️"}
                  </span>
                </div>
                <p className="text-sm pt-1 leading-relaxed opacity-90">{result.urgencyReason}</p>

                {result.urgency === "emergency" && (
                  <div className="mt-4 p-5 rounded-2xl bg-rose-500/10 border-2 border-rose-500 text-rose-700 dark:text-rose-400 space-y-3.5">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                      <div>
                        <h4 className="font-bold text-sm">Critical Clinical Safety Alert</h4>
                        <p className="text-xs leading-relaxed mt-0.5 text-ink/80 dark:text-dark-ink/80">
                          These symptoms may indicate an acute medical emergency. Telehealth visits cannot substitute for emergency room or immediate paramedic intervention. If you or the patient is having chest pain, severe shortness of breath, sudden facial drooping or weakness, call emergency services right away.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <a
                        href="tel:112"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition shadow-sm"
                      >
                        <PhoneCall className="w-3.5 h-3.5" /> Call 112 (National Emergency)
                      </a>
                      <a
                        href="tel:108"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-rose-600/90 text-white text-xs font-bold hover:bg-rose-600 transition shadow-sm"
                      >
                        <PhoneCall className="w-3.5 h-3.5" /> Call 108 (Ambulance)
                      </a>
                      <a
                        href="tel:911"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-surface dark:bg-dark-surface border border-rose-500 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-500/10 transition shadow-sm"
                      >
                        <PhoneCall className="w-3.5 h-3.5" /> Call 911
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Recommended Specialty & 1-Click Booking CTA */}
          <div className="rounded-3xl bg-surface dark:bg-dark-surface border border-primary/20 dark:border-primary/30 p-6 sm:p-7 shadow-card dark:shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary dark:text-primary-light flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5" /> Recommended Specialty
                </span>
                <h3 className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink">
                  {result.recommendedSpecialty}
                </h3>
                <p className="text-xs sm:text-sm text-ink/70 dark:text-dark-ink/70 max-w-xl leading-relaxed">
                  {result.recommendedSpecialtyReason}
                </p>
              </div>

              <Button
                onClick={handleProceedToBooking}
                className="text-xs py-3 px-5 shrink-0"
              >
                <Calendar className="w-4 h-4 mr-1.5" />
                Book with {result.recommendedSpecialty}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Suggested Questions for the Doctor */}
            <Card title="Suggested Questions for Your Doctor">
              <ul className="space-y-3 text-xs text-ink/80 dark:text-dark-ink/80">
                {(result.suggestedQuestions || []).map((q, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="h-5 w-5 rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{q}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Home Care & Monitoring Tips */}
            <Card title="Home Care & Symptom Monitoring">
              <ul className="space-y-3 text-xs text-ink/80 dark:text-dark-ink/80">
                {(result.homeCareTips || []).map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Clinical Summary for Doctor */}
          <Card title="Pre-Consultation Clinical Brief (Stored with Appointment)">
            <div className="p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle text-xs font-mono text-ink/85 dark:text-dark-ink/85 space-y-2">
              <p className="font-semibold text-ink dark:text-dark-ink leading-relaxed">
                {result.clinicalSummary}
              </p>
              {result.redFlags && result.redFlags.length > 0 && (
                <p className="text-rose-600 dark:text-rose-400 text-[11px] font-sans font-medium">
                  <span className="font-bold">Screened Warnings:</span>{" "}
                  {result.redFlags.join(", ")}
                </p>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
