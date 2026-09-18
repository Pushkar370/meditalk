import { FileDown, Pill } from "lucide-react";
import { formatDate } from "../../constants";
import StatusBadge from "../ui/StatusBadge";
import Button from "../ui/Button";
import { generatePrescriptionPdf } from "../../utils/prescriptionPdf";

export default function PrescriptionCard({ prescription, onView, doctor }) {
  const p = prescription;

  function handleDownload(e) {
    e.stopPropagation();
    generatePrescriptionPdf(
      p,
      { name: doctor?.name || p.doctorName, id: p.doctorId, specialty: doctor?.specialty },
      { name: p.patientName, id: p.patientId }
    );
  }

  return (
    <div className="card group hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-sage/20 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <Pill className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-ink">Rx #{p.id}</p>
            <p className="text-xs text-ink/50">{formatDate(p.date)}</p>
          </div>
        </div>
        <StatusBadge status={p.status} />
      </div>
      <p className="mt-3 text-sm text-ink/70">
        {p.medications.length} medication{p.medications.length > 1 ? "s" : ""} · {p.doctorName}
      </p>
      {p.diagnosis && (
        <p className="mt-1 text-xs text-ink/50">Dx: {p.diagnosis}</p>
      )}
      <div className="mt-3 flex gap-2">
        {onView && (
          <Button size="sm" variant="outline" onClick={() => onView(p)}>
            View
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={handleDownload}>
          <FileDown className="h-3.5 w-3.5" /> PDF
        </Button>
      </div>
    </div>
  );
}
