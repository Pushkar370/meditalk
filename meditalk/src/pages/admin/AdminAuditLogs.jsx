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

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

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
        <span className="text-xs font-mono text-ink/70 dark:text-dark-ink/70">
          {formatDateTime(r.timestamp)}
        </span>
      ),
    },
    {
      key: "user_name",
      label: "Actor",
      render: (r) => (
        <div>
          <div className="font-semibold text-ink dark:text-dark-ink text-xs">{r.user_name || "System"}</div>
          <div className="text-[11px] text-ink/50 dark:text-dark-ink/50">{r.role || "System"}</div>
        </div>
      ),
    },
    {
      key: "action",
      label: "Action / Event",
      render: (r) => (
        <div className="font-medium text-ink dark:text-dark-ink text-xs max-w-xs truncate" title={r.action}>
          {r.action}
        </div>
      ),
    },
    {
      key: "ip_address",
      label: "Origin & Hash",
      render: (r) => (
        <div>
          <span className="text-xs font-mono text-ink/75 dark:text-dark-ink/75" title={r.user_agent || "Client"}>
            {r.ip_address || "127.0.0.1"}
          </span>
          {r.hash && (
            <div className="text-[10px] font-mono text-ink/40 dark:text-dark-ink/40 truncate max-w-[90px]" title={`SHA-256 Hash: ${r.hash}`}>
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
        let color = "bg-accent/10 text-accent border-accent/20";
        if (type === "Auth") color = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
        if (type === "Appointment") color = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
        if (type === "Doctor") color = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
        if (type === "Announcement") color = "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";

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
        <span className="text-[11px] font-mono text-ink/50 dark:text-dark-ink/50 truncate max-w-[120px] inline-block" title={r.entity_id}>
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
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
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
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
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
        <button
          onClick={() => setInspectLog(r)}
          title="Inspect complete log payload & cryptographic hash"
          className="p-1.5 rounded-lg bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle text-ink/70 dark:text-dark-ink/70 hover:text-accent hover:border-accent/40 transition-all"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Audit Intelligence & Compliance"
        subtitle="Cryptographic SHA-256 hash-chained audit trail with database engine tamper-resistance (immutable append-only rows)."
        action={
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              disabled={isVerifying}
              onClick={handleVerifyIntegrity}
              className="flex items-center gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
            >
              {isVerifying ? (
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
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
          className={`rounded-2xl p-5 border transition-all shadow-apple-card ${
            integrityResult.verified
              ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/25 text-emerald-950 dark:text-emerald-100"
              : "bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/25 text-rose-950 dark:text-rose-100"
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`p-3 rounded-2xl ${
                  integrityResult.verified
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-rose-600 text-white shadow-sm"
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
                  <h4 className="font-semibold text-sm tracking-tight">
                    {integrityResult.verified
                      ? "Cryptographic Hash Chain Verified (SHA-256)"
                      : "CRITICAL: Audit Log Tampering Detected!"}
                  </h4>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      integrityResult.verified
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                        : "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    {integrityResult.verified ? "Tamper-Proof" : "Compromised"}
                  </span>
                </div>
                <p className="text-xs text-ink/70 dark:text-dark-ink/70 mt-0.5">
                  {integrityResult.verified
                    ? `Sequential cryptographic chain intact across ${integrityResult.totalEntries} rows. Engine trigger forbids UPDATE/DELETE.`
                    : integrityResult.error}
                </p>
              </div>
            </div>

            {integrityResult.verified && (
              <div className="text-right text-xs space-y-0.5 bg-canvas/60 dark:bg-dark-surface-elevated/70 px-3.5 py-2 rounded-xl border border-emerald-500/20">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-ink/50 dark:text-dark-ink/50 text-[11px]">Head Hash:</span>
                  <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 text-[11px]">
                    {integrityResult.headHash
                      ? `${integrityResult.headHash.slice(0, 10)}...${integrityResult.headHash.slice(-8)}`
                      : "Genesis"}
                  </span>
                </div>
                <div className="text-[10px] text-ink/40 dark:text-dark-ink/40">
                  Verified at {formatDateTime(integrityResult.verifiedAt)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPI Stats Chips Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-4 shadow-apple-card flex flex-col justify-between">
          <div className="text-xs text-ink/60 dark:text-dark-ink/60 font-medium flex items-center justify-between">
            <span>Total Events</span>
            <Shield className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-1">{stats?.total ?? allLogs.length}</div>
        </div>

        <div className="rounded-2xl border border-sky-500/25 bg-surface dark:bg-dark-surface p-4 shadow-apple-card flex flex-col justify-between">
          <div className="text-xs text-sky-700 dark:text-sky-400 font-medium flex items-center justify-between">
            <span>Auth / Logins</span>
            <KeyRound className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-1">{stats?.auth ?? 0}</div>
        </div>

        <div className="rounded-2xl border border-emerald-500/25 bg-surface dark:bg-dark-surface p-4 shadow-apple-card flex flex-col justify-between">
          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center justify-between">
            <span>Appointments</span>
            <CalendarDays className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-1">{stats?.appointments ?? 0}</div>
        </div>

        <div className="rounded-2xl border border-amber-500/25 bg-surface dark:bg-dark-surface p-4 shadow-apple-card flex flex-col justify-between">
          <div className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center justify-between">
            <span>Clinical / Doctors</span>
            <Stethoscope className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-1">{stats?.clinical ?? 0}</div>
        </div>

        <div className="rounded-2xl border border-purple-500/25 bg-surface dark:bg-dark-surface p-4 shadow-apple-card flex flex-col justify-between">
          <div className="text-xs text-purple-700 dark:text-purple-400 font-medium flex items-center justify-between">
            <span>Announcements</span>
            <Megaphone className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-1">{stats?.announcements ?? 0}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-5 shadow-apple-card space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-border-subtle dark:border-dark-border-subtle pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink/70 dark:text-dark-ink/70">
            <Filter className="w-3.5 h-3.5 text-accent" />
            <span>Search &amp; Scoping Parameters</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleApplyFilters}>Apply Filters</Button>
            {(appliedFilters.from || appliedFilters.to || appliedFilters.role || appliedFilters.status || appliedFilters.search) && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-ink/50 dark:text-dark-ink/50 hover:text-ink dark:hover:text-dark-ink flex items-center gap-1 transition-all ml-2"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {/* Free Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40 dark:text-dark-ink/40" />
            <input
              type="text"
              placeholder="Filter by actor name, user ID, or action..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle rounded-xl text-ink dark:text-dark-ink placeholder:text-ink/40 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={filters.role}
              onChange={(e) => handleFilterChange("role", e.target.value)}
              className="w-full px-3 py-2 text-xs bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle rounded-xl text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
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
              className="w-full px-3 py-2 text-xs bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle rounded-xl text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
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
              className="w-full px-2 py-2 text-xs bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle rounded-xl text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
              title="From date"
            />
            <input
              type="date"
              value={filters.to}
              onChange={(e) => handleFilterChange("to", e.target.value)}
              className="w-full px-2 py-2 text-xs bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle rounded-xl text-ink dark:text-dark-ink focus:outline-none focus:border-accent"
              title="To date"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card">
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
          <div className="space-y-3.5 text-xs">
            {/* Who & When */}
            <div className="grid grid-cols-2 gap-2 bg-canvas dark:bg-dark-surface-elevated p-3.5 rounded-xl border border-border-subtle dark:border-dark-border-subtle">
              <div>
                <span className="text-ink/50 dark:text-dark-ink/50 block text-[11px] mb-0.5">Actor (Who)</span>
                <span className="font-semibold text-ink dark:text-dark-ink">{inspectLog.user_name || "System"}</span>
                <span className="text-[11px] text-ink/50 dark:text-dark-ink/50 block mt-0.5">{inspectLog.role || "System"} (ID: {inspectLog.user_id || "N/A"})</span>
              </div>
              <div>
                <span className="text-ink/50 dark:text-dark-ink/50 block text-[11px] mb-0.5">Timestamp (When)</span>
                <span className="font-mono text-ink/80 dark:text-dark-ink/80 text-[11px]">{inspectLog.timestamp}</span>
              </div>
            </div>

            {/* From Where: IP & Device */}
            <div className="grid grid-cols-2 gap-2 bg-sky-500/10 dark:bg-sky-500/15 p-3.5 rounded-xl border border-sky-500/20">
              <div>
                <span className="text-sky-700 dark:text-sky-400 block text-[11px] font-medium flex items-center gap-1 mb-0.5">
                  <Globe className="w-3 h-3 text-sky-600 dark:text-sky-400" /> Origin IP Address
                </span>
                <span className="font-mono font-semibold text-sky-950 dark:text-sky-200 text-xs">
                  {inspectLog.ip_address || "127.0.0.1"}
                </span>
              </div>
              <div>
                <span className="text-sky-700 dark:text-sky-400 block text-[11px] font-medium mb-0.5">User Agent</span>
                <span className="font-mono text-[11px] text-sky-900/80 dark:text-sky-300/80 truncate block" title={inspectLog.user_agent}>
                  {inspectLog.user_agent || "Standard Browser Client"}
                </span>
              </div>
            </div>

            {/* What */}
            <div className="bg-canvas dark:bg-dark-surface-elevated p-3.5 rounded-xl border border-border-subtle dark:border-dark-border-subtle space-y-1">
              <span className="text-ink/50 dark:text-dark-ink/50 block text-[11px]">Action Description (What)</span>
              <p className="font-medium text-ink dark:text-dark-ink text-sm">{inspectLog.action}</p>
              <div className="flex items-center gap-3 pt-1 text-[11px] text-ink/60 dark:text-dark-ink/60">
                <span>Resource: <strong>{inspectLog.entity_type || "General"}</strong></span>
                {inspectLog.entity_id && <span>Reference: <strong className="font-mono">{inspectLog.entity_id}</strong></span>}
                <span>Status: <strong className="capitalize">{inspectLog.status || "success"}</strong></span>
              </div>
            </div>

            {/* Cryptographic Chain Proof */}
            <div className="bg-emerald-500/10 dark:bg-emerald-500/15 p-3.5 rounded-xl border border-emerald-500/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-emerald-900 dark:text-emerald-300 font-semibold text-xs flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Cryptographic Tamper-Proof Chain
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-mono px-2 py-0.5 rounded-full font-bold">
                  SHA-256
                </span>
              </div>
              <div className="space-y-1 text-[11px] font-mono">
                <div>
                  <span className="text-ink/50 dark:text-dark-ink/50 block text-[10px] mb-0.5">Previous Hash (prev_hash):</span>
                  <div className="p-2 bg-canvas dark:bg-dark-surface rounded-lg border border-emerald-500/20 break-all text-ink/75 dark:text-dark-ink/75">
                    {inspectLog.prev_hash || "0000000000000000000000000000000000000000000000000000000000000000 (GENESIS)"}
                  </div>
                </div>
                <div>
                  <span className="text-ink/50 dark:text-dark-ink/50 block text-[10px] mb-0.5">Row Signature Hash (hash):</span>
                  <div className="p-2 bg-canvas dark:bg-dark-surface rounded-lg border border-emerald-500/20 break-all text-emerald-700 dark:text-emerald-400 font-semibold">
                    {inspectLog.hash || "Not yet hashed"}
                  </div>
                </div>
              </div>
            </div>

            {/* Raw JSON */}
            <div className="bg-canvas dark:bg-dark-surface-elevated p-3.5 rounded-xl border border-border-subtle dark:border-dark-border-subtle">
              <span className="text-ink/50 dark:text-dark-ink/50 block text-[11px] mb-1">Raw Record Payload</span>
              <pre className="text-[10px] text-ink dark:text-dark-ink font-mono overflow-x-auto p-2 bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-lg max-h-36">
                {JSON.stringify(inspectLog, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
