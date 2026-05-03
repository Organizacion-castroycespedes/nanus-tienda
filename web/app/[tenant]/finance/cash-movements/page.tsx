"use client";

import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../../components/design-system/Button";
import { Modal } from "../../../../components/design-system/Modal";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { CashMovementForm } from "../../../../modules/finance/components/CashMovementForm";
import { FinanceAccessNotice } from "../../../../modules/finance/components/FinanceAccessNotice";
import { FinanceMetricCard } from "../../../../modules/finance/components/FinanceMetricCard";
import { FinancePageHeader } from "../../../../modules/finance/components/FinancePageHeader";
import { FinanceSectionNav } from "../../../../modules/finance/components/FinanceSectionNav";
import { FinanceStatusBadge } from "../../../../modules/finance/components/FinanceStatusBadge";
import { useCashMovements } from "../../../../modules/finance/hooks/use-cash-movements";
import { useCashSessions } from "../../../../modules/finance/hooks/use-cash-sessions";
import { useFinanceCatalogs } from "../../../../modules/finance/hooks/use-finance-catalogs";
import { getFinancePermissions } from "../../../../modules/finance/permissions";
import type { CreateCashMovementPayload } from "../../../../modules/finance/types";
import { formatCurrency, formatDateTime } from "../../../../modules/finance/utils";
import { useAppSelector } from "../../../../store/hooks";

const emptyForm: CreateCashMovementPayload = {
  tenantId: undefined,
  cashSessionId: "",
  movementType: "ADJUSTMENT",
  direction: "OUT",
  amount: 0,
  description: "",
  referenceType: "",
  referenceId: "",
};

const CashMovementsPage = () => {
  const authUser = useAppSelector((state) => state.auth.user);
  const role = authUser?.role ?? "";
  const tenantSlug = authUser?.tenantId ?? "default";
  const [branchFilter, setBranchFilter] = useState("");
  const [registerFilter, setRegisterFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateCashMovementPayload>(emptyForm);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");

  const { canViewFinance, canCreateCashMovements } = getFinancePermissions(role);
  const {
    movements,
    loading,
    saving,
    errorMessage,
    loadMovements,
    createItem,
  } = useCashMovements();
  const {
    currentSession,
    history: openSessions,
    sessionSummary,
    loadCurrentSession,
    loadHistory,
    loadSessionSummary,
  } = useCashSessions();
  const {
    branchOptions,
    registerOptions,
    loadBranches,
    loadCashRegisters,
  } = useFinanceCatalogs({
    role,
    tenantId: authUser?.tenantId,
  });

  useAutoClearState(toastMessage, setToastMessage);

  const refreshPageData = useCallback(async () => {
    const session = await loadCurrentSession();
    await Promise.all([
      loadMovements({ limit: 100, cashSessionId: session?.id ?? undefined }),
      loadHistory({ status: "OPEN", limit: 50 }),
      loadBranches(authUser?.tenantId ?? undefined),
      loadCashRegisters(),
      session?.id ? loadSessionSummary(session.id) : Promise.resolve(null),
    ]);
  }, [
    authUser?.tenantId,
    loadBranches,
    loadCashRegisters,
    loadCurrentSession,
    loadHistory,
    loadMovements,
    loadSessionSummary,
  ]);

  useEffect(() => {
    if (!canViewFinance) {
      return;
    }

    void refreshPageData();
  }, [
    authUser?.tenantId,
    canViewFinance,
    loadBranches,
    loadCashRegisters,
    loadCurrentSession,
    loadHistory,
    loadMovements,
    loadSessionSummary,
    refreshPageData,
  ]);

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      if (currentSession?.id && movement.cashSessionId !== currentSession.id) {
        return false;
      }
      if (branchFilter && movement.branchId !== branchFilter) {
        return false;
      }
      if (registerFilter && movement.cashRegisterId !== registerFilter) {
        return false;
      }
      if (directionFilter !== "all" && movement.direction !== directionFilter) {
        return false;
      }
      if (typeFilter !== "all" && movement.movementType !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [branchFilter, directionFilter, movements, registerFilter, typeFilter]);

  const totalIn = filteredMovements
    .filter((item) => item.direction === "IN")
    .reduce((sum, item) => sum + item.amount, 0);
  const totalOut = filteredMovements
    .filter((item) => item.direction === "OUT")
    .reduce((sum, item) => sum + item.amount, 0);
  const purchasePaymentsOut =
    sessionSummary?.totals.purchasePayments ??
    filteredMovements
      .filter(
        (item) =>
          item.movementType === "PAYMENT" &&
          item.direction === "OUT" &&
          item.referenceType === "PURCHASE"
      )
      .reduce((sum, item) => sum + item.amount, 0);
  const quickBalance = sessionSummary?.totals.netAmount ?? totalIn - totalOut;

  const handleCreateMovement = async () => {
    if (!form.cashSessionId || !form.amount) {
      setToastMessage("Selecciona sesion y monto.");
      setToastVariant("warning");
      return;
    }

    try {
      await createItem({
        ...form,
        description: form.description?.trim() || undefined,
        referenceType: form.referenceType?.trim() || undefined,
        referenceId: form.referenceId?.trim() || undefined,
      });
      await Promise.all([
        loadMovements({ limit: 100, cashSessionId: currentSession?.id ?? undefined }),
        currentSession?.id ? loadSessionSummary(currentSession.id) : Promise.resolve(null),
      ]);
      setToastMessage("Movimiento registrado correctamente.");
      setToastVariant("success");
      setModalOpen(false);
      setForm(emptyForm);
    } catch {
      setToastMessage("No se pudo registrar el movimiento.");
      setToastVariant("error");
    }
  };

  if (!canViewFinance) {
    return (
      <FinanceAccessNotice description="No tienes acceso a movimientos de caja." />
    );
  }

  return (
    <div className="space-y-6">
      <FinancePageHeader
        eyebrow="Finance / Auditoria"
        title="Movimientos de caja"
        description="Consulta entradas y salidas con una lectura tipo timeline, filtros rapidos y metricas para balance inmediato."
        actions={
          <>
            <Button variant="ghost" onClick={() => void refreshPageData()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canCreateCashMovements ? (
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Nuevo movimiento
              </Button>
            ) : null}
          </>
        }
      />

      <FinanceSectionNav tenantSlug={tenantSlug} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceMetricCard
          label="Entradas"
          value={formatCurrency(totalIn)}
          accent="emerald"
        />
        <FinanceMetricCard
          label="Salidas"
          value={formatCurrency(totalOut)}
          accent="rose"
        />
        <FinanceMetricCard
          label="Pagos compras"
          value={formatCurrency(purchasePaymentsOut)}
          accent="amber"
        />
        <FinanceMetricCard
          label="Balance rapido"
          value={formatCurrency(quickBalance)}
          accent={quickBalance >= 0 ? "blue" : "rose"}
        />
        <FinanceMetricCard
          label="Movimientos"
          value={filteredMovements.length}
          accent="slate"
        />
      </section>

      {currentSession ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900 shadow-sm">
          <p className="font-semibold">
            Sesion activa: {currentSession.cashRegisterNombre ?? "Caja"}.
          </p>
          <p className="mt-1 text-emerald-800">
            Esta vista se concentra en la caja abierta actual para reflejar pagos y salidas de la sesion en curso.
          </p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Select
            label="Sucursal"
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
          >
            <option value="">Todas</option>
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <Select
            label="Caja"
            value={registerFilter}
            onChange={(event) => setRegisterFilter(event.target.value)}
          >
            <option value="">Todas</option>
            {registerOptions.map((register) => (
              <option key={register.id} value={register.id}>
                {register.nombre}
              </option>
            ))}
          </Select>
          <Select
            label="Direccion"
            value={directionFilter}
            onChange={(event) => setDirectionFilter(event.target.value)}
          >
            <option value="all">Todas</option>
            <option value="IN">Entradas</option>
            <option value="OUT">Salidas</option>
          </Select>
          <Select
            label="Tipo"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">Todos</option>
            <option value="OPENING">Apertura</option>
            <option value="CLOSING">Cierre</option>
            <option value="ADJUSTMENT">Ajuste</option>
            <option value="EXPENSE">Gasto</option>
            <option value="WITHDRAWAL">Retiro</option>
            <option value="PAYMENT">Pago</option>
          </Select>
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              Cargando movimientos...
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              No hay movimientos para mostrar.
            </div>
          ) : (
            filteredMovements.map((movement) => (
              <article
                key={movement.id}
                className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <FinanceStatusBadge value={movement.movementType} kind="movement" />
                      <FinanceStatusBadge value={movement.direction} kind="direction" />
                    </div>
                    <p className="mt-3 text-base font-semibold text-slate-900">
                      {movement.cashRegisterNombre ?? "Caja"} · {formatCurrency(movement.amount)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {movement.description ?? "Sin descripcion"}
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-500">
                    <p>{formatDateTime(movement.createdAt)}</p>
                    <p className="mt-1">{movement.createdByEmail ?? "Usuario"}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {modalOpen ? (
        <Modal title="Registrar movimiento" className="max-w-3xl">
          <CashMovementForm
            value={form}
            openSessions={openSessions}
            onChange={setForm}
            onCancel={() => setModalOpen(false)}
            onSubmit={() => void handleCreateMovement()}
            isSaving={saving}
          />
        </Modal>
      ) : null}
    </div>
  );
};

export default CashMovementsPage;
