import { useState } from "react";
import { Pill, FileDown, ShoppingBag, CheckCircle2, Clock, Truck, Package, X, Phone, MapPin, Building2 } from "lucide-react";
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
  getPrescriptions, getPharmacyOrders, createPharmacyOrder,
} from "../../services/prescriptionService";
import { formatDate } from "../../constants";
import { generatePrescriptionPdf } from "../../utils/prescriptionPdf";

const PHARMACIES = [
  { id: "meditalk-central", name: "MediTalk Central Dispensary", sub: "Same-Day Express · Free delivery", icon: "🏥" },
  { id: "apollo", name: "Apollo Pharmacy", sub: "2–4 hr express delivery", icon: "💊" },
  { id: "carerx", name: "CareRx Partner Network", sub: "Next-day nationwide delivery", icon: "📦" },
];

const ORDER_STEPS = [
  { status: "pending",           label: "Order Placed",       icon: CheckCircle2, color: "text-primary" },
  { status: "processing",        label: "Processing",         icon: Package,      color: "text-amber-500" },
  { status: "dispensed",         label: "Dispensed",          icon: Pill,         color: "text-blue-500" },
  { status: "out_for_delivery",  label: "Out for Delivery",   icon: Truck,        color: "text-purple-500" },
  { status: "delivered",         label: "Delivered",          icon: CheckCircle2, color: "text-success" },
];

// ── Order Status Timeline ───────────────────────────────────────────────────
function OrderTimeline({ status }) {
  const currentIdx = ORDER_STEPS.findIndex(s => s.status === status);
  if (currentIdx === -1) return null;
  return (
    <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1">
      {ORDER_STEPS.map((step, i) => {
        const done = i <= currentIdx;
        const Icon = step.icon;
        return (
          <div key={step.status} className="flex items-center gap-1 flex-shrink-0">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${done ? 'bg-primary/15 text-primary' : 'bg-sage/10 text-ink/40'}`}>
              <Icon className="h-3 w-3" />
              <span className="hidden sm:block">{step.label}</span>
            </div>
            {i < ORDER_STEPS.length - 1 && (
              <div className={`h-0.5 w-4 rounded flex-shrink-0 ${i < currentIdx ? 'bg-primary' : 'bg-sage/30'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── E-Pharmacy Dispatch Modal ───────────────────────────────────────────────
function PharmacyDispatchModal({ prescription, onClose, onSuccess }) {
  const toast = useToast();
  const { user } = useAuth();
  const [selectedPharmacy, setSelectedPharmacy] = useState(PHARMACIES[0].id);
  const [form, setForm] = useState({
    contactPhone: user?.phone || "",
    deliveryAddress: "",
    notes: "",
  });
  const [ordering, setOrdering] = useState(false);

  async function handleOrder() {
    if (!form.contactPhone) { toast.error("Contact phone number is required."); return; }
    setOrdering(true);
    try {
      const pharmacy = PHARMACIES.find(p => p.id === selectedPharmacy);
      await createPharmacyOrder({
        prescriptionId: prescription.id,
        pharmacyName: pharmacy.name,
        deliveryAddress: form.deliveryAddress || null,
        contactPhone: form.contactPhone,
        notes: form.notes || null,
      });
      toast.success("Pharmacy order placed successfully!");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to place order.");
    } finally {
      setOrdering(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Prescription summary */}
      <div className="rounded-xl bg-sage/10 border border-sage/30 p-3">
        <p className="text-xs text-ink/50 mb-0.5">Prescription</p>
        <p className="font-semibold text-ink text-sm">Rx #{prescription.id}</p>
        <p className="text-xs text-ink/60">{(prescription.medications || []).length} medication(s) · {formatDate(prescription.date)}</p>
        <p className="text-xs text-ink/50 mt-1">
          {(prescription.medications || []).map(m => m.medicine).filter(Boolean).join(", ")}
        </p>
      </div>

      {/* Pharmacy selection */}
      <div>
        <p className="label-base mb-2">Select Pharmacy</p>
        <div className="space-y-2">
          {PHARMACIES.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPharmacy(p.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${selectedPharmacy === p.id ? 'border-primary bg-primary/5' : 'border-sage/30 hover:border-primary/40 hover:bg-sage/5'}`}
            >
              <span className="text-xl">{p.icon}</span>
              <div className="flex-1">
                <p className="font-medium text-ink text-sm">{p.name}</p>
                <p className="text-xs text-ink/50">{p.sub}</p>
              </div>
              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all ${selectedPharmacy === p.id ? 'border-primary bg-primary' : 'border-sage/40'}`}>
                {selectedPharmacy === p.id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Contact & Delivery */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label-base flex items-center gap-1"><Phone className="h-3 w-3" /> Contact Phone *</label>
          <input className="input-base" placeholder="+91 98765 43210" value={form.contactPhone}
            onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
        </div>
        <div>
          <label className="label-base flex items-center gap-1"><MapPin className="h-3 w-3" /> Delivery Address (optional)</label>
          <input className="input-base" placeholder="For home delivery" value={form.deliveryAddress}
            onChange={e => setForm(f => ({ ...f, deliveryAddress: e.target.value }))} />
        </div>
      </div>

      <div>
        <label className="label-base">Special Instructions (optional)</label>
        <input className="input-base" placeholder="e.g. Generic substitution OK, leave at door" value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} disabled={ordering} className="flex-1">Cancel</Button>
        <Button onClick={handleOrder} loading={ordering} className="flex-1">
          <ShoppingBag className="h-4 w-4" /> Confirm Order
        </Button>
      </div>
    </div>
  );
}

export default function PatientPrescriptions() {
  const { user } = useAuth();
  const patientId = user?.id;
  const [selected, setSelected] = useState(null);
  const [dispatchRx, setDispatchRx] = useState(null);

  const { data: rx, loading } = useFetch(() => getPrescriptions({ patientId }), [patientId]);
  const { data: orders, reload: reloadOrders } = useFetch(() => getPharmacyOrders({ patientId }), [patientId]);

  function handleDownload(prescription) {
    generatePrescriptionPdf(
      prescription,
      { name: prescription.doctorName, id: prescription.doctorId },
      { name: user?.name, id: patientId }
    );
  }

  function getOrderForPrescription(prescriptionId) {
    return (orders || []).find(o => o.prescriptionId === prescriptionId && o.status !== 'cancelled');
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
          {rx.map((p) => {
            const existingOrder = getOrderForPrescription(p.id);
            return (
              <div key={p.id} className="flex flex-col gap-2">
                <PrescriptionCard prescription={p} onView={setSelected} />

                {/* E-Pharmacy dispatch section */}
                {existingOrder ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <p className="text-xs font-semibold text-ink">{existingOrder.pharmacyName}</p>
                      </div>
                      <span className="text-[10px] font-mono text-ink/50 bg-white border border-sage/30 px-2 py-0.5 rounded-full">
                        {existingOrder.trackingNumber}
                      </span>
                    </div>
                    <OrderTimeline status={existingOrder.status} />
                  </div>
                ) : (
                  p.status === 'active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDispatchRx(p)}
                      className="border-primary/30 text-primary hover:bg-primary/5 w-full text-xs"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" /> Order Medicines / Dispatch to E-Pharmacy
                    </Button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

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

      {/* E-Pharmacy Dispatch Modal */}
      <Modal
        open={!!dispatchRx}
        onClose={() => setDispatchRx(null)}
        title="Order Medicines"
        size="md"
      >
        {dispatchRx && (
          <PharmacyDispatchModal
            prescription={dispatchRx}
            onClose={() => setDispatchRx(null)}
            onSuccess={reloadOrders}
          />
        )}
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
