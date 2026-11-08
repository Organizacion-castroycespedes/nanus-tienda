"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../../../components/design-system/Button";
import { Modal } from "../../../components/design-system/Modal";
import { Textarea } from "../../../components/design-system/Textarea";
import { Toast } from "../../../components/design-system/Toast";
import { MIN_REASON_LENGTH, isValidReason } from "../format";

type ReasonDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText: string;
  variant?: "primary" | "danger" | "warning";
  requireReason?: boolean;
  children?: ReactNode;
  canConfirm?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

/** Confirmación con motivo obligatorio para acciones críticas (queda en la auditoría). */
export const ReasonDialog = ({
  open,
  title,
  description,
  confirmText,
  variant = "primary",
  requireReason = true,
  children,
  canConfirm = true,
  onClose,
  onConfirm,
}: ReasonDialogProps) => {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;
  const reasonOk = !requireReason || isValidReason(reason);

  const submit = async () => {
    if (!reasonOk || !canConfirm) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible completar la operación.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={title}
      description={description}
      onClose={saving ? undefined : onClose}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant={variant} onClick={() => void submit()} isLoading={saving} disabled={!reasonOk || !canConfirm}>
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {children}
        <Textarea
          label={requireReason ? "Motivo (obligatorio)" : "Motivo (opcional)"}
          hint={requireReason ? `Mínimo ${MIN_REASON_LENGTH} caracteres. Queda registrado en la auditoría.` : undefined}
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {error ? <Toast variant="error" message={error} /> : null}
      </div>
    </Modal>
  );
};
