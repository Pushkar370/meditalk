import { useState, useCallback, useEffect } from "react";
import {
  FileText, Search, Download, Filter, RotateCcw, Shield,
  KeyRound, CalendarDays, Stethoscope, Megaphone, Eye, CheckCircle2, AlertTriangle, XCircle,
  ShieldCheck, Lock, Hash, Globe, RefreshCw
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
import { getAuditLogs, getAuditLogStats, verifyAuditLogIntegrity } from "../../services/adminService";
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
  const [integrityResult, setIntegrityResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const fetchLogs = useCallback(() => getAuditLogs(appliedFilters), [appliedFilters]);
  const { data: logs, loading, reload } = useFetch(fetchLogs);
  const { data: stats, reload: reloadStats } = useFetch(getAuditLogStats);

  const handleVerifyIntegrity = useCallback(async () => {
    setIsVerifying(true);
    try {
      const res = await verifyAuditLogIntegrity();
      setIntegrityResult(res);
      if (res.verified) {
        toast.success(`Audit chain verified: ${res.totalEntries} entries intact.`);
      } else {
        toast.error(`Tampering alert: ${res.error}`);
      }
    } catch (err) {
      toast.error("Integrity check failed: " + err.message);
    } finally {
      setIsVerifying(false);
    }
  }, [toast]);

  useEffect(() => {
    handleVerifyIntegrity();
  }, [handleVerifyIntegrity]);

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
      label: "Timestamp (When)",
      render: (r) => (
        <span className="text-xs font-mono text-ink/70">
          {formatDateTime(r.timestamp)}
        </span>
      ),
    },
    {
      key: "user_name",
      label: "Actor (Who)",
      render: (r) => (
        <div>
          <div className="font-semibold text-ink text-xs">{r.user_name || "System"}</div>
          <div className="text-[11px] text-ink/50">{r.role || "System"}</div>
        </div>
      ),
    },
    {
      key: "action",
      label: "Action / Event (What)",
      render: (r) => (
        <div className="font-medium text-ink text-xs max-w-xs truncate" title={r.action}>
          {r.action}
        </div>
      ),
    },
    {
      key: "ip_address",
      label: "Origin (From Where)",
      render: (r) => (
        <div>
          <span className="text-xs font-mono text-ink/75" title={r.user_agent || "Client"}>
            {r.ip_address || "127.0.0.1"}
          </span>
          {r.hash && (
            <div className="text-[10px] font-mono text-ink/40 truncate max-w-[90px]" title={`SHA-256 Hash: ${r.hash}`}>
              ⛓️ {r.hash.slice(0, 8)}...
            </div>
          )}
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
        if (type.includes("Patient") || type.includes("Chart") || type.includes("Vitals")) color = "bg-teal-50 text-teal-800 border-teal-200";

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
          title="Inspect complete log payload & cryptographic hash"
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
        subtitle="Cryptographic SHA-256 hash-chained audit trail with database engine tamper-resistance (immutable rows)."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isVerifying}
              onClick={handleVerifyIntegrity}
              className="flex items-center gap-1.5 border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
            >
              {isVerifying ? (
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              )}
              <span>{isVerifying ? "Verifying Chain..." : "Verify Log Integrity"}</span>
            </Button>
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
                handleVerifyIntegrity();
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

      {/* Cryptographic Chain Integrity Banner */}
      {integrityResult && (
        <div
          className={`rounded-2xl p-4 border transition ${
            integrityResult.verified
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
              : "bg-red-50 border-red-300 text-red-950"
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  integrityResult.verified
                    ? "bg-emerald-600 text-white"
                    : "bg-red-600 text-white"
                }`}
              >
                {integrityResult.verified ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">
                    {integrityResult.verified
                      ? "Cryptographic Hash Chain Verified (SHA-256)"
                      : "CRITICAL: Audit Log Tampering Detected!"}
                  </h4>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      integrityResult.verified
                        ? "bg-emerald-200 text-emerald-900"
                        : "bg-red-200 text-red-900"
                    }`}
                  >
                    {integrityResult.verified ? "Tamper-Proof" : "Compromised"}
                  </span>
                </div>
                <p className="text-xs text-ink/70 mt-0.5">
                  {integrityResult.verified
                    ? `Sequential cryptographic chain intact across ${integrityResult.totalEntries} rows. Engine trigger forbids UPDATE/DELETE.`
                    : integrityResult.error}
                </p>
              </div>
            </div>

            {integrityResult.verified && (
              <div className="text-right text-xs space-y-0.5 bg-white/70 px-3 py-2 rounded-xl border border-emerald-200/60">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-ink/50 text-[11px]">Head Hash:</span>
                  <span className="font-mono font-semibold text-emerald-800 text-[11px]">
                    {integrityResult.headHash
                      ? `${integrityResult.headHash.slice(0, 10)}...${integrityResult.headHash.slice(-8)}`
                      : "Genesis"}
                  </span>
                </div>
                <div className="text-[10px] text-ink/50">
                  Verified at {formatDateTime(integrityResult.verifiedAt)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
            {/* Who & When */}
            <div className="grid grid-cols-2 gap-2 bg-sage/10 p-3 rounded-xl border border-sage/20">
              <div>
                <span className="text-ink/50 block text-[11px]">Actor (Who)</span>
                <span className="font-semibold text-ink">{inspectLog.user_name || "System"}</span>
                <span className="text-[11px] text-ink/50 block">{inspectLog.role || "System"} (ID: {inspectLog.user_id || "N/A"})</span>
              </div>
              <div>
                <span className="text-ink/50 block text-[11px]">Timestamp (When)</span>
                <span className="font-mono text-ink/80 text-[11px]">{inspectLog.timestamp}</span>
              </div>
            </div>

            {/* From Where: IP & Device */}
            <div className="grid grid-cols-2 gap-2 bg-sky-50/70 p-3 rounded-xl border border-sky-200/80">
              <div>
                <span className="text-sky-800 block text-[11px] font-medium flex items-center gap-1">
                  <Globe className="w-3 h-3 text-sky-600" /> Origin IP Address (From Where)
                </span>
                <span className="font-mono font-semibold text-sky-950 text-xs">
                  {inspectLog.ip_address || "127.0.0.1"}
                </span>
              </div>
              <div>
                <span className="text-sky-800 block text-[11px] font-medium">User Agent</span>
                <span className="font-mono text-[11px] text-sky-900/80 truncate block" title={inspectLog.user_agent}>
                  {inspectLog.user_agent || "Standard Browser Client"}
                </span>
              </div>
            </div>

            {/* What */}
            <div className="bg-sage/10 p-3 rounded-xl border border-sage/20 space-y-1">
              <span className="text-ink/50 block text-[11px]">Action Description (What)</span>
              <p className="font-medium text-ink text-sm">{inspectLog.action}</p>
              <div className="flex items-center gap-3 pt-1 text-[11px] text-ink/60">
                <span>Resource: <strong>{inspectLog.entity_type || "General"}</strong></span>
                {inspectLog.entity_id && <span>Reference: <strong className="font-mono">{inspectLog.entity_id}</strong></span>}
                <span>Status: <strong className="capitalize">{inspectLog.status || "success"}</strong></span>
              </div>
            </div>

            {/* Cryptographic Chain Proof */}
            <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-emerald-900 font-semibold text-xs flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-700" /> Cryptographic Tamper-Proof Chain
                </span>
                <span className="text-[10px] bg-emerald-200/80 text-emerald-900 font-mono px-2 py-0.5 rounded-full font-bold">
                  SHA-256
                </span>
              </div>
              <div className="space-y-1 text-[11px] font-mono">
                <div>
                  <span className="text-ink/50 block text-[10px]">Previous Hash (prev_hash):</span>
                  <div className="p-1.5 bg-white/80 rounded border border-emerald-200/60 break-all text-ink/75">
                    {inspectLog.prev_hash || "0000000000000000000000000000000000000000000000000000000000000000 (GENESIS)"}
                  </div>
                </div>
                <div>
                  <span className="text-ink/50 block text-[10px]">Row Signature Hash (hash):</span>
                  <div className="p-1.5 bg-white/80 rounded border border-emerald-200/60 break-all text-emerald-900 font-semibold">
                    {inspectLog.hash || "Not yet hashed"}
                  </div>
                </div>
              </div>
            </div>

            {/* Raw JSON */}
            <div className="bg-sage/10 p-3 rounded-xl border border-sage/20">
              <span className="text-ink/50 block text-[11px] mb-1">Raw Record Payload</span>
              <pre className="text-[10px] text-ink font-mono overflow-x-auto p-2 bg-white border border-sage/30 rounded-lg max-h-36">
                {JSON.stringify(inspectLog, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
