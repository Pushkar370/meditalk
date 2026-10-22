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

  const medCount = p.medications?.length || 0;

  return (
    <div className="card group hover:shadow-card-hover transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center shrink-0">
            <Pill className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink dark:text-white tracking-tight">
              Rx #{p.id}
            </p>
            <p className="text-xs text-ink-secondary dark:text-neutral-400 mt-0.5">
              {formatDate(p.date)}
            </p>
          </div>
        </div>
        <StatusBadge status={p.status} />
      </div>

      <div className="mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
        <p className="text-xs font-medium text-ink dark:text-neutral-200">
          {medCount} medication{medCount !== 1 ? "s" : ""} · {p.doctorName}
        </p>
        {p.diagnosis && (
          <p className="mt-1 text-xs text-ink-secondary dark:text-neutral-400">
            Diagnosis: {p.diagnosis}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 pt-1">
        {onView && (
          <Button size="sm" variant="secondary" onClick={() => onView(p)}>
            View Details
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={handleDownload}>
          <FileDown className="h-3.5 w-3.5" /> Download PDF
        </Button>
      </div>
    </div>
  );
}
