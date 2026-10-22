import { useState, useEffect, useRef } from "react";
import { Users, UserCheck, CalendarDays, CheckCircle2, XCircle, Clock, Activity, Cpu, Database, Radio, RefreshCw } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Card from "../../components/ui/Card";
import LoadingState from "../../components/ui/LoadingState";
import { BarChart, LineChart, DonutChart } from "../../components/charts/Charts";
import { useFetch } from "../../hooks/useFetch";
import { getDashboardStats, getAnalytics, getSystemHealth } from "../../services/adminService";

export default function AdminDashboard() {
  const { data: stats, loading, reload: reloadStats } = useFetch(() => getDashboardStats("admin"));
  const { data: analytics, reload: reloadAnalytics } = useFetch(() => getAnalytics());
  const { data: health, loading: healthLoading, reload: reloadHealth } = useFetch(() => getSystemHealth());
  const [pinging, setPinging] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Auto-refresh stats & health every 60 seconds
    intervalRef.current = setInterval(() => {
      reloadStats();
      reloadAnalytics();
      reloadHealth();
    }, 60_000);
    return () => clearInterval(intervalRef.current);
  }, [reloadStats, reloadAnalytics, reloadHealth]);

  async function handleDiagnosticsPing() {
    setPinging(true);
    await reloadHealth();
    setTimeout(() => setPinging(false), 400);
  }

  if (loading || !stats) return <LoadingState />;

  function formatUptime(seconds) {
    if (!seconds) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Admin Overview"
        subtitle="Clinic-wide operational performance, system telemetry, and appointment distributions."
        action={
          <button
            onClick={handleDiagnosticsPing}
            disabled={pinging}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle text-xs font-semibold text-ink dark:text-dark-ink shadow-sm hover:bg-canvas dark:hover:bg-dark-surface-elevated transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-accent ${pinging ? "animate-spin" : ""}`} />
            Run Diagnostics Ping
          </button>
        }
      />

      {/* ── System Diagnostics & Platform Health Card ──────────────── */}
      {health && (
        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-5 sm:p-6 shadow-apple-card">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent/10 dark:bg-accent/20 flex items-center justify-center text-accent shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-tight text-ink dark:text-dark-ink">System Diagnostics & Telemetry</h3>
                <p className="text-xs text-ink/50 dark:text-dark-ink/50">Real-time health of database connection pool, active event streams, and host memory</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                health.status === "operational"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30"
              }`}>
                <span className={`h-2 w-2 rounded-full ${health.status === "operational" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                {health.status === "operational" ? "Platform Operational" : "Service Degraded"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Database Telemetry */}
            <div className="bg-canvas dark:bg-dark-surface-elevated/70 rounded-xl p-3.5 border border-border-subtle dark:border-dark-border-subtle">
              <div className="flex items-center gap-1.5 text-ink/50 dark:text-dark-ink/50 mb-1.5">
                <Database className="w-3.5 h-3.5 text-accent" />
                <span className="font-medium">PostgreSQL Latency</span>
              </div>
              <p className="text-xl font-bold tracking-tight text-ink dark:text-dark-ink">
                {health.database?.latencyMs ?? "—"} <span className="text-xs font-normal text-ink/50 dark:text-dark-ink/50">ms</span>
              </p>
              <p className="text-[10px] text-ink/40 dark:text-dark-ink/40 mt-1">
                Pool: {health.database?.pool?.idleCount || 0} idle · {health.database?.pool?.totalCount || 0} total
              </p>
            </div>

            {/* Active Streams */}
            <div className="bg-canvas dark:bg-dark-surface-elevated/70 rounded-xl p-3.5 border border-border-subtle dark:border-dark-border-subtle">
              <div className="flex items-center gap-1.5 text-ink/50 dark:text-dark-ink/50 mb-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium">Active SSE Streams</span>
              </div>
              <p className="text-xl font-bold tracking-tight text-ink dark:text-dark-ink">
                {health.activeSseStreams || 0} <span className="text-xs font-normal text-ink/50 dark:text-dark-ink/50">live</span>
              </p>
              <p className="text-[10px] text-ink/40 dark:text-dark-ink/40 mt-1">Real-time telemetry broadcast</p>
            </div>

            {/* Memory Usage */}
            <div className="bg-canvas dark:bg-dark-surface-elevated/70 rounded-xl p-3.5 border border-border-subtle dark:border-dark-border-subtle">
              <div className="flex items-center gap-1.5 text-ink/50 dark:text-dark-ink/50 mb-1.5">
                <Cpu className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-medium">Heap Memory</span>
              </div>
              <p className="text-xl font-bold tracking-tight text-ink dark:text-dark-ink">
                {health.memory?.heapUsedMb || 0} <span className="text-xs font-normal text-ink/50 dark:text-dark-ink/50">MB</span>
              </p>
              <p className="text-[10px] text-ink/40 dark:text-dark-ink/40 mt-1">RSS: {health.memory?.rssMb || 0} MB</p>
            </div>

            {/* Uptime */}
            <div className="bg-canvas dark:bg-dark-surface-elevated/70 rounded-xl p-3.5 border border-border-subtle dark:border-dark-border-subtle">
              <div className="flex items-center gap-1.5 text-ink/50 dark:text-dark-ink/50 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-medium">Process Uptime</span>
              </div>
              <p className="text-xl font-bold tracking-tight text-ink dark:text-dark-ink">
                {formatUptime(health.uptimeSeconds)}
              </p>
              <p className="text-[10px] text-ink/40 dark:text-dark-ink/40 mt-1">Node {health.nodeVersion} on {health.platform}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Core KPI Chips ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total Patients" value={stats.totalPatients} tone="primary" />
        <StatCard icon={UserCheck} label="Total Doctors" value={stats.totalDoctors} tone="sage" />
        <StatCard icon={CalendarDays} label="Today's Appointments" value={stats.todayAppointments} tone="accent" />
        <StatCard icon={CheckCircle2} label="Completed Consultations" value={stats.completedConsultations} tone="success" />
        <StatCard icon={XCircle} label="Cancelled Appointments" value={stats.cancelledAppointments} tone="danger" />
        <StatCard icon={Clock} label="Pending Appointments" value={stats.pendingAppointments} tone="accent" />
      </div>

      {analytics && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card title="Appointment Trends">
            <BarChart labels={analytics.appointmentTrends?.labels || []} data={analytics.appointmentTrends?.data || []} />
          </Card>
          <Card title="Patient Registrations">
            <LineChart labels={analytics.patientRegistrations?.labels || []} data={analytics.patientRegistrations?.data || []} color="#2F6F68" />
          </Card>
          <Card title="Consultation Trends">
            <LineChart labels={analytics.consultationTrends?.labels || []} data={analytics.consultationTrends?.data || []} color="#0071E3" />
          </Card>
          <Card title="Appointment Status">
            <DonutChart labels={analytics.appointmentStatus?.labels || []} data={analytics.appointmentStatus?.data || []} />
          </Card>
          <Card title="Patient Demographics">
            <DonutChart labels={analytics.patientDemographics?.labels || []} data={analytics.patientDemographics?.data || []}
              colors={["#0071E3", "#2F6F68", "#F4C95D", "#D9534F", "#3A8D5D"]} />
          </Card>
          <Card title="Doctor Workload">
            <BarChart labels={analytics.doctorWorkload?.labels || []} data={analytics.doctorWorkload?.data || []} color="#0071E3" />
          </Card>
        </div>
      )}
    </div>
  );
}
