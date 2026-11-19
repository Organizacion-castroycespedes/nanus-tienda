"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { Modal } from "../../../components/design-system/Modal";
import { Toast } from "../../../components/design-system/Toast";
import { allocateReceipt, downloadReceiptAttachment, getReceipt, reverseAllocation, voidReceipt } from "../api";
import { apiErrorMessage } from "../errors";
import { formatCOP, formatDate, formatFileSize, moneyToCents } from "../format";
import type { ReceiptDetail } from "../types";
import { ReasonDialog } from "./ReasonDialog";
import { ChargeStatusBadge, ReceiptStatusBadge } from "./StatusBadge";

type Props = { receiptId: string | null; onClose: () => void; onChanged?: () => void };

export const ReceiptDetailDialog = ({ receiptId, onClose, onChanged }: Props) => {
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [reversing, setReversing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReceipt(null);
    setError(null);
    setNotice(null);
    if (!receiptId) return;
    void getReceipt(receiptId).then(setReceipt).catch((caught) => setError(apiErrorMessage(caught)));
  }, [receiptId]);

  if (!receiptId) return null;
  const hasBalance = receipt?.status === "CONFIRMED" && moneyToCents(receipt.unallocated) > BigInt(0);

  const applyBalance = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await allocateReceipt(receiptId, { autoAllocate: true });
      setReceipt(updated);
      setNotice(moneyToCents(updated.unallocated) === moneyToCents(receipt?.unallocated) ? "No hay cargos pendientes para aplicar el saldo." : "Saldo aplicado a los cargos pendientes.");
      onChanged?.();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    try {
      const blob = await downloadReceiptAttachment(receiptId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = receipt?.attachmentName ?? "soporte";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  };

  return (
    <Modal
      title={receipt ? `Pago ${receipt.receiptNumber}` : "Pago"}
      description={receipt?.accountLegalName}
      size="xl"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            {receipt?.status === "CONFIRMED" ? <Button variant="danger" onClick={() => setVoiding(true)}>Anular pago</Button> : null}
            {hasBalance ? <Button variant="secondary" onClick={() => void applyBalance()} isLoading={busy}>Aplicar saldo a favor</Button> : null}
          </div>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>
      }
    >
      {error ? <Toast variant="error" message={error} /> : null}
      {notice ? <Toast variant="success" message={notice} /> : null}
      {receipt ? (
        <div className="space-y-5 text-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Estado</p><ReceiptStatusBadge status={receipt.status} /></div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Fecha</p><p className="font-medium text-slate-900 dark:text-white">{formatDate(receipt.receivedOn)}</p></div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Medio</p>
              <p className="font-medium text-slate-900 dark:text-white">{receipt.source === "PRORATION_CREDIT" ? "Crédito por prorrateo" : receipt.paymentMethodName}</p>
              {receipt.financialInstitutionName ? <p className="text-xs text-slate-500">{receipt.financialInstitutionName}</p> : null}
            </div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Referencia</p><p className="font-medium text-slate-900 dark:text-white">{receipt.reference ?? "—"}</p></div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Valor</p><p className="font-semibold text-slate-900 dark:text-white">{formatCOP(receipt.amount)}</p></div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Aplicado</p><p className="font-medium text-slate-900 dark:text-white">{formatCOP(receipt.allocatedAmount)}</p></div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Saldo a favor</p><p className="font-medium text-slate-900 dark:text-white">{formatCOP(receipt.unallocated)}</p></div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Soporte</p>
              {receipt.hasAttachment ? (
                <Button size="sm" variant="ghost" onClick={() => void download()}>
                  <Download className="mr-1 h-4 w-4" aria-hidden /> {receipt.attachmentName} ({formatFileSize(receipt.attachmentSize)})
                </Button>
              ) : <p className="text-slate-500">Sin soporte</p>}
            </div>
          </div>
          {receipt.notes ? <p className="text-xs text-slate-500 dark:text-slate-400">Notas: {receipt.notes}</p> : null}

          <section>
            <h4 className="mb-2 font-semibold text-slate-900 dark:text-white">Aplicado a</h4>
            {receipt.allocations.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">El pago no está aplicado a ningún cargo.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                {receipt.allocations.map((a) => (
                  <li key={a.id} className={`flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${a.reversedAt ? "opacity-60" : ""}`}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.chargeNumber}</span>
                      <span className="text-xs text-slate-500">{a.contractNumber} · vence {formatDate(a.dueDate)}</span>
                      <ChargeStatusBadge status={a.chargeStatus} />
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{formatCOP(a.amount)}</span>
                      {a.reversedAt ? (
                        <span className="text-xs text-slate-500">Revertido: {a.reversalReason}</span>
                      ) : receipt.status === "CONFIRMED" ? (
                        <Button size="sm" variant="ghost" onClick={() => setReversing(a.id)}>Revertir</Button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {receipt.voidReason ? <Toast variant="warning" message={`Anulado: ${receipt.voidReason}`} /> : null}
        </div>
      ) : null}

      <ReasonDialog
        open={voiding}
        title="Anular pago"
        description="Se revierten todas sus aplicaciones y los cargos vuelven a quedar pendientes. El registro se conserva en el historial."
        confirmText="Anular pago"
        variant="danger"
        onClose={() => setVoiding(false)}
        onConfirm={async (reason) => {
          setReceipt(await voidReceipt(receiptId, reason));
          onChanged?.();
        }}
      />
      <ReasonDialog
        open={reversing !== null}
        title="Revertir aplicación"
        description="El valor vuelve al saldo a favor del pago y el cargo recupera su saldo."
        confirmText="Revertir"
        variant="warning"
        onClose={() => setReversing(null)}
        onConfirm={async (reason) => {
          if (!reversing) return;
          setReceipt(await reverseAllocation(reversing, reason));
          onChanged?.();
        }}
      />
    </Modal>
  );
};
