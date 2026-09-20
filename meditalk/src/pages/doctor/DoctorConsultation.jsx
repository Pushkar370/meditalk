import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Stethoscope, Activity, Pill, Save, FileText, CheckCircle2,
  Video, PhoneOff, Phone, ChevronDown, ChevronUp, Sparkles, AlertTriangle, AlertCircle, ArrowDownToLine,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import Avatar from "../../components/ui/Avatar";
import LoadingState from "../../components/ui/LoadingState";
import VideoRoom from "../../components/video/VideoRoom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useFetch } from "../../hooks/useFetch";
import { getPatientById } from "../../services/patientService";
import { saveConsultation } from "../../services/prescriptionService";
import { getAppointmentById, updateVideoStatus } from "../../services/appointmentService";
import { searchICD10 } from "../../data/icd10";

// ─── Vital thresholds ─────────────────────────────────
const VITALS = [
  { key: "bp",     label: "Blood Pressure",      placeholder: "120/80",  unit: "mmHg", icon: "🫀" },
  { key: "hr",     label: "Heart Rate",           placeholder: "78",      unit: "bpm",  icon: "💓" },
  { key: "temp",   label: "Temperature",          placeholder: "36.8",    unit: "°C",   icon: "🌡️" },
  { key: "spo2",   label: "SpO₂",                placeholder: "98",      unit: "%",    icon: "🫁" },
  { key: "weight", label: "Weight",               placeholder: "70",      unit: "kg",   icon: "⚖️" },
];

function getVitalStatus(key, rawVal) {
  const v = parseFloat(rawVal);
  if (isNaN(v) || !rawVal) return "neutral";
  if (key === "hr") {
    if (v < 40 || v > 130) return "critical";
    if (v < 55 || v > 110) return "warning";
    return "normal";
  }
  if (key === "temp") {
    if (v > 38.5) return "critical";
    if (v > 37.5) return "warning";
    if (v < 35) return "critical";
    return "normal";
  }
  if (key === "spo2") {
    if (v < 90) return "critical";
    if (v < 96) return "warning";
    return "normal";
  }
  if (key === "bp") {
    const sys = parseFloat(rawVal.split("/")[0]);
    if (!isNaN(sys) && sys > 140) return "warning";
    return "normal";
  }
  return "normal";
}

const STATUS_STYLES = {
  neutral:  { dot: "bg-ink/20",           label: "",           bg: "bg-white border-sage/30" },
  normal:   { dot: "bg-success",          label: "Normal",     bg: "bg-white border-success/30" },
  warning:  { dot: "bg-amber-400",        label: "High",       bg: "bg-amber-50 border-amber-200" },
  critical: { dot: "bg-danger animate-pulse", label: "Critical",  bg: "bg-danger/5 border-danger/30" },
};

// ─── Video status helpers ──────────────────────────────
const VIDEO_BADGE = {
  null:        { label: "Not started",  cls: "bg-ink/10 text-ink/50" },
  waiting:     { label: "Waiting",      cls: "bg-amber-100 text-amber-700" },
  in_progress: { label: "In Progress",  cls: "bg-success/15 text-success" },
  ended:       { label: "Ended",        cls: "bg-danger/10 text-danger" },
};

export default function DoctorConsultation() {
  const { id: patientId } = useParams();
  const [searchParams] = useSearchParams();
  const apptId = searchParams.get("apptId");

  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const doctorId = user?.id;
  const doctorName = user?.name || "Doctor";

  const { data: patient, loading: patLoading } = useFetch(() => getPatientById(patientId), [patientId]);
  const { data: appointment, reload: reloadAppt } = useFetch(
    () => (apptId ? getAppointmentById(apptId) : Promise.resolve(null)),
    [apptId]
  );

  const [form, setForm] = useState({
    symptoms: "",
    vitals: { bp: "", hr: "", temp: "", spo2: "", weight: "" },
    diagnosis: "",
    diagnosisCode: "",
    observations: "",
    labStatus: "pending",
    treatmentPlan: "",
    followUpDate: "",
    followUpInstructions: "",
  });
  const [saving, setSaving] = useState(false);
  const [videoOpen, setVideoOpen] = useState(true);
  const [videoUpdating, setVideoUpdating] = useState(false);
  const [triageBriefOpen, setTriageBriefOpen] = useState(true);

  function applyTriageToNotes() {
    if (!appointment?.triageSummary) return;
    const ts = appointment.triageSummary;
    setForm((prev) => {
      const appendedSymptoms = prev.symptoms
        ? `${prev.symptoms}\n[Patient Reported Symptoms]: ${appointment.reason || ''}`
        : (appointment.reason || '');
      const triageBrief = `[AI Clinical Triage Assessment - Priority: ${(ts.urgency || appointment.urgency || 'routine').toUpperCase()}]\nSummary: ${ts.clinicalSummary || ''}\nRecommended Specialty: ${ts.recommendedSpecialty || ''}\nPossible Considerations: ${Array.isArray(ts.possibleConditions) ? ts.possibleConditions.join(', ') : ''}`;
      const appendedObs = prev.observations
        ? `${prev.observations}\n\n${triageBrief}`
        : triageBrief;
      return {
        ...prev,
        symptoms: appendedSymptoms,
        observations: appendedObs,
      };
    });
    toast.success("Applied AI triage notes to consultation record.");
  }

  // ICD-10 dropdown state
  const [icdQuery, setIcdQuery] = useState("");
  const [icdSuggestions, setIcdSuggestions] = useState([]);
  const [icdOpen, setIcdOpen] = useState(false);
  const icdRef = useRef(null);

  // Close ICD dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (icdRef.current && !icdRef.current.contains(e.target)) setIcdOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Update ICD suggestions
  useEffect(() => {
    if (icdQuery.trim().length >= 2) {
      setIcdSuggestions(searchICD10(icdQuery));
      setIcdOpen(true);
    } else {
      setIcdSuggestions([]);
      setIcdOpen(false);
    }
  }, [icdQuery]);

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }
  function setVital(key, value) { setForm((f) => ({ ...f, vitals: { ...f.vitals, [key]: value } })); }

  const videoStatus = appointment?.videoStatus || null;
  const roomId = apptId ? `meditalk-${apptId}` : null;

  async function handleVideoStatus(status) {
    if (!apptId) { toast.error("No appointment linked to this consultation."); return; }
    setVideoUpdating(true);
    try {
      await updateVideoStatus(apptId, status);
      reloadAppt();
      if (status === "in_progress") toast.success("Video call started. Room is now live.");
      if (status === "ended")       toast.info("Call ended. Please save the consultation.");
    } catch (err) {
      toast.error(err.message || "Failed to update video status.");
    } finally {
      setVideoUpdating(false);
    }
  }

  async function handleSave(complete = false) {
    setSaving(true);
    try {
      await saveConsultation({
        patientId: patient.id, doctorId,
        reason: form.symptoms || form.diagnosis,
        symptoms: form.symptoms, vitals: form.vitals,
        diagnosis: form.diagnosis, diagnosisCode: form.diagnosisCode,
        observations: form.observations, labResults: form.labStatus,
        treatmentPlan: form.treatmentPlan, followUpDate: form.followUpDate,
        followUpInstructions: form.followUpInstructions,
        status: "completed", appointmentId: apptId || undefined,
      });
      if (complete) {
        toast.success("Consultation completed successfully.");
        navigate("/doctor/patients");
      } else {
        toast.success("Consultation saved successfully.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to save consultation.");
    } finally {
      setSaving(false);
    }
  }

  if (patLoading) return <LoadingState />;
  if (!patient) return <div className="card"><p className="text-ink/50">Patient not found.</p></div>;

  const badge = VIDEO_BADGE[videoStatus] || VIDEO_BADGE["null"];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consultation"
        subtitle={`Patient: ${patient.name} (${patient.id})`}
      />

      {/* Patient Summary */}
      <Card>
        <div className="flex items-center gap-3">
          <Avatar name={patient.name} size="md" />
          <div>
            <p className="font-semibold text-ink">{patient.name}</p>
            <p className="text-xs text-ink/50">
              {patient.gender || "—"} · {patient.bloodGroup || patient.blood_group || "—"} ·{" "}
              {Array.isArray(patient.allergies)
                ? patient.allergies.join(", ") || "No allergies"
                : patient.allergies || "No allergies"}
            </p>
          </div>
        </div>
      </Card>

      {/* ─── Pre-Consultation AI Triage Brief ───────────── */}
      {appointment?.triageSummary && (
        <div className={`card transition border ${
          (appointment.urgency === "emergency" || appointment.triageSummary.urgency === "emergency")
            ? "border-danger/30 bg-danger/5"
            : (appointment.urgency === "urgent" || appointment.triageSummary.urgency === "urgent")
            ? "border-amber-300 bg-amber-50/50"
            : "border-primary/20 bg-primary/5"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white ${
                (appointment.urgency === "emergency" || appointment.triageSummary.urgency === "emergency")
                  ? "bg-danger animate-pulse"
                  : (appointment.urgency === "urgent" || appointment.triageSummary.urgency === "urgent")
                  ? "bg-amber-500"
                  : "bg-primary"
              }`}>
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-ink text-sm">Pre-Consultation AI Triage Brief</h3>
                  <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full uppercase tracking-wider ${
                    (appointment.urgency === "emergency" || appointment.triageSummary.urgency === "emergency")
                      ? "bg-danger text-white"
                      : (appointment.urgency === "urgent" || appointment.triageSummary.urgency === "urgent")
                      ? "bg-amber-200 text-amber-900"
                      : "bg-sage/40 text-ink/80"
                  }`}>
                    {appointment.triageSummary.urgencyLabel || `${appointment.urgency || "routine"} priority`}
                  </span>
                </div>
                <p className="text-xs text-ink/60 mt-0.5">
                  Assessed via {appointment.triageSummary.source === "gemini_ai" ? "Gemini 1.5 Flash AI" : "MediTalk Clinical Matrix Engine"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={applyTriageToNotes} className="text-xs">
                <ArrowDownToLine className="h-3.5 w-3.5" /> Import to Notes
              </Button>
              <button
                type="button"
                onClick={() => setTriageBriefOpen((v) => !v)}
                className="p-1.5 rounded-lg border border-sage/40 hover:bg-sage/10 transition text-ink/70"
                aria-label="Toggle triage brief"
              >
                {triageBriefOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {triageBriefOpen && (
            <div className="mt-4 pt-4 border-t border-sage/20 space-y-3.5 text-xs">
              <div>
                <span className="font-semibold text-ink/70 block mb-1">Clinical Summary</span>
                <p className="text-ink text-sm leading-relaxed bg-white/80 p-2.5 rounded-lg border border-sage/20">
                  {appointment.triageSummary.clinicalSummary}
                </p>
              </div>

              {/* Red Flags Alert if present */}
              {Array.isArray(appointment.triageSummary.redFlags) && appointment.triageSummary.redFlags.length > 0 && (
                <div>
                  <span className="font-semibold text-danger flex items-center gap-1 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Red-Flag Indicators Screened:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {appointment.triageSummary.redFlags.map((rf, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-danger/10 text-danger border border-danger/20 rounded-md font-medium">
                        {rf}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Potential Conditions & Suggested Diagnostic Questions */}
              <div className="grid sm:grid-cols-2 gap-3">
                {Array.isArray(appointment.triageSummary.possibleConditions) && (
                  <div className="bg-white/70 p-2.5 rounded-lg border border-sage/20">
                    <span className="font-semibold text-ink/70 block mb-1">Differential Considerations</span>
                    <ul className="list-disc list-inside space-y-0.5 text-ink/80">
                      {appointment.triageSummary.possibleConditions.map((cond, idx) => (
                        <li key={idx}>{cond}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(appointment.triageSummary.suggestedQuestions) && (
                  <div className="bg-white/70 p-2.5 rounded-lg border border-sage/20">
                    <span className="font-semibold text-ink/70 block mb-1">Suggested Diagnostic Questions</span>
                    <ul className="list-disc list-inside space-y-0.5 text-ink/80">
                      {appointment.triageSummary.suggestedQuestions.map((q, idx) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Video Panel ───────────────────────────────── */}
      {roomId && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Video className="h-4 w-4 text-primary" />
              <span className="font-semibold text-ink text-sm">Video Consultation</span>
              <span className={"text-xs font-medium px-2 py-0.5 rounded-full " + badge.cls}>
                {badge.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Doctor controls */}
              {!videoStatus && (
                <Button size="sm" onClick={() => handleVideoStatus("waiting")} loading={videoUpdating}>
                  <Phone className="h-3.5 w-3.5" /> Set Waiting
                </Button>
              )}
              {(videoStatus === "waiting" || !videoStatus) && (
                <Button size="sm" onClick={() => handleVideoStatus("in_progress")} loading={videoUpdating}>
                  <Video className="h-3.5 w-3.5" /> Start Call
                </Button>
              )}
              {videoStatus === "in_progress" && (
                <Button size="sm" variant="danger" onClick={() => handleVideoStatus("ended")} loading={videoUpdating}>
                  <PhoneOff className="h-3.5 w-3.5" /> End Call
                </Button>
              )}
              <button
                onClick={() => setVideoOpen((v) => !v)}
                className="p-1.5 rounded-lg border border-sage/40 hover:bg-sage/10 transition"
              >
                {videoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {videoOpen && (
            <VideoRoom
              roomId={roomId}
              displayName={doctorName}
              videoStatus={videoStatus}
              isDoctor
              onEnd={() => handleVideoStatus("ended")}
            />
          )}
        </div>
      )}

      {/* ─── Vitals + Symptoms ─────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title={<span className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-primary" /> Symptoms &amp; Vitals</span>}>
          <div className="space-y-4">
            <Input
              label="Symptoms / Chief Complaint"
              value={form.symptoms}
              onChange={(e) => set("symptoms", e.target.value)}
              placeholder="e.g. Fever, cough for 3 days"
            />

            {/* Vital Cards */}
            <div className="grid sm:grid-cols-2 gap-3">
              {VITALS.map((v) => {
                const status = getVitalStatus(v.key, form.vitals[v.key]);
                const style = STATUS_STYLES[status];
                return (
                  <div key={v.key} className={"rounded-xl border p-3 transition " + style.bg}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{v.icon}</span>
                        <span className="text-xs font-medium text-ink/60">{v.label}</span>
                      </div>
                      {status !== "neutral" && (
                        <div className="flex items-center gap-1">
                          <span className={"h-2 w-2 rounded-full " + style.dot} />
                          <span className={"text-[10px] font-semibold " +
                            (status === "normal" ? "text-success" : status === "warning" ? "text-amber-600" : "text-danger")
                          }>{style.label}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <input
                        type="text"
                        value={form.vitals[v.key]}
                        onChange={(e) => setVital(v.key, e.target.value)}
                        placeholder={v.placeholder}
                        className="flex-1 bg-transparent text-lg font-semibold text-ink focus:outline-none w-0 min-w-0"
                      />
                      <span className="text-xs text-ink/40 shrink-0">{v.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lab Results */}
            <div>
              <label className="label-base">Laboratory Results</label>
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-sage/50 p-4">
                <Activity className="h-5 w-5 text-primary" />
                <span className="text-sm text-ink/60 flex-1">Upload lab report (UI placeholder)</span>
                <span className={"text-xs font-medium px-2 py-1 rounded-full " +
                  (form.labStatus === "pending" ? "bg-accent/20 text-yellow-800" : "bg-success/15 text-success")
                }>
                  {form.labStatus}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          {/* Diagnosis & Plan */}
          <Card title={<span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Diagnosis &amp; Plan</span>}>
            <div className="space-y-4">
              {/* Diagnosis with ICD-10 autosuggestion */}
              <div ref={icdRef} className="relative">
                <label className="label-base">Diagnosis</label>
                <input
                  type="text"
                  value={icdQuery || form.diagnosis}
                  onChange={(e) => {
                    const val = e.target.value;
                    setIcdQuery(val);
                    set("diagnosis", val);
                  }}
                  placeholder="Start typing diagnosis or ICD-10 code…"
                  className="input-base w-full"
                />
                {icdOpen && icdSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl border border-sage/30 shadow-lg overflow-hidden">
                    {icdSuggestions.map((s) => (
                      <button
                        key={s.code}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          set("diagnosis", s.description);
                          set("diagnosisCode", s.code);
                          setIcdQuery("");
                          setIcdOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-primary/5 transition border-b border-sage/10 last:border-0"
                      >
                        <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                          {s.code}
                        </span>
                        <span className="text-sm text-ink">{s.description}</span>
                      </button>
                    ))}
                    <div className="px-4 py-1.5 text-[10px] text-ink/30 border-t border-sage/10">
                      ICD-10 · Select to autofill code
                    </div>
                  </div>
                )}
              </div>

              <Input
                label="Diagnosis Code (ICD-10)"
                value={form.diagnosisCode}
                onChange={(e) => set("diagnosisCode", e.target.value)}
                placeholder="e.g. J06.9"
              />
              <div>
                <label className="label-base">Clinical Observations</label>
                <textarea
                  className="input-base min-h-[80px]"
                  value={form.observations}
                  onChange={(e) => set("observations", e.target.value)}
                  placeholder="Physical examination findings, notes…"
                />
              </div>
              <div>
                <label className="label-base">Treatment Plan</label>
                <textarea
                  className="input-base min-h-[80px]"
                  value={form.treatmentPlan}
                  onChange={(e) => set("treatmentPlan", e.target.value)}
                  placeholder="Medications prescribed, lifestyle advice…"
                />
              </div>
            </div>
          </Card>

          {/* Follow-up */}
          <Card title="Follow-up">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Follow-up Date"
                type="date"
                value={form.followUpDate}
                onChange={(e) => set("followUpDate", e.target.value)}
              />
              <Input
                label="Instructions"
                value={form.followUpInstructions}
                onChange={(e) => set("followUpInstructions", e.target.value)}
                placeholder="e.g. Review in 2 weeks"
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => handleSave(false)} loading={saving}>
          <Save className="h-4 w-4" /> Save Consultation
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate(`/doctor/prescriptions?patientId=${patientId}&diagnosis=${encodeURIComponent(form.diagnosis || '')}`)}
        >
          <Pill className="h-4 w-4" /> Generate Prescription
        </Button>
        <Button variant="success" onClick={() => handleSave(true)} loading={saving}>
          <CheckCircle2 className="h-4 w-4" /> Complete &amp; Close
        </Button>
      </div>
    </div>
  );
}
