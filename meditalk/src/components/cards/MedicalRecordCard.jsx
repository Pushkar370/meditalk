import { FileText, FlaskConical, ScanLine, Pill, Activity } from "lucide-react";
import { formatDate } from "../../constants";
import StatusBadge from "../ui/StatusBadge";
import Button from "../ui/Button";

const TYPE_ICON = {
  Consultation: FileText,
  "Lab Result": FlaskConical,
  Imaging: ScanLine,
  Prescription: Pill,
  "Vital Signs": Activity,
};

export default function MedicalRecordCard({ record, onView, onDownload }) {
  const Icon = TYPE_ICON[record.type] || FileText;

  return (
    <div className="card group hover:shadow-card-hover transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink dark:text-white tracking-tight truncate">
              {record.type}
            </p>
            <p className="text-xs text-ink-secondary dark:text-neutral-400 mt-0.5">
              {formatDate(record.date)}
            </p>
          </div>
        </div>
        <StatusBadge status={record.status} />
      </div>

      <div className="mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.06] min-w-0">
        <p className="text-xs text-ink dark:text-neutral-300 break-words leading-relaxed" title={record.description}>
          {record.description}
        </p>
        {record.doctor && (
          <p className="mt-1 text-[11px] text-ink-secondary dark:text-neutral-400 truncate" title={record.doctor}>
            Attending: {record.doctor}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
        {onView && (
          <Button size="sm" variant="secondary" onClick={() => onView(record)}>
            View Document
          </Button>
        )}
        {onDownload && (
          <Button size="sm" variant="outline" onClick={() => onDownload(record)}>
            Download
          </Button>
        )}
      </div>
    </div>
  );
}
