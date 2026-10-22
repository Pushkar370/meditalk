import { useState, useRef } from "react";
import {
  Download,
  FileText,
  Upload,
  X,
  Image,
  File,
  CheckCircle2,
  Sparkles,
  Building2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Pill,
  ClipboardList,
  ShieldAlert,
  Info,
  Check,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import MedicalRecordCard from "../../components/cards/MedicalRecordCard";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useFetch } from "../../hooks/useFetch";
import {
  getMedicalRecords,
  saveMedicalRecord,
  synthesizeAiRecord,
  adoptAiRecords,
} from "../../services/prescriptionService";
import { RECORD_TYPES, formatDate } from "../../constants";

const FILTERS = ["All", ...RECORD_TYPES];
const MAX_FILE_SIZE_MB = 15;
const AI_FILE_SIZE_WARN_MB = 8;

// ── Upload Drop Zone ────────────────────────────────────────────────────────
function DropZone({ file, onFile, onClear }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function processFile(f) {
    if (!f) return;
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`File must be under ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) =>
      onFile({ name: f.name, type: f.type, size: f.size, dataUrl: e.target.result });
    reader.readAsDataURL(f);
  }

  return (
    <div
      className={`relative rounded-2xl border-2 border-dashed transition-all p-7 text-center cursor-pointer ${
        dragging
          ? "border-primary bg-primary/5"
          : "border-border-subtle dark:border-dark-border-subtle hover:border-primary/50 hover:bg-canvas dark:hover:bg-dark-surface-elevated/40"
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        processFile(e.dataTransfer.files[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
        onChange={(e) => processFile(e.target.files[0])}
      />

      {file ? (
        <div className="flex items-center justify-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-ink dark:text-dark-ink text-sm">
              {file.name}
            </p>
            <p className="text-xs text-ink/50 dark:text-dark-ink/50">
              {(file.size / 1024 / 1024).toFixed(2)} MB
              {file.size > AI_FILE_SIZE_WARN_MB * 1024 * 1024 && (
                <span className="ml-2 text-amber-500 font-medium">
                  (Large file — keyword extraction)
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="ml-3 h-7 w-7 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center hover:bg-rose-500/20 transition active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-primary-light mx-auto">
            <Upload className="h-5 w-5" />
          </div>
          <p className="font-semibold text-ink dark:text-dark-ink text-sm">
            Drag file here or browse files
          </p>
          <p className="text-xs text-ink/40 dark:text-dark-ink/40">
            PDF, PNG, JPG, WEBP, DOC · Max {MAX_FILE_SIZE_MB}MB
          </p>
        </div>
      )}
    </div>
  );
}

// ── AI Synthesis Result Card ────────────────────────────────────────────────
function AISynthesisCard({ synthesis, record, onAdopt, adopting }) {
  const [expanded, setExpanded] = useState(false);
  if (!synthesis) return null;

  const abnormalBiomarkers = (synthesis.extractedBiomarkers || []).filter(
    (b) => b.isAbnormal
  );
  const hasFindings =
    synthesis.extractedDiagnoses?.length > 0 ||
    synthesis.extractedAllergies?.length > 0 ||
    synthesis.extractedMedications?.length > 0 ||
    abnormalBiomarkers.length > 0;

  return (
    <div className="rounded-2xl border border-primary/20 dark:border-primary/30 bg-surface dark:bg-dark-surface overflow-hidden shadow-card dark:shadow-none transition-all">
      {/* Header */}
      <div className="flex items-start gap-3.5 p-5">
        <div className="h-10 w-10 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-ink dark:text-dark-ink">
              AI Clinical Intelligence Brief
            </span>
            {synthesis.source === "gemini_ai" && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light">
                Gemini AI
              </span>
            )}
            {synthesis.source === "keyword_fallback" && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-canvas dark:bg-dark-surface-elevated text-ink/60 border border-border-subtle dark:border-dark-border-subtle">
                Keyword Extract
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold">
              Ready for Doctor
            </span>
          </div>
          {synthesis.externalFacility && (
            <div className="flex items-center gap-1.5 mt-1">
              <Building2 className="h-3.5 w-3.5 text-ink/40 dark:text-dark-ink/40" />
              <span className="text-xs text-ink/60 dark:text-dark-ink/60">
                {synthesis.externalFacility}
              </span>
            </div>
          )}
          <p className="text-xs text-ink/75 dark:text-dark-ink/75 leading-relaxed pt-1">
            {synthesis.clinicalSummary}
          </p>
        </div>
      </div>

      {/* Clinical Disclaimer */}
      <div className="mx-5 mb-3 flex items-start gap-2.5 rounded-xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle p-3">
        <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <p className="text-[11px] text-ink/70 dark:text-dark-ink/70">
          Clinical Decision Support Only — AI-synthesized findings require physician verification before clinical prescription or treatment changes.
        </p>
      </div>

      {/* Expandable details */}
      {hasFindings && (
        <>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full px-5 py-2.5 text-xs font-semibold text-primary dark:text-primary-light hover:underline flex items-center justify-center gap-1.5 border-t border-border-subtle dark:border-dark-border-subtle bg-canvas/50 dark:bg-dark-surface-elevated/20 transition"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Hide" : "View"} Extracted Clinical Data
          </button>

          {expanded && (
            <div className="p-5 pt-3 border-t border-border-subtle dark:border-dark-border-subtle space-y-4 text-xs">
              {abnormalBiomarkers.length > 0 && (
                <div>
                  <p className="font-semibold text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Flagged Biomarkers
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {abnormalBiomarkers.map((b, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20"
                      >
                        <span className="font-medium text-ink dark:text-dark-ink block">
                          {b.name}
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 font-bold">
                          {b.value} {b.unit}
                        </span>
                        {b.referenceRange && (
                          <span className="text-[10px] text-ink/40 dark:text-dark-ink/40 block mt-0.5">
                            Ref: {b.referenceRange}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {synthesis.extractedDiagnoses?.length > 0 && (
                <div>
                  <p className="font-semibold text-ink dark:text-dark-ink mb-1.5">
                    Extracted Diagnoses:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {synthesis.extractedDiagnoses.map((d, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light font-medium"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {synthesis.extractedMedications?.length > 0 && (
                <div>
                  <p className="font-semibold text-ink dark:text-dark-ink mb-1.5">
                    Referenced Medications:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {synthesis.extractedMedications.map((m, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-canvas dark:bg-dark-surface-elevated text-ink/80 dark:text-dark-ink/80 border border-border-subtle dark:border-dark-border-subtle font-medium"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Adopt Action CTA */}
      <div className="p-4 border-t border-border-subtle dark:border-dark-border-subtle bg-canvas/30 dark:bg-dark-surface-elevated/10 flex items-center justify-between gap-3">
        <p className="text-[11px] text-ink/50 dark:text-dark-ink/50">
          Sync extracted data with your permanent medical record profile.
        </p>
        <Button
          size="sm"
          onClick={() => onAdopt(record)}
          loading={adopting}
          className="text-xs shrink-0"
        >
          <Check className="h-3.5 w-3.5 mr-1" /> Adopt Findings
        </Button>
      </div>
    </div>
  );
}

export default function PatientRecords() {
  const { user } = useAuth();
  const toast = useToast();
  const patientId = user?.id;

  const [activeFilter, setActiveFilter] = useState("All");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [adopting, setAdopting] = useState(false);

  const [form, setForm] = useState({
    type: RECORD_TYPES[0],
    description: "",
    facility: "",
    date: new Date().toISOString().slice(0, 10),
    file: null,
  });

  const { data: records, loading, reload } = useFetch(
    () => getMedicalRecords(patientId),
    [patientId]
  );

  const filtered = (records || []).filter((r) => {
    if (activeFilter === "All") return true;
    return r.type === activeFilter;
  });

  async function handleUpload() {
    if (!form.description.trim()) {
      toast.error("Please provide a title or brief summary for this record.");
      return;
    }
    setUploading(true);
    try {
      await saveMedicalRecord({
        patientId,
        type: form.type,
        description: form.description,
        facility: form.facility,
        date: form.date,
        file: form.file,
      });
      toast.success("Medical document saved & queued for AI clinical indexing.");
      setUploadOpen(false);
      setForm({
        type: RECORD_TYPES[0],
        description: "",
        facility: "",
        date: new Date().toISOString().slice(0, 10),
        file: null,
      });
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to upload document.");
    } finally {
      setUploading(false);
    }
  }

  async function handleAdopt(record) {
    setAdopting(true);
    try {
      await adoptAiRecords(record.id);
      toast.success("Clinical findings adopted into your patient health profile!");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to adopt findings.");
    } finally {
      setAdopting(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Medical Records Vault"
        subtitle="Clinical document vault with automated AI extraction and historical records."
        action={
          <Button onClick={() => setUploadOpen(true)} className="text-xs">
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Document
          </Button>
        }
      />

      {/* Filter Chips */}
      <div className="flex p-1 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/60 border border-border-subtle dark:border-dark-border-subtle w-fit max-w-full overflow-x-auto scrollbar-none">
        {FILTERS.map((f) => {
          const active = activeFilter === f;
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 shrink-0 ${
                active
                  ? "bg-surface dark:bg-dark-surface text-ink dark:text-dark-ink shadow-sm"
                  : "text-ink/50 dark:text-dark-ink/50 hover:text-ink dark:hover:text-dark-ink"
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card py-12">
          <EmptyState
            icon={FileText}
            title={`No ${activeFilter === "All" ? "" : activeFilter} records found`}
            message="Upload external lab tests, imaging reports, or discharge summaries to keep all your medical records in one place."
            action={
              <Button
                size="sm"
                onClick={() => setUploadOpen(true)}
                className="text-xs"
              >
                Upload Document
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((record) => (
            <div key={record.id} className="space-y-2">
              <MedicalRecordCard
                record={record}
                onView={setSelectedRecord}
              />
              {record.aiSynthesis && (
                <AISynthesisCard
                  synthesis={record.aiSynthesis}
                  record={record}
                  onAdopt={handleAdopt}
                  adopting={adopting}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Document Modal */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload Medical Document"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadOpen(false)}
              disabled={uploading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleUpload}
              loading={uploading}
              disabled={!form.description.trim()}
              className="text-xs"
            >
              Save to Vault
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <DropZone
            file={form.file}
            onFile={(f) => setForm((prev) => ({ ...prev, file: f }))}
            onClear={() => setForm((prev) => ({ ...prev, file: null }))}
          />

          <div>
            <label className="block text-xs font-semibold text-ink/70 dark:text-dark-ink/70 mb-1">
              Document Title / Summary <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="e.g. Complete Blood Count (CBC) Panel"
              className="input-base text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink/70 dark:text-dark-ink/70 mb-1">
                Record Type
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, type: e.target.value }))
                }
                className="input-base text-xs"
              >
                {RECORD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink/70 dark:text-dark-ink/70 mb-1">
                Document Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, date: e.target.value }))
                }
                className="input-base text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink/70 dark:text-dark-ink/70 mb-1">
              External Medical Facility (Optional)
            </label>
            <input
              type="text"
              value={form.facility}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, facility: e.target.value }))
              }
              placeholder="e.g. City Diagnostic Laboratory"
              className="input-base text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* Record Preview Modal */}
      <Modal
        open={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title="Document Preview"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            {selectedRecord?.fileUrl && (
              <a
                href={selectedRecord.fileUrl}
                download={selectedRecord.description || "record"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border-subtle dark:border-dark-border-subtle bg-surface dark:bg-dark-surface text-xs font-semibold text-ink dark:text-dark-ink hover:bg-canvas transition"
              >
                <Download className="h-3.5 w-3.5" /> Download File
              </a>
            )}
            <Button
              size="sm"
              onClick={() => setSelectedRecord(null)}
              className="text-xs ml-auto"
            >
              Close
            </Button>
          </div>
        }
      >
        {selectedRecord && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-canvas dark:bg-dark-surface-elevated/40 border border-border-subtle dark:border-dark-border-subtle">
              <h4 className="font-bold text-ink dark:text-dark-ink text-base">
                {selectedRecord.description}
              </h4>
              <p className="text-xs text-ink/50 dark:text-dark-ink/50 mt-1">
                {selectedRecord.type} · {formatDate(selectedRecord.date)}
                {selectedRecord.facility && ` · ${selectedRecord.facility}`}
              </p>
            </div>

            {selectedRecord.fileUrl ? (
              <div className="rounded-2xl border border-border-subtle dark:border-dark-border-subtle overflow-hidden bg-black/5 flex items-center justify-center min-h-[300px]">
                {selectedRecord.fileType?.startsWith("image/") ? (
                  <img
                    src={selectedRecord.fileUrl}
                    alt={selectedRecord.description}
                    className="max-h-[500px] object-contain"
                  />
                ) : (
                  <iframe
                    src={selectedRecord.fileUrl}
                    title={selectedRecord.description}
                    className="w-full h-[500px] border-0"
                  />
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-ink/40">
                <FileText className="h-8 w-8 mx-auto mb-2 text-ink/30" />
                No direct document file attached to this clinical record entry.
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
