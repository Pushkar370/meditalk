import { useState } from "react";
import { CalendarDays, Eye, Calendar, XCircle, AlertTriangle, CheckCircle2, Clock, RotateCcw } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useToast } from "../../context/ToastContext";
import { useFetch } from "../../hooks/useFetch";
import { getAppointments } from "../../services/appointmentService";
import { getDoctors } from "../../services/doctorService";
import { cancelAppointmentAdmin, rescheduleAppointmentAdmin } from "../../services/adminService";
import { SPECIALTIES, APPOINTMENT_STATUS_LABELS, APPOINTMENT_TYPES, formatDate } from "../../constants";

export default function AdminAppointments() {
  const toast = useToast();
  const { data: appointments, loading, reload } = useFetch(() => getAppointments());
  const { data: doctors } = useFetch(() => getDoctors());
  const [filter, setFilter] = useState({ date: "", doctor: "", specialty: "", status: "", type: "" });
  const [view, setView] = useState(null);

  // Management modals state
  const [cancellingAppt, setCancellingAppt] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [reschedulingAppt, setReschedulingAppt] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({ date: "", time: "", reason: "" });
  const [processing, setProcessing] = useState(false);

  if (loading) return <LoadingState />;

  const allAppts = appointments || [];
  const todayStr = new Date().toISOString().slice(0, 10);

  // Compute stat counts
  const totalCount = allAppts.length;
  const todayCount = allAppts.filter((a) => a.date === todayStr).length;
  const upcomingCount = allAppts.filter((a) => a.status === "upcoming" || a.status === "confirmed").length;
  const completedCount = allAppts.filter((a) => a.status === "completed").length;
  const cancelledCount = allAppts.filter((a) => a.status === "cancelled").length;

  const rows = allAppts.filter((a) =>
    (!filter.date || a.date === filter.date) &&
    (!filter.doctor || a.doctorId === filter.doctor) &&
    (!filter.specialty || a.specialty === filter.specialty) &&
    (!filter.status || a.status === filter.status) &&
    (!filter.type || a.type === filter.type)
  );

  async function handleConfirmCancel() {
    if (!cancellingAppt) return;
    setProcessing(true);
    try {
      await cancelAppointmentAdmin(cancellingAppt.id, cancelReason);
      toast.success(`Appointment #${cancellingAppt.id} has been cancelled.`);
      setCancellingAppt(null);
      setCancelReason("");
      if (view?.id === cancellingAppt.id) setView(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to cancel appointment.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleConfirmReschedule() {
    if (!reschedulingAppt || !rescheduleForm.date || !rescheduleForm.time) {
      toast.error("Please specify both a new date and time.");
      return;
    }
    setProcessing(true);
    try {
      await rescheduleAppointmentAdmin(
        reschedulingAppt.id,
        rescheduleForm.date,
        rescheduleForm.time,
        rescheduleForm.reason
      );
      toast.success(`Appointment rescheduled to ${rescheduleForm.date} at ${rescheduleForm.time}.`);
      setReschedulingAppt(null);
      setRescheduleForm({ date: "", time: "", reason: "" });
      if (view?.id === reschedulingAppt.id) setView(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to reschedule appointment.");
    } finally {
      setProcessing(false);
    }
  }

  function openReschedule(appt) {
    setReschedulingAppt(appt);
    setRescheduleForm({
      date: appt.date || "",
      time: appt.time || "",
      reason: "",
    });
  }

  const columns = [
    { key: "id", label: "ID" },
    { key: "patientName", label: "Patient" },
    { key: "doctorName", label: "Doctor" },
    { key: "date", label: "Date", render: (r) => formatDate(r.date) },
    { key: "time", label: "Time" },
    { key: "type", label: "Type" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setView(r)} title="View Details">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {r.status !== "cancelled" && r.status !== "completed" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="text-primary-400 hover:text-primary-300 hover:bg-primary-500/10"
                onClick={() => openReschedule(r)}
                title="Reschedule Appointment"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={() => setCancellingAppt(r)}
                title="Cancel Appointment"
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointment Control Centre"
        subtitle="Review, reschedule, or cancel patient-doctor consultations platform-wide."
      />

      {/* Summary KPI chips */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => setFilter({ ...filter, status: "" })}
          className={`cursor-pointer rounded-2xl p-3.5 border transition-all ${
            filter.status === ""
              ? "bg-primary/10 border-primary text-primary shadow-sm"
              : "bg-white border-sage/30 text-ink/70 hover:border-primary/40 hover:bg-sage/5 shadow-card"
          }`}
        >
          <div className="text-xs font-medium">All Consultations</div>
          <div className="text-xl font-bold text-ink mt-1">{totalCount}</div>
        </div>

        <div
          onClick={() => setFilter({ ...filter, date: todayStr })}
          className={`cursor-pointer rounded-2xl p-3.5 border transition-all ${
            filter.date === todayStr
              ? "bg-sky-50 border-sky-300 text-sky-800 shadow-sm"
              : "bg-white border-sage/30 text-ink/70 hover:border-primary/40 hover:bg-sage/5 shadow-card"
          }`}
        >
          <div className="text-xs font-medium flex items-center justify-between">
            <span>Today</span>
            <Calendar className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-xl font-bold text-ink mt-1">{todayCount}</div>
        </div>

        <div
          onClick={() => setFilter({ ...filter, status: "upcoming" })}
          className={`cursor-pointer rounded-2xl p-3.5 border transition-all ${
            filter.status === "upcoming"
              ? "bg-amber-50 border-amber-300 text-amber-800 shadow-sm"
              : "bg-white border-sage/30 text-ink/70 hover:border-primary/40 hover:bg-sage/5 shadow-card"
          }`}
        >
          <div className="text-xs font-medium flex items-center justify-between">
            <span>Upcoming / Confirmed</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-ink mt-1">{upcomingCount}</div>
        </div>

        <div
          onClick={() => setFilter({ ...filter, status: "completed" })}
          className={`cursor-pointer rounded-2xl p-3.5 border transition-all ${
            filter.status === "completed"
              ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm"
              : "bg-white border-sage/30 text-ink/70 hover:border-primary/40 hover:bg-sage/5 shadow-card"
          }`}
        >
          <div className="text-xs font-medium flex items-center justify-between">
            <span>Completed</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-ink mt-1">{completedCount}</div>
        </div>

        <div
          onClick={() => setFilter({ ...filter, status: "cancelled" })}
          className={`cursor-pointer rounded-2xl p-3.5 border transition-all ${
            filter.status === "cancelled"
              ? "bg-red-50 border-red-300 text-red-800 shadow-sm"
              : "bg-white border-sage/30 text-ink/70 hover:border-primary/40 hover:bg-sage/5 shadow-card"
          }`}
        >
          <div className="text-xs font-medium flex items-center justify-between">
            <span>Cancelled</span>
            <XCircle className="w-3.5 h-3.5 text-danger" />
          </div>
          <div className="text-xl font-bold text-ink mt-1">{cancelledCount}</div>
        </div>
      </div>

      {/* Filter inputs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Input type="date" value={filter.date} onChange={(e) => setFilter({ ...filter, date: e.target.value })} />
        <Select value={filter.doctor} onChange={(e) => setFilter({ ...filter, doctor: e.target.value })}>
          <option value="">All Doctors</option>
          {(doctors || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Select value={filter.specialty} onChange={(e) => setFilter({ ...filter, specialty: e.target.value })}>
          <option value="">All Specialties</option>
          {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">All Statuses</option>
          {Object.keys(APPOINTMENT_STATUS_LABELS).map((s) => <option key={s} value={s}>{APPOINTMENT_STATUS_LABELS[s]}</option>)}
        </Select>
        <Select value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}>
          <option value="">All Types</option>
          {APPOINTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No appointments match filters" />
        ) : (
          <DataTable columns={columns} data={rows} />
        )}
      </div>

      {/* View Details Modal */}
      <Modal
        open={!!view}
        onClose={() => setView(null)}
        title={`Appointment Details (#${view?.id})`}
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {view && view.status !== "cancelled" && view.status !== "completed" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const v = view;
                      setView(null);
                      openReschedule(v);
                    }}
                  >
                    Reschedule
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      const v = view;
                      setView(null);
                      setCancellingAppt(v);
                    }}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
            <Button onClick={() => setView(null)}>Close</Button>
          </div>
        }
      >
        {view && (
          <div className="space-y-3 text-sm">
            <Row label="Patient" value={view.patientName} />
            <Row label="Doctor" value={view.doctorName} />
            <Row label="Specialty" value={view.specialty} />
            <Row label="Date" value={formatDate(view.date)} />
            <Row label="Time" value={view.time} />
            <Row label="Type" value={view.type} />
            <Row label="Status" value={<StatusBadge status={view.status} />} />
            {view.reason && <Row label="Booking Reason" value={view.reason} />}
            {view.cancel_reason && (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-red-300 text-xs">
                <strong>Cancellation Reason:</strong> {view.cancel_reason}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Admin Cancel Modal */}
      {cancellingAppt && (
        <Modal
          open={true}
          onClose={() => setCancellingAppt(null)}
          title={`Cancel Appointment #${cancellingAppt.id}`}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
              <div>
                Cancelling appointment between <strong>{cancellingAppt.patientName}</strong> and{" "}
                <strong>{cancellingAppt.doctorName}</strong> on {cancellingAppt.date} at {cancellingAppt.time}.
                Both parties will receive instant push notifications.
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/80 mb-1.5">
                Cancellation Reason / Note to Parties
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Doctor emergency leave or platform schedule adjustment."
                className="input-base"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setCancellingAppt(null)} disabled={processing}>
                Back
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmCancel}
                loading={processing}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Admin Reschedule Modal */}
      {reschedulingAppt && (
        <Modal
          open={true}
          onClose={() => setReschedulingAppt(null)}
          title={`Reschedule Appointment #${reschedulingAppt.id}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-ink/60">
              Rescheduling appointment for <strong className="text-ink">{reschedulingAppt.patientName}</strong> with{" "}
              <strong className="text-ink">{reschedulingAppt.doctorName}</strong>.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink/80 mb-1">New Date</label>
                <Input
                  type="date"
                  value={rescheduleForm.date}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/80 mb-1">New Time</label>
                <Input
                  type="time"
                  value={rescheduleForm.time}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, time: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/80 mb-1.5">
                Reason for Rescheduling (Optional)
              </label>
              <textarea
                rows={2}
                value={rescheduleForm.reason}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
                placeholder="e.g. Requested by doctor or administrative timetable shift."
                className="input-base"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setReschedulingAppt(null)} disabled={processing}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmReschedule}
                loading={processing}
              >
                Save New Time
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 border-b border-sage/20 pb-2">
      <span className="text-ink/50 text-xs">{label}</span>
      <span className="font-medium text-ink text-xs text-right">{value}</span>
    </div>
  );
}
