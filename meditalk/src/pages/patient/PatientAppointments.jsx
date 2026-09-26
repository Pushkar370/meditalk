import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Loader2, CalendarX, Video, AlertTriangle, Download, CheckCircle2 } from "lucide-react";
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
  checkInAppointment,
} from "../../services/appointmentService";
import { getFollowUpSuggestions } from "../../services/prescriptionService";
import FollowUpSuggestionsCard from "../../components/appointments/FollowUpSuggestionsCard";
import { useFetch } from "../../hooks/useFetch";

// Generate and download an ICS calendar file for an appointment
function downloadICS(appt) {
  const dateStr = appt.date?.replace(/-/g, '');
  const [h, m] = (appt.time || '09:00').replace(/\s*(AM|PM)/i, '').split(':').map(Number);
  const isPM = /PM/i.test(appt.time || '');
  const hour24 = isPM && h !== 12 ? h + 12 : (!isPM && h === 12 ? 0 : h);
  const start = `${dateStr}T${String(hour24).padStart(2,'0')}${String(m||0).padStart(2,'0')}00`;
  const endHour = (hour24 + 1) % 24;
  const end = `${dateStr}T${String(endHour).padStart(2,'0')}${String(m||0).padStart(2,'0')}00`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MediTalk//EN',
    'BEGIN:VEVENT',
    `UID:${appt.id}@meditalk`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:Appointment with Dr. ${appt.doctorName}`,
    `DESCRIPTION:${appt.specialty || ''} ${appt.type || ''} consultation. Reason: ${appt.reason || ''}`,
    `STATUS:CONFIRMED`,
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `meditalk-appointment-${appt.id}.ics`;
  a.click();
}

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

  const { data: appts, loading, reload } = useFetch(() => getAppointments({ patientId }), [patientId]);
  const { data: followUpRes, reload: reloadFollowUps } = useFetch(
    () => (patientId ? getFollowUpSuggestions(patientId) : Promise.resolve({ suggestions: [] })),
    [patientId]
  );
  const [tab, setTab] = useState("upcoming");
  const [toCancel, setToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [toReschedule, setToReschedule] = useState(null);
  const [form, setForm] = useState({ date: "", time: "" });
  const [busy, setBusy] = useState(false);

  async function handleCheckIn(appt) {
    try {
      await checkInAppointment(appt.id);
      toast.success("Checked in! You are now in the waiting room queue.");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to check in.");
    }
  }

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
                onCheckIn={handleCheckIn}
                onReschedule={(appt) => {
                  setToReschedule(appt);
                  setForm({ date: "", time: "" });
                  setSlots([]);
                  setSlotsError("");
                }}
                onCancel={(appt) => { setToCancel(appt); setCancelReason(""); }}
              />
              {a.type?.toLowerCase().includes("video") && a.status !== "cancelled" && a.status !== "completed" && a.status !== "no_show" && (
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
              {/* CW-1: Add to Calendar for upcoming/confirmed appointments */}
              {(a.status === "upcoming" || a.status === "confirmed") && (
                <button
                  onClick={() => downloadICS(a)}
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg border border-sage/30 bg-sage/5 text-ink/50 text-xs font-medium hover:bg-sage/15 hover:text-ink/80 transition mt-1"
                >
                  <Download className="h-3 w-3" /> Add to Calendar (.ics)
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Cancel Modal with Prominent Warning (PX-3) ─── */}
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
              Yes, Cancel Appointment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Warning Banner */}
          <div className="flex gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Are you sure you want to cancel?</p>
              <p className="text-xs text-amber-700 mt-0.5">This action cannot be undone. Your appointment slot may be taken by another patient.</p>
            </div>
          </div>

          <div className="p-3 bg-surface rounded-xl border border-sage/20 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-ink/50">Doctor</span><span className="font-medium">Dr. {toCancel?.doctorName}</span></div>
            <div className="flex justify-between"><span className="text-ink/50">Date</span><span className="font-medium">{toCancel?.date}</span></div>
            <div className="flex justify-between"><span className="text-ink/50">Time</span><span className="font-medium">{toCancel?.time}</span></div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink/60 mb-1">
              Reason for cancellation <span className="text-danger">*</span>
            </label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Schedule conflict, feeling better, transport issues…"
              className="w-full border border-sage/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <p className="text-xs text-ink/40">
            💡 Instead of cancelling, you can reschedule your appointment to a more convenient time.
          </p>
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
