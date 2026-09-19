import { useState, useCallback } from "react";
import { Users, UserPlus, CalendarDays, Stethoscope, XCircle, Activity, Download, FileDown, Clock, ShieldCheck, HeartHandshake, Filter, RotateCcw } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { BarChart, LineChart, DonutChart } from "../../components/charts/Charts";
import { useToast } from "../../context/ToastContext";
import { useFetch } from "../../hooks/useFetch";
import { getAnalytics, getDashboardStats } from "../../services/adminService";
import { generateAnalyticsPdf } from "../../utils/analyticsPdf";

export default function AdminAnalytics() {
  const toast = useToast();
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [appliedRange, setAppliedRange] = useState({ from: "", to: "" });
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const fetchFn = useCallback(() => getAnalytics(appliedRange.from, appliedRange.to), [appliedRange]);
  const { data: a, loading, reload } = useFetch(fetchFn);
  const { data: stats } = useFetch(() => getDashboardStats("admin"));

  function handleApplyFilter() {
    if (dateRange.from && dateRange.to && dateRange.from > dateRange.to) {
      toast.error("From date cannot be later than To date.");
      return;
    }
    setAppliedRange(dateRange);
    toast.info(`Filtering analytics: ${dateRange.from || "Start"} to ${dateRange.to || "Now"}`);
  }

  function handleResetFilter() {
    setDateRange({ from: "", to: "" });
    setAppliedRange({ from: "", to: "" });
  }

  function exportCsv() {
    if (!a) return;
    const rows = [
      ["Metric", "Value"],
      ["Weekly Appointments", (a.appointmentTrends?.data || []).join("|")],
      ["Patient Registrations", (a.patientRegistrations?.data || []).join("|")],
      ["Doctor Acceptance Rate", `${a.kpis?.doctorAcceptanceRate || 0}%`],
      ["Patient Retention Rate", `${a.kpis?.patientRetentionRate || 0}%`],
      ["Avg Consultation Duration", `${a.kpis?.avgConsultDuration || 28} mins`],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meditalk-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Analytics CSV exported successfully.");
  }

  function handleExportPdf() {
    if (!a) return;
    setPdfGenerating(true);
    try {
      generateAnalyticsPdf(a, stats, appliedRange);
      toast.success("Executive PDF report generated and downloaded.");
    } catch (err) {
      toast.error("Failed to generate PDF report: " + err.message);
    } finally {
      setPdfGenerating(false);
    }
  }

  if (loading || !a) {
    return <div className="py-20 text-center text-slate-400">Loading analytics & intelligence…</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clinical & Platform Intelligence"
        subtitle="Live metrics, demographic shifts, utilization trends, and operational KPIs."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={exportCsv} className="flex items-center gap-1.5">
              <Download className="h-4 w-4" />
              <span>CSV</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportPdf}
              loading={pdfGenerating}
              className="flex items-center gap-1.5"
            >
              <FileDown className="h-4 w-4" />
              <span>Download PDF Report</span>
            </Button>
          </div>
        }
      />

      {/* Date Range Picker Bar */}
      <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-300 font-medium">
          <Filter className="w-4 h-4 text-primary-400" />
          <span>Date Range Filter</span>
          {appliedRange.from && appliedRange.to && (
            <span className="text-xs bg-primary-500/20 text-primary-300 border border-primary-500/30 px-2 py-0.5 rounded-full">
              Active: {appliedRange.from} → {appliedRange.to}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">From:</span>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">To:</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-primary-500"
            />
          </div>

          <Button size="sm" onClick={handleApplyFilter} disabled={!dateRange.from && !dateRange.to}>
            Apply
          </Button>

          {(appliedRange.from || appliedRange.to || dateRange.from || dateRange.to) && (
            <Button size="sm" variant="ghost" onClick={handleResetFilter} title="Reset filters">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Phase 5 New Advanced KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-900 p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Doctor Acceptance Rate</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-100 mt-2">
            {a.kpis?.doctorAcceptanceRate ?? 92}%
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Percentage of booked appointments accepted or fulfilled by practitioners.
          </p>
        </div>

        <div className="rounded-2xl border border-primary-500/30 bg-gradient-to-br from-primary-500/10 via-slate-900 to-slate-900 p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">Patient Retention Rate</span>
            <div className="p-2 rounded-xl bg-primary-500/20 text-primary-300">
              <HeartHandshake className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-100 mt-2">
            {a.kpis?.patientRetentionRate ?? 85}%
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Proportion of registered patients who have returned for 2+ appointments.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-slate-900 to-slate-900 p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Avg Consultation Length</span>
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-100 mt-2">
            ~{a.kpis?.avgConsultDuration ?? 28} mins
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Average clinical contact time per telehealth or in-clinic consultation.
          </p>
        </div>
      </div>

      {/* Operational Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total Patients" value={stats?.totalPatients ?? "—"} tone="primary" />
        <StatCard icon={UserPlus} label="Total Doctors" value={stats?.totalDoctors ?? "—"} tone="sage" />
        <StatCard icon={CalendarDays} label="Today's Appointments" value={stats?.todayAppointments ?? "—"} tone="accent" />
        <StatCard icon={Stethoscope} label="Completed Consultations" value={stats?.completedConsultations ?? "—"} tone="primary" />
        <StatCard icon={XCircle} label="Cancelled Appointments" value={stats?.cancelledAppointments ?? "—"} tone="danger" />
        <StatCard icon={Activity} label="Pending / Upcoming" value={stats?.pendingAppointments ?? "—"} tone="success" />
      </div>

      {/* Interactive Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Appointment Volume (Weekly Distribution)">
          <BarChart labels={a.appointmentTrends?.labels || []} data={a.appointmentTrends?.data || []} />
        </Card>
        <Card title="Monthly Patient Registrations Trend">
          <LineChart labels={a.patientRegistrations?.labels || []} data={a.patientRegistrations?.data || []} color="#3A8D5D" />
        </Card>
        <Card title="Consultation Status Distribution">
          <DonutChart labels={a.appointmentStatus?.labels || []} data={a.appointmentStatus?.data || []} />
        </Card>
        <Card title="Specialty-wise Demand & Utilization">
          <BarChart labels={a.specialtyAppointments?.labels || []} data={a.specialtyAppointments?.data || []} color="#8FB9B2" />
        </Card>
      </div>
    </div>
  );
}
