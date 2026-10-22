import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Loader2,
  CalendarX,
  Video,
  AlertTriangle,
  Download,
  CheckCircle2,
  Calendar,
  MessageSquare,
  ExternalLink,
  Clock,
  Stethoscope,
  ClipboardList,
  Printer,
  FileText,
  Pill,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import AppointmentCard from "../../components/cards/AppointmentCard";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import StatusBadge from "../../components/ui/StatusBadge";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  getAppointments,
  cancelAppointment,
  rescheduleAppointment,
  getAvailableSlots,
  checkInAppointment,
} from "../../services/appointmentService";
import {
  getFollowUpSuggestions,
  getConsultations,
} from "../../services/prescriptionService";
import FollowUpSuggestionsCard from "../../components/appointments/FollowUpSuggestionsCard";
import { useFetch } from "../../hooks/useFetch";
import { formatDate } from "../../constants";
import {
  generateGoogleCalendarUrl,
  downloadIcsFile,
  generateWhatsAppLink,
  buildAppointmentWhatsAppText,
} from "../../utils/calendarSync";

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "no_show", label: "No-Show" },
];

export default function PatientAppointments() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const patientId = user?.id;

  const { data: appts, loading, reload } = useFetch(
    () => getAppointments({ patientId }),
    [patientId]
  );
  const { data: followUpRes, reload: reloadFollowUps } = useFetch(
    () =>
      patientId
        ? getFollowUpSuggestions(patientId)
        : Promise.resolve({ suggestions: [] }),
    [patientId]
  );
  const [tab, setTab] = useState("upcoming");
  const [toView, setToView] = useState(null);
  const [toCancel, setToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [toReschedule, setToReschedule] = useState(null);
  const [form, setForm] = useState({ date: "", time: "" });
  const [busy, setBusy] = useState(false);
  const [avsData, setAvsData] = useState(null);
  const [avsLoading, setAvsLoading] = useState(false);

  useEffect(() => {
    if (toView?.status === "completed") {
      setAvsLoading(true);
      getConsultations({ appointmentId: toView.id, patientId: user?.id })
        .then((res) => {
          if (res && res.length > 0) {
            setAvsData(res[0]);
          } else {
            getConsultations({
              patientId: user?.id,
              doctorId: toView.doctor_id || toView.doctorId,
            })
              .then((fallback) => setAvsData(fallback?.[0] || null))
              .catch(() => setAvsData(null));
          }
        })
        .catch(() => setAvsData(null))
        .finally(() => setAvsLoading(false));
    } else {
      setAvsData(null);
    }
  }, [toView, user?.id]);

  async function handleCheckIn(appt) {
    try {
      await checkInAppointment(appt.id);
      toast.success("Checked in! You are now in the clinic waiting queue.");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to check in.");
    }
  }

  // --- Slot state for reschedule modal ---
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  useEffect(() => {
    if (!toReschedule?.doctorId || !form.date) {
      setSlots([]);
      setSlotsError("");
      return;
    }
    setSlotsLoading(true);
    setSlotsError("");
    setSlots([]);
    getAvailableSlots(toReschedule.doctorId, form.date)
      .then((res) => {
        if (res?.slots?.length === 0 && res?.reason) {
          setSlotsError(res.reason);
        } else {
          setSlots(res?.slots || []);
        }
      })
      .catch(() => setSlotsError("Could not load slots."))
      .finally(() => setSlotsLoading(false));
  }, [toReschedule?.doctorId, form.date]);

  if (loading) return <LoadingState />;

  const list = (appts || []).filter((a) => {
    if (tab === "upcoming") return a.status === "upcoming" || a.status === "confirmed";
    return a.status === tab;
  });

  async function confirmCancel() {
    if (!cancelReason.trim()) {
      toast.error("Please provide a reason for cancellation.");
      return;
    }
    setBusy(true);
    try {
      await cancelAppointment(toCancel.id, cancelReason);
      setToCancel(null);
      setCancelReason("");
      reload();
      toast.success("Appointment cancelled.");
    } catch (err) {
      toast.error(err.message || "Failed to cancel appointment.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmReschedule() {
    if (!form.date || !form.time) {
      toast.error("Please choose a new date and time.");
      return;
    }
    setBusy(true);
    try {
      await rescheduleAppointment(toReschedule.id, form);
      setToReschedule(null);
      setForm({ date: "", time: "" });
      reload();
      toast.success("Appointment rescheduled.");
    } catch (err) {
      toast.error(err.message || "Failed to reschedule appointment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="My Appointments"
        subtitle="Manage your upcoming visits, past records, and telehealth consults."
        action={
          <Button
            onClick={() => navigate("/patient/book-appointment")}
            className="text-xs"
          >
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Book Appointment
          </Button>
        }
      />

      {/* CW-3: Follow-Up Suggestions Banner */}
      {tab === "upcoming" && (
        <FollowUpSuggestionsCard
          suggestions={followUpRes?.suggestions || []}
          onConfirmed={() => {
            reloadFollowUps();
            reload();
          }}
          onDismissed={() => reloadFollowUps()}
        />
      )}

      {/* Apple Segmented Tabs */}
      <div className="flex p-1 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/60 border border-border-subtle dark:border-dark-border-subtle w-fit max-w-full overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 shrink-0 ${
                active
                  ? "bg-surface dark:bg-dark-surface text-ink dark:text-dark-ink shadow-sm"
                  : "text-ink/50 dark:text-dark-ink/50 hover:text-ink dark:hover:text-dark-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <div className="card py-12">
          <EmptyState
            icon={CalendarDays}
            title={`No ${tab} appointments`}
            message="When an appointment is scheduled or completed, it will appear here."
            action={
              tab === "upcoming" ? (
                <Button
                  size="sm"
                  onClick={() => navigate("/patient/book-appointment")}
                  className="text-xs"
                >
                  Book Appointment
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.map((a) => (
            <div key={a.id} className="flex flex-col gap-2">
              <AppointmentCard
                appointment={a}
                onView={(appt) => setToView(appt)}
                onCheckIn={handleCheckIn}
                onReschedule={(appt) => {
                  setToReschedule(appt);
                  setForm({ date: "", time: "" });
                  setSlots([]);
                  setSlotsError("");
                }}
                onCancel={(appt) => {
                  setToCancel(appt);
                  setCancelReason("");
                }}
              />
              {a.type?.toLowerCase().includes("video") &&
                a.status !== "cancelled" &&
                a.status !== "completed" &&
                a.status !== "no_show" && (
                  <div className="flex flex-col gap-1.5 w-full">
                    {a.videoStatus === "in_progress" ? (
                      <button
                        onClick={() => navigate(`/patient/consultation/${a.id}`)}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-semibold shadow-sm hover:bg-emerald-700 transition active:scale-[0.98]"
                      >
                        <Video className="h-4 w-4" />
                        Join Video Call (Live)
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate(`/patient/consultation/${a.id}`)}
                        className="flex items-center justify-center gap-2 w-full py-2 rounded-2xl bg-primary/10 dark:bg-primary/20 border border-primary/20 text-primary dark:text-primary-light text-xs font-semibold hover:bg-primary/15 transition active:scale-[0.98]"
                      >
                        <Video className="h-3.5 w-3.5" />
                        Enter Video Room / Waiting Lobby
                      </button>
                    )}
                    {a.videoStatus === "waiting" && (
                      <div className="flex items-center justify-center gap-2 w-full py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] font-medium">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        Doctor is preparing the consultation…
                      </div>
                    )}
                  </div>
                )}
            </div>
          ))}
        </div>
      )}

      {/* ── Cancel Modal ─── */}
      <Modal
        open={!!toCancel}
        onClose={() => {
          setToCancel(null);
          setCancelReason("");
        }}
        title="Cancel Appointment"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setToCancel(null);
                setCancelReason("");
              }}
              disabled={busy}
              className="text-xs"
            >
              Keep It
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmCancel}
              loading={busy}
              disabled={!cancelReason.trim()}
              className="text-xs"
            >
              Yes, Cancel Appointment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-700 dark:text-rose-400">
                Are you sure you want to cancel?
              </p>
              <p className="text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                This action cannot be undone. Your reserved time slot will be released back to the clinical schedule.
              </p>
            </div>
          </div>

          <div className="p-4 bg-canvas dark:bg-dark-surface-elevated/40 rounded-2xl border border-border-subtle dark:border-dark-border-subtle text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-ink/50 dark:text-dark-ink/50">Doctor</span>
              <span className="font-medium text-ink dark:text-dark-ink">
                Dr. {toCancel?.doctorName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/50 dark:text-dark-ink/50">Date</span>
              <span className="font-medium text-ink dark:text-dark-ink">
                {toCancel?.date}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink/50 dark:text-dark-ink/50">Time</span>
              <span className="font-medium text-ink dark:text-dark-ink">
                {toCancel?.time}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink/70 dark:text-dark-ink/70 mb-1.5">
              Reason for cancellation <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g., Conflict with work schedule, symptom resolved"
              className="w-full bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-3.5 text-xs text-ink dark:text-dark-ink placeholder:text-ink/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* ── Reschedule Modal ─── */}
      <Modal
        open={!!toReschedule}
        onClose={() => {
          setToReschedule(null);
          setForm({ date: "", time: "" });
        }}
        title="Reschedule Appointment"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setToReschedule(null);
                setForm({ date: "", time: "" });
              }}
              disabled={busy}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmReschedule}
              loading={busy}
              disabled={!form.date || !form.time}
              className="text-xs"
            >
              Confirm Reschedule
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-canvas dark:bg-dark-surface-elevated/40 rounded-2xl border border-border-subtle dark:border-dark-border-subtle text-xs space-y-1">
            <span className="text-ink/50 dark:text-dark-ink/50">Current:</span>
            <p className="font-semibold text-ink dark:text-dark-ink">
              Dr. {toReschedule?.doctorName} · {toReschedule?.date} at {toReschedule?.time}
            </p>
          </div>

          <Input
            type="date"
            label="Select new date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value, time: "" }))}
            min={new Date().toISOString().slice(0, 10)}
          />

          {form.date && (
            <div>
              <label className="block text-xs font-semibold text-ink/70 dark:text-dark-ink/70 mb-2">
                Available slots for {formatDate(form.date)}
              </label>
              {slotsLoading ? (
                <div className="flex items-center gap-2 text-xs text-ink/50 py-4 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading slots…
                </div>
              ) : slotsError ? (
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 text-xs text-center">
                  {slotsError}
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-4 text-xs text-ink/40">
                  No open slots on this date.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((s) => {
                    const isSelected = form.time === s.time;
                    return (
                      <button
                        key={s.time}
                        type="button"
                        disabled={!s.available}
                        onClick={() => s.available && setForm((f) => ({ ...f, time: s.time }))}
                        className={`py-2 px-2.5 rounded-xl text-xs font-medium border transition-all ${
                          isSelected
                            ? "bg-primary text-white border-primary shadow-sm"
                            : s.available
                            ? "bg-surface dark:bg-dark-surface border-border-subtle dark:border-dark-border-subtle hover:border-primary/40 text-ink dark:text-dark-ink"
                            : "opacity-40 cursor-not-allowed line-through"
                        }`}
                      >
                        {s.time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ── View Details Modal ─── */}
      <Modal
        open={!!toView}
        onClose={() => setToView(null)}
        title="Appointment Details"
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {toView?.status === "completed" && avsData && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.print()}
                  className="text-xs"
                >
                  <Printer className="h-3.5 w-3.5 mr-1" /> Print Summary
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
                    Dr. {toView.doctorName}
                  </h4>
                  <p className="text-xs text-ink/60 dark:text-dark-ink/60">
                    {toView.specialty || "Specialist"}
                  </p>
                  <p className="text-[11px] font-mono text-ink/50 dark:text-dark-ink/50 mt-0.5">
                    Confirmation #{toView.id}
                  </p>
                </div>
              </div>
              <StatusBadge status={toView.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle text-xs">
              <div>
                <span className="text-ink/50 dark:text-dark-ink/50 block">Date</span>
                <span className="font-semibold text-ink dark:text-dark-ink flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" /> {formatDate(toView.date)}
                </span>
              </div>
              <div>
                <span className="text-ink/50 dark:text-dark-ink/50 block">Time</span>
                <span className="font-semibold text-ink dark:text-dark-ink flex items-center gap-1.5 mt-0.5">
                  <Clock className="h-3.5 w-3.5 text-primary" /> {toView.time}
                </span>
              </div>
              <div className="col-span-2 pt-2 border-t border-border-subtle dark:border-dark-border-subtle">
                <span className="text-ink/50 dark:text-dark-ink/50 block">Consultation Mode</span>
                <span className="font-semibold text-ink dark:text-dark-ink mt-0.5 block">
                  {toView.type?.toLowerCase().includes("video")
                    ? "🎥 Video Call"
                    : "🏥 In-Person Clinic"}
                </span>
              </div>
              {toView.reason && (
                <div className="col-span-2 pt-2 border-t border-border-subtle dark:border-dark-border-subtle">
                  <span className="text-ink/50 dark:text-dark-ink/50 block">Reason</span>
                  <p className="text-ink dark:text-dark-ink font-medium mt-0.5">
                    {toView.reason}
                  </p>
                </div>
              )}
            </div>

            {/* After-Visit Summary (AVS) if completed */}
            {toView.status === "completed" && (
              <div className="p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle space-y-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <h5 className="font-semibold text-xs text-ink dark:text-dark-ink">
                    After-Visit Summary (AVS)
                  </h5>
                </div>
                {avsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-ink/50 py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading clinical notes…
                  </div>
                ) : avsData ? (
                  <div className="space-y-2 text-xs">
                    {avsData.diagnosis && (
                      <div>
                        <span className="text-ink/50 block">Diagnosis:</span>
                        <p className="font-semibold text-ink dark:text-dark-ink">
                          {avsData.diagnosis}
                        </p>
                      </div>
                    )}
                    {avsData.treatment_plan && (
                      <div>
                        <span className="text-ink/50 block">Treatment Plan:</span>
                        <p className="text-ink/80 dark:text-dark-ink/80">
                          {avsData.treatment_plan}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-ink/50">
                    Clinical documentation completed by doctor.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
