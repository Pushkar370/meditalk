import { useState } from "react";
import { UserCheck, CheckCircle2, XCircle, Clock, AlertTriangle, Search, Filter, ShieldCheck, Mail, Phone, Calendar, Award } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import EmptyState from "../../components/ui/EmptyState";
import LoadingState from "../../components/ui/LoadingState";
import { useToast } from "../../context/ToastContext";
import { useFetch } from "../../hooks/useFetch";
import { getPendingDoctors, getAllDoctorsWithVerification, verifyDoctor } from "../../services/adminService";

export default function AdminDoctorVerification() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("pending"); // "pending" | "all"
  const [search, setSearch] = useState("");
  const [rejectingDoctor, setRejectingDoctor] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvingDoctor, setApprovingDoctor] = useState(null);
  const [processing, setProcessing] = useState(false);

  const { data: pendingList, loading: loadingPending, reload: reloadPending } = useFetch(getPendingDoctors);
  const { data: allList, loading: loadingAll, reload: reloadAll } = useFetch(getAllDoctorsWithVerification);

  const reloadBoth = () => {
    reloadPending();
    reloadAll();
  };

  const handleApprove = async (doctor) => {
    setProcessing(true);
    try {
      await verifyDoctor(doctor.id, "approve");
      toast.success(`Dr. ${doctor.name} has been approved and notified.`);
      setApprovingDoctor(null);
      reloadBoth();
    } catch (err) {
      toast.error(err.message || "Failed to approve doctor.");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingDoctor) return;
    setProcessing(true);
    try {
      await verifyDoctor(rejectingDoctor.id, "reject", rejectReason);
      toast.info(`Dr. ${rejectingDoctor.name}'s application has been rejected.`);
      setRejectingDoctor(null);
      setRejectReason("");
      reloadBoth();
    } catch (err) {
      toast.error(err.message || "Failed to reject doctor application.");
    } finally {
      setProcessing(false);
    }
  };

  const pendingDoctors = pendingList || [];
  const allDoctors = (allList || []).filter(
    (d) =>
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.specialty?.toLowerCase().includes(search.toLowerCase()) ||
      d.email?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = pendingDoctors.length;

  const tableColumns = [
    {
      header: "Doctor",
      render: (d) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary border border-primary/20">
            {d.name?.charAt(0) || "D"}
          </div>
          <div>
            <div className="font-semibold text-ink">{d.name}</div>
            <div className="text-xs text-ink/50 flex items-center gap-2 mt-0.5">
              <span>{d.email}</span>
              {d.phone && <span>• {d.phone}</span>}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: "Specialty",
      render: (d) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
          {d.specialty || "General Medicine"}
        </span>
      ),
    },
    {
      header: "Experience",
      render: (d) => (
        <span className="text-xs text-ink/70">
          {d.experience ? `${d.experience} yr${d.experience > 1 ? "s" : ""}` : "N/A"}
        </span>
      ),
    },
    {
      header: "Verification",
      render: (d) => {
        const st = d.verification_status || "approved";
        if (st === "pending") {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
              <Clock className="w-3 h-3" /> Pending Review
            </span>
          );
        }
        if (st === "rejected") {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-danger/10 text-danger border border-danger/20" title={d.rejection_notes || "Rejected"}>
              <XCircle className="w-3 h-3" /> Rejected
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-success/15 text-success border border-success/30">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      },
    },
    {
      header: "Registered",
      render: (d) => (
        <span className="text-xs text-ink/50">
          {d.registered_at ? new Date(d.registered_at).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      header: "Actions",
      align: "right",
      render: (d) => (
        <div className="flex items-center justify-end gap-1.5">
          {d.verification_status !== "approved" && (
            <button
              onClick={() => setApprovingDoctor(d)}
              className="p-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 border border-success/20 transition-colors"
              title="Approve doctor"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          {d.verification_status !== "rejected" && (
            <button
              onClick={() => setRejectingDoctor(d)}
              className="p-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20 transition-colors"
              title="Reject doctor application"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctor Verification Center"
        subtitle="Review credential submissions, approve new practitioners, and enforce medical oversight."
        action={
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              pendingCount > 0
                ? "bg-amber-100 border-amber-300 text-amber-900 animate-pulse"
                : "bg-white border-sage/30 text-ink/60"
            }`}>
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>{pendingCount} Pending Approval{pendingCount === 1 ? "" : "s"}</span>
            </div>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-sage/30 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === "pending"
                ? "bg-primary text-white shadow-sm"
                : "bg-white border border-sage/30 text-ink/70 hover:text-ink hover:bg-sage/10"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pending Review Queue</span>
            {pendingCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-200 text-amber-900">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === "all"
                ? "bg-primary text-white shadow-sm"
                : "bg-white border border-sage/30 text-ink/70 hover:text-ink hover:bg-sage/10"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>All Practitioners & History</span>
          </button>
        </div>

        {activeTab === "all" && (
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
            <input
              type="text"
              placeholder="Search by name, specialty, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-white border border-sage/40 rounded-xl text-ink placeholder:text-ink/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Pending Queue Cards */}
      {activeTab === "pending" && (
        <>
          {loadingPending ? (
            <LoadingState />
          ) : pendingDoctors.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="All Caught Up!"
              message="There are currently no doctor accounts awaiting verification. Newly registered practitioners will appear here."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {pendingDoctors.map((doc) => (
                <div
                  key={doc.id}
                  className="card flex flex-col justify-between hover:shadow-card-hover transition-all"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-lg text-primary border border-primary/20 shadow-sm">
                          {doc.name?.charAt(0) || "D"}
                        </div>
                        <div>
                          <h3 className="font-semibold text-ink text-base leading-tight">
                            {doc.name}
                          </h3>
                          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                            {doc.specialty || "General Medicine"}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        Pending
                      </span>
                    </div>

                    {/* Metadata */}
                    <div className="space-y-2 text-xs text-ink/70 bg-sage/10 p-3.5 rounded-xl border border-sage/20">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{doc.email}</span>
                      </div>
                      {doc.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{doc.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Award className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>Experience: <strong className="text-ink">{doc.experience || 1} year{doc.experience > 1 ? "s" : ""}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>Registered: {doc.registered_at ? new Date(doc.registered_at).toLocaleDateString() : "Recently"}</span>
                      </div>
                    </div>

                    {/* Bio */}
                    {doc.bio && (
                      <p className="text-xs text-ink/70 line-clamp-3 italic bg-cream/70 p-2.5 rounded-xl border border-accent/20">
                        "{doc.bio}"
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-sage/20">
                    <button
                      onClick={() => setRejectingDoctor(doc)}
                      className="w-full py-2 px-3 rounded-xl border border-danger/30 text-danger hover:bg-danger/10 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => setApprovingDoctor(doc)}
                      className="w-full py-2 px-3 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab 2: All Doctors & Verification Status Table */}
      {activeTab === "all" && (
        <div className="card p-0 overflow-hidden">
          {loadingAll ? (
            <LoadingState />
          ) : (
            <DataTable
              columns={tableColumns}
              data={allDoctors}
              keyField="id"
              emptyMessage="No doctors matching search criteria."
            />
          )}
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {approvingDoctor && (
        <Modal
          isOpen={true}
          onClose={() => setApprovingDoctor(null)}
          title="Approve Practitioner Account"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-success/10 border border-success/25 text-ink text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-success" />
              <div>
                You are approving <strong className="text-ink">Dr. {approvingDoctor.name}</strong> ({approvingDoctor.specialty}).
                Their account will be granted full doctor access to MediTalk immediately.
              </div>
            </div>
            <p className="text-xs text-ink/60">
              An instant system notification will be delivered to the practitioner's account confirming their verified status.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setApprovingDoctor(null)} disabled={processing}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => handleApprove(approvingDoctor)}
                loading={processing}
              >
                Confirm Approval
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rejection Reason Modal */}
      {rejectingDoctor && (
        <Modal
          isOpen={true}
          onClose={() => setRejectingDoctor(null)}
          title="Reject Practitioner Application"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-danger/10 border border-danger/25 text-ink text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-danger" />
              <div>
                Rejecting application for <strong className="text-ink">Dr. {rejectingDoctor.name}</strong>.
                They will not be able to log in until cleared by an administrator.
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/80 mb-1.5">
                Rejection Reason / Notes to Applicant <span className="text-danger">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Medical registration certificate expired or unverified. Please upload current credentials."
                className="input-base"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setRejectingDoctor(null)} disabled={processing}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                loading={processing}
                disabled={!rejectReason.trim()}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
