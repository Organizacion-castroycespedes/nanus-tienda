"use client";

import { useEffect, useMemo, useState } from "react";
import { listBranches } from "../../../domains/branches/api";
import { listTenants } from "../../../domains/tenants/api";
import { useAppSelector } from "../../../store/hooks";
import { getReportingPermissions } from "../permissions";
import type { SelectorOption } from "../types";

const ALL_BRANCHES_OPTION: SelectorOption = {
  value: "",
  label: "Todas las sucursales",
};

export const useReportingScope = () => {
  const authUser = useAppSelector((state) => state.auth.user);
  const authTenantId = useAppSelector((state) => state.auth.tenantId);
  const inventoryScope = useAppSelector((state) => state.inventoryScope);
  const permissions = useMemo(
    () => getReportingPermissions(authUser?.role),
    [authUser?.role]
  );
  const currentTenantId =
    inventoryScope.currentTenant ?? authUser?.tenantId ?? authTenantId ?? "";
  const currentBranchId = inventoryScope.currentBranch ?? authUser?.branchId ?? "";

  const [tenantId, setTenantId] = useState(currentTenantId);
  const [branchId, setBranchId] = useState(currentBranchId);
  const [tenantOptions, setTenantOptions] = useState<SelectorOption[]>([]);
  const [branchOptions, setBranchOptions] = useState<SelectorOption[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);

  useEffect(() => {
    if (!permissions.showTenantSelector && currentTenantId && tenantId !== currentTenantId) {
      setTenantId(currentTenantId);
    }

    if (permissions.showTenantSelector && !tenantId && currentTenantId) {
      setTenantId(currentTenantId);
    }
  }, [currentTenantId, permissions.showTenantSelector, tenantId]);

  useEffect(() => {
    if (!permissions.showBranchSelector && branchId !== currentBranchId) {
      setBranchId(currentBranchId);
    }
  }, [branchId, currentBranchId, permissions.showBranchSelector]);

  useEffect(() => {
    if (!permissions.showTenantSelector) {
      return;
    }

    let active = true;
    setLoadingTenants(true);

    void listTenants()
      .then((items) => {
        if (!active) {
          return;
        }

        setTenantOptions(
          items
            .filter((item) => item.activo)
            .map((item) => ({
              value: item.id,
              label: item.nombre ?? item.slug,
            }))
        );
      })
      .finally(() => {
        if (active) {
          setLoadingTenants(false);
        }
      });

    return () => {
      active = false;
    };
  }, [permissions.showTenantSelector]);

  useEffect(() => {
    const scopedTenantId = permissions.showTenantSelector ? tenantId : currentTenantId;
    if (!scopedTenantId) {
      setBranchOptions(permissions.showBranchSelector ? [ALL_BRANCHES_OPTION] : []);
      return;
    }

    let active = true;
    setLoadingBranches(true);

    void listBranches({ tenantId: scopedTenantId })
      .then((items) => {
        if (!active) {
          return;
        }

        const mappedBranches = items
          .filter((item) => item.estado === "ACTIVE")
          .map((item) => ({
            value: item.id,
            label: item.nombre,
          }));

        setBranchOptions(
          permissions.showBranchSelector
            ? [ALL_BRANCHES_OPTION, ...mappedBranches]
            : mappedBranches
        );

        if (!permissions.showBranchSelector) {
          return;
        }

        const branchExists = mappedBranches.some((item) => item.value === branchId);
        if (branchId && branchExists) {
          return;
        }

        if (currentBranchId && mappedBranches.some((item) => item.value === currentBranchId)) {
          setBranchId(currentBranchId);
          return;
        }

        setBranchId("");
      })
      .finally(() => {
        if (active) {
          setLoadingBranches(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    branchId,
    currentBranchId,
    currentTenantId,
    permissions.showBranchSelector,
    permissions.showTenantSelector,
    tenantId,
  ]);

  const resolvedTenantId = permissions.showTenantSelector ? tenantId : currentTenantId;
  const resolvedBranchId = permissions.showBranchSelector ? branchId : currentBranchId;

  const resolvedTenantLabel =
    tenantOptions.find((item) => item.value === resolvedTenantId)?.label ??
    authUser?.tenantName ??
    "Tenant actual";
  const resolvedBranchLabel =
    branchOptions.find((item) => item.value === resolvedBranchId)?.label ??
    authUser?.branchName ??
    (permissions.showBranchSelector ? "Todas las sucursales" : "Sucursal asignada");

  return {
    ...permissions,
    tenantId: resolvedTenantId,
    branchId: resolvedBranchId,
    setTenantId: (value: string) => {
      setTenantId(value);
      if (permissions.showBranchSelector) {
        setBranchId("");
      }
    },
    setBranchId,
    tenantOptions,
    branchOptions,
    loadingTenants,
    loadingBranches,
    resolvedTenantLabel,
    resolvedBranchLabel,
  };
};
