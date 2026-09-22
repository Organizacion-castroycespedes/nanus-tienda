import React from "react";
import { Info, ShoppingBag, Store } from "lucide-react";
import { formatCurrency } from "../../../finance/utils";

type PaymentSummarySidebarProps = {
  totalAmount: number;
  totalPaid: number;
  changeAmount: number;
  pendingAmount: number;
  activeSessionInfo?: {
    cashRegisterName?: string;
    terminalName?: string;
    branchName?: string;
  } | null;
};

export const PaymentSummarySidebar: React.FC<PaymentSummarySidebarProps> = ({
  totalAmount,
  totalPaid,
  changeAmount,
  pendingAmount,
  activeSessionInfo,
}) => {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/70 dark:bg-slate-800/40">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <ShoppingBag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        Resumen de pago
      </div>

      {/* Total a cobrar card */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/90 p-4 dark:border-blue-900/50 dark:bg-blue-950/40">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300">
          Total a cobrar
        </p>
        <p className="mt-1 text-3xl font-extrabold text-blue-950 dark:text-white">
          {formatCurrency(totalAmount)}
        </p>
      </div>

      {/* Metrics list */}
      <div className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between font-medium">
          <span className="text-slate-600 dark:text-slate-400">Total pagado</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {formatCurrency(totalPaid)}
          </span>
        </div>

        <div className="flex items-center justify-between font-medium">
          <span className="text-slate-600 dark:text-slate-400">Cambio</span>
          <span className={`font-semibold ${changeAmount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>
            {formatCurrency(changeAmount)}
          </span>
        </div>

        <div className="flex items-center justify-between font-medium">
          <span className="text-slate-600 dark:text-slate-400">Saldo pendiente</span>
          <span className={`font-semibold ${pendingAmount > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"}`}>
            {formatCurrency(pendingAmount)}
          </span>
        </div>
      </div>

      {/* Info Notice */}
      <div className="flex items-start gap-2.5 rounded-xl bg-slate-100/80 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Info className="h-4 w-4 flex-shrink-0 text-slate-400 mt-0.5" />
        <span>Si el total pagado no cubre la venta completa, se registrará como venta a crédito.</span>
      </div>

      {/* Active Cash Register info */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
          <Store className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Caja activa: {activeSessionInfo?.cashRegisterName || "Caja principal"}</span>
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <p className="mt-1 text-slate-500 dark:text-slate-400 pl-6">
          {activeSessionInfo?.terminalName || "Terminal 1"} · {activeSessionInfo?.branchName || "Sucursal Principal"}
        </p>
      </div>
    </div>
  );
};
