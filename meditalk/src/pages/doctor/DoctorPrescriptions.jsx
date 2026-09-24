import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Pill, Plus, Trash2, FileDown, Send, ChevronDown, Check, AlertTriangle, ShieldAlert, ShieldCheck, X, Info } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Card from "../../components/ui/Card";
import Select from "../../components/ui/Select";
import StatusBadge from "../../components/ui/StatusBadge";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useFetch } from "../../hooks/useFetch";
import { getPatients } from "../../services/patientService";
import { getPrescriptions, savePrescription, checkDrugSafety } from "../../services/prescriptionService";
import { PrescriptionPreview } from "../patient/PatientPrescriptions";
import { formatDate } from "../../constants";
import { searchDrugs } from "../../data/drugCatalog";
import { generatePrescriptionPdf } from "../../utils/prescriptionPdf";


const EMPTY_MED = { medicine: "", dosage: "", frequency: "", duration: "", instructions: "" };
const FREQUENCY_OPTIONS = ["OD", "BD", "TDS", "QID", "PRN", "SOS", "Weekly", "Fortnightly"];
const DURATION_OPTIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month", "3 months", "6 months", "Ongoing"];

// ── Drug Autocomplete Input ────────────────────────────────────────────────
function DrugInput({ value, onChange, onSelect }) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    onChange(q);
    const results = searchDrugs(q);
    setSuggestions(results);
    setOpen(results.length > 0);
  }

  function handleSelect(drug) {
    setQuery(drug.name);
    setSuggestions([]);
    setOpen(false);
    onSelect(drug);
  }

  const CATEGORY_COLORS = {
    Antibiotic: "bg-blue-100 text-blue-700",
    Cardiology: "bg-red-100 text-red-700",
    Analgesic: "bg-orange-100 text-orange-700",
    Endocrinology: "bg-purple-100 text-purple-700",
    Respiratory: "bg-cyan-100 text-cyan-700",
    Gastroenterology: "bg-yellow-100 text-yellow-700",
    Psychiatry: "bg-pink-100 text-pink-700",
    Supplement: "bg-green-100 text-green-700",
  };

  return (
    <div className="relative" ref={ref}>
      <label className="label-base">Medicine</label>
      <input
        className="input-base"
        placeholder="Type drug name…"
        value={query}
        onChange={handleChange}
        onFocus={() => {
          const r = searchDrugs(query);
          if (r.length) { setSuggestions(r); setOpen(true); }
        }}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-sage/30 shadow-xl overflow-hidden">
          {suggestions.map((drug, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-4 py-3 hover:bg-sage/10 transition-colors border-b border-sage/10 last:border-0"
              onMouseDown={() => handleSelect(drug)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink text-sm">{drug.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[drug.category] || "bg-sage/20 text-ink/60"}`}>
                  {drug.category}
                </span>
              </div>
              <div className="flex gap-2 mt-1 flex-wrap">
                {drug.commonDosages.slice(0, 3).map((d, j) => (
                  <span key={j} className="text-xs bg-sage/20 text-ink/60 px-1.5 py-0.5 rounded">{d}</span>
                ))}
                <span className="text-xs text-ink/40">{drug.defaultFrequency}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DoctorPrescriptions() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get("patientId") || "";
  const prefillDiagnosis = searchParams.get("diagnosis") || "";

  const doctorId = user?.id || "D-201";

  const { data: rx, loading, reload } = useFetch(() => getPrescriptions({ doctorId }), [doctorId]);
  const { data: patients } = useFetch(() => getPatients());

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewRx, setViewRx] = useState(null);
  const [form, setForm] = useState({
    patientId: preselectedPatientId,
    diagnosis: prefillDiagnosis,
    medications: [{ ...EMPTY_MED }],
    additionalInstructions: "",
  });

  // ── Phase 9: Drug Safety Guard ───────────────────────────────────────────
  const [safetyAlerts, setSafetyAlerts] = useState([]);
  const [safetyChecking, setSafetyChecking] = useState(false);
  const [safetyDismissed, setSafetyDismissed] = useState(false);
  const safetyDebounceRef = useRef(null);

  const runSafetyCheck = useCallback(async (patientId, medications) => {
    if (!patientId || medications.every(m => !m.medicine)) {
      setSafetyAlerts([]); return;
    }
    clearTimeout(safetyDebounceRef.current);
    safetyDebounceRef.current = setTimeout(async () => {
      setSafetyChecking(true);
      try {
        const result = await checkDrugSafety(patientId, medications);
        setSafetyAlerts(result.alerts || []);
        setSafetyDismissed(false);
      } catch (_) {
        setSafetyAlerts([]);
      } finally {
        setSafetyChecking(false);
      }
    }, 500);
  }, []);

  useEffect(() => {
    if (form.patientId && creating) {
      runSafetyCheck(form.patientId, form.medications);
    }
  }, [form.patientId, form.medications, creating, runSafetyCheck]);

  // Auto-open if launched from Consultation page with patientId
  useEffect(() => {
    if (preselectedPatientId && patients && patients.length > 0) {
      setForm(f => ({ ...f, patientId: preselectedPatientId, diagnosis: prefillDiagnosis }));
      setCreating(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function updateMed(i, key, value) {
    setForm((f) => ({ ...f, medications: f.medications.map((m, idx) => (idx === i ? { ...m, [key]: value } : m)) }));
  }
  function addMed() {
    setForm((f) => ({ ...f, medications: [...f.medications, { ...EMPTY_MED }] }));
  }
  function removeMed(i) {
    setForm((f) => ({ ...f, medications: f.medications.filter((_, idx) => idx !== i) }));
  }
  function handleDrugSelect(i, drug) {
    setForm((f) => ({
      ...f,
      medications: f.medications.map((m, idx) =>
        idx === i
          ? {
              ...m,
              medicine: drug.name,
              dosage: drug.commonDosages[0] || "",
              frequency: drug.defaultFrequency || "",
              instructions: drug.instructions || "",
            }
          : m
      ),
    }));
  }

  async function handleSave() {
    if (!form.patientId) { toast.error("Please select a patient."); return; }
    if (!form.medications[0].medicine) { toast.error("Add at least one medicine."); return; }
    setSaving(true);
    try {
      const selectedPatient = (patients || []).find((p) => p.id === form.patientId);
      const saved = await savePrescription({
        patientId: form.patientId,
        patientName: selectedPatient?.name,
        doctorId,
        doctorName: user?.name,
        medications: form.medications,
        additionalInstructions: form.additionalInstructions,
        diagnosis: form.diagnosis,
      });
      toast.success("Prescription saved successfully.");
      setCreating(false);
      reload();
      // Optionally auto-download PDF
      if (saved?.prescription) {
        generatePrescriptionPdf(
          saved.prescription,
          { name: user?.name, id: doctorId, specialty: user?.specialty },
          { name: selectedPatient?.name, id: selectedPatient?.id }
        );
      }
    } catch (err) {
      toast.error(err.message || "Failed to save prescription.");
    } finally {
      setSaving(false);
    }
  }

  function handleDownloadPdf(prescription) {
    const patient = (patients || []).find(p => p.id === prescription.patientId);
    generatePrescriptionPdf(
      prescription,
      { name: user?.name, id: doctorId, specialty: user?.specialty },
      { name: prescription.patientName || patient?.name, id: prescription.patientId }
    );
  }

  function openNew() {
    const firstPatient = (patients || [])[0];
    setForm({ patientId: preselectedPatientId || firstPatient?.id || "", diagnosis: "", medications: [{ ...EMPTY_MED }], additionalInstructions: "" });
    setSafetyAlerts([]);
    setSafetyDismissed(false);
    setCreating(true);
  }

  if (loading) return <LoadingState />;
  const list = rx || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prescriptions"
        subtitle="Create and manage digital prescriptions for your patients."
        action={<Button onClick={openNew}><Plus className="h-4 w-4" /> New Prescription</Button>}
      />

      {list.length === 0 ? (
        <div className="card"><EmptyState icon={Pill} title="No prescriptions yet" message="Create a new prescription for a patient." /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((p) => (
            <div key={p.id} className="card group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-sage/20 flex items-center justify-center">
                    <Pill className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink">Rx #{p.id}</p>
                    <p className="text-xs text-ink/50">{formatDate(p.date)}</p>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <p className="text-sm text-ink/70 mt-3">{(p.medications || []).length} medication(s) · {p.patientName}</p>
              {p.diagnosis && <p className="text-xs text-ink/50 mt-1">Dx: {p.diagnosis}</p>}
              <div className="mt-3 flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setViewRx(p)}>View</Button>
                <Button size="sm" variant="ghost" onClick={() => handleDownloadPdf(p)}>
                  <FileDown className="h-3.5 w-3.5" /> PDF
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View / Download Modal */}
      <Modal
        open={!!viewRx}
        onClose={() => setViewRx(null)}
        title={`Prescription ${viewRx?.id}`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => handleDownloadPdf(viewRx)}>
              <FileDown className="h-4 w-4" /> Download PDF
            </Button>
            <Button onClick={() => setViewRx(null)}>Close</Button>
          </>
        }
      >
        {viewRx && <PrescriptionPreview rx={viewRx} />}
      </Modal>

      {/* Create Modal */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New Prescription"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              <Send className="h-4 w-4" /> Save & Download PDF
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Patient */}
          <Select label="Patient" value={form.patientId} onChange={(e) => update("patientId", e.target.value)}>
            <option value="">Select patient...</option>
            {(patients || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>

          {/* Diagnosis */}
          <Input
            label="Diagnosis (optional)"
            value={form.diagnosis}
            onChange={(e) => update("diagnosis", e.target.value)}
            placeholder="e.g. Hypertension, URTI"
          />

          {/* Drug Safety Guard */}
          {safetyChecking && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sage/10 border border-sage/30 text-xs text-ink/60">
              <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Checking drug interactions & allergy safety...
            </div>
          )}
          {!safetyDismissed && safetyAlerts.length > 0 && (
            <div className="space-y-2">
              {safetyAlerts.map((alert, i) => {
                const isCritical = alert.severity === 'critical';
                const isWarning = alert.severity === 'warning';
                const bgCls = isCritical ? 'bg-danger/8 border-danger/40' : isWarning ? 'bg-amber-50 border-amber-300' : 'bg-blue-50 border-blue-200';
                const iconCls = isCritical ? 'text-danger' : isWarning ? 'text-amber-600' : 'text-blue-500';
                const titleCls = isCritical ? 'text-danger' : isWarning ? 'text-amber-700' : 'text-blue-700';
                return (
                  <div key={i} className={`rounded-xl border p-3 ${bgCls}`}>
                    <div className="flex items-start gap-2">
                      {isCritical ? <ShieldAlert className={`h-4 w-4 shrink-0 mt-0.5 ${iconCls}`} /> :
                       isWarning ? <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${iconCls}`} /> :
                       <Info className={`h-4 w-4 shrink-0 mt-0.5 ${iconCls}`} />}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold ${titleCls}`}>
                          {isCritical ? '🔴 CRITICAL — ' : isWarning ? '🟠 WARNING — ' : 'ℹ️ '}
                          {alert.title}
                        </p>
                        <p className="text-xs text-ink/70 mt-0.5">{alert.effect}</p>
                        {alert.alternatives?.length > 0 && (
                          <p className="text-xs text-ink/60 mt-1">
                            <span className="font-medium">Safer alternatives: </span>
                            {alert.alternatives.slice(0, 2).join(' · ')}
                          </p>
                        )}
                      </div>
                      {i === 0 && (
                        <button onClick={() => setSafetyDismissed(true)} className="shrink-0 text-ink/40 hover:text-ink/70">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!safetyChecking && safetyAlerts.length === 0 && form.patientId && form.medications.some(m => m.medicine) && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/8 border border-success/30 text-xs text-success font-medium">
              <ShieldCheck className="h-3.5 w-3.5" /> No drug interactions or allergy conflicts detected.
            </div>
          )}

          {/* Medications */}

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-ink text-sm">Medications</p>
              <Button variant="secondary" size="sm" onClick={addMed}><Plus className="h-4 w-4" /> Add Medicine</Button>
            </div>
            <div className="space-y-3">
              {form.medications.map((m, i) => (
                <div key={i} className="rounded-xl border border-sage/30 p-4 bg-white relative">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <DrugInput
                      value={m.medicine}
                      onChange={(v) => updateMed(i, "medicine", v)}
                      onSelect={(drug) => handleDrugSelect(i, drug)}
                    />
                    <Input label="Dosage" value={m.dosage} onChange={(e) => updateMed(i, "dosage", e.target.value)} placeholder="e.g. 500mg" />
                    <div>
                      <label className="label-base">Frequency</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {FREQUENCY_OPTIONS.map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => updateMed(i, "frequency", f)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${m.frequency === f ? "bg-primary text-white border-primary" : "bg-white border-sage/40 text-ink/60 hover:bg-sage/10"}`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="label-base">Duration</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {DURATION_OPTIONS.map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => updateMed(i, "duration", d)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${m.duration === d ? "bg-primary text-white border-primary" : "bg-white border-sage/40 text-ink/60 hover:bg-sage/10"}`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <Input label="Instructions" value={m.instructions} onChange={(e) => updateMed(i, "instructions", e.target.value)} placeholder="e.g. After meals, avoid alcohol" />
                    </div>
                  </div>
                  {form.medications.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMed(i)}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-danger text-white flex items-center justify-center shadow"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Additional instructions */}
          <div>
            <label className="label-base">Additional Instructions / Notes</label>
            <textarea
              className="input-base min-h-[70px]"
              value={form.additionalInstructions}
              onChange={(e) => update("additionalInstructions", e.target.value)}
              placeholder="e.g. Rest for 3 days, monitor blood pressure daily, review in 2 weeks…"
            />
          </div>

          {/* Live preview */}
          <Card title="Live Preview">
            <PrescriptionPreview
              rx={{
                doctorName: user?.name || "Doctor",
                date: new Date().toISOString().slice(0, 10),
                medications: form.medications.filter((m) => m.medicine),
                additionalInstructions: form.additionalInstructions,
              }}
            />
          </Card>
        </div>
      </Modal>
    </div>
  );
}
