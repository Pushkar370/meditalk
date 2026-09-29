import { useState } from "react";
import {
  Pill, FileDown, CheckCircle2, RotateCcw, MessageSquare, AlertCircle, CalendarClock
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

  const { data: rx, loading } = useFetch(() => getPrescriptions({ patientId }), [patientId]);
  const { data: refillsData, reload: reloadRefills } = useFetch(
    () => (patientId ? getPatientRefills(patientId) : Promise.resolve({ refillRequests: [] })),
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
      toast.success("Medications added to your Daily Routine! You can log your doses on your Dashboard.");
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
      toast.success(`Refill request submitted to Dr. ${refillModalRx.doctorName}!`);
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
    <div className="space-y-6">
      <PageHeader title="My Prescriptions & Refills" subtitle="Digital prescriptions, doctor refill requests, and daily dose schedules." />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-sage/30">
        <button
          onClick={() => setActiveTab("prescriptions")}
          className={
            "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition " +
            (activeTab === "prescriptions"
              ? "border-primary text-primary"
              : "border-transparent text-ink/50 hover:text-ink")
          }
        >
          Prescriptions ({(rx || []).length})
        </button>
        <button
          onClick={() => setActiveTab("refills")}
          className={
            "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition flex items-center gap-1.5 " +
            (activeTab === "refills"
              ? "border-primary text-primary"
              : "border-transparent text-ink/50 hover:text-ink")
          }
        >
          Refill Requests ({refillRequests.length})
          {refillRequests.some((r) => r.status === "pending") && (
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          )}
        </button>
      </div>

      {activeTab === "prescriptions" ? (
        !rx || rx.length === 0 ? (
          <div className="card">
            <EmptyState icon={Pill} title="No prescriptions" message="When a doctor creates a prescription it will appear here." />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      <RotateCcw className="h-3.5 w-3.5" /> Request Prescription Refill
                    </Button>
                  )}

                  {p.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddToRoutine(p)}
                      loading={addingToRoutine === p.id}
                      className="border-primary/30 text-primary hover:bg-primary/5 w-full text-xs"
                    >
                      <CalendarClock className="h-3.5 w-3.5" /> Add to Daily Medication Routine
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
          <div className="card">
            <EmptyState
              icon={RotateCcw}
              title="No refill requests"
              message="You haven't requested any prescription refills yet. Click 'Request Prescription Refill' on any active prescription."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {refillRequests.map((r) => (
              <div key={r.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink text-sm">Refill for #{r.prescription_id}</span>
                    <span className="text-xs text-ink/50">· Dr. {r.doctor_name}</span>
                    <span className="text-xs text-ink/40">· {formatDate(r.created_at)}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(r.medications || []).map((m, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md text-xs bg-sage/20 text-ink font-medium">
                        {m.medicine || m.name} ({m.dosage})
                      </span>
                    ))}
                  </div>

                  {r.patient_notes && (
                    <p className="text-xs text-ink/70">
                      <span className="font-medium text-ink">My note:</span> "{r.patient_notes}"
                    </p>
                  )}

                  {r.doctor_notes && (
                    <div className="p-2 rounded-lg bg-sage/10 border border-sage/20 text-xs text-ink/80 flex items-start gap-1.5 mt-1">
                      <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span><span className="font-semibold">Doctor Note:</span> {r.doctor_notes}</span>
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {r.status === "pending" && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                      Pending Doctor Review
                    </span>
                  )}
                  {r.status === "approved" && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                    </span>
                  )}
                  {r.status === "rejected" && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
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
            <Button variant="ghost" onClick={() => setRefillModalRx(null)}>Cancel</Button>
            <Button onClick={handleSubmitRefill} loading={submittingRefill}>
              <RotateCcw className="h-4 w-4" /> Submit Refill Request
            </Button>
          </>
        }
      >
        {refillModalRx && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-sage/10 border border-sage/30 space-y-1">
              <p className="text-xs text-ink/50">Doctor</p>
              <p className="font-semibold text-ink text-sm">Dr. {refillModalRx.doctorName}</p>
              <p className="text-xs text-ink/60">Prescription #{refillModalRx.id} · Issued {formatDate(refillModalRx.date)}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-ink/70 mb-2">Medications in this Refill Request:</p>
              <div className="space-y-1.5">
                {(refillModalRx.medications || []).map((m, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-sage/30 bg-white flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-ink">{m.medicine}</p>
                      <p className="text-[11px] text-ink/50">{m.frequency} · {m.instructions || "Standard instructions"}</p>
                    </div>
                    <span className="font-mono text-ink/70">{m.dosage}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">
                Note for Dr. {refillModalRx.doctorName} (Optional)
              </label>
              <textarea
                value={refillNotes}
                onChange={(e) => setRefillNotes(e.target.value)}
                placeholder="e.g. Continuing routine monthly supply for chronic condition. No changes in symptoms or side effects."
                rows={3}
                className="w-full border border-sage/40 rounded-xl p-3 text-xs focus:outline-none focus:border-primary resize-none bg-white"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* View Prescription Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Prescription ${selected?.id}`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => handleDownload(selected)}>
              <FileDown className="h-4 w-4" /> Download PDF
            </Button>
            <Button onClick={() => setSelected(null)}>Close</Button>
          </>
        }
      >
        {selected && <PrescriptionPreview rx={selected} />}
      </Modal>
    </div>
  );
}

export function PrescriptionPreview({ rx }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-xl bg-cream/70 border border-accent/30 p-4">
        <p className="font-semibold text-ink">{rx.doctorName}</p>
        <p className="text-xs text-ink/50">Issued on {formatDate(rx.date)}</p>
        {rx.diagnosis && <p className="text-xs text-ink/60 mt-1">Diagnosis: {rx.diagnosis}</p>}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink/50 border-b border-sage/30">
            <th className="py-2 font-medium">Medicine</th>
            <th className="py-2 font-medium">Dosage</th>
            <th className="py-2 font-medium">Frequency</th>
            <th className="py-2 font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {(rx.medications || []).map((m, i) => (
            <tr key={i} className="border-b border-sage/20">
              <td className="py-2 font-medium text-ink">{m.medicine}</td>
              <td className="py-2">{m.dosage}</td>
              <td className="py-2">{m.frequency}</td>
              <td className="py-2">{m.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(rx.medications || []).some(m => m.instructions) && (
        <div className="space-y-1">
          {(rx.medications || []).filter(m => m.instructions).map((m, i) => (
            <p key={i} className="text-ink/70 text-xs">
              <span className="text-ink/50">{m.medicine}: </span>{m.instructions}
            </p>
          ))}
        </div>
      )}
      {rx.additionalInstructions && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs text-amber-800 font-medium mb-1">Additional Instructions</p>
          <p className="text-ink/70 text-sm">{rx.additionalInstructions}</p>
        </div>
      )}
    </div>
  );
}
