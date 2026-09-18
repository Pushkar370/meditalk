import { useState, useRef } from "react";
import { Download, FileText, Upload, X, Image, File, CheckCircle2 } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import MedicalRecordCard from "../../components/cards/MedicalRecordCard";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useFetch } from "../../hooks/useFetch";
import { getMedicalRecords, saveMedicalRecord } from "../../services/prescriptionService";
import { RECORD_TYPES, formatDate } from "../../constants";

const FILTERS = ["All", ...RECORD_TYPES];
const MAX_FILE_SIZE_MB = 15;

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
    reader.onload = (e) => onFile({ name: f.name, type: f.type, size: f.size, dataUrl: e.target.result });
    reader.readAsDataURL(f);
  }

  return (
    <div
      className={`relative rounded-xl border-2 border-dashed transition-colors p-8 text-center cursor-pointer ${dragging ? "border-primary bg-primary/5" : "border-sage/40 hover:border-primary/50 hover:bg-sage/5"}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]); }}
    >
      <input ref={inputRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
        onChange={(e) => processFile(e.target.files[0])} />

      {file ? (
        <div className="flex items-center justify-center gap-3">
          <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-success" />
          </div>
          <div className="text-left">
            <p className="font-medium text-ink text-sm">{file.name}</p>
            <p className="text-xs text-ink/50">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="ml-2 h-6 w-6 rounded-full bg-danger/10 text-danger flex items-center justify-center hover:bg-danger/20 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="h-12 w-12 rounded-full bg-sage/20 flex items-center justify-center mx-auto">
            <Upload className="h-6 w-6 text-primary/60" />
          </div>
          <p className="font-medium text-ink text-sm">Drop file or click to browse</p>
          <p className="text-xs text-ink/50">PDF, PNG, JPG, WEBP, DOC · Max {MAX_FILE_SIZE_MB}MB</p>
        </div>
      )}
    </div>
  );
}

export default function PatientRecords() {
  const { user } = useAuth();
  const toast = useToast();
  const patientId = user?.id;
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ type: "Lab Result", description: "", date: "", notes: "" });
  const [uploadFile, setUploadFile] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  const { data: records, loading, reload } = useFetch(() => getMedicalRecords(patientId), [patientId]);

  const list = (records || []).filter((r) => filter === "All" || r.type === filter);

  function handleDownload(record) {
    const fileData = record.details?.fileData;
    const fileName = record.details?.fileName || `${record.type}-${record.id}`;
    if (fileData) {
      const a = document.createElement("a");
      a.href = fileData;
      a.download = fileName;
      a.click();
    } else {
      toast.info("No downloadable file attached to this record.");
    }
  }

  async function handleUpload() {
    if (!uploadForm.type) { toast.error("Please select a record type."); return; }
    setUploading(true);
    try {
      await saveMedicalRecord({
        type: uploadForm.type,
        description: uploadForm.description || (uploadFile?.name),
        date: uploadForm.date || undefined,
        notes: uploadForm.notes,
        fileData: uploadFile?.dataUrl || null,
        fileName: uploadFile?.name || null,
        fileType: uploadFile?.type || null,
        fileSize: uploadFile?.size || null,
      });
      toast.success("Document uploaded successfully.");
      setShowUpload(false);
      setUploadFile(null);
      setUploadForm({ type: "Lab Result", description: "", date: "", notes: "" });
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to upload document.");
    } finally {
      setUploading(false);
    }
  }

  function getFilePreview(record) {
    const fd = record?.details?.fileData;
    const ft = record?.details?.fileType || "";
    if (!fd) return null;
    if (ft.startsWith("image/")) return <img src={fd} alt="Record" className="w-full max-h-96 object-contain rounded-lg border border-sage/20" />;
    if (ft === "application/pdf") return (
      <iframe src={fd} title="Record PDF" className="w-full h-96 rounded-lg border border-sage/20" />
    );
    return null;
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Health Records"
        subtitle="Your electronic health record (EHR) history."
        action={
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4" /> Upload Document
          </Button>
        }
      />

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "px-3 py-1.5 rounded-full text-sm font-medium transition " +
              (filter === f
                ? "bg-primary text-white"
                : "bg-white text-ink/60 border border-sage/40 hover:bg-sage/20")
            }
          >
            {f}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState icon={FileText} title="No records found" message={filter === "All" ? "Upload your first document to get started." : "No records match this filter yet."} />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((r) => (
            <MedicalRecordCard
              key={r.id}
              record={r}
              onView={setSelected}
              onDownload={r.details?.fileData ? handleDownload : null}
            />
          ))}
        </div>
      )}

      {/* View Record Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.type} · ${formatDate(selected.date)}` : ""}
        size="lg"
        footer={
          <>
            {selected?.details?.fileData && (
              <Button variant="outline" onClick={() => handleDownload(selected)}>
                <Download className="h-4 w-4" /> Download File
              </Button>
            )}
            <Button onClick={() => setSelected(null)}>Close</Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid sm:grid-cols-2 gap-4">
              <Info label="Record ID" value={selected.id} />
              <Info label="Doctor / Source" value={selected.doctor} />
              <Info label="Status" value={selected.status} />
              <Info label="Date" value={formatDate(selected.date)} />
            </div>
            <Info label="Description" value={selected.description} />
            {selected.details?.notes && <Info label="Notes" value={selected.details.notes} />}
            {selected.details?.symptoms?.length > 0 && (
              <Info label="Symptoms" value={selected.details.symptoms.join(", ")} />
            )}
            {selected.details?.diagnosis && <Info label="Diagnosis" value={selected.details.diagnosis} />}
            {selected.details?.treatment && <Info label="Treatment" value={selected.details.treatment} />}
            {selected.details?.fileData && (
              <div>
                <p className="text-ink/50 text-xs mb-2">Attached File: {selected.details.fileName}</p>
                {getFilePreview(selected)}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Upload Modal */}
      <Modal
        open={showUpload}
        onClose={() => { setShowUpload(false); setUploadFile(null); }}
        title="Upload Health Document"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowUpload(false); setUploadFile(null); }} disabled={uploading}>Cancel</Button>
            <Button onClick={handleUpload} loading={uploading}>
              <Upload className="h-4 w-4" /> Upload
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-base">Record Type</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {RECORD_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setUploadForm(f => ({ ...f, type: t }))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${uploadForm.type === t ? "bg-primary text-white border-primary" : "bg-white border-sage/40 text-ink/60 hover:bg-sage/10"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-base">Description (optional)</label>
            <input
              className="input-base"
              placeholder="e.g. Blood CBC report, Chest X-ray"
              value={uploadForm.description}
              onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="label-base">Date of Record (optional)</label>
            <input
              className="input-base"
              type="date"
              value={uploadForm.date}
              onChange={e => setUploadForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>

          <div>
            <label className="label-base">Notes (optional)</label>
            <textarea
              className="input-base min-h-[60px]"
              placeholder="Any additional context…"
              value={uploadForm.notes}
              onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <DropZone
            file={uploadFile}
            onFile={setUploadFile}
            onClear={() => setUploadFile(null)}
          />
        </div>
      </Modal>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-ink/50 text-xs">{label}</p>
      <p className="text-ink font-medium mt-0.5">{value || "—"}</p>
    </div>
  );
}
