"use client";

import { useCallback, useMemo, useState } from "react";
import { listBranches } from "../../../domains/branches/api";
import type { BranchResponse } from "../../../domains/branches/dtos";
import { listTenants } from "../../../domains/tenants/api";
import type { TenantSummaryResponse } from "../../../domains/tenants/dtos";
import {
  createTerminal,
  listTerminals,
  updateTerminal,
  updateTerminalStatus,
  type CreateTerminalPayload,
  type TerminalFilters,
  type TerminalResponse,
  type UpdateTerminalPayload,
} from "../services/terminals.service";

type UseTerminalsOptions = {
  role?: string | null;
  tenantId?: string | null;
};

export type TerminalTenantOption = {
  id: string;
  name: string;
};

export type TerminalBranchOption = {
  id: string;
  tenantId: string;
  name: string;
};

const mapTenantOption = (tenant: TenantSummaryResponse): TerminalTenantOption => ({
  id: tenant.id,
  name: tenant.nombre ?? tenant.slug,
});

const mapBranchOption = (branch: BranchResponse): TerminalBranchOption => ({
  id: branch.id,
  tenantId: branch.tenant_id,
  name: branch.nombre,
});

export const useTerminals = ({ role, tenantId }: UseTerminalsOptions) => {
  const [terminals, setTerminals] = useState<TerminalResponse[]>([]);
  const [tenants, setTenants] = useState<TerminalTenantOption[]>([]);
  const [branches, setBranches] = useState<TerminalBranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const isSuperRole = role === "SUPER_ADMIN" || role === "SUPER_USER";

  const loadTenants = useCallback(async () => {
    if (!isSuperRole) {
      if (tenantId) {
        setTenants([]);
      }
      return;
    }

    const items = await listTenants();
    setTenants(items.map(mapTenantOption));
  }, [isSuperRole, tenantId]);

  const loadBranches = useCallback(
    async (selectedTenantId?: string) => {
      const effectiveTenantId = isSuperRole ? selectedTenantId : tenantId ?? undefined;
      const items = await listBranches(
        effectiveTenantId ? { tenantId: effectiveTenantId } : {}
      );
      setBranches(items.map(mapBranchOption));
      return items.map(mapBranchOption);
    },
    [isSuperRole, tenantId]
  );

  const loadTerminals = useCallback(async (filters: TerminalFilters = {}) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const items = await listTerminals(filters);
      setTerminals(items);
      setHasSearched(true);
      return items;
    } catch {
      setErrorMessage("No se pudieron cargar las terminales.");
      setHasSearched(true);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createItem = useCallback(async (payload: CreateTerminalPayload) => {
    setSaving(true);
    try {
      return await createTerminal(payload);
    } finally {
      setSaving(false);
    }
  }, []);

  const updateItem = useCallback(
    async (terminalId: string, payload: UpdateTerminalPayload) => {
      setSaving(true);
      try {
        return await updateTerminal(terminalId, payload);
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const updateStatus = useCallback(async (terminalId: string, isActive: boolean) => {
    setSaving(true);
    try {
      return await updateTerminalStatus(terminalId, isActive);
    } finally {
      setSaving(false);
    }
  }, []);

  const tenantOptions = useMemo(() => {
    if (tenants.length > 0) {
      return tenants;
    }

    const seen = new Map<string, string>();
    terminals.forEach((terminal) => {
      if (terminal.tenantId && terminal.tenantName && !seen.has(terminal.tenantId)) {
        seen.set(terminal.tenantId, terminal.tenantName);
      }
    });

    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [tenants, terminals]);

  return {
    terminals,
    branches,
    tenantOptions,
    loading,
    saving,
    errorMessage,
    hasSearched,
    isSuperRole,
    setErrorMessage,
    loadTenants,
    loadBranches,
    loadTerminals,
    createItem,
    updateItem,
    updateStatus,
  };
};
