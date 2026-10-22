import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/ui/PageHeader";
import LoadingState from "../../components/ui/LoadingState";
import EmptyState from "../../components/ui/EmptyState";
import { useFetch } from "../../hooks/useFetch";
import { getConsultations, getMedicalRecords } from "../../services/prescriptionService";
import { formatDate } from "../../constants";
import {
  Activity,
  Stethoscope,
  Pill,
  FileText,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Thermometer,
  Heart,
  Wind,
  Calendar,
  User,
  ClipboardList,
  AlertCircle,
} from "lucide-react";

const ICONS = {
  Consultation: Stethoscope,
  "Lab Result": FlaskConical,
  Prescription: Pill,
  "Vital Signs": Activity,
};

function VitalBadge({ label, value, unit }) {
  if (!value) return null;
  return (
    <div className="flex flex-col items-center bg-canvas dark:bg-dark-surface-elevated/40 rounded-2xl p-3.5 border border-border-subtle dark:border-dark-border-subtle min-w-[85px]">
      <span className="text-[11px] font-medium text-ink/50 dark:text-dark-ink/50 mb-1">
        {label}
      </span>
      <span className="text-base font-bold text-ink dark:text-dark-ink tracking-tight">
        {value}
      </span>
      {unit && (
        <span className="text-[10px] text-ink/40 dark:text-dark-ink/40 mt-0.5">
          {unit}
        </span>
      )}
    </div>
  );
}

function ConsultationCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const vitals =
    typeof item.vitals === "string"
      ? JSON.parse(item.vitals || "{}")
      : item.vitals || {};
  const hasVitals = Object.values(vitals).some(Boolean);

  return (
    <li className="ml-8 relative">
      <span className="absolute -left-[27px] flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light ring-4 ring-canvas dark:ring-dark-canvas">
        <Stethoscope className="h-4 w-4" />
      </span>

      {/* Header Card */}
      <div
        className="card cursor-pointer hover:border-primary/30 transition-all duration-200"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-primary dark:text-primary-light uppercase tracking-wider">
                Clinical Consultation
              </span>
              <span className="text-xs text-ink/40 dark:text-dark-ink/40">
                {formatDate(item.date)}
              </span>
            </div>
            <p className="font-semibold text-ink dark:text-dark-ink text-base mt-1 truncate">
              {item.diagnosis || item.reason || "General Consultation"}
            </p>
            {item.doctor_name && (
              <p className="text-xs text-ink/60 dark:text-dark-ink/60 mt-1 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" /> Dr. {item.doctor_name}
              </p>
            )}
          </div>
          <button
            type="button"
            className="text-ink/40 dark:text-dark-ink/40 hover:text-primary transition shrink-0 p-1"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Quick summary pills */}
        <div className="flex gap-2 mt-3.5 flex-wrap">
          {item.diagnosis && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-xs text-sky-700 dark:text-sky-300 font-medium">
              <ClipboardList className="h-3.5 w-3.5" /> {item.diagnosis}
            </span>
          )}
          {item.follow_up_date && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              <Calendar className="h-3.5 w-3.5" /> Follow-up: {item.follow_up_date}
            </span>
          )}
          {item.status && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-canvas dark:bg-dark-surface-elevated text-xs text-ink/60 dark:text-dark-ink/60 border border-border-subtle dark:border-dark-border-subtle capitalize font-medium">
              {item.status}
            </span>
          )}
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="mt-3 space-y-3 pl-1 animate-fade-in">
          {/* Vitals Telemetry */}
          {hasVitals && (
            <div className="card">
              <p className="text-xs font-semibold text-ink/60 dark:text-dark-ink/60 uppercase tracking-wider mb-3">
                Biometric Vitals Recorded
              </p>
              <div className="flex gap-2.5 flex-wrap">
                <VitalBadge label="Blood Pressure" value={vitals.bp} unit="mmHg" />
                <VitalBadge label="Heart Rate" value={vitals.hr} unit="bpm" />
                <VitalBadge label="Temperature" value={vitals.temp} unit="°C" />
                <VitalBadge label="SpO₂" value={vitals.spo2} unit="%" />
                <VitalBadge label="Weight" value={vitals.weight} unit="kg" />
              </div>
            </div>
          )}

          {/* Symptoms & Observations */}
          {(item.symptoms || item.observations) && (
            <div className="card space-y-3">
              {item.symptoms && (
                <div>
                  <p className="text-xs font-semibold text-ink/60 dark:text-dark-ink/60 uppercase tracking-wider mb-1">
                    Reported Symptoms
                  </p>
                  <p className="text-sm text-ink/80 dark:text-dark-ink/80 leading-relaxed">
                    {item.symptoms}
                  </p>
                </div>
              )}
              {item.observations && (
                <div>
                  <p className="text-xs font-semibold text-ink/60 dark:text-dark-ink/60 uppercase tracking-wider mb-1">
                    Physician Observations
                  </p>
                  <p className="text-sm text-ink/80 dark:text-dark-ink/80 leading-relaxed">
                    {item.observations}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Treatment Plan */}
          {item.treatment_plan && (
            <div className="card">
              <p className="text-xs font-semibold text-ink/60 dark:text-dark-ink/60 uppercase tracking-wider mb-1">
                Treatment Plan & Clinical Notes
              </p>
              <p className="text-sm text-ink/80 dark:text-dark-ink/80 leading-relaxed">
                {item.treatment_plan}
              </p>
            </div>
          )}

          {/* Follow-up */}
          {(item.follow_up_date || item.follow_up_instructions) && (
            <div className="card border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10">
              <div className="flex items-start gap-2.5">
                <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Follow-Up Consultation Scheduled
                  </p>
                  {item.follow_up_date && (
                    <p className="text-sm font-semibold text-ink dark:text-dark-ink">
                      {item.follow_up_date}
                    </p>
                  )}
                  {item.follow_up_instructions && (
                    <p className="text-xs text-ink/70 dark:text-dark-ink/70">
                      {item.follow_up_instructions}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function PatientHistory() {
  const { user } = useAuth();
  const patientId = user?.id;

  const { data: consultations, loading: cl } = useFetch(
    () => getConsultations({ patientId }),
    [patientId]
  );
  const { data: medicalRecords, loading: ml } = useFetch(
    () => getMedicalRecords(patientId),
    [patientId]
  );

  if (cl || ml) return <LoadingState />;

  const consultationItems = (consultations || []).map((c) => ({
    ...c,
    type: "Consultation",
    date: c.date,
  }));
  const recordItems = (medicalRecords || []).map((r) => ({
    ...r,
    type: r.type || "Record",
    title: r.description,
  }));
  const timeline = [...consultationItems, ...recordItems].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  if (timeline.length === 0) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader
          title="Medical History"
          subtitle="A chronological timeline of your clinical care and health records."
        />
        <div className="card py-12">
          <EmptyState
            title="No medical history yet"
            message="Your consultations, lab reports, and records will appear here as your care progresses."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Medical History"
        subtitle={`${consultationItems.length} consultation${
          consultationItems.length !== 1 ? "s" : ""
        } · ${recordItems.length} record${recordItems.length !== 1 ? "s" : ""}`}
      />

      <div className="card p-6 sm:p-8">
        <ol className="relative border-l border-border-subtle dark:border-dark-border-subtle ml-3 space-y-8">
          {timeline.map((item) => {
            if (item.type === "Consultation") {
              return <ConsultationCard key={item.id} item={item} />;
            }
            const Icon = ICONS[item.type] || FileText;
            return (
              <li key={item.id} className="ml-8 relative">
                <span className="absolute -left-[27px] flex h-8 w-8 items-center justify-center rounded-full bg-canvas dark:bg-dark-surface-elevated text-ink/50 dark:text-dark-ink/50 border border-border-subtle dark:border-dark-border-subtle ring-4 ring-canvas dark:ring-dark-canvas">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="card">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold text-ink dark:text-dark-ink text-sm">
                      {item.type}
                    </p>
                    <span className="text-xs text-ink/40 dark:text-dark-ink/40">
                      {formatDate(item.date)}
                    </span>
                  </div>
                  <p className="text-sm text-ink/75 dark:text-dark-ink/75 mt-1 leading-relaxed">
                    {item.title || item.description}
                  </p>
                  {item.doctor && (
                    <p className="text-xs text-ink/50 dark:text-dark-ink/50 mt-1.5 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> Dr. {item.doctor}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
