import { useNavigate } from "react-router-dom";
import {
  CalendarClock, CalendarDays, Pill, FileText, Plus,
  HeartPulse, Activity, FlaskConical, Sparkles, ArrowRight,
  Gauge, Thermometer, Droplets, ShieldCheck, Check,
} from "lucide-react";

import StatCard from "../../components/ui/StatCard";
import AppointmentCard from "../../components/cards/AppointmentCard";
import Button from "../../components/ui/Button";
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
import { useToast } from "../../context/ToastContext";
import { useState } from "react";


export default function PatientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const patientId = user?.id;
  const [takingDose, setTakingDose] = useState(null); // scheduleId-slot being logged


  const { data: patient, loading: patientLoading } = useFetch(() => getPatientById(patientId), [patientId]);
  const { data: appts, loading: apptsLoading, reload: reloadAppts } = useFetch(() => getAppointments({ patientId }), [patientId]);
  const { data: records } = useFetch(() => getMedicalRecords(patientId), [patientId]);
  const { data: rx } = useFetch(() => getPrescriptions({ patientId }), [patientId]);
  const { data: vitalsHistory } = useFetch(() => (patientId ? getPatientVitalsHistory(patientId) : Promise.resolve([])), [patientId]);
  const { data: adherenceSchedules, reload: reloadAdherence } = useFetch(() => (patientId ? getAdherenceSchedules(patientId) : Promise.resolve([])), [patientId]);
  const { data: followUpRes, reload: reloadFollowUps } = useFetch(
    () => (patientId ? getFollowUpSuggestions(patientId) : Promise.resolve({ suggestions: [] })),
    [patientId]
  );


  if (patientLoading || apptsLoading) return <LoadingState />;

  const upcoming = (appts || []).filter((a) => a.status === "upcoming" || a.status === "confirmed");
  const nextAppt = upcoming[0];

  const recentActivity = [
    ...(records || []).map((r) => ({ ...r, kind: r.type })),
    ...(rx || []).map((p) => ({ ...p, kind: "Prescription", date: p.date })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  const displayName = patient?.name?.split(" ")[0] || user?.name?.split(" ")[0] || "there";
  const latestVitals = (vitalsHistory && vitalsHistory.length > 0) ? vitalsHistory[vitalsHistory.length - 1] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">{greeting()}, {displayName}</h1>
        <p className="text-sm text-ink/50">Here's your personal health overview & vitals intelligence.</p>
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


      {/* AI Clinical Triage Launcher Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-sage/20 to-accent/10 p-5 border border-primary/20 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center text-white shrink-0 shadow-md shadow-primary/25">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-ink text-base">MediTalk AI Symptom Triage</h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-primary/20 text-primary">Gemini 1.5 Flash</span>
              </div>
              <p className="text-xs sm:text-sm text-ink/70 mt-1 max-w-2xl">
                Unsure about symptoms or which doctor to see? Get an instant clinical urgency assessment, home care guidance, and automated specialist matching.
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate("/patient/triage")}
            className="shrink-0 shadow-md shadow-primary/20"
          >
            <Sparkles className="h-4 w-4" /> Check Symptoms Now
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CalendarClock} label="Upcoming Appointment" value={upcoming.length} tone="accent" />
        <StatCard icon={CalendarDays} label="Total Appointments" value={(appts || []).length} tone="primary" />
        <StatCard icon={Pill} label="Active Prescriptions" value={(rx || []).filter((p) => p.status === "active").length} tone="success" />
        <StatCard icon={FileText} label="Health Records" value={(records || []).length} tone="sage" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upcoming appointment */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-ink">Upcoming Appointment</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate("/patient/appointments")}>
                View all
              </Button>
            </div>
            {nextAppt ? (
              <AppointmentCard
                appointment={nextAppt}
                noCard={true}
                onView={() => navigate("/patient/appointments")}
                onReschedule={() => navigate("/patient/appointments")}
                onCancel={() => navigate("/patient/appointments")}
              />
            ) : (
              <div className="text-center py-8 text-ink/50">
                <CalendarClock className="h-8 w-8 mx-auto text-ink/30" />
                <p className="mt-2 text-sm">No upcoming appointments.</p>
                <Button className="mt-3" size="sm" onClick={() => navigate("/patient/book-appointment")}>
                  <Plus className="h-4 w-4" /> Book Appointment
                </Button>
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="card mt-6">
            <h3 className="font-semibold text-ink mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {recentActivity.length === 0 && <p className="text-sm text-ink/50">No recent activity.</p>}
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-sage/10 border border-sage/20 hover:bg-sage/15 transition">
                  <div className="h-9 w-9 rounded-full bg-white/80 border border-sage/30 flex items-center justify-center text-primary shadow-sm">
                    {item.kind === "Prescription" ? <Pill className="h-4 w-4" /> :
                      item.kind === "Lab Result" ? <FlaskConical className="h-4 w-4" /> :
                      item.kind === "Vital Signs" ? <Activity className="h-4 w-4" /> :
                      <FileText className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{item.kind}</p>
                    <p className="text-xs text-ink/50 truncate">{item.description || item.doctorName}</p>
                  </div>
                  <span className="text-xs text-ink/40">{formatDate(item.date)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Medication Adherence Widget */}
          {(adherenceSchedules || []).length > 0 && (
            <div className="card mt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-ink">Today's Medication Routine</h3>
                </div>
                {/* Streak badge */}
                {(() => {
                  const maxStreak = Math.max(...(adherenceSchedules || []).map(s => s.streakCount || 0), 0);
                  return maxStreak >= 2 ? (
                    <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-accent/20 text-ink">
                      🔥 {maxStreak}-Day Streak!
                    </span>
                  ) : null;
                })()}
              </div>

              {['morning', 'afternoon', 'evening', 'night'].map(slot => {
                const slotMeds = (adherenceSchedules || []).filter(s => s.timingSlots?.includes(slot));
                if (slotMeds.length === 0) return null;
                const today = new Date().toISOString().split('T')[0];
                const slotLabel = { morning: '🌅 Morning', afternoon: '☀️ Afternoon', evening: '🌆 Evening', night: '🌙 Night' }[slot];
                return (
                  <div key={slot} className="mb-3">
                    <p className="text-xs font-semibold text-ink/50 mb-2">{slotLabel}</p>
                    <div className="space-y-2">
                      {slotMeds.map(sched => {
                        const logKey = `${today}-${slot}`;
                        const taken = !!sched.takenLogs?.[logKey];
                        const isLogging = takingDose === `${sched.id}-${slot}`;
                        return (
                          <div key={`${sched.id}-${slot}`} className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${taken ? 'bg-success/5 border-success/30' : 'bg-white border-sage/30 hover:border-primary/30'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${taken ? 'bg-success/15' : 'bg-primary/10'}`}>
                                <Pill className={`h-4 w-4 ${taken ? 'text-success' : 'text-primary'}`} />
                              </div>
                              <div>
                                <p className={`text-sm font-medium ${taken ? 'text-ink/60 line-through' : 'text-ink'}`}>{sched.medicineName}</p>
                                <p className="text-xs text-ink/40">{sched.dosage} · {sched.frequency}</p>
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
                                  if (sched.streakCount >= 1) toast.success(`Dose logged! 🔥 ${sched.streakCount + 1}-day streak!`);
                                  else toast.success("Dose logged!");
                                } catch (err) {
                                  toast.error("Failed to log dose.");
                                } finally {
                                  setTakingDose(null);
                                }
                              }}
                              disabled={taken || !!takingDose}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${taken ? 'bg-success/15 text-success cursor-default' : 'bg-primary text-white hover:bg-primary/90 active:scale-95'} ${isLogging ? 'opacity-60' : ''}`}
                            >
                              {taken ? (<><ShieldCheck className="h-3.5 w-3.5" /> Taken</>) :
                               isLogging ? 'Logging...' :
                               (<><Check className="h-3.5 w-3.5" /> Take Dose</>)}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => navigate('/patient/prescriptions')}
                className="w-full mt-2 text-xs text-primary hover:underline text-center py-1"
              >
                Manage Medication Schedules →
              </button>
            </div>
          )}

          <div className="card mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-ink">Biometric Vitals Intelligence</h3>
              </div>
              <span className="text-xs text-ink/50">
                {latestVitals ? `Last measured: ${formatDate(latestVitals.date)}` : "Clinical Telemetry"}
              </span>
            </div>

            {/* Vitals Telemetry Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-3.5 rounded-xl bg-white border border-sage/30 shadow-sm hover:border-primary/40 transition">
                <div className="flex items-center justify-between text-xs text-ink/50 mb-1">
                  <span>Blood Pressure</span>
                  <Gauge className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-lg font-bold text-ink">
                  {latestVitals?.bp || "120/80"} <span className="text-xs font-normal text-ink/40">mmHg</span>
                </p>
                <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success">
                  {latestVitals?.systolic ? (latestVitals.systolic < 125 ? "Optimal" : "Elevated") : "Target"}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-sage/30 shadow-sm hover:border-primary/40 transition">
                <div className="flex items-center justify-between text-xs text-ink/50 mb-1">
                  <span>Heart Rate</span>
                  <Activity className="h-3.5 w-3.5 text-rose-500" />
                </div>
                <p className="text-lg font-bold text-ink">
                  {latestVitals?.hr || "72"} <span className="text-xs font-normal text-ink/40">bpm</span>
                </p>
                <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success">
                  Normal Range
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-sage/30 shadow-sm hover:border-primary/40 transition">
                <div className="flex items-center justify-between text-xs text-ink/50 mb-1">
                  <span>SpO₂ Oxygen</span>
                  <Droplets className="h-3.5 w-3.5 text-sky-500" />
                </div>
                <p className="text-lg font-bold text-ink">
                  {latestVitals?.spo2 || "98"} <span className="text-xs font-normal text-ink/40">%</span>
                </p>
                <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-600">
                  Optimal
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-sage/30 shadow-sm hover:border-primary/40 transition">
                <div className="flex items-center justify-between text-xs text-ink/50 mb-1">
                  <span>Temperature</span>
                  <Thermometer className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <p className="text-lg font-bold text-ink">
                  {latestVitals?.temp || "36.8"} <span className="text-xs font-normal text-ink/40">°C</span>
                </p>
                <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success">
                  Afebrile
                </span>
              </div>
            </div>

            {/* Historical Consultation Telemetry Log */}
            {vitalsHistory && vitalsHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-sage/30 text-ink/50 font-medium">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Consultant</th>
                      <th className="pb-2">BP</th>
                      <th className="pb-2">Heart Rate</th>
                      <th className="pb-2">SpO₂</th>
                      <th className="pb-2">Diagnosis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sage/20 text-ink">
                    {vitalsHistory.slice(-3).reverse().map((vh) => (
                      <tr key={vh.consultationId} className="hover:bg-sage/5">
                        <td className="py-2 text-ink/70">{formatDate(vh.date)}</td>
                        <td className="py-2 font-medium">{vh.doctorName}</td>
                        <td className="py-2 font-mono">{vh.bp || "—"}</td>
                        <td className="py-2">{vh.hr ? `${vh.hr} bpm` : "—"}</td>
                        <td className="py-2">{vh.spo2 ? `${vh.spo2}%` : "—"}</td>
                        <td className="py-2 text-ink/60 truncate max-w-[120px]">{vh.diagnosis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-ink/70 flex items-center justify-between">
                <span>Clinical consultation vitals will log historical trends here automatically.</span>
                <span className="font-semibold text-primary">Live Tracking Enabled</span>
              </div>
            )}
          </div>
        </div>

        {/* Health summary */}
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <HeartPulse className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-ink">Health Summary</h3>
            </div>
            {patient ? (
              <dl className="space-y-3 text-sm">
                <Row label="Blood Group" value={patient.bloodGroup || "-"} />
                <Row label="Height" value={patient.height || "-"} />
                <Row label="Weight" value={latestVitals?.weight ? `${latestVitals.weight} kg` : (patient.weight || "-")} />
                <Row label="Allergies" value={(patient.allergies || []).join(", ") || "None"} />
                <Row label="Medications" value={(patient.currentMedications || []).join(", ") || "None"} />
              </dl>
            ) : (
              <p className="text-sm text-ink/50">Loading health data...</p>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold text-ink mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Button className="w-full justify-start" onClick={() => navigate("/patient/book-appointment")}>
                <Plus className="h-4 w-4" /> Book Appointment
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-primary border-primary/30 hover:bg-primary/5"
                onClick={() => navigate("/patient/triage")}
              >
                <Sparkles className="h-4 w-4 text-primary" /> AI Symptom Triage
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/patient/records")}>
                <FileText className="h-4 w-4" /> View Records
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/patient/prescriptions")}>
                <Pill className="h-4 w-4" /> View Prescriptions
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink/50">{label}</dt>
      <dd className="font-medium text-ink text-right">{value}</dd>
    </div>
  );
}
