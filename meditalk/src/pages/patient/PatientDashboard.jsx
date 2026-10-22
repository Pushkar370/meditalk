import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Pill,
  FileText,
  Plus,
  HeartPulse,
  Activity,
  FlaskConical,
  Sparkles,
  ArrowRight,
  Gauge,
  Thermometer,
  Droplets,
  ShieldCheck,
  Check,
  Video,
  Calendar,
  Clock,
  Stethoscope,
  Download,
  ExternalLink,
  MessageSquare,
} from "lucide-react";

import StatCard from "../../components/ui/StatCard";
import AppointmentCard from "../../components/cards/AppointmentCard";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import StatusBadge from "../../components/ui/StatusBadge";
import LoadingState from "../../components/ui/LoadingState";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { greeting, formatDate } from "../../constants";
import { getPatientById } from "../../services/patientService";
import { getAppointments } from "../../services/appointmentService";
import {
  getMedicalRecords,
  getPrescriptions,
  getAdherenceSchedules,
  logAdherenceDose,
  getFollowUpSuggestions,
} from "../../services/prescriptionService";
import { getPatientVitalsHistory } from "../../services/triageService";
import FollowUpSuggestionsCard from "../../components/appointments/FollowUpSuggestionsCard";
import {
  generateGoogleCalendarUrl,
  downloadIcsFile,
  generateWhatsAppLink,
  buildAppointmentWhatsAppText,
} from "../../utils/calendarSync";
import { useToast } from "../../context/ToastContext";

export default function PatientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const patientId = user?.id;
  const [takingDose, setTakingDose] = useState(null);
  const [toView, setToView] = useState(null);

  const { data: patient, loading: patientLoading } = useFetch(
    () => getPatientById(patientId),
    [patientId]
  );
  const { data: appts, loading: apptsLoading, reload: reloadAppts } = useFetch(
    () => getAppointments({ patientId }),
    [patientId]
  );
  const { data: records } = useFetch(() => getMedicalRecords(patientId), [patientId]);
  const { data: rx } = useFetch(() => getPrescriptions({ patientId }), [patientId]);
  const { data: vitalsHistory } = useFetch(
    () => (patientId ? getPatientVitalsHistory(patientId) : Promise.resolve([])),
    [patientId]
  );
  const { data: adherenceSchedules, reload: reloadAdherence } = useFetch(
    () => (patientId ? getAdherenceSchedules(patientId) : Promise.resolve([])),
    [patientId]
  );
  const { data: followUpRes, reload: reloadFollowUps } = useFetch(
    () => (patientId ? getFollowUpSuggestions(patientId) : Promise.resolve({ suggestions: [] })),
    [patientId]
  );

  if (patientLoading || apptsLoading) return <LoadingState />;

  const upcoming = (appts || []).filter(
    (a) => a.status === "upcoming" || a.status === "confirmed"
  );
  const nextAppt = upcoming[0];

  const recentActivity = [
    ...(records || []).map((r) => ({ ...r, kind: r.type })),
    ...(rx || []).map((p) => ({ ...p, kind: "Prescription", date: p.date })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  const displayName =
    patient?.name?.split(" ")[0] || user?.name?.split(" ")[0] || "there";
  const latestVitals =
    vitalsHistory && vitalsHistory.length > 0
      ? vitalsHistory[vitalsHistory.length - 1]
      : null;
  const hasVitals = !!(
    latestVitals &&
    (latestVitals.bp || latestVitals.hr || latestVitals.temp || latestVitals.spo2)
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Title & Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink dark:text-dark-ink">
            {greeting()}, {displayName}
          </h1>
          <p className="text-sm text-ink/60 dark:text-dark-ink/60 mt-1">
            Personal health telemetry, care routines, and clinical consultations.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            onClick={() => navigate("/patient/book-appointment")}
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Book Appointment
          </Button>
        </div>
      </div>

      {/* CW-3: Follow-Up Suggestions Banner */}
      <FollowUpSuggestionsCard
        suggestions={followUpRes?.suggestions || []}
        onConfirmed={() => {
          reloadFollowUps();
          reloadAppts();
        }}
        onDismissed={() => reloadFollowUps()}
      />

      {/* AI Clinical Triage Launcher Banner (Apple Minimal Card) */}
      <div className="relative overflow-hidden rounded-3xl bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle p-6 sm:p-7 shadow-card dark:shadow-none transition-all">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-primary-light shrink-0">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-ink dark:text-dark-ink text-base">
                  MediTalk AI Symptom Triage
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light">
                  Clinical AI Matrix
                </span>
              </div>
              <p className="text-xs sm:text-sm text-ink/65 dark:text-dark-ink/65 max-w-2xl leading-relaxed">
                Unsure about your symptoms? Get an evidence-based clinical urgency assessment, home care guidance, and automated specialist matching in under 2 minutes.
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate("/patient/triage")}
            className="shrink-0 text-xs py-2.5 px-5"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Check Symptoms Now
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={CalendarClock}
          label="Upcoming"
          value={upcoming.length}
          tone="accent"
        />
        <StatCard
          icon={CalendarDays}
          label="Total Visits"
          value={(appts || []).length}
          tone="primary"
        />
        <StatCard
          icon={Pill}
          label="Active Prescriptions"
          value={(rx || []).filter((p) => p.status === "active").length}
          tone="success"
        />
        <StatCard
          icon={FileText}
          label="Health Records"
          value={(records || []).length}
          tone="sage"
        />
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Upcoming, Activity, Medication, Vitals */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Appointment */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-ink dark:text-dark-ink text-base">
                  Upcoming Appointment
                </h3>
                <p className="text-xs text-ink/50 dark:text-dark-ink/50 mt-0.5">
                  Your next scheduled clinical interaction
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/patient/appointments")}
                className="text-xs text-primary"
              >
                View all
              </Button>
            </div>
            {nextAppt ? (
              <AppointmentCard
                appointment={nextAppt}
                noCard={true}
                onView={() => setToView(nextAppt)}
                onReschedule={() => navigate("/patient/appointments")}
                onCancel={() => navigate("/patient/appointments")}
              />
            ) : (
              <div className="text-center py-10 px-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-dashed border-border-subtle dark:border-dark-border-subtle">
                <CalendarClock className="h-8 w-8 mx-auto text-ink/30 dark:text-dark-ink/30" />
                <p className="mt-2 text-sm font-medium text-ink/70 dark:text-dark-ink/70">
                  No upcoming appointments scheduled
                </p>
                <p className="text-xs text-ink/40 dark:text-dark-ink/40 mt-1 max-w-xs mx-auto">
                  Book a consultation with certified physicians across all clinical departments.
                </p>
                <Button
                  className="mt-4 text-xs"
                  size="sm"
                  onClick={() => navigate("/patient/book-appointment")}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Book Appointment
                </Button>
              </div>
            )}
          </div>

          {/* Daily Medication Routine Adherence */}
          {(adherenceSchedules || []).length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-primary-light">
                    <Pill className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink dark:text-dark-ink text-base">
                      Today's Medication Routine
                    </h3>
                    <p className="text-xs text-ink/50 dark:text-dark-ink/50">
                      Track and log daily doses for optimal adherence
                    </p>
                  </div>
                </div>
                {/* Streak badge */}
                {(() => {
                  const maxStreak = Math.max(
                    ...(adherenceSchedules || []).map((s) => s.streakCount || 0),
                    0
                  );
                  return maxStreak >= 2 ? (
                    <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      🔥 {maxStreak}-Day Streak!
                    </span>
                  ) : null;
                })()}
              </div>

              {["morning", "afternoon", "evening", "night"].map((slot) => {
                const slotMeds = (adherenceSchedules || []).filter((s) =>
                  s.timingSlots?.includes(slot)
                );
                if (slotMeds.length === 0) return null;
                const today = new Date().toISOString().split("T")[0];
                const slotLabel = {
                  morning: "🌅 Morning",
                  afternoon: "☀️ Afternoon",
                  evening: "🌆 Evening",
                  night: "🌙 Night",
                }[slot];
                return (
                  <div key={slot} className="mb-4 last:mb-0">
                    <p className="text-xs font-semibold text-ink/50 dark:text-dark-ink/50 uppercase tracking-wider mb-2">
                      {slotLabel}
                    </p>
                    <div className="space-y-2">
                      {slotMeds.map((sched) => {
                        const logKey = `${today}-${slot}`;
                        const taken = !!sched.takenLogs?.[logKey];
                        const isLogging = takingDose === `${sched.id}-${slot}`;
                        return (
                          <div
                            key={`${sched.id}-${slot}`}
                            className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all duration-200 ${
                              taken
                                ? "bg-emerald-500/5 border-emerald-500/20 dark:border-emerald-500/30"
                                : "bg-surface dark:bg-dark-surface border-border-subtle dark:border-dark-border-subtle hover:border-primary/30"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                                  taken
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light"
                                }`}
                              >
                                <Pill className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p
                                  className={`text-sm font-medium truncate ${
                                    taken
                                      ? "text-ink/50 dark:text-dark-ink/50 line-through"
                                      : "text-ink dark:text-dark-ink"
                                  }`}
                                >
                                  {sched.medicineName}
                                </p>
                                <p className="text-xs text-ink/40 dark:text-dark-ink/40">
                                  {sched.dosage} · {sched.frequency}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                if (taken) return;
                                const key = `${sched.id}-${slot}`;
                                setTakingDose(key);
                                try {
                                  await logAdherenceDose(sched.id, slot, today);
                                  reloadAdherence();
                                  if (sched.streakCount >= 1)
                                    toast.success(
                                      `Dose logged! 🔥 ${sched.streakCount + 1}-day streak!`
                                    );
                                  else toast.success("Dose logged!");
                                } catch (err) {
                                  toast.error("Failed to log dose.");
                                } finally {
                                  setTakingDose(null);
                                }
                              }}
                              disabled={taken || !!takingDose}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.97] ${
                                taken
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 cursor-default"
                                  : "bg-primary text-white hover:bg-primary-hover shadow-sm"
                              } ${isLogging ? "opacity-60" : ""}`}
                            >
                              {taken ? (
                                <>
                                  <ShieldCheck className="h-3.5 w-3.5" /> Taken
                                </>
                              ) : isLogging ? (
                                "Logging..."
                              ) : (
                                <>
                                  <Check className="h-3.5 w-3.5" /> Take Dose
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => navigate("/patient/prescriptions")}
                className="w-full mt-3 text-xs font-medium text-primary hover:underline text-center py-1 block"
              >
                Manage Medication Schedules →
              </button>
            </div>
          )}

          {/* Biometric Vitals Intelligence */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-primary-light">
                  <HeartPulse className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink dark:text-dark-ink text-base">
                    Biometric Vitals Intelligence
                  </h3>
                  <p className="text-xs text-ink/50 dark:text-dark-ink/50">
                    Clinical telemetry monitored across consultations
                  </p>
                </div>
              </div>
              <span className="text-xs text-ink/40 dark:text-dark-ink/40">
                {hasVitals && latestVitals?.date
                  ? `Last recorded: ${formatDate(latestVitals.date)}`
                  : "Clinical Telemetry"}
              </span>
            </div>

            {hasVitals ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle transition">
                  <div className="flex items-center justify-between text-xs text-ink/50 dark:text-dark-ink/50 mb-1">
                    <span>Blood Pressure</span>
                    <Gauge className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-xl font-bold tracking-tight text-ink dark:text-dark-ink">
                    {latestVitals.bp || "—"}{" "}
                    <span className="text-xs font-normal text-ink/40 dark:text-dark-ink/40">
                      mmHg
                    </span>
                  </p>
                  <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    {latestVitals.systolic
                      ? latestVitals.systolic < 125
                        ? "Optimal"
                        : "Elevated"
                      : "Recorded"}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle transition">
                  <div className="flex items-center justify-between text-xs text-ink/50 dark:text-dark-ink/50 mb-1">
                    <span>Heart Rate</span>
                    <Activity className="h-3.5 w-3.5 text-rose-500" />
                  </div>
                  <p className="text-xl font-bold tracking-tight text-ink dark:text-dark-ink">
                    {latestVitals.hr || "—"}{" "}
                    <span className="text-xs font-normal text-ink/40 dark:text-dark-ink/40">
                      bpm
                    </span>
                  </p>
                  <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    {latestVitals.hr
                      ? latestVitals.hr > 100
                        ? "Elevated"
                        : latestVitals.hr < 60
                        ? "Low"
                        : "Normal Range"
                      : "Recorded"}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle transition">
                  <div className="flex items-center justify-between text-xs text-ink/50 dark:text-dark-ink/50 mb-1">
                    <span>SpO₂ Oxygen</span>
                    <Droplets className="h-3.5 w-3.5 text-sky-500" />
                  </div>
                  <p className="text-xl font-bold tracking-tight text-ink dark:text-dark-ink">
                    {latestVitals.spo2 || "—"}{" "}
                    <span className="text-xs font-normal text-ink/40 dark:text-dark-ink/40">
                      %
                    </span>
                  </p>
                  <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-400">
                    {latestVitals.spo2
                      ? latestVitals.spo2 >= 95
                        ? "Optimal"
                        : "Requires Attention"
                      : "Recorded"}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle transition">
                  <div className="flex items-center justify-between text-xs text-ink/50 dark:text-dark-ink/50 mb-1">
                    <span>Temperature</span>
                    <Thermometer className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <p className="text-xl font-bold tracking-tight text-ink dark:text-dark-ink">
                    {latestVitals.temp || "—"}{" "}
                    <span className="text-xs font-normal text-ink/40 dark:text-dark-ink/40">
                      °C
                    </span>
                  </p>
                  <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    {latestVitals.temp
                      ? latestVitals.temp > 37.5
                        ? "Febrile"
                        : "Afebrile"
                      : "Recorded"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/30 border border-border-subtle dark:border-dark-border-subtle text-center mb-4 flex flex-col items-center justify-center">
                <HeartPulse className="h-8 w-8 text-primary/60 mb-2" />
                <h4 className="font-semibold text-ink dark:text-dark-ink text-sm">
                  No Vitals Recorded Yet
                </h4>
                <p className="text-xs text-ink/60 dark:text-dark-ink/60 mt-1 max-w-md leading-relaxed">
                  Your biometric telemetry (blood pressure, pulse, oxygen saturation, and temperature) will appear here automatically following consultations or nurse vitals entry.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/patient/triage")}
                    className="text-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" /> Check Symptoms
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => navigate("/patient/book-appointment")}
                    className="text-xs"
                  >
                    <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Book Consultation
                  </Button>
                </div>
              </div>
            )}

            {/* Historical Consultation Telemetry Log */}
            {vitalsHistory && vitalsHistory.length > 0 && (
              <div className="overflow-x-auto border-t border-border-subtle dark:border-dark-border-subtle pt-3">
                <p className="text-[11px] font-semibold text-ink/50 dark:text-dark-ink/50 uppercase tracking-wider mb-2">
                  Past Consultations Telemetry
                </p>
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-border-subtle dark:border-dark-border-subtle text-ink/50 dark:text-dark-ink/50 font-medium">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Consultant</th>
                      <th className="pb-2">BP</th>
                      <th className="pb-2">Heart Rate</th>
                      <th className="pb-2">SpO₂</th>
                      <th className="pb-2">Diagnosis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle dark:divide-dark-border-subtle text-ink dark:text-dark-ink">
                    {vitalsHistory
                      .slice(-3)
                      .reverse()
                      .map((vh) => (
                        <tr
                          key={vh.consultationId}
                          className="hover:bg-canvas dark:hover:bg-dark-surface-elevated/40 transition"
                        >
                          <td className="py-2.5 text-ink/70 dark:text-dark-ink/70">
                            {formatDate(vh.date)}
                          </td>
                          <td className="py-2.5 font-medium">{vh.doctorName}</td>
                          <td className="py-2.5 font-mono">{vh.bp || "—"}</td>
                          <td className="py-2.5">{vh.hr ? `${vh.hr} bpm` : "—"}</td>
                          <td className="py-2.5">{vh.spo2 ? `${vh.spo2}%` : "—"}</td>
                          <td className="py-2.5 text-ink/60 dark:text-dark-ink/60 truncate max-w-[120px]">
                            {vh.diagnosis}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="card">
            <h3 className="font-semibold text-ink dark:text-dark-ink text-base mb-4">
              Recent Clinical Activity
            </h3>
            <div className="space-y-2.5">
              {recentActivity.length === 0 && (
                <p className="text-sm text-ink/50 dark:text-dark-ink/50 py-4 text-center">
                  No recent activity found.
                </p>
              )}
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/30 border border-border-subtle dark:border-dark-border-subtle hover:border-primary/30 transition-all duration-150"
                >
                  <div className="h-9 w-9 rounded-xl bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle flex items-center justify-center text-primary dark:text-primary-light shrink-0">
                    {item.kind === "Prescription" ? (
                      <Pill className="h-4 w-4" />
                    ) : item.kind === "Lab Result" ? (
                      <FlaskConical className="h-4 w-4" />
                    ) : item.kind === "Vital Signs" ? (
                      <Activity className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink dark:text-dark-ink truncate">
                      {item.kind}
                    </p>
                    <p className="text-xs text-ink/50 dark:text-dark-ink/50 truncate">
                      {item.description || item.doctorName}
                    </p>
                  </div>
                  <span className="text-xs text-ink/40 dark:text-dark-ink/40 shrink-0">
                    {formatDate(item.date)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Health Summary & Quick Actions */}
        <div className="space-y-6">
          {/* Health Summary Card */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-primary-light">
                <HeartPulse className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-ink dark:text-dark-ink text-base">
                Health Summary
              </h3>
            </div>
            {patient ? (
              <dl className="space-y-3 text-sm">
                <Row label="Blood Group" value={patient.bloodGroup || "-"} />
                <Row label="Height" value={patient.height || "-"} />
                <Row
                  label="Weight"
                  value={
                    latestVitals?.weight
                      ? `${latestVitals.weight} kg`
                      : patient.weight || "-"
                  }
                />
                <Row
                  label="Allergies"
                  value={(patient.allergies || []).join(", ") || "None"}
                />
                <Row
                  label="Medications"
                  value={(patient.currentMedications || []).join(", ") || "None"}
                />
              </dl>
            ) : (
              <p className="text-sm text-ink/50 dark:text-dark-ink/50">
                Loading health data...
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/patient/profile")}
              className="w-full mt-4 text-xs"
            >
              Update Medical Profile
            </Button>
          </div>

          {/* Quick Actions Card */}
          <div className="card">
            <h3 className="font-semibold text-ink dark:text-dark-ink text-base mb-3">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <Button
                className="w-full justify-start text-xs"
                onClick={() => navigate("/patient/book-appointment")}
              >
                <Plus className="h-4 w-4 mr-2" /> Book Appointment
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-xs border-primary/30 text-primary dark:text-primary-light hover:bg-primary/5"
                onClick={() => navigate("/patient/triage")}
              >
                <Sparkles className="h-4 w-4 mr-2 text-primary dark:text-primary-light" /> AI Symptom Triage
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-xs"
                onClick={() => navigate("/patient/records")}
              >
                <FileText className="h-4 w-4 mr-2" /> View Records & Uploads
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-xs"
                onClick={() => navigate("/patient/prescriptions")}
              >
                <Pill className="h-4 w-4 mr-2" /> View Prescriptions & Refills
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Quick-View Modal */}
      <Modal
        open={!!toView}
        onClose={() => setToView(null)}
        title="Appointment Details"
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {toView &&
                (toView.status === "upcoming" || toView.status === "confirmed") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setToView(null);
                      navigate("/patient/appointments");
                    }}
                    className="text-xs"
                  >
                    Manage / Reschedule
                  </Button>
                )}
            </div>
            <Button size="sm" onClick={() => setToView(null)} className="text-xs">
              Close
            </Button>
          </div>
        }
      >
        {toView && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle flex items-center justify-center text-primary dark:text-primary-light shrink-0">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-ink dark:text-dark-ink text-base">
                    {toView.doctorName?.startsWith("Dr.")
                      ? toView.doctorName
                      : `Dr. ${toView.doctorName || "Doctor"}`}
                  </h4>
                  <p className="text-xs text-ink/60 dark:text-dark-ink/60">
                    {toView.specialty || "Specialist"}
                  </p>
                  <p className="text-[11px] font-mono text-ink/50 dark:text-dark-ink/50 mt-0.5">
                    Confirmation ID: #{toView.id}
                  </p>
                </div>
              </div>
              <StatusBadge status={toView.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle text-xs">
              <div className="space-y-1">
                <span className="text-ink/50 dark:text-dark-ink/50 block">Date</span>
                <span className="font-semibold text-ink dark:text-dark-ink flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" /> {formatDate(toView.date)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-ink/50 dark:text-dark-ink/50 block">Time</span>
                <span className="font-semibold text-ink dark:text-dark-ink flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" /> {toView.time}
                </span>
              </div>
              <div className="col-span-2 space-y-1 pt-2 border-t border-border-subtle dark:border-dark-border-subtle">
                <span className="text-ink/50 dark:text-dark-ink/50 block">
                  Consultation Mode
                </span>
                <span className="font-semibold text-ink dark:text-dark-ink flex items-center gap-1.5">
                  {toView.type?.toLowerCase().includes("video") ? (
                    <>
                      <Video className="h-3.5 w-3.5 text-primary" /> Video Consultation
                    </>
                  ) : (
                    <>
                      <Stethoscope className="h-3.5 w-3.5 text-primary" /> In-Person Clinic
                      Visit
                    </>
                  )}
                </span>
              </div>
              {toView.reason && (
                <div className="col-span-2 space-y-1 pt-2 border-t border-border-subtle dark:border-dark-border-subtle">
                  <span className="text-ink/50 dark:text-dark-ink/50 block">
                    Reason for Visit
                  </span>
                  <p className="text-ink dark:text-dark-ink font-medium">{toView.reason}</p>
                </div>
              )}
            </div>

            {toView.type?.toLowerCase().includes("video") &&
              (toView.status === "upcoming" || toView.status === "confirmed") && (
                <div>
                  <Button
                    onClick={() => {
                      setToView(null);
                      navigate(`/patient/consultation/${toView.id}`);
                    }}
                    className="w-full text-xs"
                  >
                    <Video className="h-3.5 w-3.5 mr-1.5" />
                    Enter Video Room / Waiting Lobby
                  </Button>
                </div>
              )}

            {(toView.status === "upcoming" || toView.status === "confirmed") && (
              <>
                <div className="p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-ink dark:text-dark-ink">
                          WhatsApp Consultation Details
                        </p>
                        <p className="text-[11px] text-ink/60 dark:text-dark-ink/60 mt-0.5">
                          Open appointment confirmation & reminders directly on WhatsApp.
                        </p>
                      </div>
                    </div>
                    <a
                      href={generateWhatsAppLink(
                        user?.phone || toView.patient_phone || "",
                        buildAppointmentWhatsAppText(toView, "reminder_2h")
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition active:scale-95 shrink-0"
                    >
                      <ExternalLink className="h-3 w-3" />
                      WhatsApp
                    </a>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle">
                  <p className="text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-2.5">
                    Add to your calendar:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={generateGoogleCalendarUrl(toView)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-border-subtle dark:border-dark-border-subtle bg-surface dark:bg-dark-surface hover:bg-canvas text-ink dark:text-dark-ink text-xs font-medium transition active:scale-95"
                    >
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span>Google Cal</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        downloadIcsFile(toView);
                        toast.success("iCal invite downloaded!");
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-border-subtle dark:border-dark-border-subtle bg-surface dark:bg-dark-surface hover:bg-canvas text-ink dark:text-dark-ink text-xs font-medium transition active:scale-95"
                    >
                      <Download className="h-3.5 w-3.5 text-ink/70 dark:text-dark-ink/70" />
                      <span>iCal (.ics)</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border-subtle/50 dark:border-dark-border-subtle/50 pb-2 last:border-0 last:pb-0">
      <dt className="text-ink/50 dark:text-dark-ink/50 text-xs">{label}</dt>
      <dd className="font-medium text-ink dark:text-dark-ink text-right text-xs">
        {value}
      </dd>
    </div>
  );
}
