import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays, Video, AlertTriangle, AlertCircle, Sparkles,
  Clock, UserCheck, CheckCircle2, RotateCw, Users
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import SearchBar from "../../components/ui/SearchBar";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useFetch } from "../../hooks/useFetch";
import { getAppointments, getWaitingRoomQueue, updateQueueStatus } from "../../services/appointmentService";
import { formatDate } from "../../constants";

const FILTERS = ["All", "upcoming", "confirmed", "completed", "cancelled"];

function UrgencyBadge({ urgency }) {
  if (urgency === "emergency") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-danger/15 text-danger border border-danger/30 shadow-sm animate-pulse">
        <AlertTriangle className="h-3 w-3" /> Emergency 🚨
      </span>
    );
  }
  if (urgency === "urgent") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
        <AlertCircle className="h-3 w-3" /> Urgent ⚠️
      </span>
    );
  }
  if (urgency === "self_care") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
        Self-Care ℹ️
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sage/20 text-ink/70">
      Routine 🟢
    </span>
  );
}

export default function DoctorAppointments() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const doctorId = user?.id || user?.doctorId || "D-201";
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [queueActionBusy, setQueueActionBusy] = useState(false);

  const { data: appts, loading, reload } = useFetch(() => getAppointments({ doctorId }), [doctorId]);
  const { data: queueData, reload: reloadQueue } = useFetch(
    () => (doctorId ? getWaitingRoomQueue(doctorId) : Promise.resolve({ queue: [] })),
    [doctorId]
  );

  const todayQueue = queueData?.queue || [];
  const waitingPatients = todayQueue.filter((q) => q.checkInStatus === "checked_in");
  const inRoomPatient = todayQueue.find((q) => q.checkInStatus === "in_room");

  async function handleSetQueueStatus(apptId, newStatus) {
    setQueueActionBusy(true);
    try {
      await updateQueueStatus(apptId, newStatus);
      toast.success(`Queue status updated: ${newStatus}`);
      reloadQueue();
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to update queue status");
    } finally {
      setQueueActionBusy(false);
    }
  }

  if (loading) return <LoadingState />;

  const list = (appts || [])
    .filter((a) => filter === "All" || a.status === filter)
    .filter((a) => (a.patientName || "").toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { key: "date", label: "Date", render: (r) => formatDate(r.date) },
    { key: "time", label: "Time" },
    {
      key: "patientName",
      label: "Patient",
      render: (r) => (
        <div>
          <span className="font-semibold text-ink">{r.patientName}</span>
          {r.checkInStatus === "checked_in" && (
            <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              <Clock className="h-2.5 w-2.5 animate-spin" /> In Waiting Room
            </span>
          )}
          {r.checkInStatus === "in_room" && (
            <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="h-2.5 w-2.5" /> In Consultation Room
            </span>
          )}
        </div>
      ),
    },
    {
      key: "urgency",
      label: "Triage Urgency",
      render: (r) => <UrgencyBadge urgency={r.urgency || r.triageSummary?.urgency} />,
    },
    { key: "type", label: "Type" },
    {
      key: "reason",
      label: "Reason",
      render: (r) => (
        <div className="max-w-[200px]">
          <p className="truncate">{r.reason}</p>
          {r.triageSummary && (
            <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium">
              <Sparkles className="h-2.5 w-2.5" /> AI Assessed
            </span>
          )}
        </div>
      ),
    },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(`/doctor/patients/${r.patientId}`)}>
            View Patient
          </Button>
          {(r.status === "upcoming" || r.status === "confirmed") && (
            <Button
              size="sm"
              onClick={() => navigate(`/doctor/consultation/${r.patientId}?apptId=${r.id}`)}
            >
              <Video className="h-3.5 w-3.5" /> Consult
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Appointments" subtitle="Manage your patient appointments and clinic queue." />

      {/* ─── CW-6: Clinic Waiting Room & Today's Queue ──────────────────── */}
      <div className="card border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-white to-sage/10 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-sage/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-ink text-base">Clinic Waiting Room Queue</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {waitingPatients.length} Waiting
                </span>
                {inRoomPatient && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
                    1 In Room
                  </span>
                )}
              </div>
              <p className="text-xs text-ink/60 mt-0.5">
                Real-time patient check-ins and queue management for today's clinic schedule
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              reloadQueue();
              reload();
            }}
            disabled={queueActionBusy}
          >
            <RotateCw className={`h-3.5 w-3.5 ${queueActionBusy ? "animate-spin" : ""}`} /> Refresh Queue
          </Button>
        </div>

        {/* In-Room Patient Focus Banner */}
        {inRoomPatient && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                ROOM
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Currently in Room</span>
                  <span className="font-bold text-ink text-base">{inRoomPatient.patientName}</span>
                  <span className="text-xs text-ink/50">· Scheduled: {inRoomPatient.time}</span>
                </div>
                <p className="text-xs text-ink/70 mt-0.5">
                  Reason: <span className="italic">{inRoomPatient.reason || "General Consultation"}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => navigate(`/doctor/consultation/${inRoomPatient.patientId}?apptId=${inRoomPatient.id}`)}
              >
                <Video className="h-3.5 w-3.5" /> Open Consultation
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                loading={queueActionBusy}
                onClick={() => handleSetQueueStatus(inRoomPatient.id, "completed")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark Completed
              </Button>
            </div>
          </div>
        )}

        {/* Waiting Patients List */}
        {waitingPatients.length > 0 ? (
          <div className="mt-4 space-y-2.5">
            <p className="text-xs font-bold text-ink/60 uppercase tracking-wider">
              Waiting In Lobby ({waitingPatients.length})
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {waitingPatients.map((patient, idx) => (
                <div
                  key={patient.id}
                  className="p-3.5 rounded-xl bg-white border border-sage/30 shadow-card flex flex-col justify-between gap-2.5 transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-ink text-sm leading-tight">{patient.patientName}</h4>
                        <span className="text-[11px] text-ink/50">Slot: {patient.time}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                      ~{patient.waitMinutes ?? 0}m wait
                    </span>
                  </div>

                  {patient.reason && (
                    <p className="text-xs text-ink/70 line-clamp-1 italic">
                      "{patient.reason}"
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-sage/10">
                    <UrgencyBadge urgency={patient.urgency || patient.triageSummary?.urgency} />
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="xs"
                        variant="primary"
                        loading={queueActionBusy}
                        onClick={() => handleSetQueueStatus(patient.id, "in_room")}
                      >
                        <UserCheck className="h-3 w-3" /> Call In
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-danger hover:bg-danger/10"
                        title="Mark No-Show"
                        disabled={queueActionBusy}
                        onClick={() => handleSetQueueStatus(patient.id, "no_show")}
                      >
                        No-Show
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : !inRoomPatient ? (
          <div className="mt-4 p-4 rounded-xl bg-white/60 border border-dashed border-sage/40 text-center">
            <Clock className="h-5 w-5 text-ink/30 mx-auto mb-1" />
            <p className="text-xs font-medium text-ink/70">No patients currently checked in for the waiting room.</p>
            <p className="text-[11px] text-ink/40 mt-0.5">
              Patients checking in via their portal or front desk will appear here automatically.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "px-3 py-1.5 rounded-full text-sm font-medium capitalize transition " +
                (filter === f ? "bg-primary text-white" : "bg-white text-ink/60 border border-sage/40 hover:bg-sage/20")
              }
            >
              {f}
            </button>
          ))}
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search patient..." className="sm:w-64" />
      </div>

      <div className="card">
        {list.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No appointments" />
        ) : (
          <DataTable columns={columns} data={list} />
        )}
      </div>
    </div>
  );
}
