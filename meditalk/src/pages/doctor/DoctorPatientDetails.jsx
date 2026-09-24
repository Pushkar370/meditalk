import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Droplet, AlertTriangle, FileText, Stethoscope, Pill, FlaskConical, ScanLine, Activity, Sparkles, Building2, Check } from "lucide-react";
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
import { getConsultations, getPrescriptions, getMedicalRecords, adoptAiRecords } from "../../services/prescriptionService";
import { formatDate } from "../../constants";
import { useToast } from "../../context/ToastContext";

const BASE_TABS = [
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
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [adopting, setAdopting] = useState(false);
  const [adopted, setAdopted] = useState(false);

  const { data: patient, loading: pl, reload: reloadPatient } = useFetch(() => getPatientById(id), [id]);
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
  const priorRecords = (records || []).filter(
    (r) => r.isExternalClinic || r.is_external_clinic || r.aiSummary || r.ai_summary || r.aiProcessedAt || r.ai_processed_at
  );

  const tabs = [
    ...BASE_TABS,
    ...(priorRecords.length > 0 ? [{ key: "priorRecords", label: `Prior Records (${priorRecords.length})` }] : []),
  ];

  async function handleAdoptPrior(rec) {
    if (!rec) return;
    setAdopting(true);
    try {
      const allergies = (rec.extractedAllergies || rec.extracted_allergies || []).map(a => typeof a === 'string' ? a : a.allergen);
      const medications = rec.extractedMedications || rec.extracted_medications || [];
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
        {tabs.map((t) => (
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
          <div className="space-y-6">
            {priorRecords.length > 0 && (
              <div className="p-4 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 via-sage/10 to-accent/5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-white shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-ink text-sm">Prior Clinic Records Intelligence</h4>
                        <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-primary/20 text-primary">
                          {priorRecords.length} Record{priorRecords.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-xs text-ink/60 mt-0.5">
                        AI synthesized history from previous medical facility ({priorRecords[0].externalFacilityName || priorRecords[0].external_facility_name || 'External Clinic'}).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      loading={adopting}
                      onClick={() => handleAdoptPrior(priorRecords[0])}
                      className="text-xs border-success/40 text-success hover:bg-success/5"
                    >
                      {adopted ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {adopted ? "Adopted into Chart" : "Adopt Allergies & Meds"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setTab("priorRecords")} className="text-xs text-primary">
                      View Details →
                    </Button>
                  </div>
                </div>
                {(priorRecords[0].aiSummary || priorRecords[0].ai_summary) && (
                  <p className="mt-3 text-xs text-ink/80 bg-white/70 p-2.5 rounded-lg border border-sage/20 leading-relaxed">
                    {priorRecords[0].aiSummary || priorRecords[0].ai_summary}
                  </p>
                )}
              </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <Info label="Height" value={patient.height} />
              <Info label="Weight" value={patient.weight} />
              <Info label="Phone" value={patient.phone} />
              <Info label="Email" value={patient.email} />
              <Info label="Chronic Conditions" value={conditionsList.join(", ") || "None"} />
              <Info label="Medications" value={medicationsList.join(", ") || "None"} />
            </div>
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

        {tab === "priorRecords" && (
          <div className="space-y-4">
            {priorRecords.map((r, idx) => {
              const abnormal = (r.extractedBiomarkers || r.extracted_biomarkers || []).filter(b => b.isAbnormal);
              const diagnoses = r.extractedDiagnoses || r.extracted_diagnoses || [];
              const allergies = r.extractedAllergies || r.extracted_allergies || [];
              const meds = r.extractedMedications || r.extracted_medications || [];

              return (
                <div key={r.id || idx} className="p-4 rounded-xl border border-sage/30 bg-white space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink text-sm">{r.description || r.type}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">AI Synthesized</span>
                      </div>
                      <p className="text-xs text-ink/50 mt-0.5">
                        {formatDate(r.date)} {r.externalFacilityName ? `· ${r.externalFacilityName}` : ""}
                      </p>
                    </div>
                    {(allergies.length > 0 || meds.length > 0) && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={adopting}
                        onClick={() => handleAdoptPrior(r)}
                        className="text-xs border-success/40 text-success hover:bg-success/5"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Adopt into Chart
                      </Button>
                    )}
                  </div>

                  {(r.aiSummary || r.ai_summary) && (
                    <div className="bg-sage/10 p-3 rounded-lg text-xs text-ink leading-relaxed">
                      {r.aiSummary || r.ai_summary}
                    </div>
                  )}

                  {abnormal.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-danger flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Flagged Abnormal Biomarkers:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {abnormal.map((b, bi) => (
                          <span key={bi} className="px-2 py-0.5 bg-danger/10 text-danger border border-danger/20 rounded-md text-xs font-medium">
                            {b.test}: <strong>{b.value}</strong> (Ref: {b.reference || '—'})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    {diagnoses.length > 0 && (
                      <div className="bg-sage/5 border border-sage/20 p-2.5 rounded-lg">
                        <span className="font-semibold text-ink/70 block mb-1">Extracted Diagnoses</span>
                        <div className="flex flex-wrap gap-1">
                          {diagnoses.map((d, di) => (
                            <span key={di} className="px-2 py-0.5 bg-white rounded border border-sage/20 text-ink/80">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {meds.length > 0 && (
                      <div className="bg-sage/5 border border-sage/20 p-2.5 rounded-lg">
                        <span className="font-semibold text-ink/70 block mb-1">Prior Medications</span>
                        <div className="flex flex-wrap gap-1">
                          {meds.map((m, mi) => (
                            <span key={mi} className="px-2 py-0.5 bg-white rounded border border-sage/20 text-ink/80">
                              {typeof m === 'string' ? m : `${m.name || m} ${m.dosage || ''}`}
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
