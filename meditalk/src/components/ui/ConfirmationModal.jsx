import Modal from "./Modal";
import Button from "./Button";
import { AlertTriangle, Info } from "lucide-react";

export default function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmLabel = "Confirm",
  variant = "danger",
  loading = false,
}) {
  const isDanger = variant === "danger";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={variant} size="md" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div
          className={
            "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 " +
            (isDanger
              ? "bg-danger/10 text-danger"
              : "bg-primary/10 text-primary")
          }
        >
          {isDanger ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <Info className="h-5 w-5" />
          )}
        </div>
        <p className="text-sm text-ink-secondary dark:text-neutral-300 leading-relaxed pt-1">
          {message}
        </p>
      </div>
    </Modal>
  );
}
