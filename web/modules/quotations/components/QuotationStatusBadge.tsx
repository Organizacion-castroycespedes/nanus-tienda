import { QUOTATION_STATUS_LABELS, type QuotationEffectiveStatus } from "../types";

const STATUS_CLASSES: Record<QuotationEffectiveStatus, string> = {
  DRAFT: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  SENT: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200",
  CONVERTED: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200",
  EXPIRED: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};

export const QuotationStatusBadge = ({ status }: { status: QuotationEffectiveStatus }) => (
  <span
    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_CLASSES[status]}`}
  >
    {QUOTATION_STATUS_LABELS[status]}
  </span>
);
