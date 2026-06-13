"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/design-system/Button";
import { Select } from "../../../components/design-system/Select";
import { getAuthContext, createPosSession as createPosSessionRequest } from "../api";
import { usePosContext } from "../hooks/usePosContext";
import { useAppSelector } from "../../../store/hooks";
import type { PosBranch, PosTenant, PosTerminal } from "../types";

type PosContextSelectorProps = {
  tenantSlug: string;
};

export const PosContextSelector = ({ tenantSlug }: PosContextSelectorProps) => {
  const router = useRouter();
  const authTenantId = useAppSelector((state) => state.auth.user?.tenantId ?? null);
  const authTenantName = useAppSelector((state) => state.auth.user?.tenantName ?? null);
  const authRole = useAppSelector((state) => state.auth.user?.role ?? null);
  const pos = usePosContext();
  const {
    tenantId,
    branchId,
    terminalId,
    error,
    setContext,
    setSession,
    setLoading,
    setError,
  } = pos;
  const [tenants, setTenants] = useState<PosTenant[]>([]);
  const [uiLoading, setUiLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setUiLoading(true);
      setLoading(true);
      setError(null);

      try {
        const response = await getAuthContext();
        if (!active) {
          return;
        }

        setTenants(response.tenants);
      } catch {
        if (!active) {
          return;
        }
        setError("No se pudo cargar el contexto POS.");
      } finally {
        if (active) {
          setUiLoading(false);
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [setError, setLoading]);

  const canSelectTenant = authRole === "SUPER_ADMIN";

  const availableTenants = useMemo(() => {
    if (canSelectTenant || !authTenantId) {
      return tenants;
    }
    return tenants.filter((tenant) => tenant.id === authTenantId);
  }, [authTenantId, canSelectTenant, tenants]);

  useEffect(() => {
    if (canSelectTenant || !authTenantId) {
      return;
    }
    if (tenantId !== authTenantId) {
      setContext({
        tenantId: authTenantId,
        branchId: null,
        terminalId: null,
      });
    }
  }, [authTenantId, canSelectTenant, setContext, tenantId]);

  useEffect(() => {
    if (!canSelectTenant || tenantId || availableTenants.length !== 1) {
      return;
    }
    setContext({
      tenantId: availableTenants[0].id,
      branchId: null,
      terminalId: null,
    });
  }, [availableTenants, canSelectTenant, setContext, tenantId]);

  const selectedTenant = useMemo(
    () =>
      availableTenants.find(
        (tenant) => tenant.id === (canSelectTenant ? tenantId : authTenantId ?? tenantId)
      ) ?? null,
    [authTenantId, availableTenants, canSelectTenant, tenantId]
  );

  const availableBranches = useMemo(
    () => selectedTenant?.branches ?? [],
    [selectedTenant]
  );

  const selectedBranch = useMemo(
    () => availableBranches.find((branch) => branch.id === branchId) ?? null,
    [availableBranches, branchId]
  );

  const availableTerminals = useMemo(
    () => selectedBranch?.terminals ?? [],
    [selectedBranch]
  );

  const handleTenantChange = (tenantId: string) => {
    setContext({
      tenantId: tenantId || null,
      branchId: null,
      terminalId: null,
    });
  };

  useEffect(() => {
    if (availableBranches.length === 1 && !branchId) {
      setContext({ branchId: availableBranches[0].id });
    }
  }, [availableBranches, branchId, setContext]);

  useEffect(() => {
    if (availableTerminals.length === 1 && !terminalId) {
      setContext({ terminalId: availableTerminals[0].id });
    }
  }, [availableTerminals, setContext, terminalId]);

  const handleBranchChange = (branchId: string) => {
    setContext({
      branchId: branchId || null,
      terminalId: null,
    });
  };

  const handleTerminalChange = (terminalId: string) => {
    setContext({
      terminalId: terminalId || null,
    });
  };

  const canConfirm = Boolean(tenantId && branchId && terminalId && !submitting);

  const handleConfirm = async () => {
    if (!branchId || !terminalId) {
      setError("Selecciona una sucursal y una terminal.");
      return;
    }

    setSubmitting(true);
    setLoading(true);
    setError(null);

    try {
      const session = await createPosSessionRequest({
        branchId,
        terminalId,
      });

      setSession({
        posSessionId: session.posSessionId,
        branchId: session.branchId,
        terminalId: session.terminalId,
      });

      router.push(`/${tenantSlug}/pos`);
    } catch {
      setError("No se pudo iniciar la sesion POS.");
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };

  const renderBranchLabel = (branch: PosBranch) => branch.name;
  const renderTerminalLabel = (terminal: PosTerminal) =>
    `${terminal.name} (${terminal.code})`;

  return (
    <section className="mx-auto max-w-3xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Contexto POS
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Selecciona sucursal y terminal
        </h1>
        {selectedTenant ? (
          <p className="mt-3 text-sm text-slate-600">
            Empresa activa: <span className="font-medium text-slate-900">{canSelectTenant ? selectedTenant.name : authTenantName ?? selectedTenant.name}</span>
          </p>
        ) : null}
      </div>

      {uiLoading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-slate-500">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Cargando contexto disponible...
        </div>
      ) : (
        <div className="space-y-5">
          {canSelectTenant ? (
            <Select
              label="Empresa"
              value={tenantId ?? ""}
              onChange={(event) => handleTenantChange(event.target.value)}
              disabled={availableTenants.length === 0}
            >
              <option value="">Selecciona una empresa</option>
              {availableTenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </Select>
          ) : null}

          <Select
            label="Sucursal"
            value={branchId ?? ""}
            onChange={(event) => handleBranchChange(event.target.value)}
            disabled={!selectedTenant}
          >
            <option value="">Selecciona una sucursal</option>
            {availableBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {renderBranchLabel(branch)}
              </option>
            ))}
          </Select>

          <Select
            label="Terminal"
            value={terminalId ?? ""}
            onChange={(event) => handleTerminalChange(event.target.value)}
            disabled={!selectedBranch}
          >
            <option value="">Selecciona una terminal</option>
            {availableTerminals.map((terminal) => (
              <option key={terminal.id} value={terminal.id}>
                {renderTerminalLabel(terminal)}
              </option>
            ))}
          </Select>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={() => void handleConfirm()} disabled={!canConfirm}>
              {submitting ? "Confirmando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};
