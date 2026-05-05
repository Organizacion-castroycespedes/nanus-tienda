import { Button } from "../../../components/design-system/Button";
import { DateRangePicker } from "../../../components/design-system/DateRangePicker";
import { Select } from "../../../components/design-system/Select";
import type { SelectorOption } from "../types";

type FiltersBarProps = {
  dateRange: {
    from: string;
    to: string;
  };
  onDateRangeChange: (value: { from: string; to: string }) => void;
  tenantId: string;
  branchId: string;
  onTenantChange: (value: string) => void;
  onBranchChange: (value: string) => void;
  showTenantSelector: boolean;
  showBranchSelector: boolean;
  tenantOptions: SelectorOption[];
  branchOptions: SelectorOption[];
  loadingTenants?: boolean;
  loadingBranches?: boolean;
  tenantLabel?: string;
  branchLabel?: string;
  isSearching?: boolean;
  onSearch: () => void;
};

export const FiltersBar = ({
  dateRange,
  onDateRangeChange,
  tenantId,
  branchId,
  onTenantChange,
  onBranchChange,
  showTenantSelector,
  showBranchSelector,
  tenantOptions,
  branchOptions,
  loadingTenants = false,
  loadingBranches = false,
  tenantLabel,
  branchLabel,
  isSearching = false,
  onSearch,
}: FiltersBarProps) => {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr_auto] xl:items-end">
        <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
        <div className="grid gap-4 sm:grid-cols-2">
          {showTenantSelector ? (
            <Select
              label="Tenant"
              value={tenantId}
              onChange={(event) => onTenantChange(event.target.value)}
              disabled={loadingTenants}
            >
              <option value="">
                {loadingTenants ? "Cargando tenants..." : "Selecciona un tenant"}
              </option>
              {tenantOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Tenant
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {tenantLabel ?? "Tenant actual"}
              </p>
            </div>
          )}
          {showBranchSelector ? (
            <Select
              label="Sucursal"
              value={branchId}
              onChange={(event) => onBranchChange(event.target.value)}
              disabled={loadingBranches || (!tenantId && showTenantSelector)}
            >
              {branchOptions.map((item) => (
                <option key={item.value || "all"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Sucursal
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {branchLabel ?? "Sucursal asignada"}
              </p>
            </div>
          )}
        </div>
        <Button
          className="w-full xl:w-auto"
          onClick={onSearch}
          isLoading={isSearching}
          disabled={!dateRange.from || !dateRange.to || (showTenantSelector && !tenantId)}
        >
          Buscar
        </Button>
      </div>
    </section>
  );
};
