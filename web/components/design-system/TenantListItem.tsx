import type { ReactNode } from "react";

type TenantListItemProps = {
  name: string;
  slug: string;
  active: boolean;
  selected?: boolean;
  onSelect?: () => void;
  actions?: ReactNode;
};

export const TenantListItem = ({
  name,
  slug,
  active,
  selected = false,
  onSelect,
  actions,
}: TenantListItemProps) => {
  const statusStyles = active
    ? "bg-emerald-50 text-emerald-700"
    : "bg-slate-100 text-slate-500";
  const cardStyles = selected
    ? "border-blue-600 bg-blue-50/40"
    : "border-slate-200 bg-white";

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${cardStyles}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            className="text-left"
          >
            <p className="text-sm font-semibold text-slate-900">{name}</p>
            <p className="text-xs text-slate-500">{slug}</p>
          </button>
        ) : (
          <div>
            <p className="text-sm font-semibold text-slate-900">{name}</p>
            <p className="text-xs text-slate-500">{slug}</p>
          </div>
        )}
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyles}`}>
          {active ? "Activa" : "Inactiva"}
        </span>
      </div>
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
};
