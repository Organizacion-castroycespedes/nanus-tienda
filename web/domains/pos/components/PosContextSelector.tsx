"use client";

import { Loader2, Lock, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Select } from "../../../components/design-system/Select";
import { getAuthContext, createPosSession as createPosSessionRequest } from "../api";
import { usePosContext } from "../hooks/usePosContext";
import { useAppSelector } from "../../../store/hooks";
import {
  getCurrentCashSession,
  listCashRegisters,
  openCashSession,
} from "../../../modules/finance/services/finance.service";
import type { CashRegister, CashSession } from "../../../modules/finance/types";
import type { PosBranch, PosTenant, PosTerminal } from "../types";

type PosContextSelectorProps = {
  tenantSlug: string;
};

export const PosContextSelector = ({ tenantSlug }: PosContextSelectorProps) => {
  const router = useRouter();
  const authTenantId = useAppSelector((state) => state.auth.user?.tenantId ?? null);
  const authTenantName = useAppSelector((state) => state.auth.user?.tenantName ?? null);
  const authRole = useAppSelector((state) => state.auth.user?.role ?? null);
  const authBranchId = useAppSelector((state) => state.auth.user?.branchId ?? null);
  const authBranchName = useAppSelector((state) => state.auth.user?.branchName ?? null);
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
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [currentCashSession, setCurrentCashSession] = useState<CashSession | null>(null);
  const [cashLoading, setCashLoading] = useState(false);
  const [openingAmount, setOpeningAmount] = useState(0);

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
  const mustUseAssignedBranch = authRole === "USER" || authRole === "ADMIN";

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

  const availableBranches = useMemo(() => {
    const branches = selectedTenant?.branches ?? [];
    if (!mustUseAssignedBranch) {
      return branches;
    }
    if (!authBranchId) {
      return [];
    }
    return branches.filter((branch) => branch.id === authBranchId);
  }, [authBranchId, mustUseAssignedBranch, selectedTenant]);

  const selectedBranch = useMemo(
    () => availableBranches.find((branch) => branch.id === branchId) ?? null,
    [availableBranches, branchId]
  );

  const availableTerminals = useMemo(
    () => selectedBranch?.terminals ?? [],
    [selectedBranch]
  );

  const selectedCashRegister = useMemo(() => {
    if (!terminalId) {
      return null;
    }
    return (
      cashRegisters.find(
        (register) => register.activo && register.terminalId === terminalId
      ) ?? null
    );
  }, [cashRegisters, terminalId]);

  const currentCashMatchesSelection =
    Boolean(currentCashSession && selectedCashRegister) &&
    currentCashSession?.branchId === branchId &&
    currentCashSession?.cashRegisterId === selectedCashRegister?.id;

  const currentCashConflicts =
    Boolean(currentCashSession && selectedCashRegister) &&
    !currentCashMatchesSelection;

  const handleTenantChange = (tenantId: string) => {
    setContext({
      tenantId: tenantId || null,
      branchId: null,
      terminalId: null,
    });
  };

  useEffect(() => {
    if (mustUseAssignedBranch && authBranchId && branchId !== authBranchId) {
      setContext({ branchId: authBranchId, terminalId: null });
      return;
    }

    if (availableBranches.length === 1 && !branchId) {
      setContext({ branchId: availableBranches[0].id });
    }
  }, [authBranchId, availableBranches, branchId, mustUseAssignedBranch, setContext]);

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

  useEffect(() => {
    if (!selectedTenant || !branchId) {
      setCashRegisters([]);
      return;
    }

    let active = true;
    setCashLoading(true);
    setError(null);

    void listCashRegisters({
      tenantId: selectedTenant.id,
      branchId,
      activo: true,
    })
      .then((registers) => {
        if (!active) {
          return;
        }
        setCashRegisters(registers.filter((register) => register.activo));
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setCashRegisters([]);
        setCurrentCashSession(null);
        setError("No se pudo cargar el estado de caja para este contexto.");
      })
      .finally(() => {
        if (active) {
          setCashLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [branchId, selectedTenant, setError]);

  useEffect(() => {
    if (!selectedTenant || !branchId || !selectedCashRegister) {
      setCurrentCashSession(null);
      return;
    }

    let active = true;
    setCashLoading(true);
    setError(null);

    void getCurrentCashSession(selectedCashRegister.id)
      .then((session) => {
        if (!active) {
          return;
        }
        setCurrentCashSession(session);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setCurrentCashSession(null);
        setError("No se pudo cargar el estado de caja para este contexto.");
      })
      .finally(() => {
        if (active) {
          setCashLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [branchId, selectedCashRegister, selectedTenant, setError]);

  const needsCashOpening = Boolean(
    tenantId &&
      branchId &&
      terminalId &&
      selectedCashRegister &&
      !currentCashSession
  );
  const canConfirm = Boolean(
    tenantId &&
      branchId &&
      terminalId &&
      selectedCashRegister &&
      !currentCashConflicts &&
      !cashLoading &&
      !submitting
  );

  const handleConfirm = async () => {
    if (!branchId || !terminalId) {
      setError("Selecciona una sucursal y una terminal.");
      return;
    }

    if (!selectedCashRegister) {
      setError("La terminal seleccionada no tiene una caja activa asociada.");
      return;
    }

    if (currentCashConflicts) {
      setError("Ya tienes una caja abierta en otro contexto. Cierra esa caja antes de cambiar.");
      return;
    }

    setSubmitting(true);
    setLoading(true);
    setError(null);

    try {
      if (!currentCashSession) {
        await openCashSession({
          tenantId: selectedTenant?.id,
          branchId,
          cashRegisterId: selectedCashRegister.id,
          openingAmount,
        });
        window.dispatchEvent(new Event("manus:cash-session-changed"));
      }

      const session = await createPosSessionRequest({
        branchId,
        terminalId,
      });

      setSession({
        posSessionId: session.posSessionId,
        branchId: session.branchId,
        terminalId: session.terminalId,
        cashRegisterId: selectedCashRegister.id,
      });

      router.push(`/${tenantSlug}/pos`);
    } catch {
      setError("No se pudo abrir caja o iniciar la sesion POS.");
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
            disabled={!selectedTenant || mustUseAssignedBranch}
          >
            <option value="">
              {mustUseAssignedBranch
                ? authBranchName ?? "Sucursal asignada"
                : "Selecciona una sucursal"}
            </option>
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

          {mustUseAssignedBranch ? (
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <span>
                {authBranchId
                  ? "Tu rol usa la sucursal asignada. No puedes abrir caja en otra sucursal."
                  : "Tu usuario no tiene sucursal asignada. Solicita asignacion antes de abrir caja."}
              </span>
            </div>
          ) : null}

          {selectedBranch && availableTerminals.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Esta sucursal no tiene terminales activas para POS.
            </div>
          ) : null}

          {terminalId && !cashLoading && !selectedCashRegister ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              La terminal seleccionada no tiene una caja activa asociada.
            </div>
          ) : null}

          {currentCashConflicts ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Ya tienes una caja abierta en otra sucursal o caja. Cierra esa caja antes de cambiar de contexto.
            </div>
          ) : null}

          {selectedCashRegister ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Caja asociada: {selectedCashRegister.nombre}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {currentCashMatchesSelection
                      ? "Hay una caja abierta en este contexto."
                      : "Se abrira una caja en este contexto antes de entrar al POS."}
                  </p>
                </div>
              </div>
              {needsCashOpening ? (
                <div className="mt-4 max-w-xs">
                  <Input
                    label="Monto de apertura"
                    type="number"
                    min="0"
                    step="0.01"
                    value={String(openingAmount)}
                    onChange={(event) => setOpeningAmount(Number(event.target.value))}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              onClick={() => void handleConfirm()}
              disabled={!canConfirm}
              isLoading={submitting || cashLoading}
            >
              {needsCashOpening ? "Abrir caja y entrar al POS" : "Entrar al POS"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};
