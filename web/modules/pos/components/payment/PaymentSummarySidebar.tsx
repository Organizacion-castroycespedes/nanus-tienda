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
    <div className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 sm:p-3.5 dark:border-slate-700/70 dark:bg-slate-800/40">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
        <ShoppingBag className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        Resumen de pago
      </div>

      {/* Total a cobrar card */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/90 p-2.5 sm:p-3 dark:border-blue-900/50 dark:bg-blue-950/40">
        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
          Total a cobrar
        </p>
        <p className="mt-0.5 text-2xl font-black text-blue-950 dark:text-white leading-tight">
          {formatCurrency(totalAmount)}
        </p>
      </div>

      {/* Metrics list */}
      <div className="space-y-1.5 text-xs">
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
      <div className="flex items-start gap-2 rounded-xl bg-slate-100/80 p-2 text-[11px] leading-tight text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Info className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 mt-0.5" />
        <span>Si el pago no cubre la venta, se registra como crédito.</span>
      </div>

      {/* Active Cash Register info */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300 text-xs">
          <Store className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Caja activa: {activeSessionInfo?.cashRegisterName || "Caja 1"}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 pl-5">
          {activeSessionInfo?.terminalName || "Terminal 1"} · {activeSessionInfo?.branchName || "Sucursal Principal"}
        </p>
      </div>
    </div>
  );
};
