import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Droplet, AlertTriangle, FileText, Stethoscope, Pill, FlaskConical, ScanLine, Activity } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import EmptyState from "../../components/ui/EmptyState";
import Avatar from "../../components/ui/Avatar";
import LoadingState from "../../components/ui/LoadingState";
import { useFetch } from "../../hooks/useFetch";
import { getPatientById } from "../../services/patientService";
import { getConsultations, getPrescriptions, getMedicalRecords } from "../../services/prescriptionService";
import { formatDate } from "../../constants";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "history", label: "Medical History" },
  { key: "consultations", label: "Consultations" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "labs", label: "Lab Results" },
  { key: "imaging", label: "Imaging" },
  { key: "treatment", label: "Treatment History" },
];

export default function DoctorPatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");

  const { data: patient, loading: pl } = useFetch(() => getPatientById(id), [id]);
  const { data: consults, loading: cl } = useFetch(() => getConsultations({ patientId: id }), [id]);
  const { data: rx, loading: rl } = useFetch(() => getPrescriptions({ patientId: id }), [id]);
  const { data: records, loading: ml } = useFetch(() => getMedicalRecords(id), [id]);

  if (pl || cl || rl || ml) return <LoadingState />;
  if (!patient) return <div className="card"><p className="text-ink/50">Patient not found.</p></div>;

  const toList = (val) => Array.isArray(val) ? val : (typeof val === 'string' && val ? [val] : []);
  const patientAge = patient.dob && !isNaN(new Date(patient.dob).getFullYear()) ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : "—";
  const allergiesList = toList(patient.allergies);
  const conditionsList = toList(patient.chronicConditions);
  const medicationsList = toList(patient.currentMedications);

  const labs = (records || []).filter((r) => r.type === "Lab Result");
  const imaging = (records || []).filter((r) => r.type === "Imaging");

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/doctor/patients")}>
        <ArrowLeft className="h-4 w-4" /> Back to patients
      </Button>

      <Card>
        <div className="flex items-center gap-4 flex-wrap">
          <Avatar name={patient.name} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-ink">{patient.name}</h2>
            <p className="text-sm text-ink/50">{patient.id}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Meta label="Age" value={patientAge} />
            <Meta label="Gender" value={patient.gender || "—"} />
            <Meta label="Blood Group" value={patient.bloodGroup || patient.blood_group || "—"} icon={<Droplet className="h-4 w-4 text-danger" />} />
            <Meta label="Allergies" value={allergiesList.join(", ") || "None"} icon={allergiesList.length ? <AlertTriangle className="h-4 w-4 text-accent" /> : null} />
          </div>
        </div>
      </Card>

      <div className="flex gap-2 border-b border-sage/30 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition " +
              (tab === t.key ? "border-primary text-primary" : "border-transparent text-ink/50 hover:text-ink")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === "overview" && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <Info label="Height" value={patient.height} />
            <Info label="Weight" value={patient.weight} />
            <Info label="Phone" value={patient.phone} />
            <Info label="Email" value={patient.email} />
            <Info label="Chronic Conditions" value={conditionsList.join(", ") || "None"} />
            <Info label="Medications" value={medicationsList.join(", ") || "None"} />
          </div>
        )}

        {tab === "history" && <Timeline patient={patient} consultations={consults} medicalRecords={records} />}

        {tab === "consultations" &&
          ((consults || []).length ? (
            <DataTable
              columns={[
                { key: "date", label: "Date", render: (r) => formatDate(r.date) },
                { key: "reason", label: "Reason" },
                { key: "diagnosis", label: "Diagnosis" },
                { key: "followUpDate", label: "Follow-up", render: (r) => formatDate(r.followUpDate) },
              ]}
              data={consults}
            />
          ) : (
            <EmptyState icon={Stethoscope} title="No consultations yet" />
          ))}

        {tab === "prescriptions" &&
          ((rx || []).length ? (
            <div className="space-y-3">
              {rx.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl bg-sage/10 border border-sage/20 p-3 hover:bg-sage/15 transition">
                  <Pill className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium text-ink text-sm">Rx #{p.id}</p>
                    <p className="text-xs text-ink/50">{(p.medications || []).length} meds · {formatDate(p.date)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Pill} title="No prescriptions" />
          ))}

        {tab === "labs" &&
          (labs.length ? (
            <DataTable columns={[{ key: "date", label: "Date", render: (r) => formatDate(r.date) }, { key: "description", label: "Report" }, { key: "doctor", label: "By" }]} data={labs} />
          ) : (
            <EmptyState icon={FlaskConical} title="No lab results" />
          ))}

        {tab === "imaging" &&
          (imaging.length ? (
            <DataTable columns={[{ key: "date", label: "Date", render: (r) => formatDate(r.date) }, { key: "description", label: "Study" }, { key: "doctor", label: "By" }]} data={imaging} />
          ) : (
            <EmptyState icon={ScanLine} title="No imaging studies" />
          ))}

        {tab === "treatment" && (
          <div className="space-y-3">
            {(consults || []).map((c) => (
              <div key={c.id} className="rounded-xl bg-sage/10 border border-sage/20 p-4 text-sm">
                <div className="flex justify-between">
                  <p className="font-medium text-ink">{c.diagnosis} <span className="text-ink/40">({c.diagnosisCode})</span></p>
                  <span className="text-ink/40">{formatDate(c.date)}</span>
                </div>
                <p className="text-ink/70 mt-1">{c.treatmentPlan}</p>
                <p className="text-ink/50 mt-1">Follow-up: {formatDate(c.followUpDate)} · {c.followUpInstructions}</p>
              </div>
            ))}
            {!(consults || []).length && <EmptyState icon={Activity} title="No treatment history" />}
          </div>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value, icon }) {
  return (
    <div>
      <p className="text-[11px] text-ink/50 flex items-center gap-1">{icon}{label}</p>
      <p className="text-sm font-medium text-ink mt-0.5">{value}</p>
    </div>
  );
}
function Info({ label, value }) {
  return (
    <div>
      <p className="text-ink/50 text-xs">{label}</p>
      <p className="text-ink font-medium mt-0.5">{value || "-"}</p>
    </div>
  );
}
function Timeline({ patient, consultations = [], medicalRecords = [] }) {
  const cList = Array.isArray(consultations) ? consultations : [];
  const mList = Array.isArray(medicalRecords) ? medicalRecords : [];
  const items = [
    ...cList.filter((c) => c && c.patientId === patient?.id).map((c) => ({ ...c, type: "Consultation", title: c.diagnosis, date: c.date })),
    ...mList.filter((r) => r && r.patientId === patient?.id).map((r) => ({ ...r, title: r.description })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!items.length) return <EmptyState icon={FileText} title="No history" />;
  return (
    <ol className="relative border-l-2 border-sage/30 ml-3 space-y-5">
      {items.map((it) => (
        <li key={it.id} className="ml-6">
          <span className="absolute -left-[13px] h-6 w-6 rounded-full bg-primary/10 ring-4 ring-white" />
          <p className="font-semibold text-ink text-sm">{it.type}</p>
          <p className="text-sm text-ink/70">{it.title}</p>
          <span className="text-xs text-ink/40">{formatDate(it.date)}</span>
        </li>
      ))}
    </ol>
  );
}
