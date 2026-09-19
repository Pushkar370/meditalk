import { useState, useCallback } from "react";
import {
  FileText, Search, Download, Filter, RotateCcw, Shield,
  KeyRound, CalendarDays, Stethoscope, Megaphone, Eye, CheckCircle2, AlertTriangle, XCircle
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useToast } from "../../context/ToastContext";
import { useFetch } from "../../hooks/useFetch";
import { getAuditLogs, getAuditLogStats } from "../../services/adminService";
import { exportAuditLogsCsv } from "../../utils/auditExport";
import { formatDateTime } from "../../constants";

const ROLES = ["", "Patient", "Doctor", "Administrator"];
const STATUSES = ["", "success", "warning", "failed"];

export default function AdminAuditLogs() {
  const toast = useToast();

  const [filters, setFilters] = useState({
    role: "",
    status: "",
    search: "",
    from: "",
    to: "",
  });

  const [appliedFilters, setAppliedFilters] = useState({
    role: "",
    status: "",
    search: "",
    from: "",
    to: "",
  });

  const [inspectLog, setInspectLog] = useState(null);

  const fetchLogs = useCallback(() => getAuditLogs(appliedFilters), [appliedFilters]);
  const { data: logs, loading, reload } = useFetch(fetchLogs);
  const { data: stats, reload: reloadStats } = useFetch(getAuditLogStats);

  function handleApplyFilters() {
    if (filters.from && filters.to && filters.from > filters.to) {
      toast.error("From date cannot be later than To date.");
      return;
    }
    setAppliedFilters({ ...filters });
  }

  function handleResetFilters() {
    const reset = { role: "", status: "", search: "", from: "", to: "" };
    setFilters(reset);
    setAppliedFilters(reset);
  }

  function handleExport() {
    const list = logs || [];
    if (list.length === 0) {
      toast.error("No audit records to export.");
      return;
    }
    const success = exportAuditLogsCsv(list);
    if (success) {
      toast.success(`Exported ${list.length} audit records to CSV.`);
    }
  }

  const allLogs = logs || [];

  const columns = [
    {
      key: "timestamp",
      label: "Timestamp",
      render: (r) => (
        <span className="text-xs font-mono text-slate-300">
          {formatDateTime(r.timestamp)}
        </span>
      ),
    },
    {
      key: "user_name",
      label: "Actor",
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-100 text-xs">{r.user_name || "System"}</div>
          <div className="text-[11px] text-slate-400">{r.role || "System"}</div>
        </div>
      ),
    },
    {
      key: "action",
      label: "Action / Event",
      render: (r) => (
        <div className="font-medium text-slate-200 text-xs max-w-xs truncate" title={r.action}>
          {r.action}
        </div>
      ),
    },
    {
      key: "entity_type",
      label: "Resource",
      render: (r) => {
        const type = r.entity_type || "System";
        let color = "bg-slate-800 text-slate-300 border-slate-700";
        if (type === "Auth") color = "bg-blue-500/15 text-blue-300 border-blue-500/30";
        if (type === "Appointment") color = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
        if (type === "Doctor") color = "bg-amber-500/15 text-amber-300 border-amber-500/30";
        if (type === "Announcement") color = "bg-purple-500/15 text-purple-300 border-purple-500/30";

        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${color}`}>
            {type}
          </span>
        );
      },
    },
    {
      key: "entity_id",
      label: "Reference",
      render: (r) => (
        <span className="text-[11px] font-mono text-slate-400 truncate max-w-[120px] inline-block" title={r.entity_id}>
          {r.entity_id || "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => {
        const st = (r.status || "success").toLowerCase();
        if (st === "warning") {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
              <AlertTriangle className="w-3 h-3" /> Warning
            </span>
          );
        }
        if (st === "failed" || st === "error") {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400">
              <XCircle className="w-3 h-3" /> Failed
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Success
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Inspect",
      align: "right",
      render: (r) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setInspectLog(r)}
          title="Inspect complete log payload"
          className="p-1.5"
        >
          <Eye className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Intelligence Explorer"
        subtitle="Cryptographic & relational audit trail recording every platform authentication, intervention, and clinical event."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                reload();
                reloadStats();
              }}
              title="Refresh logs"
              className="flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Refresh</span>
            </Button>
          </div>
        }
      />

      {/* KPI Stats Chips Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3.5">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>Total Events</span>
            <Shield className="w-3.5 h-3.5 text-primary-400" />
          </div>
          <div className="text-xl font-bold text-slate-100 mt-1">{stats?.total ?? allLogs.length}</div>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3.5">
          <div className="text-xs text-blue-300 font-medium flex items-center justify-between">
            <span>Auth / Logins</span>
            <KeyRound className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-slate-100 mt-1">{stats?.auth ?? 0}</div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3.5">
          <div className="text-xs text-emerald-300 font-medium flex items-center justify-between">
            <span>Appointments</span>
            <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-slate-100 mt-1">{stats?.appointments ?? 0}</div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3.5">
          <div className="text-xs text-amber-300 font-medium flex items-center justify-between">
            <span>Clinical / Doctors</span>
            <Stethoscope className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-slate-100 mt-1">{stats?.clinical ?? 0}</div>
        </div>

        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3.5">
          <div className="text-xs text-purple-300 font-medium flex items-center justify-between">
            <span>Announcements</span>
            <Megaphone className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-slate-100 mt-1">{stats?.announcements ?? 0}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <Filter className="w-3.5 h-3.5 text-primary-400" />
            <span>Search & Scoping Parameters</span>
          </div>
          {(appliedFilters.from || appliedFilters.to || appliedFilters.role || appliedFilters.status || appliedFilters.search) && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search user, action, resource..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500"
            />
          </div>

          <Select
            value={filters.role}
            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r || "All Roles"}
              </option>
            ))}
          </Select>

          <Select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? s.toUpperCase() : "All Statuses"}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">From:</span>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className="w-full px-2 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">To:</span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="w-full px-2 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-primary-500"
            />
            <Button size="sm" onClick={handleApplyFilters} className="px-3 py-1.5">
              Apply
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <LoadingState />
        ) : allLogs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No audit logs found"
            message="No system events match your current filter parameters."
          />
        ) : (
          <DataTable columns={columns} data={allLogs} keyField="id" />
        )}
      </div>

      {/* Inspect Event Modal */}
      {inspectLog && (
        <Modal
          open={true}
          onClose={() => setInspectLog(null)}
          title={`Audit Event #${inspectLog.id}`}
          size="md"
          footer={<Button onClick={() => setInspectLog(null)}>Close</Button>}
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 block text-[11px]">Actor</span>
                <span className="font-semibold text-slate-100">{inspectLog.user_name || "System"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Role</span>
                <span className="font-medium text-slate-200">{inspectLog.role || "System"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">User ID</span>
                <span className="font-mono text-slate-300">{inspectLog.user_id || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Timestamp</span>
                <span className="font-mono text-slate-300">{inspectLog.timestamp}</span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[11px]">Action Description</span>
              <p className="font-medium text-slate-100 text-sm">{inspectLog.action}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 block text-[11px]">Resource / Entity Type</span>
                <span className="font-medium text-slate-200">{inspectLog.entity_type || "General"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Reference / Target ID</span>
                <span className="font-mono text-slate-200">{inspectLog.entity_id || "N/A"}</span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[11px] mb-1">Raw Record Payload</span>
              <pre className="text-[11px] text-slate-300 font-mono overflow-x-auto p-2 bg-slate-900 rounded-lg">
                {JSON.stringify(inspectLog, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
