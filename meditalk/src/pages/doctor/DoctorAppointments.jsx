import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Video,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Clock,
  UserCheck,
  CheckCircle2,
  RotateCw,
  Users,
  MessageSquare,
  Play,
  Eye,
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
import {
  getAppointments,
  getWaitingRoomQueue,
  updateQueueStatus,
} from "../../services/appointmentService";
import { formatDate } from "../../constants";

const FILTERS = ["All", "upcoming", "confirmed", "completed", "cancelled"];

function UrgencyBadge({ urgency }) {
  if (urgency === "emergency") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
        <AlertTriangle className="h-3 w-3" /> Emergency
      </span>
    );
  }
  if (urgency === "urgent") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30">
        <AlertCircle className="h-3 w-3" /> Urgent
      </span>
    );
  }
  if (urgency === "self_care") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
        Self-Care
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-canvas dark:bg-dark-surface-elevated text-ink/70 dark:text-dark-ink/70 border border-border-subtle dark:border-dark-border-subtle">
      Routine
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

  const { data: appts, loading, reload } = useFetch(
    () => getAppointments({ doctorId }),
    [doctorId]
  );
  const { data: queueData, reload: reloadQueue } = useFetch(
    () =>
      doctorId ? getWaitingRoomQueue(doctorId) : Promise.resolve({ queue: [] }),
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
    .filter((a) =>
      (a.patientName || "").toLowerCase().includes(search.toLowerCase())
    );

  const columns = [
    { key: "date", label: "Date", render: (r) => formatDate(r.date) },
    { key: "time", label: "Time" },
    {
      key: "patientName",
      label: "Patient",
      render: (r) => (
        <div>
          <span className="font-semibold text-ink dark:text-dark-ink">
            {r.patientName}
          </span>
          {r.checkInStatus === "checked_in" && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <Clock className="h-2.5 w-2.5 animate-spin" /> In Waiting Room
            </span>
          )}
          {r.checkInStatus === "in_room" && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-2.5 w-2.5" /> In Consultation
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
    { key: "type", label: "Mode" },
    {
      key: "reason",
      label: "Reason",
      render: (r) => (
        <div className="max-w-[200px]">
          <p className="truncate text-ink/80 dark:text-dark-ink/80">{r.reason}</p>
          {r.triageSummary && (
            <span className="inline-flex items-center gap-1 text-[10px] text-primary dark:text-primary-light font-medium">
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
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/doctor/patients/${r.patientId}`)}
            className="text-xs"
          >
            <Eye className="h-3 w-3 mr-1" /> View Chart
          </Button>
          {(r.status === "upcoming" || r.status === "confirmed") && (
            <Button
              size="sm"
              onClick={() =>
                navigate(`/doctor/consultation/${r.patientId}?apptId=${r.id}`)
              }
              className="text-xs"
            >
              <Video className="h-3 w-3 mr-1" /> Consult
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Appointments & Clinic Queue"
        subtitle="Manage scheduled consultations, triage urgencies, and live waiting room flow."
      />

      {/* ─── CW-6: Clinic Waiting Room & Today's Queue ──────────────────── */}
      <div className="card border border-primary/20 dark:border-primary/30 p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-border-subtle dark:border-dark-border-subtle">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-ink dark:text-dark-ink text-base">
                  Live Clinic Waiting Queue
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  {waitingPatients.length} Waiting
                </span>
                {inRoomPatient && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    1 In Examination Room
                  </span>
                )}
              </div>
              <p className="text-xs text-ink/50 dark:text-dark-ink/50 mt-0.5">
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
            className="text-xs"
          >
            <RotateCw
              className={`h-3.5 w-3.5 mr-1.5 ${queueActionBusy ? "animate-spin" : ""}`}
            />{" "}
            Refresh Queue
          </Button>
        </div>

        {/* In-Room Patient Focus Banner */}
        {inRoomPatient && (
          <div className="p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                ROOM
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Currently in Room
                  </span>
                  <span className="font-bold text-ink dark:text-dark-ink text-base">
                    {inRoomPatient.patientName}
                  </span>
                  <span className="text-xs text-ink/50 dark:text-dark-ink/50">
                    · Slot: {inRoomPatient.time}
                  </span>
                </div>
                <p className="text-xs text-ink/70 dark:text-dark-ink/70 mt-0.5">
                  Reason:{" "}
                  <span className="italic">
                    {inRoomPatient.reason || "General Consultation"}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() =>
                  navigate(
                    `/doctor/consultation/${inRoomPatient.patientId}?apptId=${inRoomPatient.id}`
                  )
                }
                className="text-xs"
              >
                <Video className="h-3.5 w-3.5 mr-1" /> Open Consultation
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                loading={queueActionBusy}
                onClick={() => handleSetQueueStatus(inRoomPatient.id, "completed")}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Complete Session
              </Button>
            </div>
          </div>
        )}

        {/* Waiting Patients List */}
        {waitingPatients.length > 0 ? (
          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold text-ink/60 dark:text-dark-ink/60 uppercase tracking-wider">
              Waiting In Lobby ({waitingPatients.length})
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {waitingPatients.map((patient, idx) => (
                <div
                  key={patient.id}
                  className="p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle flex flex-col justify-between gap-3 transition hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="h-7 w-7 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light font-bold text-xs flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <div>
                        <h4 className="font-semibold text-ink dark:text-dark-ink text-sm leading-tight">
                          {patient.patientName}
                        </h4>
                        <span className="text-xs text-ink/50 dark:text-dark-ink/50">
                          Slot: {patient.time}
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                      ~{patient.waitMinutes ?? 0}m wait
                    </span>
                  </div>

                  {patient.reason && (
                    <p className="text-xs text-ink/70 dark:text-dark-ink/70 line-clamp-1 italic">
                      "{patient.reason}"
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle dark:border-dark-border-subtle">
                    <UrgencyBadge
                      urgency={patient.urgency || patient.triageSummary?.urgency}
                    />
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="xs"
                        loading={queueActionBusy}
                        onClick={() => handleSetQueueStatus(patient.id, "in_room")}
                      >
                        <UserCheck className="h-3 w-3 mr-1" /> Call In
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-rose-600 hover:bg-rose-500/10"
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
          <div className="py-8 text-center bg-canvas dark:bg-dark-surface-elevated/20 rounded-2xl border border-dashed border-border-subtle dark:border-dark-border-subtle">
            <Clock className="h-6 w-6 text-ink/30 dark:text-dark-ink/30 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-ink/70 dark:text-dark-ink/70">
              No patients currently waiting in the queue.
            </p>
            <p className="text-[11px] text-ink/40 dark:text-dark-ink/40 mt-0.5">
              Patients checking in via their portal will appear here automatically.
            </p>
          </div>
        ) : null}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex p-1 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/60 border border-border-subtle dark:border-dark-border-subtle w-fit overflow-x-auto">
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all duration-150 ${
                  active
                    ? "bg-surface dark:bg-dark-surface text-ink dark:text-dark-ink shadow-sm"
                    : "text-ink/50 dark:text-dark-ink/50 hover:text-ink dark:hover:text-dark-ink"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search patient..."
          className="sm:w-64"
        />
      </div>

      {/* Appointments Data Table */}
      <div className="card">
        {list.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No appointments found"
            message="No appointment matching your filter criteria was found."
          />
        ) : (
          <DataTable columns={columns} data={list} />
        )}
      </div>
    </div>
  );
}
