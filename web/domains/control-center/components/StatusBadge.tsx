import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_STYLES } from "../format";
import type { ContractStatus } from "../types";

export const ContractStatusBadge = ({ status }: { status: ContractStatus }) => (
  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${CONTRACT_STATUS_STYLES[status]}`}>
    {CONTRACT_STATUS_LABELS[status]}
  </span>
);

export const Pill = ({ tone, children }: { tone: "ok" | "warn" | "muted" | "danger"; children: string }) => {
  const styles = {
    ok: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300",
    warn: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300",
    danger: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300",
    muted: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700 dark:text-slate-300",
  }[tone];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${styles}`}>{children}</span>;
};
