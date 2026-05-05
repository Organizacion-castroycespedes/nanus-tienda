type ReportStatusBadgeProps = {
  value: string;
};

const colorByStatus = (value: string) => {
  const normalized = value.trim().toUpperCase();

  if (["PAID", "CLOSED", "COMPLETED", "ACTIVE"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (["PENDING", "OPEN", "PARTIAL"].includes(normalized)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (["CANCELLED", "REFUNDED", "ERROR"].includes(normalized)) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
};

export const ReportStatusBadge = ({ value }: ReportStatusBadgeProps) => (
  <span
    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${colorByStatus(
      value
    )}`}
  >
    {value}
  </span>
);
