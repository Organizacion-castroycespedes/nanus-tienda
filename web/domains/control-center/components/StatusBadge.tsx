import { CHARGE_STATUS_LABELS, CHARGE_STATUS_TONES, CONTRACT_STATUS_LABELS, CONTRACT_STATUS_STYLES, RECEIPT_STATUS_LABELS } from "../format";
import type { ChargeStatus, ContractStatus, ReceiptStatus } from "../types";

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

export const ChargeStatusBadge = ({ status, overdue = false }: { status: ChargeStatus; overdue?: boolean }) =>
  overdue ? <Pill tone="danger">{`${CHARGE_STATUS_LABELS[status]} · vencido`}</Pill> : <Pill tone={CHARGE_STATUS_TONES[status]}>{CHARGE_STATUS_LABELS[status]}</Pill>;

export const ReceiptStatusBadge = ({ status }: { status: ReceiptStatus }) => (
  <Pill tone={status === "CONFIRMED" ? "ok" : "muted"}>{RECEIPT_STATUS_LABELS[status]}</Pill>
);
