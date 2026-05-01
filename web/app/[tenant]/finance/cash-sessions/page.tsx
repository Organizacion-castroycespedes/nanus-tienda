"use client";

import { Plus, Receipt, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../../components/design-system/Button";
import { Modal } from "../../../../components/design-system/Modal";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { CloseCashSessionForm } from "../../../../modules/finance/components/CloseCashSessionForm";
import { FinanceAccessNotice } from "../../../../modules/finance/components/FinanceAccessNotice";
import { FinanceMetricCard } from "../../../../modules/finance/components/FinanceMetricCard";
import { FinancePageHeader } from "../../../../modules/finance/components/FinancePageHeader";
import { FinanceSectionNav } from "../../../../modules/finance/components/FinanceSectionNav";
import { FinanceStatusBadge } from "../../../../modules/finance/components/FinanceStatusBadge";
import { OpenCashSessionForm } from "../../../../modules/finance/components/OpenCashSessionForm";
import { useFinanceCatalogs } from "../../../../modules/finance/hooks/use-finance-catalogs";
import { useCashSessions } from "../../../../modules/finance/hooks/use-cash-sessions";
import { getFinancePermissions } from "../../../../modules/finance/permissions";
import type {
  CloseCashSessionPayload,
  OpenCashSessionPayload,
} from "../../../../modules/finance/types";
import { formatCurrency, formatDateTime } from "../../../../modules/finance/utils";
import { useAppSelector } from "../../../../store/hooks";

const openFormInitial: OpenCashSessionPayload = {
  tenantId: undefined,
  branchId: "",
  cashRegisterId: "",
  openingAmount: 0,
};

const closeFormInitial: CloseCashSessionPayload = {
  closingAmount: 0,
  description: "",
};

const CashSessionsPage = () => {
  const authUser = useAppSelector((state) => state.auth.user);
  const role = authUser?.role ?? "";
  const tenantSlug = authUser?.tenantId ?? "default";
  const [statusFilter, setStatusFilter] = useState("all");
  const [registerFilter, setRegisterFilter] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [openForm, setOpenForm] = useState<OpenCashSessionPayload>(openFormInitial);
  const [closeForm, setCloseForm] = useState<CloseCashSessionPayload>(closeFormInitial);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");

  const { canViewFinance, canOperateCashSessions } = getFinancePermissions(role);
  const {
    currentSession,
    history,
    loadingCurrent,
    loadingHistory,
    saving,
    errorMessage,
    loadCurrentSession,
    loadHistory,
    openSession,
    closeSession,
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

  useEffect(() => {
    if (!canViewFinance) {
      return;
    }

    void loadCurrentSession();
    void loadHistory({ limit: 50 });
    void loadBranches(authUser?.tenantId ?? undefined);
    void loadCashRegisters();
  }, [
    authUser?.tenantId,
    canViewFinance,
    loadBranches,
    loadCashRegisters,
    loadCurrentSession,
    loadHistory,
  ]);

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (registerFilter && item.cashRegisterId !== registerFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [history, registerFilter, statusFilter]);

  const expectedCurrent = currentSession
    ? currentSession.expectedAmount ?? currentSession.openingAmount
    : 0;

  const handleOpenSession = async () => {
    if (!openForm.branchId || !openForm.cashRegisterId) {
      setToastMessage("Selecciona sucursal y caja.");
      setToastVariant("warning");
      return;
    }

    try {
      await openSession(openForm);
      setToastMessage("Caja abierta correctamente.");
      setToastVariant("success");
      setOpenModal(false);
      setOpenForm(openFormInitial);
      await loadHistory({ limit: 50 });
    } catch {
      setToastMessage("No se pudo abrir la caja.");
      setToastVariant("error");
    }
  };

  const handleCloseSession = async () => {
    if (!currentSession) {
      return;
    }

    try {
      await closeSession(currentSession.id, closeForm);
      setToastMessage("Caja cerrada correctamente.");
      setToastVariant("success");
      setCloseModal(false);
      setCloseForm(closeFormInitial);
      await loadCurrentSession();
      await loadHistory({ limit: 50 });
    } catch {
      setToastMessage("No se pudo cerrar la caja.");
      setToastVariant("error");
    }
  };

  if (!canViewFinance) {
    return (
      <FinanceAccessNotice description="No tienes acceso a sesiones de caja." />
    );
  }

  const openCount = history.filter((item) => item.status === "OPEN").length;
  const closedCount = history.filter((item) => item.status === "CLOSED").length;

  return (
    <div className="space-y-6">
      <FinancePageHeader
        eyebrow="Finance / Caja"
        title="Sesiones de caja"
        description="Abre, monitorea y cierra cajas con una lectura inmediata del estado actual y del historial reciente."
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                void loadCurrentSession();
                void loadHistory({ limit: 50 });
              }}
              isLoading={loadingCurrent || loadingHistory}
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            {canOperateCashSessions ? (
              <Button onClick={() => setOpenModal(true)} disabled={Boolean(currentSession)}>
                <Plus className="h-4 w-4" />
                Abrir caja
              </Button>
            ) : null}
          </>
        }
      />

      <FinanceSectionNav tenantSlug={tenantSlug} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinanceMetricCard
          label="Caja actual"
          value={currentSession ? currentSession.cashRegisterNombre ?? "Abierta" : "Sin sesion"}
          accent={currentSession ? "amber" : "slate"}
        />
        <FinanceMetricCard
          label="Monto de apertura"
          value={currentSession ? formatCurrency(currentSession.openingAmount) : formatCurrency(0)}
          accent="blue"
        />
        <FinanceMetricCard label="Sesiones abiertas" value={openCount} accent="emerald" />
        <FinanceMetricCard label="Sesiones cerradas" value={closedCount} accent="slate" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Estado actual
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Tu caja en este momento
              </h2>
            </div>
            {currentSession ? (
              <FinanceStatusBadge value={currentSession.status} kind="session" />
            ) : null}
          </div>
          {loadingCurrent ? (
            <p className="mt-6 text-sm text-slate-500">Consultando sesion actual...</p>
          ) : !currentSession ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
              No tienes una sesion abierta en este momento.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Caja</p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {currentSession.cashRegisterNombre}
                  </p>
                  <p className="text-sm text-slate-500">
                    {currentSession.cashRegisterCodigo}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Abierta</p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {formatDateTime(currentSession.openedAt)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {currentSession.openedByUserEmail ?? "Usuario actual"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <FinanceMetricCard
                  label="Apertura"
                  value={formatCurrency(currentSession.openingAmount)}
                  accent="blue"
                />
                <FinanceMetricCard
                  label="Esperado"
                  value={formatCurrency(expectedCurrent)}
                  accent="amber"
                />
                <FinanceMetricCard
                  label="Accion"
                  value={
                    canOperateCashSessions ? (
                      <Button variant="warning" onClick={() => setCloseModal(true)}>
                        <Receipt className="h-4 w-4" />
                        Cerrar caja
                      </Button>
                    ) : (
                      "Solo lectura"
                    )
                  }
                  accent="slate"
                />
              </div>
            </div>
          )}
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
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
              label="Estado"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Todos</option>
              <option value="OPEN">Abiertas</option>
              <option value="CLOSED">Cerradas</option>
              <option value="CANCELLED">Canceladas</option>
            </Select>
          </div>

          <div className="mt-5 space-y-3">
            {loadingHistory ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                Cargando historial...
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                No hay sesiones para mostrar.
              </div>
            ) : (
              filteredHistory.map((session) => (
                <div
                  key={session.id}
                  className="rounded-2xl border border-slate-200 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {session.cashRegisterNombre ?? "Caja"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Apertura {formatDateTime(session.openedAt)}
                      </p>
                    </div>
                    <FinanceStatusBadge value={session.status} kind="session" />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Apertura</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {formatCurrency(session.openingAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cierre</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {formatCurrency(session.closingAmount ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Diferencia</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {formatCurrency(session.differenceAmount ?? 0)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

      {openModal ? (
        <Modal title="Abrir caja" className="max-w-3xl">
          <OpenCashSessionForm
            value={openForm}
            branchOptions={branchOptions}
            registerOptions={registerOptions}
            onChange={setOpenForm}
            onCancel={() => setOpenModal(false)}
            onSubmit={() => void handleOpenSession()}
            isSaving={saving}
          />
        </Modal>
      ) : null}

      {closeModal && currentSession ? (
        <Modal title="Cerrar caja" className="max-w-2xl">
          <CloseCashSessionForm
            value={closeForm}
            expectedAmount={expectedCurrent}
            onChange={setCloseForm}
            onCancel={() => setCloseModal(false)}
            onSubmit={() => void handleCloseSession()}
            isSaving={saving}
          />
        </Modal>
      ) : null}
    </div>
  );
};

export default CashSessionsPage;
