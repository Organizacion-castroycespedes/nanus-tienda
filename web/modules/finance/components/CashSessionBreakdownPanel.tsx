"use client";

import type { CashSessionSummary } from "../types";
import { formatCurrency } from "../utils";

type CashSessionBreakdownPanelProps = {
  summary: CashSessionSummary;
};

const labelByCategory: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  DIGITAL: "Digital",
  OTHER: "Otro",
};

export const CashSessionBreakdownPanel = ({
  summary,
}: CashSessionBreakdownPanelProps) => {
  const cashControl = summary.cashControl ?? {
    openingCash: summary.totals.openingAmount,
    cashPaymentsIn: summary.totals.paymentsIn,
    cashPaymentsOut: summary.totals.paymentsOut,
    cashDeliveryFees: summary.totals.deliveryFees ?? 0,
    cashManualIn: summary.totals.adjustmentsIn,
    cashManualOut:
      summary.totals.expenses +
      summary.totals.withdrawals +
      summary.totals.adjustmentsOut,
    expectedCashAmount: summary.totals.expectedAmount,
    countedCashAmount: summary.lastCount?.countedCashAmount ?? null,
    differenceAmount: summary.lastCount?.differenceAmount ?? null,
    nonCashNet: 0,
    totalNetAmount: summary.totals.netAmount,
  };
  const source = summary.sourceBreakdown ?? {
    opening: summary.totals.openingAmount,
    posSales: summary.totals.salesPayments,
    orders: 0,
    purchases: summary.totals.purchasePayments,
    refunds: summary.totals.refundPayments,
    deliveries: summary.totals.deliveryFees ?? 0,
    manualIn: summary.totals.adjustmentsIn,
    manualOut:
      summary.totals.expenses +
      summary.totals.withdrawals +
      summary.totals.adjustmentsOut,
    otherIn: 0,
    otherOut: 0,
    totalIn: summary.totals.paymentsIn + summary.totals.adjustmentsIn,
    totalOut:
      summary.totals.paymentsOut +
      summary.totals.expenses +
      summary.totals.withdrawals +
      summary.totals.adjustmentsOut,
    net: summary.totals.netAmount,
  };
  const methods = summary.paymentMethodDetails ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 dark:bg-slate-800 dark:border-slate-700">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Apertura efectivo
          </p>
          <p className="mt-1 break-words text-lg font-semibold leading-tight text-slate-900 tabular-nums dark:text-white">
            {formatCurrency(cashControl.openingCash)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700">
            Efectivo esperado
          </p>
          <p className="mt-1 break-words text-lg font-semibold leading-tight text-slate-900 tabular-nums dark:text-white">
            {formatCurrency(cashControl.expectedCashAmount)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-blue-700">
            Otros medios neto
          </p>
          <p className="mt-1 break-words text-lg font-semibold leading-tight text-slate-900 tabular-nums dark:text-white">
            {formatCurrency(cashControl.nonCashNet)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Neto operativo
          </p>
          <p className="mt-1 break-words text-lg font-semibold leading-tight text-slate-900 tabular-nums dark:text-white">
            {formatCurrency(cashControl.totalNetAmount)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Ventas POS</p>
          <p className="mt-1 font-semibold text-slate-900 dark:text-white">
            {formatCurrency(source.posSales)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Pedidos</p>
          <p className="mt-1 font-semibold text-slate-900 dark:text-white">
            {formatCurrency(source.orders)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Domicilios</p>
          <p className="mt-1 font-semibold text-slate-900 dark:text-white">
            {formatCurrency(source.deliveries)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Compras / salidas</p>
          <p className="mt-1 font-semibold text-slate-900 dark:text-white">
            {formatCurrency(source.purchases + source.refunds + source.manualOut)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-[780px] divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2 font-medium">Medio</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 text-right font-medium">Ventas</th>
              <th className="px-3 py-2 text-right font-medium">Pedidos</th>
              <th className="px-3 py-2 text-right font-medium">Domicilios</th>
              <th className="px-3 py-2 text-right font-medium">Compras/Egresos</th>
              <th className="px-3 py-2 text-right font-medium">Neto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {methods.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-500 dark:text-slate-400" colSpan={7}>
                  Sin pagos agrupados por metodo.
                </td>
              </tr>
            ) : (
              methods.map((method) => (
                <tr key={`${method.paymentMethodId ?? "cash"}-${method.category}`}>
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">
                    {method.paymentMethodNombre}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                    {labelByCategory[method.category] ?? method.category}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(method.sales)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(method.orders)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(method.deliveries)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(
                      method.purchases +
                        method.refunds +
                        method.manualOut +
                        method.otherOut
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900 dark:text-white">
                    {formatCurrency(method.net)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
