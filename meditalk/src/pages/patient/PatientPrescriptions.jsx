import { useState } from "react";
import { Pill, FileDown } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import PrescriptionCard from "../../components/cards/PrescriptionCard";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useAuth } from "../../context/AuthContext";
import { useFetch } from "../../hooks/useFetch";
import { getPrescriptions } from "../../services/prescriptionService";
import { formatDate } from "../../constants";
import { generatePrescriptionPdf } from "../../utils/prescriptionPdf";

export default function PatientPrescriptions() {
  const { user } = useAuth();
  const patientId = user?.id;
  const [selected, setSelected] = useState(null);

  const { data: rx, loading } = useFetch(() => getPrescriptions({ patientId }), [patientId]);

  function handleDownload(prescription) {
    generatePrescriptionPdf(
      prescription,
      { name: prescription.doctorName, id: prescription.doctorId },
      { name: user?.name, id: patientId }
    );
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader title="My Prescriptions" subtitle="Digital prescriptions from your doctors." />

      {!rx || rx.length === 0 ? (
        <div className="card">
          <EmptyState icon={Pill} title="No prescriptions" message="When a doctor creates a prescription it will appear here." />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rx.map((p) => (
            <PrescriptionCard key={p.id} prescription={p} onView={setSelected} />
          ))}
        </div>
      )}

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
