import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Loader2,
  CalendarX,
  Sparkles,
  Calendar,
  MessageSquare,
  Download,
  ExternalLink,
  CheckCircle2,
  ArrowRight,
  Smartphone,
  Share2,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DoctorCard from "../../components/cards/DoctorCard";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import LoadingState from "../../components/ui/LoadingState";
import WhatsAppNotificationModal from "../../components/appointments/WhatsAppNotificationModal";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { getDoctors, bookAppointment, getAvailableSlots } from "../../services/appointmentService";
import { useFetch } from "../../hooks/useFetch";
import { SPECIALTIES, APPOINTMENT_TYPES, formatDate } from "../../constants";
import {
  generateGoogleCalendarUrl,
  downloadIcsFile,
  generateWhatsAppLink,
  buildAppointmentWhatsAppText,
} from "../../utils/calendarSync";

const STEPS = ["Specialty", "Doctor", "Date", "Time", "Details", "Confirm"];

export default function BookAppointment() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const incomingSpecialty = location.state?.recommendedSpecialty;
  const incomingTriage = location.state?.triageSummary;
  const incomingReason = location.state?.reason;

  const { data: doctors, loading: doctorsLoading } = useFetch(() => getDoctors());

  const [step, setStep] = useState(incomingSpecialty ? 1 : 0);
  const [sel, setSel] = useState({
    specialty: incomingSpecialty || "",
    doctor: null,
    date: "",
    time: "",
    type: APPOINTMENT_TYPES[0],
    reason: incomingReason || "",
    symptoms: "",
    triageSummary: incomingTriage || null,
  });
  const [submitting, setSubmitting] = useState(false);

  // --- Dynamic Slot State ---
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  const [confirmedAppt, setConfirmedAppt] = useState(null);
  const [waModalOpen, setWaModalOpen] = useState(false);

  // Fetch slots whenever doctor + date are both selected (step 3)
  useEffect(() => {
    if (!sel.doctor?.id || !sel.date) { setSlots([]); return; }
    setSlotsLoading(true);
    setSlotsError("");
    setSlots([]);
    getAvailableSlots(sel.doctor.id, sel.date)
      .then((res) => {
        if (res?.slots?.length === 0 && res?.reason) {
          setSlotsError(res.reason);
        } else {
          setSlots(res?.slots || []);
        }
      })
      .catch(() => setSlotsError("Could not load slots. Please try again."))
      .finally(() => setSlotsLoading(false));
  }, [sel.doctor?.id, sel.date]);

  function set(key, value) {
    setSel((s) => ({ ...s, [key]: value }));
    // Reset time if doctor or date changes
    if (key === "doctor" || key === "date") {
      setSel((s) => ({ ...s, [key]: value, time: "" }));
    }
  }

  const filteredDoctors = (doctors || []).filter((d) => d.specialty === sel.specialty);

  const canNext = [
    !!sel.specialty,
    !!sel.doctor,
    !!sel.date,
    !!sel.time,
    sel.reason.trim().length > 0,
    true,
  ][step];

  async function handleBook() {
    setSubmitting(true);
    try {
      const res = await bookAppointment({
        patientId: user?.id,
        patientName: user?.name,
        doctorId: sel.doctor.id,
        doctorName: sel.doctor.name,
        specialty: sel.specialty,
        date: sel.date,
        time: sel.time,
        type: sel.type,
        reason: sel.reason,
        triageSummary: sel.triageSummary,
        urgency: sel.triageSummary?.urgency || 'routine',
      });
      if (res.success) {
        toast.success("Appointment booked successfully!");
        setConfirmedAppt({
          ...res.appointment,
          patient_phone: user?.phone,
          whatsappLink: res.whatsappLink,
        });
      }
    } catch (err) {
      toast.error(err.message || "Failed to book appointment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (doctorsLoading) return <LoadingState />;

  if (confirmedAppt) {
    const isVideo = confirmedAppt.type === "video" || confirmedAppt.type === "Video consultation";
    const googleCalUrl = generateGoogleCalendarUrl(confirmedAppt);
    const waText = buildAppointmentWhatsAppText(confirmedAppt);
    const waLink = confirmedAppt.whatsappLink || generateWhatsAppLink(confirmedAppt.patient_phone || user?.phone, waText);

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <PageHeader title="Booking Confirmation" subtitle="Your telehealth consultation has been successfully scheduled." />

        <div className="card border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-50/50 via-white to-sage/10 dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900 p-6 sm:p-8 rounded-2xl shadow-xl text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4 animate-scale-up">
            <CheckCircle2 className="h-9 w-9" />
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Appointment Confirmed
          </span>

          <h2 className="text-xl sm:text-2xl font-bold text-ink mt-3">
            You're all set with Dr. {confirmedAppt.doctorName || confirmedAppt.doctor_name}!
          </h2>
          <p className="text-xs sm:text-sm text-ink/70 mt-1 max-w-md mx-auto">
            A confirmation email has been dispatched. Sync with your calendar or send a WhatsApp alert below.
          </p>

          {/* Details Card */}
          <div className="my-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-sage/30 dark:border-slate-700 p-4 sm:p-5 text-left shadow-sm space-y-2.5">
            <Summary label="Doctor" value={`Dr. ${confirmedAppt.doctorName || confirmedAppt.doctor_name} (${confirmedAppt.specialty})`} />
            <Summary label="Scheduled Date" value={formatDate(confirmedAppt.date)} />
            <Summary label="Consultation Time" value={confirmedAppt.time} />
            <Summary label="Consultation Mode" value={isVideo ? "🎥 Video Call (Telehealth)" : "🏥 In-Person Clinic Visit"} />
            <Summary label="Appointment ID" value={confirmedAppt.id} />
          </div>

          {/* Action Grid: Calendar & WhatsApp */}
          <div className="grid sm:grid-cols-2 gap-3 text-left">
            {/* Google Calendar */}
            <a
              href={googleCalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 dark:bg-blue-950/40 dark:border-blue-900 text-blue-900 dark:text-blue-200 hover:bg-blue-100/70 transition shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">Google Calendar</p>
                  <p className="text-[11px] opacity-75">1-click calendar sync</p>
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </a>

            {/* iCal (.ICS) */}
            <button
              type="button"
              onClick={() => {
                downloadIcsFile(confirmedAppt);
                toast.success("iCal invite downloaded!");
              }}
              className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-ink hover:bg-slate-100 dark:hover:bg-slate-700/80 transition shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0">
                  <Download className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">Download iCal (.ICS)</p>
                  <p className="text-[11px] text-ink/60">Apple, Outlook, Android</p>
                </div>
              </div>
              <Download className="h-3.5 w-3.5 opacity-60" />
            </button>

            {/* Direct WhatsApp Click-to-Chat */}
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/70 transition shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">Open on WhatsApp</p>
                  <p className="text-[11px] opacity-75">App & WhatsApp Web</p>
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </a>

            {/* Custom WhatsApp Testing Modal */}
            <button
              type="button"
              onClick={() => setWaModalOpen(true)}
              className="flex items-center justify-between p-3.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary transition shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold">Send to My Phone / Others</p>
                  <p className="text-[11px] opacity-75">Interactive WhatsApp tool</p>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 opacity-60" />
            </button>
          </div>

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6 border-t border-sage/20 dark:border-slate-800 mt-6">
            <Button onClick={() => navigate("/patient/appointments")} className="w-full sm:w-auto shadow-md">
              View My Appointments <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmedAppt(null);
                setStep(0);
                setSel({
                  specialty: "",
                  doctor: null,
                  date: "",
                  time: "",
                  type: APPOINTMENT_TYPES[0],
                  reason: "",
                  symptoms: "",
                  triageSummary: null,
                });
              }}
              className="w-full sm:w-auto"
            >
              Book Another Visit
            </Button>
          </div>
        </div>

        {/* WhatsApp Modal */}
        <WhatsAppNotificationModal
          isOpen={waModalOpen}
          onClose={() => setWaModalOpen(false)}
          appointment={confirmedAppt}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Book Appointment" subtitle="A few simple steps to schedule your visit." />

      <Stepper step={step} />

      <div className="card min-h-[18rem]">
        {step === 0 && (
          <Step title="Select a specialty">
            {/* AI Triage Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-r from-primary/10 via-sage/15 to-white border border-primary/20 mb-4">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-bold text-ink">Not sure which specialty you need?</p>
                  <p className="text-[11px] text-ink/60">Use the AI Clinical Triage tool to analyze your symptoms and get matched.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/patient/triage')}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition shadow-sm shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Run AI Triage
              </button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SPECIALTIES.map((s) => (
                <button
                  key={s}
                  onClick={() => set("specialty", s)}
                  className={
                    "p-4 rounded-xl border text-left transition " +
                    (sel.specialty === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-sage/40 hover:bg-sage/20")
                  }
                >
                  <Stethoscope className="h-5 w-5 mb-2" />
                  <p className="font-medium">{s}</p>
                </button>
              ))}
            </div>
          </Step>
        )}

        {step === 1 && (
          <Step title={`Select a doctor · ${sel.specialty}`}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredDoctors.length === 0 ? (
                <p className="text-sm text-ink/50">No doctors available for this specialty.</p>
              ) : (
                filteredDoctors.map((d) => (
                  <DoctorCard key={d.id} doctor={d} onSelect={(doc) => set("doctor", doc)} />
                ))
              )}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step title="Choose a date">
            <div className="max-w-xs space-y-2">
              <Input
                type="date"
                value={sel.date}
                onChange={(e) => set("date", e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
              {sel.date && sel.doctor && (
                <p className="text-xs text-ink/50">
                  Showing available slots for <span className="font-medium text-ink">{sel.doctor.name}</span>
                </p>
              )}
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step title={`Choose a time · ${formatDate(sel.date)}`}>
            {slotsLoading ? (
              <div className="flex items-center gap-2 text-sm text-ink/50 py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Loading available slots…
              </div>
            ) : slotsError ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-ink/50">
                <CalendarX className="h-8 w-8 text-danger/50" />
                <p>{slotsError}</p>
                <p className="text-xs">Please choose a different date.</p>
              </div>
            ) : slots.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-ink/50">
                <CalendarX className="h-8 w-8 text-ink/30" />
                <p>No slots available on this day.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {slots.map((s) => (
                  <button
                    key={s.time}
                    disabled={!s.available}
                    onClick={() => s.available && set("time", s.time)}
                    title={!s.available ? "Already booked" : ""}
                    className={
                      "py-2.5 rounded-xl border text-sm font-medium transition " +
                      (sel.time === s.time
                        ? "border-primary bg-primary/10 text-primary"
                        : s.available
                        ? "border-sage/40 hover:bg-sage/20 text-ink"
                        : "border-sage/20 bg-sage/10 text-ink/25 cursor-not-allowed line-through")
                    }
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </Step>
        )}

        {step === 4 && (
          <Step title="Appointment details">
            <div className="space-y-4 max-w-lg">
              <Select label="Appointment type" value={sel.type} onChange={(e) => set("type", e.target.value)}>
                {APPOINTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Input label="Reason for visit" value={sel.reason} onChange={(e) => set("reason", e.target.value)} placeholder="e.g. Routine check-up" />
              <Input label="Symptoms (optional)" value={sel.symptoms} onChange={(e) => set("symptoms", e.target.value)} placeholder="e.g. Fever, cough" />
            </div>
          </Step>
        )}

        {step === 5 && (
          <Step title="Confirm your appointment">
            <div className="max-w-md space-y-3 text-sm">
              <Summary label="Specialty" value={sel.specialty} />
              <Summary label="Doctor" value={sel.doctor?.name} />
              <Summary label="Date" value={formatDate(sel.date)} />
              <Summary label="Time" value={sel.time} />
              <Summary label="Type" value={sel.type} />
              <Summary label="Reason" value={sel.reason} />
              {sel.triageSummary && (
                <Summary
                  label="AI Triage Urgency"
                  value={sel.triageSummary.urgencyLabel || `${sel.triageSummary.urgency || "routine"} priority`}
                />
              )}
            </div>
          </Step>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleBook} loading={submitting}>
            <Check className="h-4 w-4" /> Confirm Booking
          </Button>
        )}
      </div>
    </div>
  );
}

function Stepper({ step }) {
  return (
    <div className="flex items-center justify-between overflow-x-auto pb-1">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2 shrink-0">
          <div
            className={
              "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition " +
              (i < step
                ? "bg-success text-white"
                : i === step
                ? "bg-primary text-white"
                : "bg-white text-ink/40 border border-sage/40")
            }
          >
            {i < step ? <Check className="h-4 w-4" /> : i + 1}
          </div>
          <span className={"text-xs font-medium " + (i === step ? "text-primary" : "text-ink/40")}>{label}</span>
          {i < STEPS.length - 1 && <div className="h-px w-6 bg-sage/40" />}
        </div>
      ))}
    </div>
  );
}

function Step({ title, children }) {
  return (
    <div>
      <h3 className="font-semibold text-ink mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-sage/20 pb-2">
      <span className="text-ink/50">{label}</span>
      <span className="font-medium text-ink text-right">{value || "-"}</span>
    </div>
  );
}
