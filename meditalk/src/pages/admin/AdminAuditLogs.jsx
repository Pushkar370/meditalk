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
        <span className="text-xs font-mono text-ink/70">
          {formatDateTime(r.timestamp)}
        </span>
      ),
    },
    {
      key: "user_name",
      label: "Actor",
      render: (r) => (
        <div>
          <div className="font-semibold text-ink text-xs">{r.user_name || "System"}</div>
          <div className="text-[11px] text-ink/50">{r.role || "System"}</div>
        </div>
      ),
    },
    {
      key: "action",
      label: "Action / Event",
      render: (r) => (
        <div className="font-medium text-ink text-xs max-w-xs truncate" title={r.action}>
          {r.action}
        </div>
      ),
    },
    {
      key: "entity_type",
      label: "Resource",
      render: (r) => {
        const type = r.entity_type || "System";
        let color = "bg-sage/15 text-primary border-sage/30";
        if (type === "Auth") color = "bg-sky-50 text-sky-700 border-sky-200";
        if (type === "Appointment") color = "bg-emerald-50 text-emerald-700 border-emerald-200";
        if (type === "Doctor") color = "bg-amber-50 text-amber-800 border-amber-200";
        if (type === "Announcement") color = "bg-purple-50 text-purple-700 border-purple-200";

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
        <span className="text-[11px] font-mono text-ink/50 truncate max-w-[120px] inline-block" title={r.entity_id}>
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
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
              <AlertTriangle className="w-3 h-3" /> Warning
            </span>
          );
        }
        if (st === "failed" || st === "error") {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger">
              <XCircle className="w-3 h-3" /> Failed
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
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
        <div className="card p-3.5 flex flex-col justify-between">
          <div className="text-xs text-ink/60 font-medium flex items-center justify-between">
            <span>Total Events</span>
            <Shield className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-xl font-bold text-ink mt-1">{stats?.total ?? allLogs.length}</div>
        </div>

        <div className="rounded-2xl border border-sky-200/70 bg-sky-50/60 p-3.5 shadow-card flex flex-col justify-between">
          <div className="text-xs text-sky-800 font-medium flex items-center justify-between">
            <span>Auth / Logins</span>
            <KeyRound className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-xl font-bold text-ink mt-1">{stats?.auth ?? 0}</div>
        </div>

        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-3.5 shadow-card flex flex-col justify-between">
          <div className="text-xs text-emerald-800 font-medium flex items-center justify-between">
            <span>Appointments</span>
            <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-ink mt-1">{stats?.appointments ?? 0}</div>
        </div>

        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-3.5 shadow-card flex flex-col justify-between">
          <div className="text-xs text-amber-800 font-medium flex items-center justify-between">
            <span>Clinical / Doctors</span>
            <Stethoscope className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-ink mt-1">{stats?.clinical ?? 0}</div>
        </div>

        <div className="rounded-2xl border border-purple-200/70 bg-purple-50/60 p-3.5 shadow-card flex flex-col justify-between">
          <div className="text-xs text-purple-800 font-medium flex items-center justify-between">
            <span>Announcements</span>
            <Megaphone className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-ink mt-1">{stats?.announcements ?? 0}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2 border-b border-sage/20 pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink/70">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span>Search & Scoping Parameters</span>
          </div>
          {(appliedFilters.from || appliedFilters.to || appliedFilters.role || appliedFilters.status || appliedFilters.search) && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-ink/50 hover:text-ink flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {/* Free Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
            <input
              type="text"
              placeholder="Filter by actor name, user ID, or action..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-sage/40 rounded-xl text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={filters.role}
              onChange={(e) => handleFilterChange("role", e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-sage/40 rounded-xl text-ink focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            >
              <option value="">All Roles</option>
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="admin">Admin</option>
              <option value="system">System Worker</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-sage/40 rounded-xl text-ink focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Date Pickers */}
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="date"
              value={filters.from}
              onChange={(e) => handleFilterChange("from", e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-white border border-sage/40 rounded-xl text-ink focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              title="From date"
            />
            <input
              type="date"
              value={filters.to}
              onChange={(e) => handleFilterChange("to", e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-white border border-sage/40 rounded-xl text-ink focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              title="To date"
            />
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
            <div className="grid grid-cols-2 gap-2 bg-sage/10 p-3.5 rounded-xl border border-sage/20">
              <div>
                <span className="text-ink/50 block text-[11px]">Actor</span>
                <span className="font-semibold text-ink">{inspectLog.user_name || "System"}</span>
              </div>
              <div>
                <span className="text-ink/50 block text-[11px]">Role</span>
                <span className="font-medium text-ink">{inspectLog.role || "System"}</span>
              </div>
              <div>
                <span className="text-ink/50 block text-[11px]">User ID</span>
                <span className="font-mono text-ink/70">{inspectLog.user_id || "N/A"}</span>
              </div>
              <div>
                <span className="text-ink/50 block text-[11px]">Timestamp</span>
                <span className="font-mono text-ink/70">{inspectLog.timestamp}</span>
              </div>
            </div>

            <div className="bg-sage/10 p-3.5 rounded-xl border border-sage/20 space-y-1">
              <span className="text-ink/50 block text-[11px]">Action Description</span>
              <p className="font-medium text-ink text-sm">{inspectLog.action}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-sage/10 p-3.5 rounded-xl border border-sage/20">
              <div>
                <span className="text-ink/50 block text-[11px]">Resource / Entity Type</span>
                <span className="font-medium text-ink">{inspectLog.entity_type || "General"}</span>
              </div>
              <div>
                <span className="text-ink/50 block text-[11px]">Reference / Target ID</span>
                <span className="font-mono text-ink">{inspectLog.entity_id || "N/A"}</span>
              </div>
            </div>

            <div className="bg-sage/10 p-3.5 rounded-xl border border-sage/20">
              <span className="text-ink/50 block text-[11px] mb-1">Raw Record Payload</span>
              <pre className="text-[11px] text-ink font-mono overflow-x-auto p-2.5 bg-white border border-sage/30 rounded-lg">
                {JSON.stringify(inspectLog, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
