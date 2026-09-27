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
  const [waOptIn, setWaOptIn] = useState(true);
  const [patientPhone, setPatientPhone] = useState(user?.phone || "");
  const [waSending, setWaSending] = useState(false);
  const [waSentTo, setWaSentTo] = useState(null);

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

  async function handleSendWhatsApp() {
    const rawDigits = patientPhone.replace(/[^\d]/g, "");
    if (!rawDigits || rawDigits.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    setWaSending(true);
    try {
      const res = await fetch("/api/messaging/send-appointment-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({
          appointmentId: confirmedAppt.id,
          recipientPhone: patientPhone.trim(),
          type: "confirmation",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWaSentTo(data.to || patientPhone.trim());
        toast.success("Appointment details sent to WhatsApp!");
        if (data.waLink) {
          setConfirmedAppt((prev) => ({ ...prev, whatsappLink: data.waLink }));
        }
      } else {
        const fallbackLink = generateWhatsAppLink(
          patientPhone.trim(),
          buildAppointmentWhatsAppText(confirmedAppt, "confirmation")
        );
        setConfirmedAppt((prev) => ({ ...prev, whatsappLink: fallbackLink }));
        setWaSentTo(patientPhone.trim());
        window.open(fallbackLink, "_blank");
        toast.success("Opened WhatsApp with your appointment details!");
      }
    } catch (err) {
      const fallbackLink = generateWhatsAppLink(
        patientPhone.trim(),
        buildAppointmentWhatsAppText(confirmedAppt, "confirmation")
      );
      setConfirmedAppt((prev) => ({ ...prev, whatsappLink: fallbackLink }));
      setWaSentTo(patientPhone.trim());
      window.open(fallbackLink, "_blank");
      toast.info("Opened WhatsApp with your appointment details.");
    } finally {
      setWaSending(false);
    }
  }

  if (doctorsLoading) return <LoadingState />;

  if (confirmedAppt) {
    const isVideo = confirmedAppt.type === "video" || confirmedAppt.type === "Video consultation";
    const googleCalUrl = generateGoogleCalendarUrl(confirmedAppt);
    const waText = buildAppointmentWhatsAppText(confirmedAppt, "confirmation");
    const waLink = confirmedAppt.whatsappLink || generateWhatsAppLink(waSentTo || patientPhone || user?.phone, waText);

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader title="Appointment Confirmed" subtitle="Your telehealth consultation has been successfully scheduled." />

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/80 dark:border-emerald-800 shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Booking Confirmed
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                Dr. {confirmedAppt.doctorName || confirmedAppt.doctor_name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Confirmation ID: <span className="font-mono text-slate-700 dark:text-slate-300">#{confirmedAppt.id}</span>
              </p>
            </div>
          </div>

          {/* Details Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-b border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <p className="text-slate-400 font-medium">Specialty</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{confirmedAppt.specialty || "General Medicine"}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Date</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{formatDate(confirmedAppt.date)}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Time</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{confirmedAppt.time}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Mode</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {isVideo ? "🎥 Video Call" : "🏥 In-Person"}
              </p>
            </div>
          </div>

          {/* WhatsApp Permission & Delivery Section */}
          <div className="my-6 p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="wa-optin" className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer">
                    WhatsApp Consultation Details & Reminders
                  </label>
                  <input
                    id="wa-optin"
                    type="checkbox"
                    checked={waOptIn}
                    onChange={(e) => setWaOptIn(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Receive your appointment confirmation, direct video room link, and a 2-hour reminder on your WhatsApp.
                </p>

                {waOptIn && (
                  <div className="mt-3.5 space-y-3">
                    {!waSentTo ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                            +91
                          </span>
                          <input
                            type="tel"
                            placeholder="Enter 10-digit mobile number"
                            value={patientPhone.replace(/^\+?91/, "")}
                            onChange={(e) => setPatientPhone(e.target.value)}
                            className="w-full pl-11 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSendWhatsApp}
                          disabled={waSending}
                          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                        >
                          {waSending ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...
                            </>
                          ) : (
                            <>
                              <MessageSquare className="h-3.5 w-3.5" /> Send to WhatsApp
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 text-xs font-medium text-emerald-900 dark:text-emerald-200">
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>Details dispatched to <strong>{waSentTo}</strong></span>
                        </div>
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-emerald-300 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-50 transition"
                        >
                          <ExternalLink className="h-3 w-3" /> Open in WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Calendar Sync Options */}
          <div className="pt-2 pb-5 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2.5">
              Add to your calendar:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href={googleCalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-medium transition shadow-sm"
              >
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                Add to Google Calendar
              </a>
              <button
                type="button"
                onClick={() => {
                  downloadIcsFile(confirmedAppt);
                  toast.success("iCal invite downloaded!");
                }}
                className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-medium transition shadow-sm"
              >
                <Download className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                Download iCal (.ics) for Apple/Outlook
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5">
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
                setWaSentTo(null);
              }}
              className="w-full sm:w-auto text-xs"
            >
              Book Another Visit
            </Button>
            <Button onClick={() => navigate("/patient/appointments")} className="w-full sm:w-auto text-xs">
              Go to My Appointments <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
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
