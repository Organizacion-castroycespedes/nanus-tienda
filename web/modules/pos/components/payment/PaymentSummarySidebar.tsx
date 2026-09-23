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
  compact?: boolean;
};

export const PaymentSummarySidebar: React.FC<PaymentSummarySidebarProps> = ({
  totalAmount,
  totalPaid,
  changeAmount,
  pendingAmount,
  activeSessionInfo,
  compact = false,
}) => {
  return (
    <div
      className={`space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 dark:border-slate-700/70 dark:bg-slate-800/40 ${
        compact ? "p-3" : "p-3.5 sm:p-4"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
        <ShoppingBag className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        Resumen de pago
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/90 p-3 dark:border-blue-900/50 dark:bg-blue-950/40">
        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
          Total a cobrar
        </p>
        <p
          className={`mt-1 font-black leading-tight text-blue-950 dark:text-white ${
            compact ? "text-2xl" : "text-3xl"
          }`}
        >
          {formatCurrency(totalAmount)}
        </p>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between font-medium">
          <span className="text-slate-600 dark:text-slate-400">Total pagado</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {formatCurrency(totalPaid)}
          </span>
        </div>

        <div className="flex items-center justify-between font-medium">
          <span className="text-slate-600 dark:text-slate-400">Cambio</span>
          <span
            className={`font-semibold ${
              changeAmount > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-900 dark:text-white"
            }`}
          >
            {formatCurrency(changeAmount)}
          </span>
        </div>

        <div className="flex items-center justify-between font-medium">
          <span className="text-slate-600 dark:text-slate-400">Saldo pendiente</span>
          <span
            className={`font-semibold ${
              pendingAmount > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-900 dark:text-white"
            }`}
          >
            {formatCurrency(pendingAmount)}
          </span>
        </div>
      </div>

      {pendingAmount > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-2.5 text-[11px] leading-tight text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
          <span>
            Si el total pagado no cubre la venta completa, se registrará como venta a crédito.
          </span>
        </div>
      )}

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          <Store className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Caja activa: {activeSessionInfo?.cashRegisterName || "Caja 1"}</span>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        </div>
        <p className="mt-0.5 pl-5 text-[11px] text-slate-500 dark:text-slate-400">
          {activeSessionInfo?.terminalName || "Terminal 1"} ·{" "}
          {activeSessionInfo?.branchName || "Sucursal Principal"}
        </p>
      </div>
    </div>
  );
};
