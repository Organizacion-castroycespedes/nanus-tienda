type FinanceStatusBadgeProps = {
  value: string | boolean | null | undefined;
  kind?: "session" | "active" | "direction" | "movement";
};

const sessionStyles: Record<string, string> = {
  OPEN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CLOSED: "border-slate-200 bg-slate-100 text-slate-700",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-700",
};

const movementStyles: Record<string, string> = {
  OPENING: "border-blue-200 bg-blue-50 text-blue-700",
  CLOSING: "border-slate-200 bg-slate-100 text-slate-700",
  ADJUSTMENT: "border-amber-200 bg-amber-50 text-amber-700",
  EXPENSE: "border-rose-200 bg-rose-50 text-rose-700",
  WITHDRAWAL: "border-orange-200 bg-orange-50 text-orange-700",
};

const directionStyles: Record<string, string> = {
  IN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OUT: "border-rose-200 bg-rose-50 text-rose-700",
};

export const FinanceStatusBadge = ({
  value,
  kind = "session",
}: FinanceStatusBadgeProps) => {
  const normalized = typeof value === "boolean" ? (value ? "ACTIVE" : "INACTIVE") : value ?? "-";

  let className = "border-slate-200 bg-slate-100 text-slate-700";

  if (kind === "session") {
    className = sessionStyles[String(normalized)] ?? className;
  } else if (kind === "active") {
    className =
      normalized === "ACTIVE"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-100 text-slate-700";
  } else if (kind === "direction") {
    className = directionStyles[String(normalized)] ?? className;
  } else if (kind === "movement") {
    className = movementStyles[String(normalized)] ?? className;
  }

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      {typeof value === "boolean" ? (value ? "Activo" : "Inactivo") : normalized}
    </span>
  );
};
