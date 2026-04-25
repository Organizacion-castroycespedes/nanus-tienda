import type { Tenant } from "../domains/tenants/types";

export type TenantState = {
  tenant: Tenant | null;
};

export const tenantStore: TenantState = {
  tenant: null,
};
