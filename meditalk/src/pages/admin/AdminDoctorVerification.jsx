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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-500/20 to-primary-600/30 flex items-center justify-center font-bold text-primary-400 border border-primary-500/30">
            {d.name?.charAt(0) || "D"}
          </div>
          <div>
            <div className="font-semibold text-slate-100">{d.name}</div>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
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
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary-500/15 text-primary-300 border border-primary-500/20">
          {d.specialty || "General Medicine"}
        </span>
      ),
    },
    {
      header: "Experience",
      render: (d) => (
        <span className="text-xs text-slate-300">
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
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Clock className="w-3 h-3" /> Pending Review
            </span>
          );
        }
        if (st === "rejected") {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30" title={d.rejection_notes || "Rejected"}>
              <XCircle className="w-3 h-3" /> Rejected
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        );
      },
    },
    {
      header: "Registered",
      render: (d) => (
        <span className="text-xs text-slate-400">
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
              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
              title="Approve doctor"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          {d.verification_status !== "rejected" && (
            <button
              onClick={() => setRejectingDoctor(d)}
              className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
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
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse"
                : "bg-slate-800/60 border-slate-700 text-slate-400"
            }`}>
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>{pendingCount} Pending Approval{pendingCount === 1 ? "" : "s"}</span>
            </div>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === "pending"
                ? "bg-primary-600 text-white shadow-lg shadow-primary-600/25"
                : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pending Review Queue</span>
            {pendingCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === "all"
                ? "bg-primary-600 text-white shadow-lg shadow-primary-600/25"
                : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>All Practitioners & History</span>
          </button>
        </div>

        {activeTab === "all" && (
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, specialty, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary-500"
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
                  className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm p-5 hover:border-slate-700/80 transition-all flex flex-col justify-between shadow-card"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-primary-600/30 flex items-center justify-center font-bold text-lg text-amber-300 border border-amber-500/30 shadow-inner">
                          {doc.name?.charAt(0) || "D"}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-100 text-base leading-tight">
                            {doc.name}
                          </h3>
                          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-500/15 text-primary-300 border border-primary-500/20">
                            {doc.specialty || "General Medicine"}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Pending
                      </span>
                    </div>

                    {/* Metadata */}
                    <div className="space-y-2 text-xs text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate">{doc.email}</span>
                      </div>
                      {doc.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          <span>{doc.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Award className="w-3.5 h-3.5 text-slate-500" />
                        <span>Experience: <strong className="text-slate-200">{doc.experience || 1} year{doc.experience > 1 ? "s" : ""}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Registered: {doc.registered_at ? new Date(doc.registered_at).toLocaleDateString() : "Recently"}</span>
                      </div>
                    </div>

                    {/* Bio */}
                    {doc.bio && (
                      <p className="text-xs text-slate-300 line-clamp-3 italic bg-slate-800/30 p-2.5 rounded-xl">
                        "{doc.bio}"
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-slate-800/80">
                    <button
                      onClick={() => setRejectingDoctor(doc)}
                      className="w-full py-2 px-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/15 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => setApprovingDoctor(doc)}
                      className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-700/25"
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
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
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
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
              <div>
                You are approving <strong>Dr. {approvingDoctor.name}</strong> ({approvingDoctor.specialty}).
                Their account will be granted full doctor access to MediTalk immediately.
              </div>
            </div>
            <p className="text-xs text-slate-400">
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
                className="bg-emerald-600 hover:bg-emerald-500"
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
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400" />
              <div>
                Rejecting application for <strong>Dr. {rejectingDoctor.name}</strong>.
                They will not be able to log in until cleared by an administrator.
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Rejection Reason / Notes to Applicant <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Medical registration certificate expired or unverified. Please upload current credentials."
                className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-500"
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
