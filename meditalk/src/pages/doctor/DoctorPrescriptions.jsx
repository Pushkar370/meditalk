import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Pill,
  Plus,
  Trash2,
  FileDown,
  Send,
  ChevronDown,
  Check,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  X,
  Info,
  RotateCcw,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
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
import {
  getPrescriptions,
  savePrescription,
  checkDrugSafety,
  getDoctorRefills,
  approveRefill,
  rejectRefill,
} from "../../services/prescriptionService";
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
    Antibiotic: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    Cardiology: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    Analgesic: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    Endocrinology: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
    Respiratory: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
    Gastroenterology: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    Psychiatry: "bg-pink-500/10 text-pink-700 dark:text-pink-300",
    Supplement: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  };

  return (
    <div className="relative" ref={ref}>
      <label className="text-[11px] font-semibold text-ink/60 dark:text-dark-ink/60 uppercase tracking-wider block mb-1">
        Medicine Name
      </label>
      <input
        className="input-base text-xs"
        placeholder="Type drug name to search catalogue…"
        value={query}
        onChange={handleChange}
        onFocus={() => {
          const r = searchDrugs(query);
          if (r.length) {
            setSuggestions(r);
            setOpen(true);
          }
        }}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-surface dark:bg-dark-surface rounded-2xl border border-border-subtle dark:border-dark-border-subtle shadow-popover overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((drug, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-4 py-3 hover:bg-canvas dark:hover:bg-dark-surface-elevated transition border-b border-border-subtle/50 dark:border-dark-border-subtle/50 last:border-0"
              onMouseDown={() => handleSelect(drug)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink dark:text-dark-ink text-xs">
                  {drug.name}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    CATEGORY_COLORS[drug.category] || "bg-canvas dark:bg-dark-surface-elevated text-ink/60"
                  }`}
                >
                  {drug.category}
                </span>
              </div>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {drug.commonDosages.slice(0, 3).map((d, j) => (
                  <span
                    key={j}
                    className="text-[10px] bg-canvas dark:bg-dark-surface-elevated text-ink/70 dark:text-dark-ink/70 px-2 py-0.5 rounded-md border border-border-subtle dark:border-dark-border-subtle"
                  >
                    {d}
                  </span>
                ))}
                <span className="text-[10px] text-ink/40 dark:text-dark-ink/40 py-0.5">
                  {drug.defaultFrequency}
                </span>
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

  const { data: rx, loading, reload } = useFetch(
    () => getPrescriptions({ doctorId }),
    [doctorId]
  );
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

  // ── Drug Safety Guard ───────────────────────────────────────────
  const [safetyAlerts, setSafetyAlerts] = useState([]);
  const [safetyChecking, setSafetyChecking] = useState(false);
  const [safetyDismissed, setSafetyDismissed] = useState(false);
  const safetyDebounceRef = useRef(null);

  const runSafetyCheck = useCallback(async (pId, medications) => {
    if (!pId || medications.every((m) => !m.medicine)) {
      setSafetyAlerts([]);
      return;
    }
    clearTimeout(safetyDebounceRef.current);
    safetyDebounceRef.current = setTimeout(async () => {
      setSafetyChecking(true);
      try {
        const result = await checkDrugSafety(pId, medications);
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
      setForm((f) => ({
        ...f,
        patientId: preselectedPatientId,
        diagnosis: prefillDiagnosis,
      }));
      setCreating(true);
    }
  }, [patients, preselectedPatientId, prefillDiagnosis]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function updateMed(i, key, value) {
    setForm((f) => ({
      ...f,
      medications: f.medications.map((m, idx) =>
        idx === i ? { ...m, [key]: value } : m
      ),
    }));
  }
  function addMed() {
    setForm((f) => ({
      ...f,
      medications: [...f.medications, { ...EMPTY_MED }],
    }));
  }
  function removeMed(i) {
    setForm((f) => ({
      ...f,
      medications: f.medications.filter((_, idx) => idx !== i),
    }));
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
    if (!form.patientId) {
      toast.error("Please select a patient.");
      return;
    }
    if (!form.medications[0].medicine) {
      toast.error("Add at least one medicine.");
      return;
    }
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
    const patient = (patients || []).find((p) => p.id === prescription.patientId);
    generatePrescriptionPdf(
      prescription,
      { name: user?.name, id: doctorId, specialty: user?.specialty },
      {
        name: prescription.patientName || patient?.name,
        id: prescription.patientId,
      }
    );
  }

  function openNew() {
    const firstPatient = (patients || [])[0];
    setForm({
      patientId: preselectedPatientId || firstPatient?.id || "",
      diagnosis: "",
      medications: [{ ...EMPTY_MED }],
      additionalInstructions: "",
    });
    setSafetyAlerts([]);
    setSafetyDismissed(false);
    setCreating(true);
  }

  // CW-4: Refill State & Actions
  const [activeTab, setActiveTab] = useState("prescriptions");
  const [approvingRefill, setApprovingRefill] = useState(null);
  const [rejectingRefill, setRejectingRefill] = useState(null);
  const [doctorRefillNote, setDoctorRefillNote] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const { data: refillsData, reload: reloadRefills } = useFetch(
    () => (doctorId ? getDoctorRefills(doctorId) : Promise.resolve({ refillRequests: [] })),
    [doctorId]
  );
  const refillRequests = refillsData?.refillRequests || [];
  const pendingCount = refillRequests.filter((r) => r.status === "pending").length;

  async function handleApprove() {
    if (!approvingRefill) return;
    setActionBusy(true);
    try {
      await approveRefill(approvingRefill.id, {
        doctorNotes: doctorRefillNote || "Approved renewal",
      });
      toast.success(
        `Refill approved! New prescription created for ${approvingRefill.patient_name}.`
      );
      setApprovingRefill(null);
      setDoctorRefillNote("");
      reloadRefills();
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to approve refill.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReject() {
    if (!rejectingRefill || !doctorRefillNote.trim()) {
      toast.error("Please provide a note/reason for declining.");
      return;
    }
    setActionBusy(true);
    try {
      await rejectRefill(rejectingRefill.id, { doctorNotes: doctorRefillNote });
      toast.info("Refill request declined.");
      setRejectingRefill(null);
      setDoctorRefillNote("");
      reloadRefills();
    } catch (err) {
      toast.error(err.message || "Failed to decline refill.");
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) return <LoadingState />;
  const list = rx || [];

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Prescriptions & Medication Management"
        subtitle="Issue digital prescriptions, cross-check drug safety, and process patient refill requests."
        action={
          <Button onClick={openNew} className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Prescription
          </Button>
        }
      />

      {/* Apple Segmented Tabs */}
      <div className="flex p-1 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/60 border border-border-subtle dark:border-dark-border-subtle w-fit">
        <button
          onClick={() => setActiveTab("prescriptions")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
            activeTab === "prescriptions"
              ? "bg-surface dark:bg-dark-surface text-ink dark:text-dark-ink shadow-sm"
              : "text-ink/50 dark:text-dark-ink/50 hover:text-ink dark:hover:text-dark-ink"
          }`}
        >
          All Prescriptions ({list.length})
        </button>
        <button
          onClick={() => setActiveTab("refills")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-2 ${
            activeTab === "refills"
              ? "bg-surface dark:bg-dark-surface text-ink dark:text-dark-ink shadow-sm"
              : "text-ink/50 dark:text-dark-ink/50 hover:text-ink dark:hover:text-dark-ink"
          }`}
        >
          <span>Refill Requests ({refillRequests.length})</span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
              {pendingCount} Pending
            </span>
          )}
        </button>
      </div>

      {activeTab === "prescriptions" ? (
        list.length === 0 ? (
          <div className="card py-12">
            <EmptyState
              icon={Pill}
              title="No prescriptions issued yet"
              message="Create a digital prescription for an assigned patient."
              action={
                <Button size="sm" onClick={openNew} className="text-xs">
                  Create Prescription
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {list.map((p) => (
              <div key={p.id} className="card flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-primary-light shrink-0">
                        <Pill className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-ink dark:text-dark-ink text-sm">
                          Rx #{p.id}
                        </p>
                        <p className="text-xs text-ink/40 dark:text-dark-ink/40">
                          {formatDate(p.date)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink dark:text-dark-ink">
                      {p.patientName}
                    </p>
                    <p className="text-xs text-ink/60 dark:text-dark-ink/60 mt-0.5">
                      {(p.medications || []).length} medication(s) prescribed
                    </p>
                  </div>
                  {p.diagnosis && (
                    <p className="text-xs text-ink/75 dark:text-dark-ink/75 bg-canvas dark:bg-dark-surface-elevated/40 p-2.5 rounded-xl border border-border-subtle dark:border-dark-border-subtle">
                      <span className="font-semibold text-ink dark:text-dark-ink">
                        Diagnosis:
                      </span>{" "}
                      {p.diagnosis}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border-subtle dark:border-dark-border-subtle">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewRx(p)}
                    className="text-xs flex-1"
                  >
                    View Details
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownloadPdf(p)}
                    className="text-xs"
                  >
                    <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* CW-4: Refill Requests View */
        refillRequests.length === 0 ? (
          <div className="card py-12">
            <EmptyState
              icon={RotateCcw}
              title="No refill requests"
              message="No patients have requested prescription refills at this time."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {refillRequests.map((r) => (
              <div
                key={r.id}
                className="card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink dark:text-dark-ink text-sm">
                      Refill for #{r.prescription_id}
                    </span>
                    <span className="font-bold text-ink dark:text-dark-ink">
                      · {r.patient_name}
                    </span>
                    <span className="text-xs text-ink/50 dark:text-dark-ink/50">
                      · Requested {formatDate(r.created_at)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(r.medications || []).map((m, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs bg-canvas dark:bg-dark-surface-elevated text-ink dark:text-dark-ink border border-border-subtle dark:border-dark-border-subtle font-medium"
                      >
                        {m.medicine || m.name} ({m.dosage}) · {m.frequency}
                      </span>
                    ))}
                  </div>

                  {r.patient_notes && (
                    <p className="text-xs text-ink/80 dark:text-dark-ink/80 bg-canvas dark:bg-dark-surface-elevated/40 p-2.5 rounded-xl border border-border-subtle dark:border-dark-border-subtle">
                      <span className="font-semibold text-ink dark:text-dark-ink">
                        Patient reason:
                      </span>{" "}
                      "{r.patient_notes}"
                    </p>
                  )}

                  {r.doctor_notes && (
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                      <span className="font-semibold">My Note:</span>{" "}
                      {r.doctor_notes}
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {r.status === "pending" ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => {
                          setApprovingRefill(r);
                          setDoctorRefillNote("Refill approved for ongoing management");
                        }}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> Approve & Renew
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRejectingRefill(r);
                          setDoctorRefillNote("");
                        }}
                        className="text-xs text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                      >
                        <X className="h-3.5 w-3.5 mr-1" /> Decline
                      </Button>
                    </>
                  ) : r.status === "approved" ? (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approved (Rx #{r.new_prescription_id})
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                      Declined
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* CW-4: Approve Refill Modal */}
      <Modal
        open={!!approvingRefill}
        onClose={() => setApprovingRefill(null)}
        title="Approve Prescription Refill"
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setApprovingRefill(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              loading={actionBusy}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Confirm Approval & Issue Rx
            </Button>
          </>
        }
      >
        {approvingRefill && (
          <div className="space-y-4 text-xs">
            <p className="text-ink/70 dark:text-dark-ink/70">
              Approving this request will automatically generate a new active prescription for{" "}
              <span className="font-semibold text-ink dark:text-dark-ink">
                {approvingRefill.patient_name}
              </span>{" "}
              with the existing medication regimen.
            </p>
            <div>
              <p className="font-semibold text-ink dark:text-dark-ink mb-1.5">
                Medications to Renew:
              </p>
              <div className="space-y-1.5">
                {(approvingRefill.medications || []).map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle flex justify-between"
                  >
                    <span className="font-medium text-ink dark:text-dark-ink">
                      {m.medicine || m.name} ({m.dosage})
                    </span>
                    <span className="text-ink/50 dark:text-dark-ink/50 font-mono">
                      {m.frequency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block font-semibold text-ink dark:text-dark-ink mb-1.5">
                Physician Instructions / Renewal Note
              </label>
              <textarea
                value={doctorRefillNote}
                onChange={(e) => setDoctorRefillNote(e.target.value)}
                placeholder="e.g. Approved 30-day supply. Continue daily monitoring."
                rows={2}
                className="w-full bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-3 text-xs text-ink dark:text-dark-ink placeholder:text-ink/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition resize-none"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* CW-4: Reject Refill Modal */}
      <Modal
        open={!!rejectingRefill}
        onClose={() => setRejectingRefill(null)}
        title="Decline Refill Request"
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRejectingRefill(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={handleReject}
              loading={actionBusy}
              className="text-xs"
            >
              Decline Refill
            </Button>
          </>
        }
      >
        {rejectingRefill && (
          <div className="space-y-3.5 text-xs">
            <p className="text-ink/70 dark:text-dark-ink/70">
              Please provide a clinical explanation for declining this refill request for{" "}
              <span className="font-semibold text-ink dark:text-dark-ink">
                {rejectingRefill.patient_name}
              </span>
              . This note will be sent directly to the patient.
            </p>
            <div>
              <label className="block font-semibold text-ink dark:text-dark-ink mb-1.5">
                Clinical Reason for Declining <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={doctorRefillNote}
                onChange={(e) => setDoctorRefillNote(e.target.value)}
                placeholder="e.g. Physical consultation required prior to renewal due to blood pressure monitoring needs."
                rows={3}
                className="w-full bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-3 text-xs text-ink dark:text-dark-ink placeholder:text-ink/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition resize-none"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* View Modal */}
      <Modal
        open={!!viewRx}
        onClose={() => setViewRx(null)}
        title={`Prescription #${viewRx?.id}`}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadPdf(viewRx)}
              className="text-xs"
            >
              <FileDown className="h-3.5 w-3.5 mr-1" /> Download PDF
            </Button>
            <Button size="sm" onClick={() => setViewRx(null)} className="text-xs">
              Close
            </Button>
          </div>
        }
      >
        {viewRx && <PrescriptionPreview rx={viewRx} />}
      </Modal>

      {/* Create Modal */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New Clinical Prescription"
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreating(false)}
              disabled={saving}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              loading={saving}
              className="text-xs"
            >
              <Send className="h-3.5 w-3.5 mr-1" /> Save & Download PDF
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Patient */}
          <Select
            label="Patient"
            value={form.patientId}
            onChange={(e) => update("patientId", e.target.value)}
          >
            <option value="">Select patient...</option>
            {(patients || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (#{p.id})
              </option>
            ))}
          </Select>

          {/* Diagnosis */}
          <Input
            label="Clinical Diagnosis"
            value={form.diagnosis}
            onChange={(e) => update("diagnosis", e.target.value)}
            placeholder="e.g. Essential Hypertension, Acute Bronchitis"
          />

          {/* Drug Safety Guard */}
          {safetyChecking && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle text-xs text-ink/60 dark:text-dark-ink/60">
              <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Cross-checking drug interactions & allergy safety...
            </div>
          )}
          {!safetyDismissed && safetyAlerts.length > 0 && (
            <div className="space-y-2">
              {safetyAlerts.map((alert, i) => {
                const isCritical = alert.severity === "critical";
                const isWarning = alert.severity === "warning";
                const bgCls = isCritical
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400"
                  : isWarning
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                  : "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-400";
                return (
                  <div key={i} className={`rounded-2xl border p-3.5 ${bgCls}`}>
                    <div className="flex items-start gap-2.5">
                      {isCritical ? (
                        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                      ) : isWarning ? (
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                      ) : (
                        <Info className="h-4 w-4 shrink-0 mt-0.5 text-sky-600" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold">
                          {isCritical
                            ? "🔴 CRITICAL SAFETY ALERT — "
                            : isWarning
                            ? "🟠 WARNING — "
                            : "ℹ️ "}
                          {alert.title}
                        </p>
                        <p className="text-xs mt-0.5 opacity-90">{alert.effect}</p>
                        {alert.alternatives?.length > 0 && (
                          <p className="text-xs opacity-80 mt-1">
                            <span className="font-semibold">Safer alternatives: </span>
                            {alert.alternatives.slice(0, 2).join(" · ")}
                          </p>
                        )}
                      </div>
                      {i === 0 && (
                        <button
                          onClick={() => setSafetyDismissed(true)}
                          className="shrink-0 opacity-60 hover:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!safetyChecking &&
            safetyAlerts.length === 0 &&
            form.patientId &&
            form.medications.some((m) => m.medicine) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                <ShieldCheck className="h-3.5 w-3.5" /> No drug interactions or allergy conflicts detected.
              </div>
            )}

          {/* Medications Form */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-ink dark:text-dark-ink text-sm">
                Prescribed Medications
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={addMed}
                className="text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Medication
              </Button>
            </div>
            <div className="space-y-3">
              {form.medications.map((m, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border-subtle dark:border-dark-border-subtle p-4 bg-canvas dark:bg-dark-surface-elevated/40 relative space-y-3"
                >
                  <div className="grid sm:grid-cols-2 gap-3">
                    <DrugInput
                      value={m.medicine}
                      onChange={(v) => updateMed(i, "medicine", v)}
                      onSelect={(drug) => handleDrugSelect(i, drug)}
                    />
                    <Input
                      label="Dosage"
                      value={m.dosage}
                      onChange={(e) => updateMed(i, "dosage", e.target.value)}
                      placeholder="e.g. 500mg, 1 tablet"
                    />
                    <div>
                      <label className="text-[11px] font-semibold text-ink/60 dark:text-dark-ink/60 uppercase tracking-wider block mb-1">
                        Frequency
                      </label>
                      <div className="flex gap-1.5 flex-wrap">
                        {FREQUENCY_OPTIONS.map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => updateMed(i, "frequency", f)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                              m.frequency === f
                                ? "bg-primary text-white border-primary shadow-sm"
                                : "bg-surface dark:bg-dark-surface border-border-subtle dark:border-dark-border-subtle text-ink/70 dark:text-dark-ink/70 hover:border-primary/40"
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-ink/60 dark:text-dark-ink/60 uppercase tracking-wider block mb-1">
                        Duration
                      </label>
                      <div className="flex gap-1.5 flex-wrap">
                        {DURATION_OPTIONS.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => updateMed(i, "duration", d)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                              m.duration === d
                                ? "bg-primary text-white border-primary shadow-sm"
                                : "bg-surface dark:bg-dark-surface border-border-subtle dark:border-dark-border-subtle text-ink/70 dark:text-dark-ink/70 hover:border-primary/40"
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <Input
                        label="Special Instructions"
                        value={m.instructions}
                        onChange={(e) =>
                          updateMed(i, "instructions", e.target.value)
                        }
                        placeholder="e.g. Take after breakfast, avoid dairy products"
                      />
                    </div>
                  </div>
                  {form.medications.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMed(i)}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-sm hover:bg-rose-700 transition"
                      title="Remove medication"
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
            <label className="text-[11px] font-semibold text-ink/60 dark:text-dark-ink/60 uppercase tracking-wider block mb-1">
              General Patient Instructions / Lifestyle Recommendations
            </label>
            <textarea
              className="input-base text-xs min-h-[75px]"
              value={form.additionalInstructions}
              onChange={(e) => update("additionalInstructions", e.target.value)}
              placeholder="e.g. Increase hydration, monitor systolic blood pressure, follow up in 2 weeks…"
            />
          </div>

          {/* Live preview */}
          <Card title="Prescription Layout Preview">
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
