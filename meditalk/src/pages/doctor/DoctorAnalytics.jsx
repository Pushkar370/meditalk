import { useState } from "react";
import {
  BarChart2,
  CalendarCheck2,
  CalendarX,
  Users,
  Pill,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import LoadingState from "../../components/ui/LoadingState";
import EmptyState from "../../components/ui/EmptyState";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { getDoctorAnalytics } from "../../services/appointmentService";

export default function DoctorAnalytics() {
  const { user } = useAuth();
  const doctorId = user?.id;

  const { data, loading } = useFetch(
    () => (doctorId ? getDoctorAnalytics(doctorId) : Promise.resolve(null)),
    [doctorId]
  );

  if (loading || !data) return <LoadingState />;

  const { summary = {}, topDiagnoses = [], monthlyTrend = [] } = data;

  const total = summary.total || 0;
  const completed = summary.completed || 0;
  const upcoming = summary.upcoming || 0;
  const cancelled = summary.cancelled || 0;
  const noShow = summary.noShow || 0;
  const noShowRate = summary.noShowRate || 0;
  const completionRate = summary.completionRate || 0;
  const uniquePatients = summary.uniquePatients || 0;
  const prescriptionsIssued = summary.prescriptionsIssued || 0;
  const pendingRefills = summary.pendingRefills || 0;

  const maxDiagCount = topDiagnoses.length > 0 ? Math.max(...topDiagnoses.map((d) => d.count), 1) : 1;
  const maxMonthCount = monthlyTrend.length > 0 ? Math.max(...monthlyTrend.map((m) => m.count), 1) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Practice Analytics & Insights"
        subtitle="Clinical performance metrics, patient volume trends, and diagnostic patterns."
      />

      {/* KPI Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Stethoscope}
          label="Total Consultations"
          value={total}
          tone="primary"
          sub={`${completionRate}% completion rate`}
        />
        <StatCard
          icon={CalendarCheck2}
          label="Upcoming Scheduled"
          value={upcoming}
          tone="accent"
          sub="Active queue & upcoming"
        />
        <StatCard
          icon={CalendarX}
          label="No-Show Rate"
          value={`${noShowRate}%`}
          tone={noShowRate > 15 ? "danger" : "sage"}
          sub={`${noShow} missed appointments`}
        />
        <StatCard
          icon={Users}
          label="Unique Patients"
          value={uniquePatients}
          tone="success"
          sub="Patient roster"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-ink/50 font-medium">Completed Visits</p>
            <p className="text-xl font-bold text-ink mt-0.5">{completed}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-success/15 flex items-center justify-center text-success">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-ink/50 font-medium">Prescriptions Issued</p>
            <p className="text-xl font-bold text-ink mt-0.5">{prescriptionsIssued}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
            <Pill className="h-5 w-5" />
          </div>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-ink/50 font-medium">Pending Refills</p>
            <p className="text-xl font-bold text-ink mt-0.5">{pendingRefills}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-ink/50 font-medium">Cancelled by Patient/Doctor</p>
            <p className="text-xl font-bold text-ink mt-0.5">{cancelled}</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-600">
            <CalendarX className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Diagnoses Given */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-ink text-base">Top 5 Clinical Diagnoses</h3>
            </div>
            <span className="text-xs text-ink/50">From consultation records</span>
          </div>

          {topDiagnoses.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="No diagnostic records yet"
              message="Diagnoses documented during consultations will automatically appear here."
            />
          ) : (
            <div className="space-y-4">
              {topDiagnoses.map((d, idx) => {
                const pct = Math.round((d.count / maxDiagCount) * 100);
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full bg-sage/20 text-ink/70 flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        {d.diagnosis}
                      </span>
                      <span className="text-ink/60 font-mono font-medium">
                        {d.count} {d.count === 1 ? "case" : "cases"}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-sage/20 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Volume Trend (Last 6 Months) */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-ink text-base">Monthly Consultation Trend</h3>
            </div>
            <span className="text-xs text-ink/50">Past 6 months</span>
          </div>

          {monthlyTrend.length === 0 ? (
            <EmptyState
              icon={BarChart2}
              title="No historical trend data"
              message="Monthly consultation distribution will be charted here."
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-6 gap-2 items-end h-40 pt-4 px-2 border-b border-sage/20">
                {monthlyTrend.map((m, idx) => {
                  const heightPct = Math.max(15, Math.round((m.count / maxMonthCount) * 100));
                  return (
                    <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="text-[10px] font-mono text-ink/60">{m.count}</span>
                      <div
                        className="w-full max-w-[2.25rem] rounded-t-lg bg-primary hover:bg-primary/90 transition-all cursor-pointer relative group"
                        style={{ height: `${heightPct}%` }}
                      >
                        <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-ink text-white text-[10px] py-0.5 px-1.5 rounded shadow whitespace-nowrap z-10">
                          {m.completed} completed
                        </div>
                      </div>
                      <span className="text-[10px] text-ink/50 whitespace-nowrap">{m.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-ink/60 pt-1">
                <span>Month (YYYY-MM)</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-primary" /> Total Bookings
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clinical Workflow & Adherence Intelligence */}
      <div className="card p-5 bg-gradient-to-r from-sage/10 via-white to-primary/5 border border-sage/30">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-ink text-sm">Practice Health & Attendance Retention</h4>
            <p className="text-xs text-ink/70 max-w-3xl">
              Automatic 24-hour and 2-hour transactional reminders via Resend email are active for all your appointments.
              Follow-up recommendations documented at the conclusion of consultations appear directly on patient dashboards for 1-click confirmation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
