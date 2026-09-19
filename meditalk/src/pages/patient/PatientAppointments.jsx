import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Loader2, CalendarX, Video } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import AppointmentCard from "../../components/cards/AppointmentCard";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import ConfirmationModal from "../../components/ui/ConfirmationModal";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  getAppointments,
  cancelAppointment,
  rescheduleAppointment,
  getAvailableSlots,
} from "../../services/appointmentService";
import { useFetch } from "../../hooks/useFetch";

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export default function PatientAppointments() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const patientId = user?.id;

  const { data: appts, loading, reload } = useFetch(() => getAppointments({ patientId }), [patientId]);
  const [tab, setTab] = useState("upcoming");
  const [toCancel, setToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [toReschedule, setToReschedule] = useState(null);
  const [form, setForm] = useState({ date: "", time: "" });
  const [busy, setBusy] = useState(false);

  // --- Slot state for reschedule modal ---
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  // Fetch available slots when reschedule date changes
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
          // Exclude the current appointment's own slot from "taken" display
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
    <div className="space-y-6">
      <PageHeader
        title="My Appointments"
        subtitle="View and manage your appointments."
        action={<Button onClick={() => navigate("/patient/book-appointment")}><CalendarDays className="h-4 w-4" /> Book</Button>}
      />

      <div className="flex gap-2 border-b border-sage/30">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition " +
              (tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-ink/50 hover:text-ink")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CalendarDays}
            title={`No ${tab} appointments`}
            message="When you book an appointment it will appear here."
            action={tab === "upcoming" ? <Button onClick={() => navigate("/patient/book-appointment")}>Book Appointment</Button> : null}
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((a) => (
            <div key={a.id} className="flex flex-col gap-2">
              <AppointmentCard
                appointment={a}
                onView={() => navigate("/patient/appointments")}
                onReschedule={(appt) => {
                  setToReschedule(appt);
                  setForm({ date: "", time: "" });
                  setSlots([]);
                  setSlotsError("");
                }}
                onCancel={(appt) => { setToCancel(appt); setCancelReason(""); }}
              />
              {a.type?.toLowerCase().includes("video") && a.status !== "cancelled" && a.status !== "completed" && (
                <div className="flex flex-col gap-1.5 w-full">
                  {a.videoStatus === "in_progress" ? (
                    <button
                      onClick={() => navigate(`/patient/consultation/${a.id}`)}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-success text-white text-sm font-semibold shadow-md hover:bg-success/90 transition animate-pulse-slow"
                    >
                      <Video className="h-4 w-4" />
                      Join Video Call (Live)
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/patient/consultation/${a.id}`)}
                      className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition"
                    >
                      <Video className="h-3.5 w-3.5" />
                      Enter Video Room / Waiting Lobby
                    </button>
                  )}
                  {a.videoStatus === "waiting" && (
                    <div className="flex items-center justify-center gap-2 w-full py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                      Doctor is preparing the call…
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Cancel Modal with Reason ─────────────────────── */}
      <Modal
        open={!!toCancel}
        onClose={() => { setToCancel(null); setCancelReason(""); }}
        title="Cancel Appointment"
        footer={
          <>
            <Button variant="outline" onClick={() => { setToCancel(null); setCancelReason(""); }} disabled={busy}>
              Keep It
            </Button>
            <Button
              variant="danger"
              onClick={confirmCancel}
              loading={busy}
              disabled={!cancelReason.trim()}
            >
              Yes, Cancel
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink/70">
            You are about to cancel your appointment with{" "}
            <span className="font-semibold text-ink">{toCancel?.doctorName}</span> on{" "}
            <span className="font-semibold text-ink">{toCancel?.date}</span> at{" "}
            <span className="font-semibold text-ink">{toCancel?.time}</span>.
          </p>
          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">
              Reason for cancellation <span className="text-danger">*</span>
            </label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Schedule conflict, feeling better, etc."
              className="w-full border border-sage/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* ── Reschedule Modal with Dynamic Slots ─────────── */}
      <Modal
        open={!!toReschedule}
        onClose={() => { setToReschedule(null); setForm({ date: "", time: "" }); }}
        title="Reschedule Appointment"
        footer={
          <>
            <Button variant="outline" onClick={() => setToReschedule(null)} disabled={busy}>Cancel</Button>
            <Button onClick={confirmReschedule} loading={busy} disabled={!form.date || !form.time}>
              Confirm Reschedule
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink/60">
            Current: <span className="font-medium text-ink">{toReschedule?.date} at {toReschedule?.time}</span>
          </p>

          <Input
            label="New date"
            type="date"
            value={form.date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value, time: "" }))}
          />

          {/* Dynamic slot grid */}
          {form.date && (
            <div>
              <label className="block text-xs font-medium text-ink/60 mb-2">New time</label>
              {slotsLoading ? (
                <div className="flex items-center gap-2 text-sm text-ink/50 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Loading available slots…
                </div>
              ) : slotsError ? (
                <div className="flex items-center gap-2 text-sm text-danger/70 py-2">
                  <CalendarX className="h-4 w-4" />
                  {slotsError}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-ink/50 py-2">No slots available on this day.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      disabled={!s.available}
                      onClick={() => s.available && setForm((f) => ({ ...f, time: s.time }))}
                      className={
                        "py-2 rounded-lg border text-xs font-medium transition " +
                        (form.time === s.time
                          ? "border-primary bg-primary/10 text-primary"
                          : s.available
                          ? "border-sage/40 hover:bg-sage/20 text-ink"
                          : "border-sage/20 bg-sage/5 text-ink/25 cursor-not-allowed line-through")
                      }
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
