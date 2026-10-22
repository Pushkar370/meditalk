import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Droplet,
  AlertTriangle,
  FileText,
  Stethoscope,
  Pill,
  FlaskConical,
  ScanLine,
  Activity,
  Sparkles,
  Building2,
  Check,
  ShieldCheck,
  Calendar,
} from "lucide-react";
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
import {
  getConsultations,
  getPrescriptions,
  getMedicalRecords,
  adoptAiRecords,
} from "../../services/prescriptionService";
import { formatDate } from "../../constants";
import { useToast } from "../../context/ToastContext";

const BASE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "history", label: "Medical History" },
  { key: "consultations", label: "Consultations & Care Plans" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "labs", label: "Lab Results" },
  { key: "imaging", label: "Imaging" },
];

export default function DoctorPatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [adopting, setAdopting] = useState(false);
  const [adopted, setAdopted] = useState(false);

  const { data: patient, loading: pl, reload: reloadPatient } = useFetch(
    () => getPatientById(id),
    [id]
  );
  const { data: consults, loading: cl } = useFetch(
    () => getConsultations({ patientId: id }),
    [id]
  );
  const { data: rx, loading: rl } = useFetch(
    () => getPrescriptions({ patientId: id }),
    [id]
  );
  const { data: records, loading: ml } = useFetch(
    () => getMedicalRecords(id),
    [id]
  );

  if (pl || cl || rl || ml) return <LoadingState />;
  if (!patient)
    return (
      <div className="card text-center py-12">
        <p className="text-ink/50 dark:text-dark-ink/50">Patient record not found.</p>
      </div>
    );

  const toList = (val) =>
    Array.isArray(val)
      ? val
      : typeof val === "string" && val
      ? [val]
      : [];
  const patientAge =
    patient.dob && !isNaN(new Date(patient.dob).getFullYear())
      ? new Date().getFullYear() - new Date(patient.dob).getFullYear()
      : "—";
  const allergiesList = toList(patient.allergies);
  const conditionsList = toList(patient.chronicConditions);
  const medicationsList = toList(patient.currentMedications);

  const labs = (records || []).filter((r) => r.type === "Lab Result");
  const imaging = (records || []).filter((r) => r.type === "Imaging");
  const priorRecords = (records || []).filter(
    (r) =>
      r.isExternalClinic ||
      r.is_external_clinic ||
      r.aiSummary ||
      r.ai_summary ||
      r.aiProcessedAt ||
      r.ai_processed_at
  );

  const tabs = [
    ...BASE_TABS,
    ...(priorRecords.length > 0
      ? [{ key: "priorRecords", label: `Prior Records (${priorRecords.length})` }]
      : []),
  ];

  async function handleAdoptPrior(rec) {
    if (!rec) return;
    setAdopting(true);
    try {
      const allergies = (
        rec.extractedAllergies ||
        rec.extracted_allergies ||
        []
      ).map((a) => (typeof a === "string" ? a : a.allergen));
      const medications =
        rec.extractedMedications || rec.extracted_medications || [];
      await adoptAiRecords(id, { allergies, medications });
      toast.success("Adopted prior allergies and medications into patient chart.");
      setAdopted(true);
      reloadPatient();
    } catch (err) {
      toast.error(err.message || "Failed to adopt prior records.");
    } finally {
      setAdopting(false);
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/doctor/patients")}
          className="text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to patients
        </Button>
        <Button
          size="sm"
          onClick={() => navigate(`/doctor/consultation/${id}`)}
          className="text-xs"
        >
          <Stethoscope className="h-3.5 w-3.5 mr-1.5" /> Start Consultation
        </Button>
      </div>

      {/* Patient Profile Card */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar name={patient.name} size="lg" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-ink dark:text-dark-ink">
                {patient.name}
              </h2>
              <p className="text-xs text-ink/50 dark:text-dark-ink/50 mt-0.5 font-mono">
                #{patient.id}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle text-xs">
            <Meta label="Age" value={patientAge} />
            <Meta label="Gender" value={patient.gender || "—"} />
            <Meta
              label="Blood Group"
              value={patient.bloodGroup || patient.blood_group || "—"}
              icon={<Droplet className="h-3.5 w-3.5 text-rose-500" />}
            />
            <Meta
              label="Allergies"
              value={allergiesList.join(", ") || "None"}
              icon={
                allergiesList.length ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                ) : null
              }
              alert={allergiesList.length > 0}
            />
          </div>
        </div>
      </Card>

      {/* Apple Segmented Tabs */}
      <div className="flex p-1 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/60 border border-border-subtle dark:border-dark-border-subtle w-fit max-w-full overflow-x-auto scrollbar-none">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 shrink-0 ${
                active
                  ? "bg-surface dark:bg-dark-surface text-ink dark:text-dark-ink shadow-sm"
                  : "text-ink/50 dark:text-dark-ink/50 hover:text-ink dark:hover:text-dark-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="card">
        {tab === "overview" && (
          <div className="space-y-6">
            {priorRecords.length > 0 && (
              <div className="p-5 rounded-2xl border border-primary/20 dark:border-primary/30 bg-canvas dark:bg-dark-surface-elevated/40 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-ink dark:text-dark-ink text-sm">
                          Prior Clinic Records Intelligence
                        </h4>
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light">
                          {priorRecords.length} Record
                          {priorRecords.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="text-xs text-ink/60 dark:text-dark-ink/60 mt-0.5">
                        AI synthesized history from previous medical facility (
                        {priorRecords[0].externalFacilityName ||
                          priorRecords[0].external_facility_name ||
                          "External Facility"}
                        ).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      loading={adopting}
                      onClick={() => handleAdoptPrior(priorRecords[0])}
                      className="text-xs"
                    >
                      {adopted ? (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" />
                      )}
                      {adopted ? "Adopted into Chart" : "Adopt Allergies & Meds"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setTab("priorRecords")}
                      className="text-xs text-primary dark:text-primary-light"
                    >
                      View Details →
                    </Button>
                  </div>
                </div>
                {(priorRecords[0].aiSummary || priorRecords[0].ai_summary) && (
                  <p className="text-xs text-ink/75 dark:text-dark-ink/75 bg-surface dark:bg-dark-surface p-3 rounded-xl border border-border-subtle dark:border-dark-border-subtle leading-relaxed">
                    {priorRecords[0].aiSummary || priorRecords[0].ai_summary}
                  </p>
                )}
              </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 text-sm">
              <Info label="Height" value={patient.height} />
              <Info label="Weight" value={patient.weight} />
              <Info label="Phone" value={patient.phone} />
              <Info label="Email" value={patient.email} />
              <Info
                label="Chronic Conditions"
                value={conditionsList.join(", ") || "None recorded"}
              />
              <Info
                label="Active Medications"
                value={medicationsList.join(", ") || "None recorded"}
              />
            </div>
          </div>
        )}

        {tab === "history" && (
          <Timeline
            patient={patient}
            consultations={consults}
            medicalRecords={records}
          />
        )}

        {tab === "consultations" &&
          ((consults || []).length ? (
            <div className="space-y-4">
              {consults.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle p-5 space-y-3"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border-subtle dark:border-dark-border-subtle pb-3">
                    <div className="flex items-center gap-2.5">
                      <Stethoscope className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-ink dark:text-dark-ink text-sm">
                        {c.diagnosis || "Clinical Consultation"}
                      </span>
                      {c.diagnosisCode && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light">
                          {c.diagnosisCode}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-ink/40 dark:text-dark-ink/40">
                      {formatDate(c.date)}
                    </span>
                  </div>

                  {c.reason && (
                    <p className="text-xs text-ink/70 dark:text-dark-ink/70">
                      <strong className="text-ink dark:text-dark-ink font-semibold">
                        Reason for Visit:
                      </strong>{" "}
                      {c.reason}
                    </p>
                  )}

                  {c.treatmentPlan && (
                    <div className="bg-surface dark:bg-dark-surface p-3.5 rounded-xl text-xs text-ink/80 dark:text-dark-ink/80 leading-relaxed border border-border-subtle dark:border-dark-border-subtle">
                      <strong className="block text-ink dark:text-dark-ink font-semibold mb-1">
                        Clinical Treatment Plan:
                      </strong>
                      {c.treatmentPlan}
                    </div>
                  )}

                  {(c.followUpDate || c.followUpInstructions) && (
                    <div className="flex items-center gap-2 text-xs text-ink/60 dark:text-dark-ink/60 pt-1">
                      <span className="font-medium text-ink dark:text-dark-ink">
                        Follow-up:
                      </span>
                      <span>
                        {c.followUpDate ? formatDate(c.followUpDate) : "As needed"}
                        {c.followUpInstructions
                          ? ` · ${c.followUpInstructions}`
                          : ""}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Stethoscope}
              title="No consultations yet"
              message="Completed consultation notes and treatment plans will appear here."
            />
          ))}

        {tab === "prescriptions" &&
          ((rx || []).length ? (
            <div className="space-y-3">
              {rx.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3.5 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle p-4 hover:border-primary/30 transition"
                >
                  <div className="h-9 w-9 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-primary-light shrink-0">
                    <Pill className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink dark:text-dark-ink text-sm">
                      Rx #{p.id}
                    </p>
                    <p className="text-xs text-ink/50 dark:text-dark-ink/50">
                      {(p.medications || []).length} medications · {formatDate(p.date)}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Pill} title="No prescriptions on record" />
          ))}

        {tab === "labs" &&
          (labs.length ? (
            <DataTable
              columns={[
                {
                  key: "date",
                  label: "Date",
                  render: (r) => formatDate(r.date),
                },
                { key: "description", label: "Report" },
                { key: "doctor", label: "Ordering Physician" },
              ]}
              data={labs}
            />
          ) : (
            <EmptyState icon={FlaskConical} title="No lab results on record" />
          ))}

        {tab === "imaging" &&
          (imaging.length ? (
            <DataTable
              columns={[
                {
                  key: "date",
                  label: "Date",
                  render: (r) => formatDate(r.date),
                },
                { key: "description", label: "Study" },
                { key: "doctor", label: "Ordering Physician" },
              ]}
              data={imaging}
            />
          ) : (
            <EmptyState icon={ScanLine} title="No imaging studies on record" />
          ))}

        {tab === "priorRecords" && (
          <div className="space-y-4">
            {priorRecords.map((r, idx) => {
              const abnormal = (
                r.extractedBiomarkers ||
                r.extracted_biomarkers ||
                []
              ).filter((b) => b.isAbnormal);
              const diagnoses =
                r.extractedDiagnoses || r.extracted_diagnoses || [];
              const allergies =
                r.extractedAllergies || r.extracted_allergies || [];
              const meds =
                r.extractedMedications || r.extracted_medications || [];

              return (
                <div
                  key={r.id || idx}
                  className="p-5 rounded-2xl border border-border-subtle dark:border-dark-border-subtle bg-canvas dark:bg-dark-surface-elevated/40 space-y-3.5"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink dark:text-dark-ink text-sm">
                          {r.description || r.type}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light font-semibold">
                          AI Synthesized
                        </span>
                      </div>
                      <p className="text-xs text-ink/50 dark:text-dark-ink/50 mt-0.5">
                        {formatDate(r.date)}{" "}
                        {r.externalFacilityName ? `· ${r.externalFacilityName}` : ""}
                      </p>
                    </div>
                    {(allergies.length > 0 || meds.length > 0) && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={adopting}
                        onClick={() => handleAdoptPrior(r)}
                        className="text-xs"
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" /> Adopt into Chart
                      </Button>
                    )}
                  </div>

                  {(r.aiSummary || r.ai_summary) && (
                    <div className="bg-surface dark:bg-dark-surface p-3.5 rounded-xl text-xs text-ink/80 dark:text-dark-ink/80 leading-relaxed border border-border-subtle dark:border-dark-border-subtle">
                      {r.aiSummary || r.ai_summary}
                    </div>
                  )}

                  {abnormal.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="h-3.5 w-3.5" /> Flagged Abnormal Biomarkers:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {abnormal.map((b, bi) => (
                          <span
                            key={bi}
                            className="px-2.5 py-1 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 rounded-xl text-xs font-medium"
                          >
                            {b.test}: <strong>{b.value}</strong> (Ref:{" "}
                            {b.reference || "—"})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    {diagnoses.length > 0 && (
                      <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle p-3 rounded-xl">
                        <span className="font-semibold text-ink/70 dark:text-dark-ink/70 block mb-1.5">
                          Extracted Diagnoses
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {diagnoses.map((d, di) => (
                            <span
                              key={di}
                              className="px-2 py-0.5 bg-canvas dark:bg-dark-surface-elevated rounded-lg text-ink/80 dark:text-dark-ink/80 text-[11px] font-medium"
                            >
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {meds.length > 0 && (
                      <div className="bg-surface dark:bg-dark-surface border border-border-subtle dark:border-dark-border-subtle p-3 rounded-xl">
                        <span className="font-semibold text-ink/70 dark:text-dark-ink/70 block mb-1.5">
                          Prior Medications
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {meds.map((m, mi) => (
                            <span
                              key={mi}
                              className="px-2 py-0.5 bg-canvas dark:bg-dark-surface-elevated rounded-lg text-ink/80 dark:text-dark-ink/80 text-[11px] font-medium"
                            >
                              {typeof m === "string"
                                ? m
                                : `${m.name || m} ${m.dosage || ""}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value, icon, alert }) {
  return (
    <div>
      <p className="text-[11px] text-ink/50 dark:text-dark-ink/50 flex items-center gap-1 font-medium">
        {icon}
        {label}
      </p>
      <p
        className={`text-sm font-semibold mt-0.5 truncate ${
          alert ? "text-rose-600 dark:text-rose-400" : "text-ink dark:text-dark-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="space-y-0.5">
      <p className="text-ink/50 dark:text-dark-ink/50 text-xs font-medium">{label}</p>
      <p className="text-ink dark:text-dark-ink font-semibold">{value || "—"}</p>
    </div>
  );
}

function Timeline({ patient, consultations = [], medicalRecords = [] }) {
  const cList = Array.isArray(consultations) ? consultations : [];
  const mList = Array.isArray(medicalRecords) ? medicalRecords : [];
  const items = [
    ...cList
      .filter((c) => c && c.patientId === patient?.id)
      .map((c) => ({
        ...c,
        type: "Consultation",
        title: c.diagnosis,
        date: c.date,
      })),
    ...mList
      .filter((r) => r && r.patientId === patient?.id)
      .map((r) => ({ ...r, title: r.description })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!items.length)
    return <EmptyState icon={FileText} title="No medical history on record" />;
  return (
    <ol className="relative border-l border-border-subtle dark:border-dark-border-subtle ml-3 space-y-6">
      {items.map((it) => (
        <li key={it.id} className="ml-6 relative">
          <span className="absolute -left-[27px] h-6 w-6 rounded-full bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center ring-4 ring-canvas dark:ring-dark-canvas" />
          <p className="font-semibold text-ink dark:text-dark-ink text-sm">
            {it.type}
          </p>
          <p className="text-sm text-ink/70 dark:text-dark-ink/70 mt-0.5">
            {it.title}
          </p>
          <span className="text-xs text-ink/40 dark:text-dark-ink/40">
            {formatDate(it.date)}
          </span>
        </li>
      ))}
    </ol>
  );
}
