import { useState, useEffect } from "react";
import {
  Users, Clock, CheckCircle2, UserCheck, AlertCircle, Search, RefreshCw, CalendarDays, ArrowRight, DoorOpen
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";
import LoadingState from "../../components/ui/LoadingState";
import EmergencyBanner from "../../components/ui/EmergencyBanner";
import { useToast } from "../../context/ToastContext";
import {
  getWaitingRoomQueue,
  checkInAppointment,
  updateQueueStatus
} from "../../services/appointmentService";
import { formatDate } from "../../constants";

export default function ReceptionistQueue() {
  const toast = useToast();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState({});

  async function loadQueue(silent = false) {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await getWaitingRoomQueue();
      setQueue(res.queue || []);
    } catch (err) {
      toast.error(err.message || "Failed to load clinic queue");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadQueue();
    // Auto-refresh queue every 15 seconds
    const interval = setInterval(() => loadQueue(true), 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleCheckIn(id, patientName) {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await checkInAppointment(id);
      toast.success(`${patientName} marked as checked in!`);
      await loadQueue(true);
    } catch (err) {
      toast.error(err.message || "Failed to check in patient");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleStatusChange(id, newStatus, label) {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await updateQueueStatus(id, newStatus);
      toast.success(`Queue status updated to ${label}`);
      await loadQueue(true);
    } catch (err) {
      toast.error(err.message || "Failed to update queue status");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  const filtered = queue.filter((item) => {
    const term = search.toLowerCase();
    const matchSearch =
      (item.patientName || "").toLowerCase().includes(term) ||
      (item.id || "").toLowerCase().includes(term) ||
      (item.doctorName || "").toLowerCase().includes(term);

    if (!matchSearch) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "checked_in") return item.checkInStatus === "checked_in";
    if (statusFilter === "in_room") return item.checkInStatus === "in_room";
    if (statusFilter === "scheduled") return !item.checkInStatus || item.checkInStatus === "scheduled";
    if (statusFilter === "completed") return item.status === "completed" || item.checkInStatus === "completed";
    return true;
  });

  const totalScheduled = queue.length;
  const waitingCount = queue.filter((q) => q.checkInStatus === "checked_in").length;
  const inRoomCount = queue.filter((q) => q.checkInStatus === "in_room").length;
  const completedCount = queue.filter((q) => q.status === "completed" || q.checkInStatus === "completed").length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Reception & Patient Check-in"
        subtitle="Manage arriving patients, front-desk check-ins, and clinic waiting room flow."
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

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-4 sm:p-5 shadow-apple-card flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-accent/10 dark:bg-accent/20 text-accent flex items-center justify-center shrink-0">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-ink/50 dark:text-dark-ink/50 font-medium">Today's Visits</p>
            <p className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-0.5">{totalScheduled}</p>
          </div>
        </div>

        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-4 sm:p-5 shadow-apple-card flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">In Lobby</p>
            <p className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-0.5">{waitingCount}</p>
          </div>
        </div>

        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-4 sm:p-5 shadow-apple-card flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <DoorOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">With Doctor</p>
            <p className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-0.5">{inRoomCount}</p>
          </div>
        </div>

        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-4 sm:p-5 shadow-apple-card flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Completed</p>
            <p className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-0.5">{completedCount}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-4 shadow-apple-card flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40 dark:text-dark-ink/40" />
          <input
            type="text"
            placeholder="Search patient, doctor, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs rounded-xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle pl-10 pr-4 py-2 text-ink dark:text-dark-ink placeholder:text-ink/40 focus:outline-none focus:border-accent"
          />
        </div>

        <div className="inline-flex p-1 rounded-xl bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle w-full sm:w-auto overflow-x-auto">
          {[
            { key: "all", label: "All" },
            { key: "checked_in", label: `Waiting (${waitingCount})` },
            { key: "in_room", label: `In Room (${inRoomCount})` },
            { key: "scheduled", label: "Not Checked In" },
            { key: "completed", label: "Completed" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab.key
                  ? "bg-surface dark:bg-dark-surface text-ink dark:text-dark-ink shadow-sm"
                  : "text-ink/60 dark:text-dark-ink/60 hover:text-ink dark:hover:text-dark-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Queue Table */}
      {loading ? (
        <LoadingState message="Loading live waiting room queue..." />
      ) : filtered.length === 0 ? (
        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-12 text-center shadow-apple-card">
          <Users className="h-10 w-10 mx-auto text-ink/30 dark:text-dark-ink/30 mb-2" />
          <p className="text-sm font-semibold text-ink dark:text-dark-ink">No appointments match the selected filter</p>
          <p className="text-xs text-ink/50 dark:text-dark-ink/50 mt-1">Check-in appointments appear here automatically.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isCheckedIn = item.checkInStatus === "checked_in";
            const isInRoom = item.checkInStatus === "in_room";
            const isCompleted = item.status === "completed" || item.checkInStatus === "completed";
            const isBusy = !!actionLoading[item.id];

            return (
              <div
                key={item.id}
                className={`rounded-2xl p-5 transition-all border shadow-apple-card ${
                  isCheckedIn
                    ? "border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10"
                    : isInRoom
                    ? "border-indigo-500/30 bg-indigo-500/5 dark:bg-indigo-500/10"
                    : isCompleted
                    ? "border-border-subtle/50 dark:border-dark-border-subtle/50 bg-surface dark:bg-dark-surface opacity-70"
                    : "border-border-subtle dark:border-dark-border-subtle bg-surface dark:bg-dark-surface"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Patient & Doctor Details */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${
                        isCheckedIn
                          ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                          : isInRoom
                          ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
                          : "bg-canvas dark:bg-dark-surface-elevated text-ink/70 dark:text-dark-ink/70 border border-border-subtle dark:border-dark-border-subtle"
                      }`}
                    >
                      {item.patientName ? item.patientName.charAt(0) : "P"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink dark:text-dark-ink text-sm tracking-tight">{item.patientName}</span>
                        <span className="text-[10px] text-ink/40 dark:text-dark-ink/40 font-mono">ID: {item.id}</span>
                        {item.type && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-canvas dark:bg-dark-surface-elevated text-ink/60 dark:text-dark-ink/60 border border-border-subtle dark:border-dark-border-subtle font-medium">
                            {item.type}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink/60 dark:text-dark-ink/60 mt-0.5">
                        Assigned Physician: <strong>{item.doctorName}</strong> ({item.specialty || "General"})
                      </p>
                      <p className="text-xs text-ink/50 dark:text-dark-ink/50 mt-0.5">
                        Time: <strong>{item.time}</strong> · Date: {formatDate(item.date)}
                      </p>
                    </div>
                  </div>

                  {/* Status & Wait Timer */}
                  <div className="flex items-center gap-3 shrink-0">
                    {isCheckedIn && (
                      <div className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 animate-pulse text-amber-600 dark:text-amber-400" />
                        <span>Waiting: {item.waitMinutes || 0} min</span>
                      </div>
                    )}

                    {isInRoom && (
                      <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5">
                        <DoorOpen className="h-3.5 w-3.5" /> In Consultation
                      </span>
                    )}

                    {!isCheckedIn && !isInRoom && !isCompleted && (
                      <span className="px-2.5 py-1 rounded-full bg-canvas dark:bg-dark-surface-elevated text-ink/60 dark:text-dark-ink/60 text-xs font-medium border border-border-subtle dark:border-dark-border-subtle">
                        Not Checked In
                      </span>
                    )}

                    {isCompleted && (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1 border border-emerald-500/30">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Done
                      </span>
                    )}
                  </div>

                  {/* Front-Desk Queue Controls */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    {!isCheckedIn && !isInRoom && !isCompleted && (
                      <Button
                        size="sm"
                        disabled={isBusy}
                        loading={isBusy}
                        onClick={() => handleCheckIn(item.id, item.patientName)}
                        className="text-xs"
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Mark Checked-In
                      </Button>
                    )}

                    {isCheckedIn && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isBusy}
                          loading={isBusy}
                          onClick={() => handleStatusChange(item.id, "in_room", "In Room")}
                          className="text-xs"
                        >
                          <DoorOpen className="h-3.5 w-3.5" /> Call into Room
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => handleStatusChange(item.id, "no_show", "No-Show")}
                          className="text-xs text-rose-600 dark:text-rose-400 hover:bg-danger/10 border-danger/30"
                        >
                          No-Show
                        </Button>
                      </>
                    )}

                    {isInRoom && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        loading={isBusy}
                        onClick={() => handleStatusChange(item.id, "completed", "Completed")}
                        className="text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/30"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark Completed
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
