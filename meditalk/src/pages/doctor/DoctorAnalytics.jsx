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
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Practice Analytics & Insights"
        subtitle="Clinical performance metrics, patient volume trends, and diagnostic patterns."
      />

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-4 flex items-center justify-between shadow-apple-card hover:shadow-apple-card-hover transition-all">
          <div>
            <p className="text-xs text-ink/50 dark:text-dark-ink/50 font-medium">Completed Visits</p>
            <p className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-0.5">{completed}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-4 flex items-center justify-between shadow-apple-card hover:shadow-apple-card-hover transition-all">
          <div>
            <p className="text-xs text-ink/50 dark:text-dark-ink/50 font-medium">Prescriptions</p>
            <p className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-0.5">{prescriptionsIssued}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-accent/10 dark:bg-accent/20 flex items-center justify-center text-accent">
            <Pill className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-4 flex items-center justify-between shadow-apple-card hover:shadow-apple-card-hover transition-all">
          <div>
            <p className="text-xs text-ink/50 dark:text-dark-ink/50 font-medium">Pending Refills</p>
            <p className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-0.5">{pendingRefills}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-4 flex items-center justify-between shadow-apple-card hover:shadow-apple-card-hover transition-all">
          <div>
            <p className="text-xs text-ink/50 dark:text-dark-ink/50 font-medium">Cancelled</p>
            <p className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink mt-0.5">{cancelled}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <CalendarX className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Diagnoses Given */}
        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-ink dark:text-dark-ink text-base tracking-tight">Top Clinical Diagnoses</h3>
                <p className="text-xs text-ink/50 dark:text-dark-ink/50">Aggregated from consultation SOAP entries</p>
              </div>
            </div>
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
                      <span className="font-semibold text-ink dark:text-dark-ink flex items-center gap-2.5">
                        <span className="h-5 w-5 rounded-full bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle text-ink/70 dark:text-dark-ink/70 flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        {d.diagnosis}
                      </span>
                      <span className="text-ink/60 dark:text-dark-ink/60 font-mono font-medium">
                        {d.count} {d.count === 1 ? "case" : "cases"}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-canvas dark:bg-dark-surface-elevated overflow-hidden border border-border-subtle/50 dark:border-dark-border-subtle/50">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-500"
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
        <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center">
                <BarChart2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-ink dark:text-dark-ink text-base tracking-tight">Monthly Consultation Trend</h3>
                <p className="text-xs text-ink/50 dark:text-dark-ink/50">Consultation volume over past 6 months</p>
              </div>
            </div>
          </div>

          {monthlyTrend.length === 0 ? (
            <EmptyState
              icon={BarChart2}
              title="No historical trend data"
              message="Monthly consultation distribution will be charted here."
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-6 gap-3 items-end h-44 pt-4 px-2 border-b border-border-subtle dark:border-dark-border-subtle">
                {monthlyTrend.map((m, idx) => {
                  const heightPct = Math.max(15, Math.round((m.count / maxMonthCount) * 100));
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end">
                      <span className="text-[10px] font-mono font-medium text-ink/60 dark:text-dark-ink/60">{m.count}</span>
                      <div
                        className="w-full max-w-[2.5rem] rounded-t-xl bg-accent hover:opacity-90 transition-all cursor-pointer relative group"
                        style={{ height: `${heightPct}%` }}
                      >
                        <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-ink dark:bg-dark-surface-elevated text-white dark:text-dark-ink text-[10px] py-1 px-2 rounded-lg shadow-lg whitespace-nowrap z-10 border border-white/10">
                          {m.completed} completed
                        </div>
                      </div>
                      <span className="text-[10px] text-ink/50 dark:text-dark-ink/50 font-medium whitespace-nowrap">{m.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-ink/60 dark:text-dark-ink/60 pt-2">
                <span>Month</span>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  <span>Total Bookings</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clinical Workflow & Adherence Intelligence */}
      <div className="bg-gradient-to-r from-canvas to-surface dark:from-dark-surface dark:to-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-6 shadow-apple-card">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-accent/10 dark:bg-accent/20 text-accent flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-ink dark:text-dark-ink text-sm tracking-tight">Practice Health & Attendance Retention</h4>
            <p className="text-xs text-ink/70 dark:text-dark-ink/70 leading-relaxed max-w-3xl">
              Automatic 24-hour and 2-hour transactional reminders via Resend email are active for all your appointments.
              Follow-up recommendations documented at the conclusion of consultations appear directly on patient dashboards for 1-click confirmation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
