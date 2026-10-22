import { useState } from "react";
import {
  Pill,
  FileDown,
  CheckCircle2,
  RotateCcw,
  MessageSquare,
  AlertCircle,
  CalendarClock,
  Clock,
  User,
  Calendar,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import PrescriptionCard from "../../components/cards/PrescriptionCard";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useFetch } from "../../hooks/useFetch";
import {
  getPrescriptions,
  getPatientRefills,
  requestPrescriptionRefill,
  createAdherenceSchedules,
} from "../../services/prescriptionService";
import { formatDate } from "../../constants";
import { generatePrescriptionPdf } from "../../utils/prescriptionPdf";

export function PrescriptionPreview({ rx }) {
  if (!rx) return null;
  return (
    <div className="space-y-5 text-sm">
      <div className="p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-ink/50 dark:text-dark-ink/50">Prescribing Physician</p>
          <p className="text-base font-bold text-ink dark:text-dark-ink">
            {rx.doctorName?.startsWith("Dr.") ? rx.doctorName : `Dr. ${rx.doctorName || "Doctor"}`}
          </p>
          <p className="text-xs text-ink/60 dark:text-dark-ink/60">
            {rx.specialty || "Medical Specialist"}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <span className="text-xs text-ink/50 dark:text-dark-ink/50">Date Issued</span>
          <p className="text-xs font-semibold text-ink dark:text-dark-ink">
            {formatDate(rx.date)}
          </p>
          <p className="text-[11px] font-mono text-ink/40 dark:text-dark-ink/40 mt-0.5">
            Rx ID: #{rx.id}
          </p>
        </div>
      </div>

      {rx.diagnosis && (
        <div>
          <span className="text-xs font-semibold text-ink/60 dark:text-dark-ink/60 uppercase tracking-wider block mb-1">
            Clinical Diagnosis:
          </span>
          <p className="text-sm font-medium text-ink dark:text-dark-ink">
            {rx.diagnosis}
          </p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-ink/60 dark:text-dark-ink/60 uppercase tracking-wider mb-2.5">
          Prescribed Medications:
        </p>
        <div className="divide-y divide-border-subtle dark:divide-dark-border-subtle border border-border-subtle dark:border-dark-border-subtle rounded-2xl overflow-hidden bg-surface dark:bg-dark-surface">
          {(rx.medications || []).map((m, i) => (
            <div key={i} className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm text-ink dark:text-dark-ink">
                  {m.medicine || m.name}
                </p>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light">
                  {m.dosage}
                </span>
              </div>
              <p className="text-xs text-ink/60 dark:text-dark-ink/60">
                Frequency: <span className="font-medium text-ink dark:text-dark-ink">{m.frequency}</span>
                {m.duration && ` · Duration: ${m.duration}`}
              </p>
              {m.instructions && (
                <p className="text-xs text-ink/70 dark:text-dark-ink/70 italic mt-1">
                  Instructions: "{m.instructions}"
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {(rx.instructions || rx.additionalInstructions) && (
        <div className="p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle text-xs space-y-1">
          <span className="font-semibold text-ink dark:text-dark-ink">
            General Patient Instructions:
          </span>
          <p className="text-ink/80 dark:text-dark-ink/80 leading-relaxed">
            {rx.instructions || rx.additionalInstructions}
          </p>
        </div>
      )}
    </div>
  );
}

export default function PatientPrescriptions() {
  const { user } = useAuth();
  const toast = useToast();
  const patientId = user?.id;
  const [activeTab, setActiveTab] = useState("prescriptions");
  const [selected, setSelected] = useState(null);
  const [addingToRoutine, setAddingToRoutine] = useState(null);

  // CW-4: Refill State
  const [refillModalRx, setRefillModalRx] = useState(null);
  const [refillNotes, setRefillNotes] = useState("");
  const [submittingRefill, setSubmittingRefill] = useState(false);

  const { data: rx, loading } = useFetch(
    () => getPrescriptions({ patientId }),
    [patientId]
  );
  const { data: refillsData, reload: reloadRefills } = useFetch(
    () =>
      patientId
        ? getPatientRefills(patientId)
        : Promise.resolve({ refillRequests: [] }),
    [patientId]
  );

  const refillRequests = refillsData?.refillRequests || [];

  function handleDownload(prescription) {
    generatePrescriptionPdf(
      prescription,
      { name: prescription.doctorName, id: prescription.doctorId },
      { name: user?.name, id: patientId }
    );
  }

  async function handleAddToRoutine(prescription) {
    if (!prescription?.medications?.length) {
      toast.error("This prescription has no medications listed.");
      return;
    }
    setAddingToRoutine(prescription.id);
    try {
      await createAdherenceSchedules(
        patientId,
        prescription.id,
        prescription.medications.map((m) => ({
          name: m.medicine || m.name,
          dosage: m.dosage || "1 dose",
          frequency: m.frequency || "OD",
          instructions: m.instructions || "",
        }))
      );
      toast.success(
        "Medications added to your Daily Routine! You can log doses on your Dashboard."
      );
    } catch (err) {
      toast.error(err.message || "Failed to add medications to routine.");
    } finally {
      setAddingToRoutine(null);
    }
  }

  async function handleSubmitRefill() {
    if (!refillModalRx) return;
    setSubmittingRefill(true);
    try {
      await requestPrescriptionRefill({
        prescriptionId: refillModalRx.id,
        patientNotes: refillNotes,
      });
      toast.success(
        `Refill request submitted to Dr. ${refillModalRx.doctorName}!`
      );
      setRefillModalRx(null);
      setRefillNotes("");
      reloadRefills();
      setActiveTab("refills");
    } catch (err) {
      toast.error(err.message || "Failed to submit refill request.");
    } finally {
      setSubmittingRefill(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Prescriptions & Refills"
        subtitle="Digital clinical prescriptions, doctor refill requests, and medication routines."
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
          Prescriptions ({(rx || []).length})
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
          {refillRequests.some((r) => r.status === "pending") && (
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>
      </div>

      {activeTab === "prescriptions" ? (
        !rx || rx.length === 0 ? (
          <div className="card py-12">
            <EmptyState
              icon={Pill}
              title="No prescriptions on record"
              message="When your doctor creates a digital prescription, it will appear here."
            />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {rx.map((p) => (
              <div key={p.id} className="flex flex-col gap-2">
                <PrescriptionCard prescription={p} onView={setSelected} />

                {/* Refill & Routine Actions */}
                <div className="flex flex-col gap-1.5">
                  {p.status === "active" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setRefillModalRx(p);
                        setRefillNotes("");
                      }}
                      className="w-full text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Request Prescription Refill
                    </Button>
                  )}

                  {p.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddToRoutine(p)}
                      loading={addingToRoutine === p.id}
                      className="border-primary/30 text-primary dark:text-primary-light hover:bg-primary/5 w-full text-xs"
                    >
                      <CalendarClock className="h-3.5 w-3.5 mr-1" /> Add to Daily Routine
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Refill Requests Tab */
        refillRequests.length === 0 ? (
          <div className="card py-12">
            <EmptyState
              icon={RotateCcw}
              title="No refill requests"
              message="You haven't requested any prescription refills yet. Click 'Request Prescription Refill' on any active prescription."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {refillRequests.map((r) => (
              <div
                key={r.id}
                className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink dark:text-dark-ink text-sm">
                      Refill for #{r.prescription_id}
                    </span>
                    <span className="text-xs text-ink/50 dark:text-dark-ink/50">
                      · Dr. {r.doctor_name}
                    </span>
                    <span className="text-xs text-ink/40 dark:text-dark-ink/40">
                      · {formatDate(r.created_at)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(r.medications || []).map((m, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs bg-canvas dark:bg-dark-surface-elevated/60 text-ink dark:text-dark-ink border border-border-subtle dark:border-dark-border-subtle font-medium"
                      >
                        {m.medicine || m.name} ({m.dosage})
                      </span>
                    ))}
                  </div>

                  {r.patient_notes && (
                    <p className="text-xs text-ink/70 dark:text-dark-ink/70">
                      <span className="font-medium text-ink dark:text-dark-ink">Patient Note:</span>{" "}
                      "{r.patient_notes}"
                    </p>
                  )}

                  {r.doctor_notes && (
                    <div className="p-3 rounded-xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle text-xs text-ink/80 dark:text-dark-ink/80 flex items-start gap-2 mt-1">
                      <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Doctor Note:</span> {r.doctor_notes}
                      </div>
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {r.status === "pending" && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      Pending Doctor Review
                    </span>
                  )}
                  {r.status === "approved" && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                    </span>
                  )}
                  {r.status === "rejected" && (
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

      {/* CW-4: Request Refill Modal */}
      <Modal
        open={!!refillModalRx}
        onClose={() => setRefillModalRx(null)}
        title="Request Prescription Refill"
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRefillModalRx(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitRefill}
              loading={submittingRefill}
              className="text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Submit Refill Request
            </Button>
          </>
        }
      >
        {refillModalRx && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle space-y-1">
              <p className="text-xs text-ink/50 dark:text-dark-ink/50">Consultant</p>
              <p className="font-semibold text-ink dark:text-dark-ink text-sm">
                Dr. {refillModalRx.doctorName}
              </p>
              <p className="text-xs text-ink/60 dark:text-dark-ink/60">
                Prescription #{refillModalRx.id} · Issued {formatDate(refillModalRx.date)}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-ink/70 dark:text-dark-ink/70 uppercase tracking-wider mb-2">
                Medications to Refill:
              </p>
              <div className="space-y-2">
                {(refillModalRx.medications || []).map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-border-subtle dark:border-dark-border-subtle bg-surface dark:bg-dark-surface flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-ink dark:text-dark-ink">
                        {m.medicine || m.name}
                      </span>
                      <span className="text-ink/40 dark:text-dark-ink/40 ml-1.5">
                        ({m.dosage})
                      </span>
                    </div>
                    <span className="text-ink/50 dark:text-dark-ink/50 font-mono">
                      {m.frequency}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink/70 dark:text-dark-ink/70 mb-1.5">
                Notes for your doctor (optional):
              </label>
              <textarea
                rows={3}
                value={refillNotes}
                onChange={(e) => setRefillNotes(e.target.value)}
                placeholder="e.g., Running low on 30-day supply, symptoms remain well controlled."
                className="w-full bg-canvas dark:bg-dark-surface-elevated border border-border-subtle dark:border-dark-border-subtle rounded-2xl p-3.5 text-xs text-ink dark:text-dark-ink placeholder:text-ink/30 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition resize-none"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Prescription View Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Prescription Details"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(selected)}
              className="text-xs"
            >
              <FileDown className="h-3.5 w-3.5 mr-1" /> Download PDF
            </Button>
            <Button size="sm" onClick={() => setSelected(null)} className="text-xs">
              Close
            </Button>
          </div>
        }
      >
        {selected && <PrescriptionPreview rx={selected} />}
      </Modal>
    </div>
  );
}
