import { Button } from "../../../components/design-system/Button";
import { DateRangePicker } from "../../../components/design-system/DateRangePicker";
import { Select } from "../../../components/design-system/Select";
import type { ReactNode } from "react";
import type { SelectorOption } from "../types";

type FiltersBarProps = {
  dateRange: {
    from: string;
    to: string;
  };
  onDateRangeChange: (value: { from: string; to: string }) => void;
  showDateRange?: boolean;
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
  extraFilters?: ReactNode;
  onSearch: () => void;
};

export const FiltersBar = ({
  dateRange,
  onDateRangeChange,
  showDateRange = true,
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
  extraFilters,
  onSearch,
}: FiltersBarProps) => {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-800 dark:border-slate-700">
      <div className="flex flex-wrap items-end justify-center gap-4">
        <div className="order-2 w-full min-w-[280px] max-w-[360px] sm:order-1 xl:flex-1 xl:basis-[280px]">
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Tenant
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                {tenantLabel ?? "Tenant actual"}
              </p>
            </div>
          )}
        </div>

        {showDateRange ? (
          <div className="order-1 w-full min-w-[280px] max-w-[420px] sm:order-2 xl:flex-[1.2] xl:basis-[340px]">
            <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
          </div>
        ) : null}

        <div className="order-3 w-full min-w-[280px] max-w-[360px] xl:flex-1 xl:basis-[280px]">
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Sucursal
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                {branchLabel ?? "Sucursal asignada"}
              </p>
            </div>
          )}
        </div>

        <div className="order-4 w-full min-w-[280px] max-w-[360px] xl:flex-1 xl:basis-[280px]">
          {extraFilters ? extraFilters : <div />}
        </div>

        <div className="order-5 flex w-full justify-center xl:w-auto xl:justify-start">
          <Button
            className="w-full xl:w-auto"
            onClick={onSearch}
            isLoading={isSearching}
            disabled={
              (showDateRange && (!dateRange.from || !dateRange.to)) ||
              (showTenantSelector && !tenantId)
            }
          >
            Buscar
          </Button>
        </div>
      </div>
    </section>
  );
};
