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
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Clinic-wide overview, system diagnostics, and operational telemetry."
        action={
          <button
            onClick={handleDiagnosticsPing}
            disabled={pinging}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-sage/40 text-xs font-semibold text-ink shadow-sm hover:bg-sage/10 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${pinging ? "animate-spin" : ""}`} />
            Run Diagnostics Ping
          </button>
        }
      />

      {/* ── System Diagnostics & Platform Health Card ──────────────── */}
      {health && (
        <div className="bg-gradient-to-r from-primary/5 via-sage/10 to-accent/10 border border-primary/20 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">System Diagnostics & Telemetry</h3>
                <p className="text-[11px] text-ink/50">Real-time health of database, active streams, and server resources</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                health.status === "operational"
                  ? "bg-success/15 text-success border border-success/30"
                  : "bg-danger/15 text-danger border border-danger/30"
              }`}>
                <span className={`h-2 w-2 rounded-full ${health.status === "operational" ? "bg-success animate-pulse" : "bg-danger"}`} />
                {health.status === "operational" ? "Platform Operational" : "Service Degraded"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {/* Database Telemetry */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-sage/30">
              <div className="flex items-center gap-1.5 text-ink/50 mb-1">
                <Database className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium">PostgreSQL Latency</span>
              </div>
              <p className="text-base font-bold text-ink">
                {health.database?.latencyMs ?? "—"} <span className="text-xs font-normal text-ink/50">ms</span>
              </p>
              <p className="text-[10px] text-ink/40 mt-0.5">
                Pool: {health.database?.pool?.idleCount || 0} idle · {health.database?.pool?.totalCount || 0} total
              </p>
            </div>

            {/* Active Streams */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-sage/30">
              <div className="flex items-center gap-1.5 text-ink/50 mb-1">
                <Radio className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-medium">Active SSE Streams</span>
              </div>
              <p className="text-base font-bold text-ink">
                {health.activeSseStreams || 0} <span className="text-xs font-normal text-ink/50">live</span>
              </p>
              <p className="text-[10px] text-ink/40 mt-0.5">Real-time notification sockets</p>
            </div>

            {/* Memory Usage */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-sage/30">
              <div className="flex items-center gap-1.5 text-ink/50 mb-1">
                <Cpu className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-medium">Node Memory (Heap)</span>
              </div>
              <p className="text-base font-bold text-ink">
                {health.memory?.heapUsedMb || 0} <span className="text-xs font-normal text-ink/50">MB</span>
              </p>
              <p className="text-[10px] text-ink/40 mt-0.5">RSS: {health.memory?.rssMb || 0} MB</p>
            </div>

            {/* Uptime */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-sage/30">
              <div className="flex items-center gap-1.5 text-ink/50 mb-1">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span className="font-medium">Process Uptime</span>
              </div>
              <p className="text-base font-bold text-ink">
                {formatUptime(health.uptimeSeconds)}
              </p>
              <p className="text-[10px] text-ink/40 mt-0.5">Node {health.nodeVersion} on {health.platform}</p>
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
            <LineChart labels={analytics.patientRegistrations?.labels || []} data={analytics.patientRegistrations?.data || []} color="#3A8D5D" />
          </Card>
          <Card title="Consultation Trends">
            <LineChart labels={analytics.consultationTrends?.labels || []} data={analytics.consultationTrends?.data || []} color="#8FB9B2" />
          </Card>
          <Card title="Appointment Status">
            <DonutChart labels={analytics.appointmentStatus?.labels || []} data={analytics.appointmentStatus?.data || []} />
          </Card>
          <Card title="Patient Demographics">
            <DonutChart labels={analytics.patientDemographics?.labels || []} data={analytics.patientDemographics?.data || []}
              colors={["#2F6F68", "#8FB9B2", "#F4C95D", "#D9534F", "#3A8D5D"]} />
          </Card>
          <Card title="Doctor Workload">
            <BarChart labels={analytics.doctorWorkload?.labels || []} data={analytics.doctorWorkload?.data || []} color="#3A8D5D" />
          </Card>
        </div>
      )}
    </div>
  );
}
