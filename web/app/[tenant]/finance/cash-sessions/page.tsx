"use client";

import { Download, Eye, Plus, Printer, Receipt, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../../components/design-system/Button";
import { Modal } from "../../../../components/design-system/Modal";
import {
  NoticeDialog,
  type NoticeDialogVariant,
} from "../../../../components/design-system/NoticeDialog";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { CloseCashSessionForm } from "../../../../modules/finance/components/CloseCashSessionForm";
import { FinanceAccessNotice } from "../../../../modules/finance/components/FinanceAccessNotice";
import { FinanceMetricCard } from "../../../../modules/finance/components/FinanceMetricCard";
import { FinancePageHeader } from "../../../../modules/finance/components/FinancePageHeader";
import { FinanceSectionNav } from "../../../../modules/finance/components/FinanceSectionNav";
import { FinanceStatusBadge } from "../../../../modules/finance/components/FinanceStatusBadge";
import { useFinanceCatalogs } from "../../../../modules/finance/hooks/use-finance-catalogs";
import { useCashSessions } from "../../../../modules/finance/hooks/use-cash-sessions";
import { getFinancePermissions } from "../../../../modules/finance/permissions";
import type {
  CashSession,
  CashSessionSummary,
  CloseCashSessionPayload,
} from "../../../../modules/finance/types";
import { formatCurrency, formatDateTime } from "../../../../modules/finance/utils";
import { PdfPreviewModal } from "../../../../modules/reporteria/components/PdfPreviewModal";
import { getCashClosingTicket } from "../../../../modules/reporteria/services/reporting.service";
import {
  downloadBlob,
  getApiErrorMessage,
} from "../../../../modules/reporteria/utils";
import { useAppSelector } from "../../../../store/hooks";

const closeFormInitial: CloseCashSessionPayload = {
  closingAmount: 0,
  description: "",
};

type PdfConfig = {
  title: string;
  fileName: string;
  getPdf: () => Promise<Blob>;
};

type CloseNoticeState = {
  variant: NoticeDialogVariant;
  title: string;
  message: string;
  session?: CashSession;
  summary?: CashSessionSummary | null;
  expectedAmount?: number;
  realAmount?: number;
  differenceAmount?: number;
};

const buildCashClosingTicketFileName = (cashSessionId: string) =>
  `ticket-cierre-${cashSessionId}.pdf`;

const buildCashClosingTicketTitle = (cashSessionId: string) =>
  `Ticket de cierre ${cashSessionId.slice(0, 8)}`;

const buildCloseNoticeRows = (notice: CloseNoticeState) => {
  if (!notice.session) {
    return [];
  }

  const totals = notice.summary?.totals;
  const entries =
    totals === undefined ? undefined : totals.paymentsIn + totals.adjustmentsIn;
  const exits =
    totals === undefined
      ? undefined
      : totals.paymentsOut +
        totals.expenses +
        totals.withdrawals +
        totals.adjustmentsOut;
  const expected =
    notice.session.expectedAmount ?? totals?.expectedAmount ?? notice.expectedAmount;
  const real =
    notice.session.closingAmount ?? totals?.closingRecorded ?? notice.realAmount;
  const difference =
    notice.session.differenceAmount ??
    notice.differenceAmount ??
    (real !== undefined && expected !== undefined ? real - expected : undefined);

  return [
    {
      label: "Monto apertura",
      value: formatCurrency(notice.session.openingAmount),
    },
    entries === undefined
      ? null
      : {
          label: "Entradas",
          value: formatCurrency(entries),
        },
    exits === undefined
      ? null
      : {
          label: "Salidas",
          value: formatCurrency(exits),
        },
    expected === undefined || expected === null
      ? null
      : {
          label: "Esperado",
          value: formatCurrency(expected),
        },
    real === undefined || real === null
      ? null
      : {
          label: "Real",
          value: formatCurrency(real),
        },
    difference === undefined || difference === null
      ? null
      : {
          label: "Diferencia",
          value: formatCurrency(difference),
        },
    {
      label: "Fecha/hora cierre",
      value: formatDateTime(notice.session.closedAt),
    },
  ].filter((row): row is { label: string; value: string } => Boolean(row));
};

const sumRecentMovementsByReference = (
  summary: CashSessionSummary | null,
  referenceType: string
) =>
  summary?.recentMovements
    .filter((movement) => movement.referenceType === referenceType)
    .reduce((sum, movement) => sum + movement.amount, 0) ?? 0;

const countRecentMovementsByReference = (
  summary: CashSessionSummary | null,
  referenceType: string
) =>
  summary?.recentMovements.filter(
    (movement) => movement.referenceType === referenceType
  ).length ?? 0;

const CashSessionsPage = () => {
  const router = useRouter();
  const authUser = useAppSelector((state) => state.auth.user);
  const role = authUser?.role ?? "";
  const tenantSlug = authUser?.tenantId ?? "default";
  const [statusFilter, setStatusFilter] = useState("all");
  const [registerFilter, setRegisterFilter] = useState("");
  const [closeModal, setCloseModal] = useState(false);
  const [closeForm, setCloseForm] = useState<CloseCashSessionPayload>(closeFormInitial);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [closeNotice, setCloseNotice] = useState<CloseNoticeState | null>(null);
  const [pdfConfig, setPdfConfig] = useState<PdfConfig | null>(null);

  const { canViewFinance, canOperateCashSessions } = getFinancePermissions(role);
  const {
    currentSession,
    history,
    sessionSummary,
    loadingCurrent,
    loadingHistory,
    loadingSummary,
    saving,
    errorMessage,
    loadCurrentSession,
    loadHistory,
    loadSessionSummary,
    closeSession,
  } = useCashSessions();
  const {
    registerOptions,
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
    void loadCashRegisters();
  }, [
    authUser?.tenantId,
    canViewFinance,
    loadCashRegisters,
    loadCurrentSession,
    loadHistory,
  ]);

  useEffect(() => {
    if (!currentSession?.id) {
      return;
    }

    void loadSessionSummary(currentSession.id);
  }, [currentSession?.id, loadSessionSummary]);

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
    ? sessionSummary?.totals.expectedAmount ??
      currentSession.expectedAmount ??
      currentSession.openingAmount
    : 0;

  const showTicketActionError = (error: unknown, fallbackMessage: string) => {
    setToastMessage(getApiErrorMessage(error, fallbackMessage));
    setToastVariant("error");
  };

  const openTicketPreview = (cashSessionId: string) => {
    setCloseNotice(null);
    setPdfConfig({
      title: buildCashClosingTicketTitle(cashSessionId),
      fileName: buildCashClosingTicketFileName(cashSessionId),
      getPdf: () => getCashClosingTicket(cashSessionId),
    });
  };

  const handleDownloadTicket = async (cashSessionId: string) => {
    try {
      const blob = await getCashClosingTicket(cashSessionId);
      downloadBlob(blob, buildCashClosingTicketFileName(cashSessionId));
    } catch (error) {
      showTicketActionError(error, "No se pudo descargar el ticket de cierre.");
    }
  };

  const handlePrintTicket = async (
    cashSessionId: string,
    options: { automatic?: boolean } = {}
  ) => {
    try {
      const blob = await getCashClosingTicket(cashSessionId);
      const objectUrl = window.URL.createObjectURL(blob);
      const printWindow = window.open(objectUrl, "_blank");

      if (!printWindow) {
        window.URL.revokeObjectURL(objectUrl);
        setToastMessage(
          options.automatic
            ? "El navegador bloqueo la impresion automatica. Usa Imprimir o Ver ticket para hacerlo manualmente."
            : "El navegador bloqueo la impresion. Usa Ver ticket para imprimir manualmente."
        );
        setToastVariant("warning");
        return;
      }

      const print = () => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch {
          setToastMessage("No se pudo imprimir automaticamente. Usa Ver ticket.");
          setToastVariant("warning");
        }
      };

      printWindow.addEventListener("load", print, { once: true });
      window.setTimeout(print, 1000);
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
      showTicketActionError(error, "No se pudo imprimir el ticket de cierre.");
    }
  };

  const handleCloseSession = async () => {
    if (!currentSession) {
      return;
    }

    const summarySnapshot = sessionSummary;
    const expectedSnapshot = expectedCurrent;
    const realSnapshot = closeForm.closingAmount;

    try {
      const closed = await closeSession(currentSession.id, closeForm);
      setCloseModal(false);
      setCloseForm(closeFormInitial);
      await loadCurrentSession();
      await loadHistory({ limit: 50 });
      setCloseNotice({
        variant: "success",
        title: "Caja cerrada",
        message: "Caja cerrada correctamente",
        session: closed,
        summary: summarySnapshot,
        expectedAmount: expectedSnapshot,
        realAmount: realSnapshot,
        differenceAmount: closed.differenceAmount ?? realSnapshot - expectedSnapshot,
      });
      window.dispatchEvent(new Event("manus:cash-session-changed"));
      void handlePrintTicket(closed.id, { automatic: true });
    } catch (error) {
      setCloseNotice({
        variant: "error",
        title: "No se pudo cerrar la caja",
        message: getApiErrorMessage(error, "No se pudo cerrar la caja."),
      });
    }
  };

  if (!canViewFinance) {
    return (
      <FinanceAccessNotice description="No tienes acceso a sesiones de caja." />
    );
  }

  const openCount = history.filter((item) => item.status === "OPEN").length;
  const closedCount = history.filter((item) => item.status === "CLOSED").length;
  const recentOrderAmount = sumRecentMovementsByReference(
    sessionSummary,
    "SALES_ORDER"
  );
  const recentOrderCount = countRecentMovementsByReference(
    sessionSummary,
    "SALES_ORDER"
  );

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
              <Button
                onClick={() => router.push(`/${tenantSlug}/pos/select-context`)}
                disabled={Boolean(currentSession)}
              >
                <Plus className="h-4 w-4" />
                Abrir caja desde contexto
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
                  value={
                    loadingSummary && !sessionSummary
                      ? "Calculando..."
                      : formatCurrency(expectedCurrent)
                  }
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

              {sessionSummary ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <FinanceMetricCard
                    label="Ingresos"
                    value={formatCurrency(
                      sessionSummary.totals.paymentsIn + sessionSummary.totals.adjustmentsIn
                    )}
                    accent="emerald"
                  />
                  <FinanceMetricCard
                    label="Egresos"
                    value={formatCurrency(
                      sessionSummary.totals.paymentsOut +
                        sessionSummary.totals.expenses +
                        sessionSummary.totals.withdrawals +
                        sessionSummary.totals.adjustmentsOut
                    )}
                    accent="rose"
                  />
                  <FinanceMetricCard
                    label="Ventas cobradas"
                    value={formatCurrency(sessionSummary.totals.salesPayments)}
                    accent="blue"
                  />
                  <FinanceMetricCard
                    label="Ultimo arqueo"
                    value={
                      sessionSummary.lastCount
                        ? formatCurrency(sessionSummary.lastCount.countedCashAmount)
                        : "Sin arqueo"
                    }
                    accent="slate"
                  />
                </div>
              ) : null}

              {sessionSummary ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                        Gestion del turno
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">
                        Caja abierta actual
                      </h3>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/${tenantSlug}/finance/cash-movements?cashSessionId=${currentSession.id}`
                        )
                      }
                    >
                      Ver movimientos
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <FinanceMetricCard
                      label="Ventas POS"
                      value={formatCurrency(sessionSummary.totals.salesPayments)}
                      accent="blue"
                    />
                    <FinanceMetricCard
                      label="Pedidos"
                      value={
                        recentOrderCount > 0
                          ? formatCurrency(recentOrderAmount)
                          : "Sin pedidos"
                      }
                      accent="emerald"
                    />
                    <FinanceMetricCard
                      label="Compras"
                      value={formatCurrency(sessionSummary.totals.purchasePayments)}
                      accent="rose"
                    />
                    <FinanceMetricCard
                      label="Movimientos"
                      value={sessionSummary.totals.movementCount}
                      accent="amber"
                    />
                    <FinanceMetricCard
                      label="Arqueo"
                      value={
                        sessionSummary.lastCount
                          ? formatCurrency(sessionSummary.lastCount.countedCashAmount)
                          : "Sin arqueo"
                      }
                      accent="slate"
                    />
                    <FinanceMetricCard
                      label="Tickets"
                      value="Ticket al cerrar"
                      accent="slate"
                    />
                  </div>

                  {sessionSummary.recentMovements.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Ultimos movimientos
                      </p>
                      {sessionSummary.recentMovements.slice(0, 4).map((movement) => (
                        <div
                          key={movement.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-slate-700">
                            {movement.description ??
                              movement.referenceType ??
                              movement.movementType}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {movement.direction === "OUT" ? "-" : ""}
                            {formatCurrency(movement.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                      Sin movimientos registrados en la caja abierta.
                    </div>
                  )}
                </section>
              ) : null}
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
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    {session.status === "CLOSED" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTicketPreview(session.id)}
                        >
                          <Eye className="h-4 w-4" />
                          Ver ticket
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDownloadTicket(session.id)}
                        >
                          <Download className="h-4 w-4" />
                          Descargar PDF
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handlePrintTicket(session.id)}
                        >
                          <Printer className="h-4 w-4" />
                          Imprimir
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        El ticket de cierre estara disponible cuando la caja quede cerrada.
                      </p>
                    )}
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

      {closeModal && currentSession ? (
        <Modal title="Cerrar caja" className="max-w-2xl">
          <CloseCashSessionForm
            value={closeForm}
            expectedAmount={expectedCurrent}
            summary={sessionSummary}
            onChange={setCloseForm}
            onCancel={() => setCloseModal(false)}
            onSubmit={() => void handleCloseSession()}
            isSaving={saving}
          />
        </Modal>
      ) : null}

      {closeNotice ? (
        <NoticeDialog
          open={Boolean(closeNotice)}
          title={closeNotice.title}
          message={closeNotice.message}
          variant={closeNotice.variant}
          closeText={closeNotice.variant === "success" ? "Cerrar" : "Reintentar"}
          onClose={() => setCloseNotice(null)}
        >
          {closeNotice.variant === "success" && closeNotice.session ? (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {buildCloseNoticeRows(closeNotice).map((row) => (
                  <div
                    key={row.label}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {row.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openTicketPreview(closeNotice.session!.id)}
                >
                  <Eye className="h-4 w-4" />
                  Ver ticket
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDownloadTicket(closeNotice.session!.id)}
                >
                  <Download className="h-4 w-4" />
                  Descargar PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handlePrintTicket(closeNotice.session!.id)}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
              </div>
            </div>
          ) : null}
        </NoticeDialog>
      ) : null}

      {pdfConfig ? (
        <PdfPreviewModal
          isOpen={Boolean(pdfConfig)}
          title={pdfConfig.title}
          fileName={pdfConfig.fileName}
          getPdf={pdfConfig.getPdf}
          onClose={() => setPdfConfig(null)}
        />
      ) : null}
    </div>
  );
};

export default CashSessionsPage;
