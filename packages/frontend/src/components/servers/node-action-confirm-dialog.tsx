import { useState } from "react";

interface NodeActionConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant: "danger" | "warning";
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function NodeActionConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  variant,
  onConfirm,
  onCancel,
}: NodeActionConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  const btnClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-amber-600 hover:bg-amber-700 text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-w-md rounded-md border border-border bg-surface p-6">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-surface/80 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${btnClass}`}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
