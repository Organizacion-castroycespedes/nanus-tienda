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

  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [tenantOptions, setTenantOptions] = useState<SelectorOption[]>([]);
  const [branchOptions, setBranchOptions] = useState<SelectorOption[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);

  const resolvedTenantId = permissions.showTenantSelector
    ? selectedTenantId || currentTenantId
    : currentTenantId;
  const resolvedBranchId = permissions.showBranchSelector
    ? selectedBranchId
    : currentBranchId;

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
    if (!resolvedTenantId) {
      setBranchOptions(permissions.showBranchSelector ? [ALL_BRANCHES_OPTION] : []);
      return;
    }

    let active = true;
    setLoadingBranches(true);

    void listBranches({ tenantId: resolvedTenantId })
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

        const branchExists = mappedBranches.some((item) => item.value === selectedBranchId);
        if (selectedBranchId && branchExists) {
          return;
        }

        if (currentBranchId && mappedBranches.some((item) => item.value === currentBranchId)) {
          setSelectedBranchId(currentBranchId);
          return;
        }

        setSelectedBranchId("");
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
    currentBranchId,
    permissions.showBranchSelector,
    resolvedTenantId,
    selectedBranchId,
  ]);

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
      setSelectedTenantId(value);
      if (permissions.showBranchSelector) {
        setSelectedBranchId("");
      }
    },
    setBranchId: setSelectedBranchId,
    tenantOptions,
    branchOptions,
    loadingTenants,
    loadingBranches,
    resolvedTenantLabel,
    resolvedBranchLabel,
  };
};
