"use client";

import { useEffect, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Modal } from "../../../components/design-system/Modal";
import { Toast } from "../../../components/design-system/Toast";
import { getCharge, voidCharge } from "../api";
import { apiErrorMessage } from "../errors";
import { CHARGE_KIND_LABELS, FREQUENCY_LABELS, formatCOP, formatDate, formatRate, isOverdue, moneyToCents, todayInBogota } from "../format";
import type { ChargeDetail } from "../types";
import { ReasonDialog } from "./ReasonDialog";
import { ChargeStatusBadge } from "./StatusBadge";

type Props = { chargeId: string | null; onClose: () => void; onChanged?: () => void };

export const ChargeDetailDialog = ({ chargeId, onClose, onChanged }: Props) => {
  const [charge, setCharge] = useState<ChargeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    setCharge(null);
    setError(null);
    if (!chargeId) return;
    void getCharge(chargeId).then(setCharge).catch((caught) => setError(apiErrorMessage(caught)));
  }, [chargeId]);

  if (!chargeId) return null;
  const canVoid = charge && charge.status !== "VOID" && moneyToCents(charge.paidAmount) === BigInt(0);

  return (
    <Modal
      title={charge ? `Cargo ${charge.chargeNumber}` : "Cargo"}
      description={charge ? `${charge.accountLegalName} · contrato ${charge.contractNumber}` : undefined}
      size="xl"
      onClose={onClose}
      footer={
        <div className="flex justify-between gap-2">
          {canVoid ? <Button variant="danger" onClick={() => setVoiding(true)}>Anular cargo</Button> : <span />}
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </div>
      }
    >
      {error ? <Toast variant="error" message={error} /> : null}
      {charge ? (
        <div className="space-y-5 text-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Estado</p><ChargeStatusBadge status={charge.status} overdue={isOverdue(charge, todayInBogota())} /></div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Tipo</p><p className="font-medium text-slate-900 dark:text-white">{CHARGE_KIND_LABELS[charge.kind]} · {FREQUENCY_LABELS[charge.billingFrequency]}</p></div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Período</p><p className="font-medium text-slate-900 dark:text-white">{formatDate(charge.periodStart)} – {formatDate(charge.periodEnd)}</p></div>
            <div><p className="text-xs text-slate-500 dark:text-slate-400">Vence</p><p className="font-medium text-slate-900 dark:text-white">{formatDate(charge.dueDate)}</p></div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                <tr><th className="px-3 py-2">Concepto</th><th className="px-3 py-2 text-right">Cant.</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2 text-right">Descuento</th><th className="px-3 py-2 text-right">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {charge.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{line.description}{line.prorationFactor ? <span className="ml-1 text-xs text-slate-500">(factor {line.prorationFactor})</span> : null}</td>
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{Number(line.quantity)}</td>
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{formatCOP(line.unitAmount)}</td>
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{moneyToCents(line.discountAmount) > BigInt(0) ? formatCOP(line.discountAmount) : "—"}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900 dark:text-white">{line.lineTotal.startsWith("-") ? `−${formatCOP(line.lineTotal.slice(1))}` : formatCOP(line.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="ml-auto grid max-w-sm grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500 dark:text-slate-400">Base</dt><dd className="text-right">{formatCOP(charge.baseAmount)}</dd>
            <dt className="text-slate-500 dark:text-slate-400">{charge.taxName} {formatRate(charge.taxRate)}</dt><dd className="text-right">{formatCOP(charge.taxAmount)}</dd>
            <dt className="font-semibold text-slate-900 dark:text-white">Total</dt><dd className="text-right font-semibold text-slate-900 dark:text-white">{formatCOP(charge.totalAmount)}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Pagado</dt><dd className="text-right">{formatCOP(charge.paidAmount)}</dd>
            <dt className="font-semibold text-slate-900 dark:text-white">Saldo</dt><dd className="text-right font-semibold text-slate-900 dark:text-white">{formatCOP(charge.balance)}</dd>
          </dl>

          <section>
            <h4 className="mb-2 font-semibold text-slate-900 dark:text-white">Pagos aplicados</h4>
            {charge.allocations.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Sin pagos aplicados.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
                {charge.allocations.map((a) => (
                  <li key={a.id} className={`flex flex-col gap-1 px-3 py-2 sm:flex-row sm:justify-between ${a.reversedAt ? "opacity-60" : ""}`}>
                    <span>{a.receiptNumber} · {a.source === "PRORATION_CREDIT" ? "Crédito por prorrateo" : a.paymentMethodName} · {formatDate(a.receivedOn)}</span>
                    <span className="font-medium">{formatCOP(a.amount)}{a.reversedAt ? ` · revertido: ${a.reversalReason}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {charge.voidReason ? <Toast variant="warning" message={`Anulado: ${charge.voidReason}`} /> : null}
        </div>
      ) : null}

      <ReasonDialog
        open={voiding}
        title="Anular cargo"
        description="El cargo queda anulado y su período se puede volver a generar. Solo se anulan cargos sin pagos aplicados."
        confirmText="Anular"
        variant="danger"
        onClose={() => setVoiding(false)}
        onConfirm={async (reason) => {
          setCharge(await voidCharge(chargeId, reason));
          onChanged?.();
        }}
      />
    </Modal>
  );
};
