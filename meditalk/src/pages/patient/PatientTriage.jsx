import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, AlertCircle, AlertTriangle, CheckCircle2, Info, ArrowRight,
  RotateCcw, Calendar, Stethoscope, ShieldAlert, HeartPulse, ChevronRight
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
  "High Fever", "Dizziness / Lightheadedness", "Extreme Fatigue",
  "Nausea / Vomiting", "Night Sweats", "Swelling in Legs/Ankles",
  "Shortness of Breath", "Difficulty Swallowing", "Palpitations / Rapid Heartbeat",
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
    if (val <= 3) return "text-success";
    if (val <= 6) return "text-amber-500";
    if (val <= 8) return "text-orange-500";
    return "text-danger";
  }

  function getUrgencyBadge(urgency) {
    switch (urgency) {
      case "emergency":
        return {
          bg: "bg-danger/15 text-danger border-danger/30",
          icon: ShieldAlert,
          title: "Emergency Care Required 🚨",
          badgeTone: "danger",
        };
      case "urgent":
        return {
          bg: "bg-amber-100 text-amber-800 border-amber-300",
          icon: AlertTriangle,
          title: "Urgent Consultation (24–48h) ⚠️",
          badgeTone: "warning",
        };
      case "self_care":
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          icon: Info,
          title: "Mild / Home Monitoring ℹ️",
          badgeTone: "info",
        };
      default:
        return {
          bg: "bg-success/15 text-success border-success/30",
          icon: CheckCircle2,
          title: "Routine Scheduled Visit 🟢",
          badgeTone: "success",
        };
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="AI Clinical Triage Assistant"
        subtitle="Conversational symptom checker providing triage urgency levels and intelligent specialty guidance."
        action={
          step === 3 && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" /> Start New Triage
            </Button>
          )
        }
      />

      {/* Clinical Disclaimer Banner */}
      <div className="flex items-start gap-3.5 p-4 rounded-xl bg-amber-50 border border-amber-300 shadow-sm text-ink">
        <div className="h-6 w-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <Info className="w-4 h-4" />
        </div>
        <p className="text-xs sm:text-sm text-ink leading-relaxed">
          <strong className="font-bold text-amber-950">Clinical Guidance Notice:</strong>{" "}
          <span className="text-ink/80 font-normal">
            This AI tool assesses urgency and recommends specialists based on evidence-based triage logic. It is not an official medical diagnosis. In life-threatening emergencies,{" "}
          </span>
          <strong className="font-bold text-danger">
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
                <label className="block text-sm font-semibold text-ink mb-1">
                  1. What symptoms are you experiencing? <span className="text-danger">*</span>
                </label>
                <p className="text-xs text-ink/60 mb-2">
                  Describe what you feel, where the discomfort is located, and how it started.
                </p>
                <textarea
                  rows={4}
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="e.g., I've had sharp chest pain radiating to my shoulder for the past 2 hours, especially when taking deep breaths..."
                  className="w-full border border-sage/40 rounded-xl p-3.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition resize-none"
                />
              </div>

              {/* Quick Suggestion Chips */}
              <div>
                <p className="text-xs font-semibold text-ink/50 uppercase tracking-wider mb-2">
                  Quick Examples (Click to append)
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_CHIPS.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickChip(chip.text)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-sage/40 hover:bg-sage/15 text-ink/80 shadow-sm transition active:scale-95"
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
                <label className="block text-xs font-semibold text-ink/70 uppercase tracking-wider mb-2">
                  How long have these symptoms persisted?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setDuration(opt)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition ${
                        duration === opt
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-white border-sage/40 text-ink/80 hover:bg-sage/10"
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
                  <label className="text-xs font-semibold text-ink/70 uppercase tracking-wider">
                    Severity Level (1 to 10 scale)
                  </label>
                  <span className={`text-sm font-bold ${getSeverityColor(severity)}`}>
                    {severity} / 10 · {severity <= 3 ? "Mild" : severity <= 6 ? "Moderate" : severity <= 8 ? "Severe" : "Critical"}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={severity}
                  onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
                  className="w-full accent-primary h-2 bg-sage/30 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-ink/40 mt-1">
                  <span>1 (Barely noticeable)</span>
                  <span>5 (Noticeable discomfort)</span>
                  <span>10 (Unbearable / Debilitating)</span>
                </div>
              </div>

              {/* Accompanying Symptoms */}
              <div>
                <label className="block text-xs font-semibold text-ink/70 uppercase tracking-wider mb-2">
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                          active
                            ? "bg-primary/10 border-primary text-primary font-semibold"
                            : "bg-white border-sage/40 text-ink/70 hover:bg-sage/10"
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
                  className="w-full sm:w-auto px-6 py-3"
                >
                  <Sparkles className="w-4 h-4" />
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
              <div className={`p-5 rounded-2xl border ${badge.bg} shadow-sm space-y-2`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-white/70 shadow-inner">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider opacity-75">Triage Level</span>
                      <h2 className="text-lg font-bold">{badge.title}</h2>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-white/80 border border-current/20">
                    {result.source === "gemini_ai" ? "Powered by Google Gemini ✨" : "Evidence-Based Clinical Matrix ⚙️"}
                  </span>
                </div>
                <p className="text-sm pt-1 leading-relaxed opacity-90">{result.urgencyReason}</p>

                {result.urgency === "emergency" && (
                  <div className="mt-3 p-3 rounded-xl bg-danger text-white text-xs font-medium flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <span>Immediate Action: If you feel acute crushing pain, fainting, or severe breathing distress, please call emergency services immediately or go to the nearest emergency room.</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Recommended Specialty & 1-Click Booking CTA */}
          <div className="bg-gradient-to-br from-primary/10 via-sage/15 to-white border border-primary/25 rounded-2xl p-6 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5" /> Recommended Specialty
                </span>
                <h3 className="text-xl font-bold text-ink">{result.recommendedSpecialty}</h3>
                <p className="text-xs text-ink/70 max-w-xl">{result.recommendedSpecialtyReason}</p>
              </div>

              <button
                onClick={handleProceedToBooking}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-semibold text-sm shadow-md hover:bg-primary/90 transition active:scale-95 shrink-0"
              >
                <Calendar className="w-4 h-4" />
                Book with {result.recommendedSpecialty}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Suggested Questions for the Doctor */}
            <Card title="Suggested Questions for Your Doctor">
              <ul className="space-y-2.5 text-xs text-ink/80">
                {(result.suggestedQuestions || []).map((q, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="h-4 w-4 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Home Care & Monitoring Tips */}
            <Card title="Home Care & Symptom Monitoring">
              <ul className="space-y-2.5 text-xs text-ink/80">
                {(result.homeCareTips || []).map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {/* Clinical Summary for Doctor */}
          <Card title="Pre-Consultation Clinical Brief (Stored with Appointment)">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-xs font-mono text-ink/85 space-y-2">
              <p className="font-semibold text-ink">{result.clinicalSummary}</p>
              {result.redFlags && result.redFlags.length > 0 && (
                <p className="text-danger text-[11px] font-sans font-medium">
                  <span className="font-bold">Screened Warnings:</span> {result.redFlags.join(", ")}
                </p>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
