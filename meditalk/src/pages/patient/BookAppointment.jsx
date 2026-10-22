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
  ShieldAlert,
  PhoneCall,
  Clock,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DoctorCard from "../../components/cards/DoctorCard";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import LoadingState from "../../components/ui/LoadingState";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  getDoctors,
  bookAppointment,
  getAvailableSlots,
} from "../../services/appointmentService";
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
  const [dismissEmergencyWarning, setDismissEmergencyWarning] = useState(false);

  // Fetch slots whenever doctor + date are both selected
  useEffect(() => {
    if (!sel.doctor?.id || !sel.date) {
      setSlots([]);
      return;
    }
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
        urgency: sel.triageSummary?.urgency || "routine",
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
      if (res.ok && data.success && data.sent) {
        setWaSentTo(data.to || patientPhone.trim());
        toast.success("Appointment details sent to WhatsApp via carrier!");
        if (data.waLink) {
          setConfirmedAppt((prev) => ({ ...prev, whatsappLink: data.waLink }));
        }
      } else {
        const fallbackLink =
          data.waLink ||
          generateWhatsAppLink(
            patientPhone.trim(),
            buildAppointmentWhatsAppText(confirmedAppt, "confirmation")
          );
        setConfirmedAppt((prev) => ({ ...prev, whatsappLink: fallbackLink }));
        setWaSentTo(patientPhone.trim());
        window.open(fallbackLink, "_blank");
        toast.info(
          data.message || "Message opened in WhatsApp directly."
        );
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
    const isVideo =
      confirmedAppt.type === "video" || confirmedAppt.type === "Video consultation";
    const googleCalUrl = generateGoogleCalendarUrl(confirmedAppt);
    const waText = buildAppointmentWhatsAppText(confirmedAppt, "confirmation");
    const waLink =
      confirmedAppt.whatsappLink ||
      generateWhatsAppLink(waSentTo || patientPhone || user?.phone, waText);
    const rawDocName = (
      confirmedAppt.doctorName ||
      confirmedAppt.doctor_name ||
      "Doctor"
    ).trim();
    const doctorDisplayName = rawDocName.startsWith("Dr.")
      ? rawDocName
      : `Dr. ${rawDocName}`;

    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
        <PageHeader
          title="Appointment Confirmed"
          subtitle="Your clinical consultation has been scheduled successfully."
        />

        <div className="card space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4 pb-6 border-b border-border-subtle dark:border-dark-border-subtle">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                ✓ Booking Confirmed
              </span>
              <h2 className="text-xl font-bold tracking-tight text-ink dark:text-dark-ink mt-1">
                {doctorDisplayName}
              </h2>
              <p className="text-xs text-ink/50 dark:text-dark-ink/50 mt-0.5">
                Confirmation ID:{" "}
                <span className="font-mono font-semibold text-ink dark:text-dark-ink">
                  #{confirmedAppt.id}
                </span>
              </p>
            </div>
          </div>

          {/* Details Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle text-xs">
            <div>
              <p className="text-ink/50 dark:text-dark-ink/50 font-medium">Specialty</p>
              <p className="font-semibold text-ink dark:text-dark-ink mt-1">
                {confirmedAppt.specialty || "General Medicine"}
              </p>
            </div>
            <div>
              <p className="text-ink/50 dark:text-dark-ink/50 font-medium">Date</p>
              <p className="font-semibold text-ink dark:text-dark-ink mt-1">
                {formatDate(confirmedAppt.date)}
              </p>
            </div>
            <div>
              <p className="text-ink/50 dark:text-dark-ink/50 font-medium">Time</p>
              <p className="font-semibold text-ink dark:text-dark-ink mt-1">
                {confirmedAppt.time}
              </p>
            </div>
            <div>
              <p className="text-ink/50 dark:text-dark-ink/50 font-medium">Mode</p>
              <p className="font-semibold text-ink dark:text-dark-ink mt-1">
                {isVideo ? "🎥 Video Call" : "🏥 In-Person"}
              </p>
            </div>
          </div>

          {/* WhatsApp Permission & Delivery Section */}
          <div className="p-5 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle">
            <div className="flex items-start gap-3.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="wa-optin"
                    className="text-xs font-semibold text-ink dark:text-dark-ink cursor-pointer"
                  >
                    WhatsApp Consultation Details & Reminders
                  </label>
                  <input
                    id="wa-optin"
                    type="checkbox"
                    checked={waOptIn}
                    onChange={(e) => setWaOptIn(e.target.checked)}
                    className="h-4 w-4 rounded border-border-subtle dark:border-dark-border-subtle text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-ink/60 dark:text-dark-ink/60 mt-0.5">
                  Receive your appointment confirmation, direct video room link, and a 2-hour reminder on your WhatsApp.
                </p>

                {waOptIn && (
                  <div className="mt-3.5 space-y-3">
                    {!waSentTo ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink/40 dark:text-dark-ink/40">
                            +91
                          </span>
                          <input
                            type="tel"
                            placeholder="Enter 10-digit mobile number"
                            value={patientPhone.replace(/^\+?91/, "")}
                            onChange={(e) => setPatientPhone(e.target.value)}
                            className="w-full pl-11 pr-3 py-2 text-xs rounded-xl border border-border-subtle dark:border-dark-border-subtle bg-surface dark:bg-dark-surface text-ink dark:text-dark-ink placeholder:text-ink/30 dark:placeholder:text-dark-ink/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={handleSendWhatsApp}
                          disabled={waSending}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shrink-0"
                        >
                          {waSending ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sending...
                            </>
                          ) : (
                            <>
                              <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Send to WhatsApp
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-surface dark:bg-dark-surface border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 text-xs font-medium text-ink dark:text-dark-ink">
                          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>
                            Details dispatched to <strong>{waSentTo}</strong>
                          </span>
                        </div>
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition active:scale-95"
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
          <div className="pt-2 pb-2">
            <p className="text-xs font-semibold text-ink/60 dark:text-dark-ink/60 uppercase tracking-wider mb-2.5">
              Add to your calendar:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href={googleCalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-3 rounded-2xl border border-border-subtle dark:border-dark-border-subtle bg-surface dark:bg-dark-surface hover:bg-canvas text-ink dark:text-dark-ink text-xs font-medium transition active:scale-95 shadow-sm"
              >
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Add to Google Calendar</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  downloadIcsFile(confirmedAppt);
                  toast.success("iCal invite downloaded!");
                }}
                className="flex items-center justify-center gap-2 p-3 rounded-2xl border border-border-subtle dark:border-dark-border-subtle bg-surface dark:bg-dark-surface hover:bg-canvas text-ink dark:text-dark-ink text-xs font-medium transition active:scale-95 shadow-sm"
              >
                <Download className="h-3.5 w-3.5 text-ink/70 dark:text-dark-ink/70" />
                <span>Download iCal (.ics) for Apple/Outlook</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 border-t border-border-subtle dark:border-dark-border-subtle">
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
            <Button
              onClick={() => navigate("/patient/appointments")}
              className="w-full sm:w-auto text-xs"
            >
              Go to My Appointments <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Book Appointment"
        subtitle="A few simple steps to schedule your clinical consultation."
      />

      {/* Emergency Red-Flag Intercept Banner */}
      {sel.triageSummary?.urgency === "emergency" && !dismissEmergencyWarning && (
        <div className="p-6 rounded-3xl bg-rose-500/10 border-2 border-rose-500 text-rose-700 dark:text-rose-400 space-y-4 shadow-card dark:shadow-none">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-rose-600 text-white shadow-sm shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-rose-700 dark:text-rose-400">
                Emergency Medical Warning
              </h3>
              <p className="text-xs sm:text-sm text-ink/80 dark:text-dark-ink/80 mt-1 leading-relaxed">
                Your AI Triage assessment flagged severe or critical red-flag symptoms. If you or the patient is experiencing acute chest pain, sudden difficulty breathing, slurred speech, acute abdominal distress, or heavy bleeding, <strong>do not wait for a scheduled teleconsultation</strong>. Seek in-person emergency care immediately.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-rose-500/20">
            <div className="flex flex-wrap items-center gap-2">
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-surface dark:bg-dark-surface border border-rose-500 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-500/10 transition shadow-sm"
              >
                <PhoneCall className="w-3.5 h-3.5" /> Call 911
              </a>
            </div>
            <button
              type="button"
              onClick={() => setDismissEmergencyWarning(true)}
              className="text-xs text-ink/60 dark:text-dark-ink/60 hover:text-ink dark:hover:text-dark-ink underline transition font-medium"
            >
              I understand, continue booking non-emergency visit
            </button>
          </div>
        </div>
      )}

      {/* Stepper */}
      <Stepper step={step} />

      {/* Step Content Card */}
      <div className="card min-h-[20rem]">
        {step === 0 && (
          <Step title="Select a clinical specialty">
            {/* AI Triage Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle mb-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-primary-light shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink dark:text-dark-ink">
                    Not sure which specialty you need?
                  </p>
                  <p className="text-[11px] text-ink/60 dark:text-dark-ink/60">
                    Use the AI Clinical Triage tool to analyze symptoms and match with the right department.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/patient/triage")}
                className="text-xs shrink-0 text-primary border-primary/30"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Run AI Triage
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SPECIALTIES.map((s) => {
                const isSelected = sel.specialty === s;
                return (
                  <button
                    key={s}
                    onClick={() => set("specialty", s)}
                    className={`p-4 rounded-2xl border text-left transition-all duration-150 active:scale-[0.98] ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light shadow-sm"
                        : "border-border-subtle dark:border-dark-border-subtle bg-surface dark:bg-dark-surface hover:border-primary/40 text-ink dark:text-dark-ink"
                    }`}
                  >
                    <Stethoscope className="h-5 w-5 mb-2.5 opacity-80" />
                    <p className="font-semibold text-sm">{s}</p>
                  </button>
                );
              })}
            </div>
          </Step>
        )}

        {step === 1 && (
          <Step title={`Select a doctor · ${sel.specialty}`}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDoctors.length === 0 ? (
                <p className="text-sm text-ink/50 dark:text-dark-ink/50 py-8 col-span-full text-center">
                  No doctors currently registered for this specialty.
                </p>
              ) : (
                filteredDoctors.map((d) => (
                  <DoctorCard
                    key={d.id}
                    doctor={d}
                    onSelect={(doc) => set("doctor", doc)}
                  />
                ))
              )}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step title="Choose a date">
            <div className="max-w-xs space-y-3">
              <Input
                type="date"
                label="Consultation date"
                value={sel.date}
                onChange={(e) => set("date", e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
              {sel.date && sel.doctor && (
                <p className="text-xs text-ink/50 dark:text-dark-ink/50">
                  Showing available slots for{" "}
                  <span className="font-semibold text-ink dark:text-dark-ink">
                    {sel.doctor.name}
                  </span>
                </p>
              )}
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step title={`Choose a time · ${formatDate(sel.date)}`}>
            {slotsLoading ? (
              <div className="flex items-center gap-2.5 text-sm text-ink/50 dark:text-dark-ink/50 py-10 justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Loading available doctor slots…
              </div>
            ) : slotsError ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-ink/50 dark:text-dark-ink/50">
                <CalendarX className="h-8 w-8 text-rose-500/60" />
                <p className="font-medium text-ink dark:text-dark-ink">{slotsError}</p>
                <p className="text-xs">Please choose another date or doctor.</p>
              </div>
            ) : slots.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-ink/50 dark:text-dark-ink/50">
                <CalendarX className="h-8 w-8 text-ink/30 dark:text-dark-ink/30" />
                <p className="font-medium text-ink dark:text-dark-ink">
                  No open slots found on this date.
                </p>
                <p className="text-xs">Please select another date in the calendar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                {slots.map((s) => {
                  const isSelected = sel.time === s.time;
                  return (
                    <button
                      key={s.time}
                      disabled={!s.available}
                      onClick={() => s.available && set("time", s.time)}
                      title={!s.available ? "Already booked" : ""}
                      className={`py-3 rounded-2xl border text-sm font-medium transition-all active:scale-[0.98] ${
                        isSelected
                          ? "border-primary bg-primary text-white shadow-sm"
                          : s.available
                          ? "border-border-subtle dark:border-dark-border-subtle bg-surface dark:bg-dark-surface hover:border-primary/40 text-ink dark:text-dark-ink"
                          : "border-border-subtle/40 dark:border-dark-border-subtle/30 bg-canvas dark:bg-dark-surface-elevated/20 text-ink/30 dark:text-dark-ink/30 cursor-not-allowed line-through"
                      }`}
                    >
                      {s.time}
                    </button>
                  );
                })}
              </div>
            )}
          </Step>
        )}

        {step === 4 && (
          <Step title="Appointment details">
            <div className="space-y-4 max-w-lg">
              <Select
                label="Appointment type"
                value={sel.type}
                onChange={(e) => set("type", e.target.value)}
              >
                {APPOINTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Input
                label="Reason for visit"
                value={sel.reason}
                onChange={(e) => set("reason", e.target.value)}
                placeholder="e.g. Routine follow-up, ongoing migraine"
              />
              <Input
                label="Symptoms (optional)"
                value={sel.symptoms}
                onChange={(e) => set("symptoms", e.target.value)}
                placeholder="e.g. Mild headache, sensitivity to light"
              />
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
                  value={
                    sel.triageSummary.urgencyLabel ||
                    `${sel.triageSummary.urgency || "routine"} priority`
                  }
                />
              )}
            </div>
          </Step>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="text-xs"
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className="text-xs"
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleBook} loading={submitting} className="text-xs">
            <Check className="h-4 w-4 mr-1" /> Confirm Booking
          </Button>
        )}
      </div>
    </div>
  );
}

function Stepper({ step }) {
  return (
    <div className="flex items-center justify-between overflow-x-auto pb-2 scrollbar-none">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2 shrink-0">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
              i < step
                ? "bg-emerald-600 text-white shadow-sm"
                : i === step
                ? "bg-primary text-white shadow-sm ring-4 ring-primary/10"
                : "bg-surface dark:bg-dark-surface text-ink/40 dark:text-dark-ink/40 border border-border-subtle dark:border-dark-border-subtle"
            }`}
          >
            {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span
            className={`text-xs font-medium ${
              i === step
                ? "text-primary dark:text-primary-light font-semibold"
                : "text-ink/40 dark:text-dark-ink/40"
            }`}
          >
            {label}
          </span>
          {i < STEPS.length - 1 && (
            <div className="h-px w-6 sm:w-10 bg-border-subtle dark:bg-dark-border-subtle mx-1" />
          )}
        </div>
      ))}
    </div>
  );
}

function Step({ title, children }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-ink dark:text-dark-ink text-base">{title}</h3>
      {children}
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-subtle dark:border-dark-border-subtle pb-2.5">
      <span className="text-ink/50 dark:text-dark-ink/50 text-xs">{label}</span>
      <span className="font-medium text-ink dark:text-dark-ink text-right text-xs">
        {value || "-"}
      </span>
    </div>
  );
}
