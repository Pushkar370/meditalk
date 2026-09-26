import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/ui/PageHeader";
import LoadingState from "../../components/ui/LoadingState";
import EmptyState from "../../components/ui/EmptyState";
import { useFetch } from "../../hooks/useFetch";
import { getConsultations, getMedicalRecords } from "../../services/prescriptionService";
import { formatDate } from "../../constants";
import {
  Activity, Stethoscope, Pill, FileText, FlaskConical,
  ChevronDown, ChevronUp, Thermometer, Heart, Wind,
  Calendar, User, ClipboardList, AlertCircle,
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
    <div className="flex flex-col items-center bg-surface rounded-xl p-3 border border-sage/20 min-w-[80px]">
      <span className="text-xs text-ink/40 mb-1">{label}</span>
      <span className="text-sm font-bold text-ink">{value}</span>
      {unit && <span className="text-xs text-ink/30">{unit}</span>}
    </div>
  );
}

function ConsultationCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const vitals = typeof item.vitals === "string" ? JSON.parse(item.vitals || "{}") : (item.vitals || {});
  const hasVitals = Object.values(vitals).some(Boolean);
  const hasMeds = item.medications && item.medications.length > 0;

  return (
    <li className="ml-6">
      <span className="absolute -left-[15px] flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary ring-4 ring-background">
        <Stethoscope className="h-3.5 w-3.5" />
      </span>

      {/* Header */}
      <div
        className="card cursor-pointer hover:border-primary/30 transition-all"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Consultation</span>
              <span className="text-xs text-ink/30">{formatDate(item.date)}</span>
            </div>
            <p className="font-semibold text-ink mt-1 truncate">
              {item.diagnosis || item.reason || "General Consultation"}
            </p>
            {item.doctor_name && (
              <p className="text-xs text-ink/50 mt-0.5 flex items-center gap-1">
                <User className="h-3 w-3" /> Dr. {item.doctor_name}
              </p>
            )}
          </div>
          <button className="text-ink/30 hover:text-primary transition shrink-0">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Quick summary pills */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {item.diagnosis && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-xs text-blue-700">
              <ClipboardList className="h-3 w-3" /> {item.diagnosis}
            </span>
          )}
          {item.follow_up_date && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-100 text-xs text-green-700">
              <Calendar className="h-3 w-3" /> Follow-up: {item.follow_up_date}
            </span>
          )}
          {item.status && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sage/10 text-xs text-ink/50 capitalize">
              {item.status}
            </span>
          )}
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="mt-2 space-y-3 pl-1">
          {/* Vitals */}
          {hasVitals && (
            <div className="card">
              <p className="text-xs font-semibold text-ink/50 uppercase tracking-wider mb-3">Vital Signs</p>
              <div className="flex gap-2 flex-wrap">
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
                  <p className="text-xs font-semibold text-ink/50 uppercase tracking-wider mb-1">Symptoms</p>
                  <p className="text-sm text-ink/80">{item.symptoms}</p>
                </div>
              )}
              {item.observations && (
                <div>
                  <p className="text-xs font-semibold text-ink/50 uppercase tracking-wider mb-1">Doctor's Observations</p>
                  <p className="text-sm text-ink/80">{item.observations}</p>
                </div>
              )}
            </div>
          )}

          {/* Treatment Plan */}
          {item.treatment_plan && (
            <div className="card">
              <p className="text-xs font-semibold text-ink/50 uppercase tracking-wider mb-1">Treatment Plan</p>
              <p className="text-sm text-ink/80">{item.treatment_plan}</p>
            </div>
          )}

          {/* Follow-up */}
          {(item.follow_up_date || item.follow_up_instructions) && (
            <div className="card border-green-100 bg-green-50/50">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-green-700">Follow-Up Scheduled</p>
                  {item.follow_up_date && <p className="text-sm text-ink mt-0.5">{item.follow_up_date}</p>}
                  {item.follow_up_instructions && <p className="text-xs text-ink/60 mt-0.5">{item.follow_up_instructions}</p>}
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

  const { data: consultations, loading: cl } = useFetch(() => getConsultations({ patientId }), [patientId]);
  const { data: medicalRecords, loading: ml } = useFetch(() => getMedicalRecords(patientId), [patientId]);

  if (cl || ml) return <LoadingState />;

  const consultationItems = (consultations || []).map((c) => ({ ...c, type: "Consultation", date: c.date }));
  const recordItems = (medicalRecords || []).map((r) => ({ ...r, type: r.type || "Record", title: r.description }));
  const timeline = [...consultationItems, ...recordItems].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (timeline.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Medical History" subtitle="A chronological timeline of your care." />
        <div className="card"><EmptyState title="No history yet" message="Your consultations and records will appear here after your first visit." /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medical History"
        subtitle={`${consultationItems.length} consultation${consultationItems.length !== 1 ? "s" : ""} · ${recordItems.length} record${recordItems.length !== 1 ? "s" : ""}`}
      />
      <div className="card">
        <ol className="relative border-l-2 border-sage/30 ml-3 space-y-8">
          {timeline.map((item) => {
            if (item.type === "Consultation") {
              return <ConsultationCard key={item.id} item={item} />;
            }
            const Icon = ICONS[item.type] || FileText;
            return (
              <li key={item.id} className="ml-6">
                <span className="absolute -left-[15px] flex h-7 w-7 items-center justify-center rounded-full bg-sage/20 text-ink/60 ring-4 ring-background">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="card">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold text-ink">{item.type}</p>
                    <span className="text-xs text-ink/40">{formatDate(item.date)}</span>
                  </div>
                  <p className="text-sm text-ink/70 mt-1">{item.title || item.description}</p>
                  {item.doctor && <p className="text-xs text-ink/40 mt-0.5 flex items-center gap-1"><User className="h-3 w-3" /> {item.doctor}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

