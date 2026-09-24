import { useState, useRef } from "react";
import {
  Download, FileText, Upload, X, Image, File, CheckCircle2,
  Sparkles, Building2, AlertTriangle, ChevronDown, ChevronUp,
  FlaskConical, Pill, ClipboardList, ShieldAlert, Info,
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
  getMedicalRecords, saveMedicalRecord,
  synthesizeAiRecord, adoptAiRecords,
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
            <p className="text-xs text-ink/50">{(file.size / 1024 / 1024).toFixed(2)} MB
              {file.size > AI_FILE_SIZE_WARN_MB * 1024 * 1024 && (
                <span className="ml-2 text-accent">(Large file — keyword analysis only)</span>
              )}
            </p>
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

// ── AI Synthesis Result Card ────────────────────────────────────────────────
function AISynthesisCard({ synthesis, record, onAdopt, adopting }) {
  const [expanded, setExpanded] = useState(false);
  if (!synthesis) return null;

  const abnormalBiomarkers = (synthesis.extractedBiomarkers || []).filter(b => b.isAbnormal);
  const hasFindings = (synthesis.extractedDiagnoses?.length > 0) ||
    (synthesis.extractedAllergies?.length > 0) ||
    (synthesis.extractedMedications?.length > 0) ||
    abnormalBiomarkers.length > 0;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
          <Sparkles className="h-4.5 w-4.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-primary">AI Clinical Intelligence Brief</span>
            {synthesis.source === 'gemini_ai' && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/20 text-primary">Gemini AI</span>
            )}
            {synthesis.source === 'keyword_fallback' && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/30 text-ink/70">Keyword Extract</span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/20 text-success font-semibold">Ready for Doctor</span>
          </div>
          {synthesis.externalFacility && (
            <div className="flex items-center gap-1.5 mt-1">
              <Building2 className="h-3 w-3 text-ink/50" />
              <span className="text-xs text-ink/60">{synthesis.externalFacility}</span>
            </div>
          )}
          <p className="text-xs text-ink/70 mt-1.5 leading-relaxed">{synthesis.clinicalSummary}</p>
        </div>
      </div>

      {/* Clinical Disclaimer */}
      <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg bg-accent/10 border border-accent/30 p-2.5">
        <Info className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
        <p className="text-[11px] text-ink/70">Clinical Decision Support Only — AI analysis requires physician review before clinical use.</p>
      </div>

      {/* Expandable details */}
      {hasFindings && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full px-4 py-2 text-xs font-medium text-primary/80 hover:text-primary flex items-center gap-1 border-t border-primary/20 hover:bg-primary/5 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Hide" : "View"} Extracted Clinical Data
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-3 border-t border-primary/10">
              {synthesis.extractedDiagnoses?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink/60 mb-1.5 flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5" /> Prior Diagnoses
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {synthesis.extractedDiagnoses.map((d, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-white border border-sage/30 text-ink/70 font-medium">{d}</span>
                    ))}
                  </div>
                </div>
              )}

              {synthesis.extractedAllergies?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink/60 mb-1.5 flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-danger" /> Documented Allergies
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {synthesis.extractedAllergies.map((a, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-danger/10 border border-danger/20 text-danger font-medium">
                        {a.allergen || a} {a.severity === 'high' ? '⚠️' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {synthesis.extractedMedications?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink/60 mb-1.5 flex items-center gap-1.5">
                    <Pill className="h-3.5 w-3.5 text-primary" /> Prior Medications
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {synthesis.extractedMedications.map((m, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-sage/15 border border-sage/30 text-ink/70">
                        {typeof m === 'string' ? m : `${m.name}${m.dosage && m.dosage !== 'See record' ? ` ${m.dosage}` : ''}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {abnormalBiomarkers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink/60 mb-1.5 flex items-center gap-1.5">
                    <FlaskConical className="h-3.5 w-3.5 text-accent" /> Abnormal Biomarkers
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {abnormalBiomarkers.map((b, i) => (
                      <div key={i} className="flex items-center justify-between bg-danger/5 border border-danger/20 rounded-lg px-3 py-1.5 text-xs">
                        <span className="font-medium text-ink">{b.test}</span>
                        <div className="text-right">
                          <span className="text-danger font-bold">{b.value}</span>
                          <span className="text-ink/40 ml-1">ref: {b.reference}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {synthesis.clinicalRisks?.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Clinical Risks
                  </p>
                  <ul className="text-xs text-amber-800 space-y-1">
                    {synthesis.clinicalRisks.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Adopt into chart action */}
      {(synthesis.extractedAllergies?.length > 0 || synthesis.extractedMedications?.length > 0) && (
        <div className="border-t border-primary/20 p-3 flex items-center justify-between gap-3 bg-primary/3">
          <p className="text-xs text-ink/60">Add extracted allergies & medications to your profile?</p>
          <Button size="sm" onClick={onAdopt} loading={adopting}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Adopt into My Chart
          </Button>
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
  const [uploadForm, setUploadForm] = useState({ type: "Lab Result", description: "", date: "", notes: "", isExternalClinic: false });
  const [uploadFile, setUploadFile] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [synthRecord, setSynthRecord] = useState(null); // { id, synthesis }
  const [synthesizing, setSynthesizing] = useState(null); // recordId being synthesized
  const [adopting, setAdopting] = useState(false);

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
      const saved = await saveMedicalRecord({
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
      setUploadForm({ type: "Lab Result", description: "", date: "", notes: "", isExternalClinic: false });
      reload();

      // Auto-trigger AI synthesis for external clinic records with files
      if (uploadForm.isExternalClinic && saved?.record?.id) {
        setTimeout(() => handleSynthesize(saved.record.id), 500);
      }
    } catch (err) {
      toast.error(err.message || "Failed to upload document.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSynthesize(recordId, patientNotes) {
    setSynthesizing(recordId);
    try {
      const result = await synthesizeAiRecord(recordId, patientNotes);
      setSynthRecord({ id: recordId, synthesis: result.synthesis });
      reload(); // refresh cards to show AI Synthesized badge
      toast.success("AI clinical analysis complete.");
    } catch (err) {
      toast.error(err.message || "AI analysis failed.");
    } finally {
      setSynthesizing(null);
    }
  }

  async function handleAdopt() {
    if (!synthRecord?.synthesis) return;
    setAdopting(true);
    try {
      const s = synthRecord.synthesis;
      await adoptAiRecords(patientId, {
        allergies: (s.extractedAllergies || []).map(a => typeof a === 'string' ? a : a.allergen),
        medications: s.extractedMedications || [],
      });
      toast.success("Extracted information added to your health profile.");
      setSynthRecord(null);
    } catch (err) {
      toast.error(err.message || "Failed to adopt records.");
    } finally {
      setAdopting(false);
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

      {/* Prior Records AI Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-primary/8 via-sage/15 to-accent/8 border border-primary/20 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-ink text-sm">New to MediTalk or transferring from another clinic?</h3>
            <p className="text-xs text-ink/60 mt-0.5">Upload your previous discharge summaries, lab tests, and prescriptions. Our AI will extract your history and share it with your doctor automatically.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/5 shrink-0" onClick={() => { setUploadForm(f => ({ ...f, isExternalClinic: true })); setShowUpload(true); }}>
          <Upload className="h-4 w-4" /> Import Prior Records
        </Button>
      </div>

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
            <div key={r.id} className="flex flex-col gap-2">
              <MedicalRecordCard
                record={r}
                onView={setSelected}
                onDownload={r.details?.fileData ? handleDownload : null}
              />
              {/* AI Synthesize button for non-synthesized records with files */}
              {r.details?.fileData && !r.ai_processed_at && (
                <Button
                  variant="outline"
                  size="sm"
                  loading={synthesizing === r.id}
                  onClick={() => handleSynthesize(r.id)}
                  className="border-primary/30 text-primary hover:bg-primary/5 text-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {synthesizing === r.id ? "AI Analyzing..." : "Analyze with AI"}
                </Button>
              )}
              {r.ai_processed_at && (
                <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium text-primary">AI Synthesized</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSynthesize(r.id)}
                    className="text-xs text-ink/50 hover:text-primary p-1"
                  >
                    Re-analyze
                  </Button>
                </div>
              )}
              {/* Show synthesis result if this record was just analyzed */}
              {synthRecord?.id === r.id && (
                <AISynthesisCard
                  synthesis={synthRecord.synthesis}
                  record={r}
                  onAdopt={handleAdopt}
                  adopting={adopting}
                />
              )}
            </div>
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
              <Info2 label="Record ID" value={selected.id} />
              <Info2 label="Doctor / Source" value={selected.doctor} />
              <Info2 label="Status" value={selected.status} />
              <Info2 label="Date" value={formatDate(selected.date)} />
            </div>
            <Info2 label="Description" value={selected.description} />
            {selected.details?.notes && <Info2 label="Notes" value={selected.details.notes} />}
            {selected.details?.symptoms?.length > 0 && (
              <Info2 label="Symptoms" value={selected.details.symptoms.join(", ")} />
            )}
            {selected.details?.diagnosis && <Info2 label="Diagnosis" value={selected.details.diagnosis} />}
            {selected.details?.treatment && <Info2 label="Treatment" value={selected.details.treatment} />}
            {/* Show AI summary if available */}
            {selected.ai_summary && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
                <p className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> AI Clinical Summary
                </p>
                <p className="text-xs text-ink/70 leading-relaxed">{selected.ai_summary}</p>
              </div>
            )}
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
          {/* External clinic toggle */}
          <div
            onClick={() => setUploadForm(f => ({ ...f, isExternalClinic: !f.isExternalClinic }))}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${uploadForm.isExternalClinic ? 'bg-primary/10 border-primary/40' : 'bg-sage/5 border-sage/30 hover:bg-sage/10'}`}
          >
            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${uploadForm.isExternalClinic ? 'border-primary bg-primary' : 'border-sage/40'}`}>
              {uploadForm.isExternalClinic && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
            </div>
            <div>
              <p className="text-sm font-medium text-ink">This is from a previous clinic / hospital</p>
              <p className="text-xs text-ink/50">Enables AI clinical intelligence extraction for your doctor</p>
            </div>
            {uploadForm.isExternalClinic && (
              <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> AI Enabled
              </span>
            )}
          </div>

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
              placeholder="e.g. Blood CBC report, Chest X-ray, Discharge Summary"
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
              placeholder="Any additional context for the AI or doctor…"
              value={uploadForm.notes}
              onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <DropZone
            file={uploadFile}
            onFile={setUploadFile}
            onClear={() => setUploadFile(null)}
          />

          {uploadForm.isExternalClinic && (
            <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-ink/70">After upload, AI will automatically analyze this document and extract diagnoses, medications, and allergies for your doctor.</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function Info2({ label, value }) {
  return (
    <div>
      <p className="text-ink/50 text-xs">{label}</p>
      <p className="text-ink font-medium mt-0.5">{value || "—"}</p>
    </div>
  );
}
