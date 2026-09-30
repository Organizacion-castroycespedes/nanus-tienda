"use client";

import { Plus, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../../components/design-system/Button";
import { Modal } from "../../../../components/design-system/Modal";
import { Select } from "../../../../components/design-system/Select";
import { Input } from "../../../../components/design-system/Input";
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
  const tenantSlug = authUser?.tenantSlug ?? authUser?.tenantId ?? "default";
  const [branchFilter, setBranchFilter] = useState("");
  const [registerFilter, setRegisterFilter] = useState("");
  const [currentTenantFilter, setCurrentTenantFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"movements" | "payments">("movements");
  const [queryMode, setQueryMode] = useState<"current" | "history">("current");
  const [currentUserFilter, setCurrentUserFilter] = useState("");
  const [currentSessionFilter, setCurrentSessionFilter] = useState("");
  const [hasExecutedQuery, setHasExecutedQuery] = useState(false);
  const [queryMessage, setQueryMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateCashMovementPayload>(emptyForm);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");

  const { canViewFinance, canViewPaymentMethods, canCreateCashMovements } =
    getFinancePermissions(role);
  const {
    movements,
    summary,
    byPaymentMethod,
    loading,
    saving,
    errorMessage,
    loadMovements,
    createItem,
    clearResults,
  } = useCashMovements();
  const {
    currentSession,
    history: openSessions,
    loadCurrentSession,
    loadHistory,
    loadSessionSummary,
  } = useCashSessions();
  const {
    branchOptions,
    registerOptions,
    tenantOptions,
    loadBranches,
    loadCashRegisters,
    loadTenants,
  } = useFinanceCatalogs({
    role,
    tenantId: authUser?.tenantId,
  });

  useAutoClearState(toastMessage, setToastMessage);

  const refreshPageData = useCallback(async () => {
    const session = await loadCurrentSession();
    await Promise.all([
      loadHistory({
        status: "OPEN",
        tenantId: currentTenantFilter || authUser?.tenantId || undefined,
        branchId: queryMode === "current" ? branchFilter || undefined : undefined,
        cashRegisterId: queryMode === "current" ? registerFilter || undefined : undefined,
        limit: 50,
      }),
      loadBranches(currentTenantFilter || authUser?.tenantId || undefined),
      loadCashRegisters({
        tenantId: currentTenantFilter || authUser?.tenantId || undefined,
        branchId: branchFilter || undefined,
      }),
      session?.id ? loadSessionSummary(session.id) : Promise.resolve(null),
    ]);
  }, [
    authUser?.tenantId,
    branchFilter,
    currentTenantFilter,
    loadBranches,
    loadCashRegisters,
    loadCurrentSession,
    loadHistory,
    loadSessionSummary,
    queryMode,
    registerFilter,
  ]);

  useEffect(() => {
    if (role === "SUPER_ADMIN" && canViewFinance) {
      void loadTenants();
    }
  }, [canViewFinance, loadTenants, role]);

  const currentOpenSessions = useMemo(
    () => openSessions.filter((session) => session.status === "OPEN"),
    [openSessions]
  );
  const currentUsers = useMemo(
    () =>
      Array.from(
        new Map(
          currentOpenSessions.map((session) => [
            session.openedByUserId,
            session.openedByUserEmail ?? session.openedByUserId,
          ])
        )
      ).map(([id, label]) => ({ id, label })),
    [currentOpenSessions]
  );
  const selectableCurrentSessions = useMemo(
    () =>
      currentOpenSessions.filter(
        (session) => !currentUserFilter || session.openedByUserId === currentUserFilter
      ),
    [currentOpenSessions, currentUserFilter]
  );

  const executeCurrentQuery = useCallback(
    async (cashSessionId: string) => {
      setQueryMessage(null);
      setHasExecutedQuery(true);
      await loadMovements({
        cashSessionId,
        branchId: branchFilter || undefined,
        cashRegisterId: registerFilter || undefined,
        limit: 100,
        offset: 0,
      });
    },
    [branchFilter, loadMovements, registerFilter]
  );

  useEffect(() => {
    if (queryMode !== "current" || !canViewFinance || currentOpenSessions.length === 0) {
      return;
    }
    const selected = selectableCurrentSessions.find(
      (session) => session.id === currentSessionFilter
    ) ?? selectableCurrentSessions[0];
    if (!selected) {
      return;
    }
    if (selected.id !== currentSessionFilter) {
      setCurrentSessionFilter(selected.id);
    }
    void executeCurrentQuery(selected.id);
  }, [
    canViewFinance,
    currentOpenSessions,
    currentSessionFilter,
    executeCurrentQuery,
    queryMode,
    selectableCurrentSessions,
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
    loadSessionSummary,
    refreshPageData,
  ]);

  const overviewSummary = summary;
  const paymentTotal = byPaymentMethod.reduce((total, item) => total + item.total, 0);

  const executeQuery = async () => {
    if (queryMode === "current") {
      const session = selectableCurrentSessions.find(
        (item) => item.id === currentSessionFilter
      ) ?? selectableCurrentSessions[0];
      if (!session) {
        setQueryMessage("No hay una sesion abierta autorizada para consultar.");
        return;
      }
      await executeCurrentQuery(session.id);
      return;
    }
    setQueryMessage(null);
    if (!dateFrom || !dateTo) {
      setQueryMessage("Selecciona fecha desde y fecha hasta.");
      return;
    }
    if (dateFrom > dateTo) {
      setQueryMessage("Fecha desde no puede ser mayor que fecha hasta.");
      return;
    }
    const start = new Date(`${dateFrom}T00:00:00Z`).getTime();
    const end = new Date(`${dateTo}T00:00:00Z`).getTime();
    if (end - start > 30 * 86400000) {
      setQueryMessage("El rango maximo es de 31 dias.");
      return;
    }
    setHasExecutedQuery(true);
    await loadMovements({
      dateFrom,
      dateTo,
      branchId: branchFilter || undefined,
      cashRegisterId: registerFilter || undefined,
      direction: activeTab === "movements" && directionFilter !== "all" ? directionFilter as "IN" | "OUT" : undefined,
      movementType: activeTab === "movements" && typeFilter !== "all" ? typeFilter as never : undefined,
      limit: 100,
      offset: 0,
    });
  };

  const clearQuery = () => {
    setDateFrom("");
    setDateTo("");
    setBranchFilter("");
    setRegisterFilter("");
    setDirectionFilter("all");
    setTypeFilter("all");
    setQueryMessage(null);
    setHasExecutedQuery(false);
    clearResults();
    setCurrentUserFilter("");
    setCurrentSessionFilter("");
  };

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
        hasExecutedQuery ? executeQuery() : Promise.resolve(null),
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
    <div className="min-w-0 space-y-4">
      <FinancePageHeader
        compact
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

      <FinanceSectionNav
        tenantSlug={tenantSlug}
        canViewPaymentMethods={canViewPaymentMethods}
        compact
      />

      <div className="flex min-w-0 gap-1 border-b border-slate-200 dark:border-slate-700" role="tablist" aria-label="Vista de movimientos">
        {([
          ["movements", "Movimientos"],
          ["payments", "Métodos de pago"],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`${tab}-panel`}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-3 py-2 text-sm font-semibold transition ${activeTab === tab ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex min-w-0 gap-1 border-b border-slate-200 dark:border-slate-700" role="tablist" aria-label="Modo de consulta">
        {([[
          "current",
          "Turno actual",
        ], ["history", "Histórico"]] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={queryMode === mode}
            onClick={() => {
              setQueryMode(mode);
              clearResults();
              setHasExecutedQuery(false);
            }}
            className={`border-b-2 px-3 py-2 text-sm font-semibold transition ${queryMode === mode ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(155px,1fr))] gap-2">
        <FinanceMetricCard
          compact
          label="Entradas"
          value={overviewSummary ? formatCurrency(overviewSummary.totalIn) : "—"}
          accent="emerald"
        />
        <FinanceMetricCard
          compact
          label="Salidas"
          value={overviewSummary ? formatCurrency(overviewSummary.totalOut) : "—"}
          accent="rose"
        />
        <FinanceMetricCard
          compact
          label="Pagos compras"
          value={overviewSummary ? formatCurrency(overviewSummary.purchasePayments) : "—"}
          accent="amber"
        />
        <FinanceMetricCard
          compact
          label="Balance rapido"
          value={overviewSummary ? formatCurrency(overviewSummary.balance) : "—"}
          accent={!overviewSummary || overviewSummary.balance >= 0 ? "blue" : "rose"}
        />
        <FinanceMetricCard
          compact
          label="Movimientos"
          value={overviewSummary ? overviewSummary.movementCount : "—"}
          accent="slate"
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {queryMode === "history" ? <>
            <Input label="Fecha desde" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <Input label="Fecha hasta" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </> : (
            <>
              {role === "SUPER_ADMIN" ? (
                <Select label="Tenant" value={currentTenantFilter} onChange={(event) => {
                  setCurrentTenantFilter(event.target.value);
                  setBranchFilter("");
                  setRegisterFilter("");
                  setCurrentUserFilter("");
                  setCurrentSessionFilter("");
                  clearResults();
                }}>
                  <option value="">Selecciona un tenant</option>
                  {tenantOptions.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
                </Select>
              ) : null}
              {role !== "USER" ? (
                <Select label="Usuario" value={currentUserFilter} onChange={(event) => { setCurrentUserFilter(event.target.value); setCurrentSessionFilter(""); clearResults(); }}>
                  <option value="">Todos los usuarios</option>
                  {currentUsers.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}
                </Select>
              ) : null}
              <Select label="Sesión abierta" value={currentSessionFilter} onChange={(event) => { setCurrentSessionFilter(event.target.value); clearResults(); }}>
                <option value="">Selecciona una sesión</option>
                {selectableCurrentSessions.map((session) => <option key={session.id} value={session.id}>{session.cashRegisterNombre ?? session.cashRegisterId} · {session.openedByUserEmail ?? session.openedByUserId}</option>)}
              </Select>
            </>
          )}
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
          {queryMode === "history" && activeTab === "movements" ? (
            <>
              <Select label="Direccion" value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value)}>
                <option value="all">Todas</option><option value="IN">Entradas</option><option value="OUT">Salidas</option>
              </Select>
              <Select label="Tipo" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">Todos</option><option value="OPENING">Apertura</option><option value="CLOSING">Cierre</option><option value="ADJUSTMENT">Ajuste</option><option value="EXPENSE">Gasto</option><option value="WITHDRAWAL">Retiro</option><option value="PAYMENT">Pago</option>
              </Select>
            </>
          ) : null}
          <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-2">
            <Button onClick={() => void executeQuery()} isLoading={loading}><Search className="h-4 w-4" />Buscar</Button>
            <Button variant="ghost" onClick={clearQuery}><X className="h-4 w-4" />Limpiar</Button>
          </div>
        </div>
        {queryMessage ? <p className="mt-2 text-sm text-amber-700">{queryMessage}</p> : null}
        {!hasExecutedQuery ? <p className="mt-2 text-xs text-slate-500">Selecciona un rango y pulsa Buscar para consultar movimientos.</p> : null}
      </section>

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

      {activeTab === "payments" ? (
        <section id="payments-panel" role="tabpanel" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:bg-slate-800 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Métodos de pago</p><h2 className="text-lg font-semibold text-slate-900 dark:text-white">Desglose por sesión de caja</h2><p className="text-xs text-slate-500">Pagos completados relacionados con el rango y alcance consultados.</p></div>
            {hasExecutedQuery ? <span className="text-sm text-slate-500">{byPaymentMethod.length} métodos · {formatCurrency(paymentTotal)}</span> : null}
          </div>
          {!hasExecutedQuery ? <div className="mt-4 rounded-xl border border-dashed p-5 text-sm text-slate-500">Ejecuta una consulta para ver el desglose.</div> : byPaymentMethod.length === 0 ? <div className="mt-4 rounded-xl border border-dashed p-5 text-sm text-slate-500">No hay pagos para los filtros seleccionados.</div> : <div className="mt-3 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="px-2 py-2">Método</th><th className="px-2 py-2">Tipo</th><th className="px-2 py-2">Pagos</th><th className="px-2 py-2">Ventas</th><th className="px-2 py-2">Pedidos</th><th className="px-2 py-2">Compras/egresos</th><th className="px-2 py-2">Neto</th></tr></thead><tbody>{byPaymentMethod.map((item) => <tr key={item.paymentMethodId} className="border-b border-slate-100"><td className="px-2 py-2 font-medium">{item.paymentMethodNombre ?? item.paymentMethod}</td><td className="px-2 py-2">{item.paymentMethodTipo ?? "-"}</td><td className="px-2 py-2">{item.count}</td><td className="px-2 py-2">{formatCurrency(item.sales)}</td><td className="px-2 py-2">{formatCurrency(item.orders)}</td><td className="px-2 py-2">{formatCurrency(item.purchasesOut)}</td><td className="px-2 py-2 font-semibold">{formatCurrency(item.net)}</td></tr>)}</tbody></table></div>}
        </section>
      ) : null}

      {activeTab === "movements" ? <section id="movements-panel" role="tabpanel" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
              Cargando movimientos...
            </div>
          ) : !hasExecutedQuery ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:text-slate-400">Selecciona un rango y ejecuta la consulta.</div>
          ) : movements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
              No hay movimientos para mostrar.
            </div>
          ) : (
            movements.map((movement) => (
              <article
                key={movement.id}
                className="rounded-xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <FinanceStatusBadge value={movement.movementType} kind="movement" />
                      <FinanceStatusBadge value={movement.direction} kind="direction" />
                    </div>
                    <p className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                      {movement.cashRegisterNombre ?? "Caja"} · {formatCurrency(movement.amount)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {movement.description ?? "Sin descripcion"}
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                    <p>{formatDateTime(movement.createdAt)}</p>
                    <p className="mt-1">{movement.createdByEmail ?? "Usuario"}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
      : null}

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
