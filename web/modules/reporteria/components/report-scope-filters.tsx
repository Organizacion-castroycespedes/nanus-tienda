import type { Dispatch, SetStateAction } from "react";
import { DateRangePicker } from "../../../components/design-system/DateRangePicker";
import { Select } from "../../../components/design-system/Select";
import type { ReportFilterDefinition } from "../../../components/design-system/ReportFilters";
import type { SelectorOption } from "../types";

type ScopeFilterArgs = {
  dateRange: { from: string; to: string };
  initialRange: { from: string; to: string };
  setDateRange: Dispatch<SetStateAction<{ from: string; to: string }>>;
  showTenantSelector: boolean;
  showBranchSelector: boolean;
  tenantId: string;
  branchId: string;
  setTenantId: (value: string) => void;
  setBranchId: (value: string) => void;
  tenantOptions: SelectorOption[];
  branchOptions: SelectorOption[];
  loadingTenants: boolean;
  loadingBranches: boolean;
  tenantLabel: string;
  branchLabel: string;
  extra?: ReportFilterDefinition[];
};

export const createReportScopeFilters = ({
  dateRange,
  initialRange,
  setDateRange,
  showTenantSelector,
  showBranchSelector,
  tenantId,
  branchId,
  setTenantId,
  setBranchId,
  tenantOptions,
  branchOptions,
  loadingTenants,
  loadingBranches,
  tenantLabel,
  branchLabel,
  extra = [],
}: ScopeFilterArgs): ReportFilterDefinition[] => [
  {
    key: "date",
    label: "Fecha",
    priority: "primary",
    active: false,
    render: () => <DateRangePicker value={dateRange} onChange={setDateRange} compact />,
    clear: () => setDateRange(initialRange),
  },
  ...(showTenantSelector
    ? [{
        key: "tenant",
        label: "Tenant",
        priority: "secondary" as const,
        active: Boolean(tenantId),
        activeLabel: tenantLabel,
        render: () => (
          <Select label="Tenant" value={tenantId} onChange={(event) => setTenantId(event.target.value)} disabled={loadingTenants}>
            <option value="">{loadingTenants ? "Cargando tenants..." : "Selecciona un tenant"}</option>
            {tenantOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        ),
        clear: () => setTenantId(""),
      }]
    : []),
  ...(showBranchSelector
    ? [{
        key: "branch",
        label: "Sucursal",
        priority: "secondary" as const,
        active: Boolean(branchId),
        activeLabel: branchLabel,
        render: () => (
          <Select label="Sucursal" value={branchId} onChange={(event) => setBranchId(event.target.value)} disabled={loadingBranches || (!tenantId && showTenantSelector)}>
            {branchOptions.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
          </Select>
        ),
        clear: () => setBranchId(""),
      }]
    : []),
  ...extra,
];
