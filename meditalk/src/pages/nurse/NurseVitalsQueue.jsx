import { useState, useEffect } from "react";
import {
  HeartPulse, Activity, Stethoscope, CheckCircle2, Clock, Search, RefreshCw,
  PlusCircle, UserCheck, Eye, DoorOpen, AlertTriangle
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import LoadingState from "../../components/ui/LoadingState";
import EmergencyBanner from "../../components/ui/EmergencyBanner";
import { useToast } from "../../context/ToastContext";
import {
  getWaitingRoomQueue,
  checkInAppointment,
  updateQueueStatus
} from "../../services/appointmentService";
import {
  recordPatientVitals,
  getPatientVitalsHistory
} from "../../services/patientService";
import { formatDate } from "../../constants";

export default function NurseVitalsQueue() {
  const toast = useToast();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  // Vitals Entry Modal state
  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [vitalsForm, setVitalsForm] = useState({
    systolic: "",
    diastolic: "",
    hr: "",
    temp: "",
    spo2: "",
    weight: "",
    bloodSugar: "",
    notes: "",
  });
  const [savingVitals, setSavingVitals] = useState(false);

  // History Modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [vitalsHistory, setVitalsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function loadQueue(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await getWaitingRoomQueue();
      setQueue(res.queue || []);
    } catch (err) {
      toast.error(err.message || "Failed to load triage queue");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadQueue();
    const timer = setInterval(() => loadQueue(true), 15000);
    return () => clearInterval(timer);
  }, []);

  function openVitalsModal(appt) {
    setSelectedAppt(appt);
    const existing = appt.vitals || {};
    let sys = "";
    let dia = "";
    if (existing.bp) {
      const parts = existing.bp.split("/");
      sys = parts[0]?.trim() || "";
      dia = parts[1]?.trim() || "";
    }
    setVitalsForm({
      systolic: sys,
      diastolic: dia,
      hr: existing.hr || "",
      temp: existing.temp || "",
      spo2: existing.spo2 || "",
      weight: existing.weight || "",
      bloodSugar: existing.bloodSugar || "",
      notes: existing.notes || "",
    });
    setVitalsModalOpen(true);
  }

  async function handleSaveVitals(e) {
    e.preventDefault();
    if (!selectedAppt) return;
    setSavingVitals(true);
    try {
      const bp = vitalsForm.systolic && vitalsForm.diastolic
        ? `${vitalsForm.systolic}/${vitalsForm.diastolic}`
        : null;

      await recordPatientVitals(selectedAppt.patientId, {
        ...vitalsForm,
        bp,
        appointmentId: selectedAppt.id,
      });

      toast.success(`Vitals recorded for ${selectedAppt.patientName}. Available to doctor.`);
      setVitalsModalOpen(false);
      await loadQueue(true);
    } catch (err) {
      toast.error(err.message || "Failed to save vitals");
    } finally {
      setSavingVitals(false);
    }
  }

  async function viewHistory(appt) {
    setSelectedAppt(appt);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const history = await getPatientVitalsHistory(appt.patientId);
      setVitalsHistory(history || []);
    } catch (err) {
      toast.error("Could not fetch vitals history");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleCheckIn(id, patientName) {
    try {
      await checkInAppointment(id);
      toast.success(`${patientName} marked as checked in!`);
      await loadQueue(true);
    } catch (err) {
      toast.error(err.message || "Failed to check in");
    }
  }

  const filtered = queue.filter((item) => {
    const term = search.toLowerCase();
    return (
      (item.patientName || "").toLowerCase().includes(term) ||
      (item.id || "").toLowerCase().includes(term) ||
      (item.doctorName || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Clinical Nursing Station & Triage"
        subtitle="Record pre-consultation vitals and triage intake before physician examination."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadQueue(true)}
            loading={refreshing}
          >
            <RefreshCw className="h-4 w-4" /> Refresh Queue
          </Button>
        }
      />

      <EmergencyBanner compact />

      {/* Header Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-5 shadow-apple-card flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-accent/10 dark:bg-accent/20 text-accent flex items-center justify-center shrink-0">
            <HeartPulse className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-ink/50 dark:text-dark-ink/50 font-medium">Triage Waiting Room</p>
            <p className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-0.5">
              {queue.filter((q) => q.checkInStatus === "checked_in").length} Patients Ready
            </p>
          </div>
        </div>

        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-5 shadow-apple-card flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-ink/50 dark:text-dark-ink/50 font-medium">Vitals Documented</p>
            <p className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-0.5">
              {queue.filter((q) => q.vitals && (q.vitals.bp || q.vitals.hr)).length} Completed
            </p>
          </div>
        </div>

        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-5 shadow-apple-card flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-ink/50 dark:text-dark-ink/50 font-medium">Physician Handoff</p>
            <p className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-0.5">
              {queue.filter((q) => q.checkInStatus === "in_room").length} In Exam Room
            </p>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative w-full sm:w-96">
        <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40 dark:text-dark-ink/40" />
        <input
          type="text"
          placeholder="Search arriving patient by name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs rounded-xl bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle pl-10 pr-4 py-2.5 text-ink dark:text-dark-ink placeholder:text-ink/40 focus:outline-none focus:border-accent shadow-sm transition-all"
        />
      </div>

      {/* Queue List */}
      {loading ? (
        <LoadingState message="Loading patients for pre-consultation vitals..." />
      ) : filtered.length === 0 ? (
        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-12 text-center shadow-apple-card">
          <HeartPulse className="h-10 w-10 mx-auto text-ink/30 dark:text-dark-ink/30 mb-2" />
          <p className="text-sm font-semibold text-ink dark:text-dark-ink">No appointments in queue</p>
          <p className="text-xs text-ink/50 dark:text-dark-ink/50 mt-1">Patients arriving at clinic reception will populate here automatically.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const hasVitals = item.vitals && (item.vitals.bp || item.vitals.hr || item.vitals.spo2);
            const isCheckedIn = item.checkInStatus === "checked_in";

            return (
              <div
                key={item.id}
                className={`rounded-2xl p-5 border transition-all shadow-apple-card ${
                  hasVitals
                    ? "border-emerald-500/25 bg-surface dark:bg-dark-surface"
                    : isCheckedIn
                    ? "border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10"
                    : "border-border-subtle dark:border-dark-border-subtle bg-surface dark:bg-dark-surface"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Patient Info */}
                  <div className="flex items-start gap-3.5">
                    <div className="h-11 w-11 rounded-xl bg-accent/10 dark:bg-accent/20 text-accent flex items-center justify-center font-bold text-sm shrink-0">
                      {item.patientName ? item.patientName.charAt(0) : "P"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink dark:text-dark-ink text-sm tracking-tight">{item.patientName}</span>
                        <span className="text-[10px] text-ink/40 dark:text-dark-ink/40 font-mono">ID: {item.patientId}</span>
                        {item.urgency === "emergency" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-sm">
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink/60 dark:text-dark-ink/60 mt-0.5">
                        Attending Doctor: <strong>{item.doctorName}</strong> ({item.specialty || "General Medicine"})
                      </p>
                      <p className="text-xs text-ink/50 dark:text-dark-ink/50 mt-0.5">
                        Time: <strong>{item.time}</strong> · {formatDate(item.date)}
                      </p>
                    </div>
                  </div>

                  {/* Recorded Vitals Summary Badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {hasVitals ? (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-950 dark:text-emerald-200 text-xs space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 text-[11px]">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Pre-Consultation Vitals Recorded</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-[11px] text-emerald-900 dark:text-emerald-200">
                          {item.vitals.bp && <span>BP: <strong>{item.vitals.bp}</strong></span>}
                          {item.vitals.hr && <span>HR: <strong>{item.vitals.hr} bpm</strong></span>}
                          {item.vitals.spo2 && <span>SpO2: <strong>{item.vitals.spo2}%</strong></span>}
                          {item.vitals.temp && <span>Temp: <strong>{item.vitals.temp}°</strong></span>}
                        </div>
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Vitals Not Recorded Yet</span>
                      </div>
                    )}
                  </div>

                  {/* Nurse Clinical Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    {!isCheckedIn && !item.checkInStatus && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleCheckIn(item.id, item.patientName)}
                        className="text-xs"
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Check-in
                      </Button>
                    )}

                    <Button
                      size="sm"
                      onClick={() => openVitalsModal(item)}
                      className="text-xs"
                    >
                      <HeartPulse className="h-3.5 w-3.5" />
                      {hasVitals ? "Update Vitals" : "Record Vitals"}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => viewHistory(item)}
                      className="text-xs"
                    >
                      <Eye className="h-3.5 w-3.5" /> History
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Vitals Modal */}
      <Modal
        open={vitalsModalOpen}
        onClose={() => setVitalsModalOpen(false)}
        title={`Record Pre-Consultation Vitals — ${selectedAppt?.patientName || "Patient"}`}
        size="lg"
      >
        <form onSubmit={handleSaveVitals} className="space-y-4">
          <p className="text-xs text-ink/60 dark:text-dark-ink/60">
            Recorded biometrics will be attached to this appointment and pre-populated into Dr. {selectedAppt?.doctorName}'s consultation chart.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1">Systolic BP (mmHg)</label>
              <input
                type="number"
                placeholder="e.g. 120"
                value={vitalsForm.systolic}
                onChange={(e) => setVitalsForm({ ...vitalsForm, systolic: e.target.value })}
                className="w-full text-xs rounded-xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle p-2.5 text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1">Diastolic BP (mmHg)</label>
              <input
                type="number"
                placeholder="e.g. 80"
                value={vitalsForm.diastolic}
                onChange={(e) => setVitalsForm({ ...vitalsForm, diastolic: e.target.value })}
                className="w-full text-xs rounded-xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle p-2.5 text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1">Heart Rate (bpm)</label>
              <input
                type="number"
                placeholder="e.g. 72"
                value={vitalsForm.hr}
                onChange={(e) => setVitalsForm({ ...vitalsForm, hr: e.target.value })}
                className="w-full text-xs rounded-xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle p-2.5 text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1">Body Temp (°C or °F)</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 98.6"
                value={vitalsForm.temp}
                onChange={(e) => setVitalsForm({ ...vitalsForm, temp: e.target.value })}
                className="w-full text-xs rounded-xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle p-2.5 text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1">Oxygen Saturation (%)</label>
              <input
                type="number"
                placeholder="e.g. 98"
                value={vitalsForm.spo2}
                onChange={(e) => setVitalsForm({ ...vitalsForm, spo2: e.target.value })}
                className="w-full text-xs rounded-xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle p-2.5 text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 70.5"
                value={vitalsForm.weight}
                onChange={(e) => setVitalsForm({ ...vitalsForm, weight: e.target.value })}
                className="w-full text-xs rounded-xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle p-2.5 text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1">Blood Sugar / Glucose (mg/dL)</label>
              <input
                type="number"
                placeholder="e.g. 105 (optional)"
                value={vitalsForm.bloodSugar}
                onChange={(e) => setVitalsForm({ ...vitalsForm, bloodSugar: e.target.value })}
                className="w-full text-xs rounded-xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle p-2.5 text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/70 dark:text-dark-ink/70 mb-1">Nurse Triage Notes</label>
            <textarea
              rows="2"
              placeholder="e.g. Patient resting comfortably, denies acute chest pain, alert and oriented..."
              value={vitalsForm.notes}
              onChange={(e) => setVitalsForm({ ...vitalsForm, notes: e.target.value })}
              className="w-full text-xs rounded-xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle p-2.5 text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border-subtle dark:border-dark-border-subtle">
            <Button variant="outline" size="sm" type="button" onClick={() => setVitalsModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={savingVitals}>
              Save Vitals to Chart
            </Button>
          </div>
        </form>
      </Modal>

      {/* Historical Vitals Modal */}
      <Modal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Vitals History — ${selectedAppt?.patientName || "Patient"}`}
        size="lg"
      >
        {loadingHistory ? (
          <LoadingState message="Fetching patient historical vitals..." />
        ) : vitalsHistory.length === 0 ? (
          <p className="text-sm text-ink/50 dark:text-dark-ink/50 text-center py-6">No previous vitals recordings found for this patient.</p>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto">
            {vitalsHistory.map((v, i) => (
              <div key={i} className="p-3.5 rounded-xl border border-border-subtle dark:border-dark-border-subtle bg-canvas dark:bg-dark-surface-elevated text-xs space-y-1">
                <div className="flex justify-between font-semibold text-ink dark:text-dark-ink">
                  <span>{v.date ? new Date(v.date).toLocaleString() : "Past Visit"}</span>
                  <span className="text-accent">{v.doctorName || "Staff"}</span>
                </div>
                <div className="flex gap-3 text-ink/80 dark:text-dark-ink/80 flex-wrap">
                  {v.bp && <span>BP: <strong>{v.bp}</strong></span>}
                  {v.hr && <span>HR: <strong>{v.hr} bpm</strong></span>}
                  {v.temp && <span>Temp: <strong>{v.temp}°</strong></span>}
                  {v.spo2 && <span>SpO2: <strong>{v.spo2}%</strong></span>}
                  {v.weight && <span>Weight: <strong>{v.weight} kg</strong></span>}
                  {v.bloodSugar && <span>Glucose: <strong>{v.bloodSugar} mg/dL</strong></span>}
                </div>
                {v.notes && <p className="text-[11px] text-ink/60 dark:text-dark-ink/60 italic">Notes: {v.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
