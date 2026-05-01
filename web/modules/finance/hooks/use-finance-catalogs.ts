"use client";

import { useCallback, useMemo, useState } from "react";
import { listBranches } from "../../../domains/branches/api";
import type { BranchResponse } from "../../../domains/branches/dtos";
import { listTenants } from "../../../domains/tenants/api";
import type { TenantSummaryResponse } from "../../../domains/tenants/dtos";
import { listTerminals } from "../../terminals/services/terminals.service";
import { listCashRegisters } from "../services/finance.service";
import type {
  CashRegister,
  FinanceBranchOption,
  FinanceTerminalOption,
  FinanceTenantOption,
} from "../types";

type UseFinanceCatalogsOptions = {
  role?: string | null;
  tenantId?: string | null;
};

const mapTenant = (tenant: TenantSummaryResponse): FinanceTenantOption => ({
  id: tenant.id,
  name: tenant.nombre ?? tenant.slug,
});

const mapBranch = (branch: BranchResponse): FinanceBranchOption => ({
  id: branch.id,
  tenantId: branch.tenant_id,
  name: branch.nombre,
  status: branch.estado,
});

export const useFinanceCatalogs = ({
  role,
  tenantId,
}: UseFinanceCatalogsOptions) => {
  const [tenants, setTenants] = useState<FinanceTenantOption[]>([]);
  const [branches, setBranches] = useState<FinanceBranchOption[]>([]);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [terminals, setTerminals] = useState<FinanceTerminalOption[]>([]);

  const isSuperRole = role === "SUPER_ADMIN" || role === "SUPER_USER";

  const loadTenants = useCallback(async () => {
    if (!isSuperRole) {
      setTenants([]);
      return [];
    }

    const items = await listTenants();
    const mapped = items.map(mapTenant);
    setTenants(mapped);
    return mapped;
  }, [isSuperRole]);

  const loadBranches = useCallback(
    async (selectedTenantId?: string) => {
      const effectiveTenantId = isSuperRole ? selectedTenantId : tenantId ?? undefined;
      const items = await listBranches(
        effectiveTenantId ? { tenantId: effectiveTenantId } : {}
      );
      const mapped = items.map(mapBranch);
      setBranches(mapped);
      return mapped;
    },
    [isSuperRole, tenantId]
  );

  const loadCashRegisters = useCallback(
    async (filters: { tenantId?: string; branchId?: string; activo?: boolean } = {}) => {
      const items = await listCashRegisters({
        tenantId: isSuperRole ? filters.tenantId : tenantId ?? undefined,
        branchId: filters.branchId,
        activo: filters.activo,
      });
      setCashRegisters(items);
      return items;
    },
    [isSuperRole, tenantId]
  );

  const loadTerminals = useCallback(
    async (filters: { tenantId?: string; branchId?: string } = {}) => {
      const items = await listTerminals({
        tenantId: isSuperRole ? filters.tenantId : tenantId ?? undefined,
        branchId: filters.branchId,
      });

      const mapped: FinanceTerminalOption[] = items.map((item) => ({
        id: item.id,
        tenantId: item.tenantId,
        branchId: item.branchId,
        name: item.name,
        code: item.code,
        isActive: item.isActive,
      }));

      setTerminals(mapped);
      return mapped;
    },
    [isSuperRole, tenantId]
  );

  const branchOptions = useMemo(() => branches, [branches]);
  const tenantOptions = useMemo(() => tenants, [tenants]);
  const registerOptions = useMemo(() => cashRegisters, [cashRegisters]);
  const terminalOptions = useMemo(() => terminals, [terminals]);

  return {
    isSuperRole,
    tenantOptions,
    branchOptions,
    registerOptions,
    terminalOptions,
    loadTenants,
    loadBranches,
    loadCashRegisters,
    loadTerminals,
  };
};
