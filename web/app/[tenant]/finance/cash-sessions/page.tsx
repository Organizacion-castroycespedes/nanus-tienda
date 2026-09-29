"use client";

import {
  Calendar,
  ChevronDown,
  ClipboardCheck,
  Download,
  Eye,
  Filter,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../../components/design-system/Button";
import { Input } from "../../../../components/design-system/Input";
import { Modal } from "../../../../components/design-system/Modal";
import {
  NoticeDialog,
  type NoticeDialogVariant,
} from "../../../../components/design-system/NoticeDialog";
import { RowActionsMenu } from "../../../../components/design-system/RowActionsMenu";
import { Select } from "../../../../components/design-system/Select";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { CloseCashSessionForm } from "../../../../modules/finance/components/CloseCashSessionForm";
import { CashSessionAuditForm } from "../../../../modules/finance/components/CashSessionAuditForm";
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
  CashSessionCloseResult,
  CashSessionSummary,
  CloseCashSessionPayload,
  CreateCashSessionAuditPayload,
} from "../../../../modules/finance/types";
import { formatCurrency, formatDateTime } from "../../../../modules/finance/utils";
import { createCashSessionAudit } from "../../../../modules/finance/services/finance.service";
import { PdfPreviewModal } from "../../../../modules/reporteria/components/PdfPreviewModal";
import { getCashClosingTicket } from "../../../../modules/reporteria/services/reporting.service";
import { getCashAuditTicket } from "../../../../modules/reporteria/services/reporting.service";
import {
  downloadBlob,
  getApiErrorMessage,
} from "../../../../modules/reporteria/utils";
import { useAppSelector } from "../../../../store/hooks";

const closeFormInitial: CloseCashSessionPayload = {
  closingAmount: 0,
  description: "",
};

const auditFormInitial: CreateCashSessionAuditPayload = {
  countedCashAmount: 0,
  notes: "",
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
  session?: CashSessionCloseResult;
  summary?: CashSessionSummary | null;
  expectedAmount?: number;
  realAmount?: number;
  differenceAmount?: number;
};

const buildCashClosingTicketFileName = (cashSessionId: string) =>
  `ticket-cierre-${cashSessionId}.pdf`;

const buildCashClosingTicketTitle = (cashSessionId: string) =>
  `Ticket de cierre ${cashSessionId.slice(0, 8)}`;

const buildCashAuditTicketFileName = (cashCountId: string) =>
  `tirilla-cajero-${cashCountId}.pdf`;

const buildCashAuditTicketTitle = (cashCountId: string) =>
  `Tirilla de cierre ${cashCountId.slice(0, 8)}`;

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
  const tenantSlug = authUser?.tenantSlug ?? authUser?.tenantId ?? "default";
  const [tenantFilter, setTenantFilter] = useState("");
  const [selectedSessionBranchId, setSelectedSessionBranchId] = useState("");
  const [selectedSessionUserId, setSelectedSessionUserId] = useState("");
  const [selectedCashSessionId, setSelectedCashSessionId] = useState("");
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [branchFilter, setBranchFilter] = useState("");
  const [registerFilter, setRegisterFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [closeModal, setCloseModal] = useState(false);
  const [auditModal, setAuditModal] = useState(false);
  const [closeForm, setCloseForm] = useState<CloseCashSessionPayload>(closeFormInitial);
  const [auditForm, setAuditForm] =
    useState<CreateCashSessionAuditPayload>(auditFormInitial);
  const [auditSaving, setAuditSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [closeNotice, setCloseNotice] = useState<CloseNoticeState | null>(null);
  const [pdfConfig, setPdfConfig] = useState<PdfConfig | null>(null);
  const [recentMovementsExpanded, setRecentMovementsExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const historyInitialized = useRef(false);

  const { canViewFinance, canViewPaymentMethods, canOperateCashSessions } =
    getFinancePermissions(role);
  const {
    currentSession,
    availableOpenSessions,
    history,
    sessionSummary,
    loadingCurrent,
    loadingHistory,
    loadingSummary,
    saving,
    errorMessage,
    loadCurrentSession,
    loadHistory,
    loadAvailableOpenSessions,
    loadSessionSummary,
    selectCurrentSession,
    closeSession,
  } = useCashSessions();
  const {
    branchOptions,
    registerOptions,
    tenantOptions,
    loadTenants,
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
    void loadTenants();
  }, [
    canViewFinance,
    loadCurrentSession,
    loadTenants,
  ]);

  const selectedTenantId =
    role === "SUPER_ADMIN"
      ? tenantFilter || authUser?.tenantId || undefined
      : authUser?.tenantId || undefined;

  useEffect(() => {
    if (!canViewFinance || !selectedTenantId) {
      return;
    }

    if (!historyInitialized.current) {
      historyInitialized.current = true;
      void loadHistory({
        tenantId: selectedTenantId,
        status: "OPEN",
        limit: 100,
      });
    } else {
      void loadAvailableOpenSessions({ tenantId: selectedTenantId });
    }
    void loadBranches(selectedTenantId);
    void loadCashRegisters({ tenantId: selectedTenantId, activo: true });
  }, [
    canViewFinance,
    loadBranches,
    loadCashRegisters,
    loadHistory,
    loadAvailableOpenSessions,
    selectedTenantId,
  ]);

  useEffect(() => {
    setSelectedSessionBranchId("");
    setSelectedSessionUserId("");
    setSelectedCashSessionId("");
    selectCurrentSession(null);
  }, [selectedTenantId, selectCurrentSession]);

  useEffect(() => {
    if (!currentSession?.id) {
      return;
    }

    void loadSessionSummary(currentSession.id);
  }, [currentSession?.id, loadSessionSummary]);

  const users = useMemo(
    () =>
      Array.from(
        new Map(
          history.map((session) => [
            session.openedByUserId,
            {
              id: session.openedByUserId,
              email: session.openedByUserEmail,
            },
          ])
        ).values()
      ),
    [history]
  );
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const getUserDisplayName = (userId?: string | null, fallbackEmail?: string | null) => {
    if (!userId) return fallbackEmail ?? "—";
    const foundUser = userMap.get(userId);
    return fallbackEmail ?? foundUser?.email ?? "—";
  };

  const isCashierRole = role === "USER";
  const showTenantFilter = role === "SUPER_ADMIN";
  const showBranchFilter = !isCashierRole && branchOptions.length > 1;
  const showRegisterFilter = !isCashierRole || registerOptions.length > 1;

  const selectedSessionBranches = useMemo(() => {
    const branchIds = new Set(availableOpenSessions.map((session) => session.branchId));
    return branchOptions.filter((branch) => branchIds.has(branch.id));
  }, [availableOpenSessions, branchOptions]);
  const selectedSessionBranchIdActive =
    selectedSessionBranchId &&
    selectedSessionBranches.some((branch) => branch.id === selectedSessionBranchId)
      ? selectedSessionBranchId
      : "";
  const selectableOpenSessions = useMemo(
    () =>
      availableOpenSessions.filter(
        (session) =>
          (!selectedSessionBranchIdActive || session.branchId === selectedSessionBranchIdActive) &&
          (!selectedSessionUserId || session.openedByUserId === selectedSessionUserId)
      ),
    [availableOpenSessions, selectedSessionBranchIdActive, selectedSessionUserId]
  );
  const selectableUsers = useMemo(
    () =>
      Array.from(
        new Map(
          availableOpenSessions
            .filter(
              (session) =>
                !selectedSessionBranchIdActive ||
                session.branchId === selectedSessionBranchIdActive
            )
            .map((session) => [session.openedByUserId, session.openedByUserEmail])
        ).entries()
      ),
    [availableOpenSessions, selectedSessionBranchIdActive]
  );
  const showSessionSelector = !isCashierRole && availableOpenSessions.length > 1;
  const showSelectedSessionBranch =
    !isCashierRole && selectedSessionBranches.length > 1;
  const showSelectedSessionUser = !isCashierRole && selectableUsers.length > 1;

  useEffect(() => {
    const nextSession = selectableOpenSessions.find(
      (session) => session.id === selectedCashSessionId
    ) ??
      availableOpenSessions.find((session) => session.id === currentSession?.id) ??
      selectableOpenSessions[0] ??
      null;

    if (nextSession?.id !== selectedCashSessionId) {
      setSelectedCashSessionId(nextSession?.id ?? "");
    }
    if (nextSession?.id !== currentSession?.id) {
      selectCurrentSession(nextSession);
    }
  }, [
    availableOpenSessions,
    currentSession?.id,
    selectableOpenSessions,
    selectedCashSessionId,
    selectCurrentSession,
  ]);

  const handleSelectedSessionBranchChange = (branchId: string) => {
    setSelectedSessionBranchId(branchId);
    setSelectedSessionUserId("");
    setSelectedCashSessionId("");
    selectCurrentSession(null);
  };

  const handleSelectedSessionUserChange = (userId: string) => {
    setSelectedSessionUserId(userId);
    setSelectedCashSessionId("");
    selectCurrentSession(null);
  };

  const handleSelectedSessionChange = (sessionId: string) => {
    const session = selectableOpenSessions.find((item) => item.id === sessionId) ?? null;
    setSelectedCashSessionId(sessionId);
    selectCurrentSession(session);
  };

  const filteredHistory = history;

  const searchHistory = async () => {
    const historicalQuery = statusFilter !== "OPEN";
    if (Boolean(dateFrom) !== Boolean(dateTo)) {
      setToastMessage("Fecha desde y fecha hasta deben enviarse juntas.");
      setToastVariant("warning");
      return;
    }
    if (historicalQuery && (!dateFrom || !dateTo)) {
      setToastMessage("Fecha desde y fecha hasta son obligatorias para histórico.");
      setToastVariant("warning");
      return;
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setToastMessage("Fecha desde no puede ser mayor que fecha hasta.");
      setToastVariant("warning");
      return;
    }
    if (dateFrom && dateTo) {
      const days =
        (new Date(`${dateTo}T00:00:00Z`).getTime() -
          new Date(`${dateFrom}T00:00:00Z`).getTime()) /
        86400000;
      if (days > 30) {
        setToastMessage("El rango maximo es de 31 dias.");
        setToastVariant("warning");
        return;
      }
    }
    setPage(0);
    await loadHistory({
      status: statusFilter === "all" ? undefined : statusFilter as "OPEN" | "CLOSED" | "CANCELLED",
      tenantId: selectedTenantId,
      branchId: branchFilter || undefined,
      cashRegisterId: registerFilter || undefined,
      openedByUserId: !isCashierRole && userFilter ? userFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      limit: 100,
      offset: 0,
    });
  };

  const clearHistoryFilters = async () => {
    setStatusFilter("OPEN");
    setBranchFilter("");
    setRegisterFilter("");
    setUserFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
    await loadHistory({
      tenantId: selectedTenantId,
      status: "OPEN",
      limit: 100,
      offset: 0,
    });
  };

  const historyReportSummary = useMemo(() => {
    let totalOpening = 0;
    let totalClosing = 0;
    let totalDifference = 0;
    let closedCount = 0;
    let openCount = 0;

    for (const session of filteredHistory) {
      totalOpening += Number(session.openingAmount || 0);
      if (session.status === "CLOSED") {
        closedCount++;
        totalClosing += Number(session.closingAmount || 0);
        totalDifference += Number(session.differenceAmount || 0);
      } else if (session.status === "OPEN") {
        openCount++;
      }
    }

    return {
      totalSessions: filteredHistory.length,
      closedCount,
      openCount,
      totalOpening,
      totalClosing,
      totalDifference,
    };
  }, [filteredHistory]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const paginatedHistory = useMemo(() => {
    return filteredHistory.slice(page * pageSize, (page + 1) * pageSize);
  }, [filteredHistory, page, pageSize]);

  const expectedCurrent =
    currentSession && sessionSummary?.sessionId === currentSession.id
      ? sessionSummary.cashControl?.expectedCashAmount ??
        sessionSummary.totals.expectedAmount ??
        currentSession.expectedAmount ??
        0
      : null;
  const currentSummaryReady =
    !currentSession || sessionSummary?.sessionId === currentSession.id;
  const ownClosureDelivered = Boolean(
    role === "USER" &&
      currentSession &&
      sessionSummary?.sessionId === currentSession.id &&
      authUser?.id &&
      sessionSummary.closureProgress.completedUserIds.includes(authUser.id)
  );
  const canActOnCurrentSession =
    canOperateCashSessions && currentSummaryReady && !ownClosureDelivered;

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

  const openIndividualTicketPreview = (cashCountId: string) => {
    setCloseNotice(null);
    setPdfConfig({
      title: buildCashAuditTicketTitle(cashCountId),
      fileName: buildCashAuditTicketFileName(cashCountId),
      getPdf: () => getCashAuditTicket(cashCountId),
    });
  };

  const handleDownloadIndividualTicket = async (cashCountId: string) => {
    try {
      const blob = await getCashAuditTicket(cashCountId);
      downloadBlob(blob, buildCashAuditTicketFileName(cashCountId));
    } catch (error) {
      showTicketActionError(error, "No se pudo descargar la tirilla individual.");
    }
  };

  const handlePrintIndividualTicket = async (cashCountId: string) => {
    try {
      const blob = await getCashAuditTicket(cashCountId);
      const objectUrl = window.URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = objectUrl;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          setToastMessage("No se pudo imprimir automaticamente. Usa Ver tirilla.");
          setToastVariant("warning");
        }
      };

      window.setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        window.URL.revokeObjectURL(objectUrl);
      }, 60000);
    } catch (error) {
      showTicketActionError(error, "No se pudo imprimir la tirilla individual.");
    }
  };

  const handlePrintTicket = async (
    cashSessionId: string,
    options: { automatic?: boolean } = {}
  ) => {
    try {
      const blob = await getCashClosingTicket(cashSessionId);
      const objectUrl = window.URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = objectUrl;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          setToastMessage("No se pudo imprimir automaticamente. Usa Ver ticket.");
          setToastVariant("warning");
        }
      };

      window.setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        window.URL.revokeObjectURL(objectUrl);
      }, 60000);
    } catch (error) {
      showTicketActionError(error, "No se pudo imprimir el ticket de cierre.");
    }
  };

  const handleCloseSession = async () => {
    if (!currentSession || !canActOnCurrentSession) {
      return;
    }

    const summarySnapshot = sessionSummary;
    const expectedSnapshot = expectedCurrent ?? 0;
    const realSnapshot = closeForm.closingAmount;

    try {
      const closed: CashSessionCloseResult = await closeSession(
        currentSession.id,
        closeForm
      );
      const isComplete = closed.closureProgress?.isComplete !== false;
      setCloseModal(false);
      setCloseForm(closeFormInitial);
      await loadCurrentSession();
      await loadHistory({ tenantId: selectedTenantId, status: "OPEN", limit: 50 });
      setCloseNotice({
        variant: "success",
        title: isComplete ? "Caja cerrada" : "Entrega registrada",
        message: isComplete
          ? "Caja cerrada correctamente"
          : `Tu cierre fue registrado. Faltan ${closed.closureProgress?.pendingUserIds.length ?? 0} cajero(s).`,
        session: closed,
        summary: summarySnapshot,
        expectedAmount: expectedSnapshot,
        realAmount: realSnapshot,
        differenceAmount: closed.differenceAmount ?? realSnapshot - expectedSnapshot,
      });
      window.dispatchEvent(new Event("manus:cash-session-changed"));
      if (closed.closureCount?.id) {
        void handlePrintIndividualTicket(closed.closureCount.id);
      } else if (isComplete) {
        void handlePrintTicket(closed.id, { automatic: true });
      }
    } catch (error) {
      setCloseNotice({
        variant: "error",
        title: "No se pudo cerrar la caja",
        message: getApiErrorMessage(error, "No se pudo cerrar la caja."),
      });
    }
  };

  const handleOpenAuditModal = async () => {
    if (!currentSession || !canActOnCurrentSession) {
      return;
    }
    const summary = sessionSummary ?? (await loadSessionSummary(currentSession.id));
    if (!summary) {
      setToastMessage("No se pudo cargar el resumen para arqueo.");
      setToastVariant("error");
      return;
    }
    setAuditForm({
      countedCashAmount:
        summary.cashControl?.countedCashAmount ??
        summary.lastCount?.countedCashAmount ??
        expectedCurrent ??
        0,
      notes: "",
    });
    setAuditModal(true);
  };

  const handleSaveAudit = async () => {
    if (!currentSession) {
      return;
    }

    try {
      setAuditSaving(true);
      await createCashSessionAudit(currentSession.id, auditForm);
      await loadSessionSummary(currentSession.id);
      setAuditModal(false);
      setAuditForm(auditFormInitial);
      setToastMessage("Arqueo guardado. La caja sigue abierta.");
      setToastVariant("success");
    } catch (error) {
      setToastMessage(getApiErrorMessage(error, "No se pudo guardar el arqueo."));
      setToastVariant("error");
    } finally {
      setAuditSaving(false);
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
    <div className="w-full max-w-full min-w-0 space-y-4 overflow-x-hidden">
      <FinancePageHeader
        compact
        eyebrow="Finance / Caja"
        title="Sesiones de caja"
        description="Abre, monitorea y cierra cajas con una lectura inmediata del estado actual y del historial reciente."
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                void loadCurrentSession();
                void loadHistory({ tenantId: selectedTenantId, status: "OPEN", limit: 50 });
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

      <FinanceSectionNav
        tenantSlug={tenantSlug}
        canViewPaymentMethods={canViewPaymentMethods}
        compact
      />

      <section className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(155px,1fr))] gap-2">
        <FinanceMetricCard
          compact
          label="Caja actual"
          value={ownClosureDelivered ? "Cierre entregado" : currentSession ? currentSession.cashRegisterNombre ?? "Abierta" : "Sin sesion"}
          accent={ownClosureDelivered ? "slate" : currentSession ? "amber" : "slate"}
        />
        <FinanceMetricCard
          compact
          label="Monto de apertura"
          value={
            !ownClosureDelivered && currentSession
              ? formatCurrency(
                  sessionSummary?.cashControl?.openingCash ??
                    sessionSummary?.totals.openingAmount ??
                    currentSession.openingAmount
                )
              : formatCurrency(0)
          }
          accent="blue"
        />
        <FinanceMetricCard compact label="Sesiones abiertas" value={openCount} accent="emerald" />
        <FinanceMetricCard compact label="Sesiones cerradas" value={closedCount} accent="slate" />
      </section>

      <section className="grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1.12fr)_minmax(380px,0.88fr)]">
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:p-3 dark:bg-slate-800 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Estado actual
              </p>
              <h2 className="mt-0.5 text-base font-semibold leading-tight text-slate-900 dark:text-white">
                {isCashierRole ? "Tu caja en este momento" : "Sesion de caja seleccionada"}
              </h2>
            </div>
            {currentSession && !ownClosureDelivered ? (
              <FinanceStatusBadge value={currentSession.status} kind="session" />
            ) : null}
          </div>
          {!isCashierRole && availableOpenSessions.length > 0 ? (
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {role === "SUPER_ADMIN" ? (
                <Select
                  label="Tenant"
                  value={tenantFilter}
                  onChange={(event) => {
                    setTenantFilter(event.target.value);
                    setSelectedSessionBranchId("");
                    setSelectedSessionUserId("");
                    setSelectedCashSessionId("");
                    selectCurrentSession(null);
                  }}
                >
                  <option value="">Tenant actual</option>
                  {tenantOptions.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </Select>
              ) : null}
              {showSelectedSessionBranch ? (
                <Select
                  label="Sucursal"
                  value={selectedSessionBranchIdActive}
                  onChange={(event) => handleSelectedSessionBranchChange(event.target.value)}
                >
                  <option value="">Todas las sucursales</option>
                  {selectedSessionBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              ) : null}
              {showSelectedSessionUser ? (
                <Select
                  label="Cajero / Usuario"
                  value={selectedSessionUserId}
                  onChange={(event) => handleSelectedSessionUserChange(event.target.value)}
                >
                  <option value="">Todos los usuarios</option>
                  {selectableUsers.map(([id, email]) => (
                    <option key={id} value={id}>
                      {email ?? id}
                    </option>
                  ))}
                </Select>
              ) : null}
              {showSessionSelector ? (
                <Select
                  label="Sesion abierta"
                  value={selectedCashSessionId}
                  onChange={(event) => handleSelectedSessionChange(event.target.value)}
                >
                  {selectableOpenSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {(session.cashRegisterNombre ?? "Caja") +
                        " · " +
                        (session.openedByUserEmail ?? session.openedByUserId) +
                        " · " +
                        formatDateTime(session.openedAt)}
                    </option>
                  ))}
                </Select>
              ) : null}
            </div>
          ) : null}
          {loadingCurrent ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Consultando sesion actual...</p>
          ) : !currentSession || ownClosureDelivered ? (
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-3 text-sm text-slate-500 dark:text-slate-400">
              {ownClosureDelivered
                ? "Ya entregaste tu cierre. No hay acciones ni datos operativos pendientes para ti."
                : "No tienes una sesion abierta en este momento."}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                <div className="min-w-0 rounded-xl bg-slate-50 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Caja</p>
                  <p className="mt-1 min-w-0 truncate text-sm font-semibold leading-tight text-slate-900 dark:text-white">
                    {currentSession.cashRegisterNombre}
                  </p>
                  <p className="min-w-0 truncate text-xs leading-snug text-slate-500 dark:text-slate-400">
                    {currentSession.cashRegisterCodigo}
                  </p>
                </div>
                <div className="min-w-0 rounded-xl bg-slate-50 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Abierta</p>
                  <p className="mt-1 min-w-0 truncate text-sm font-semibold leading-tight text-slate-900 dark:text-white">
                    {formatDateTime(currentSession.openedAt)}
                  </p>
                  <p className="min-w-0 truncate text-xs leading-snug text-slate-500 dark:text-slate-400">
                    {currentSession.openedByUserEmail ?? "Usuario actual"}
                  </p>
                </div>
              </div>

              <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(155px,1fr))] gap-2">
                <FinanceMetricCard
                  compact
                  label="Apertura"
                  value={formatCurrency(
                    sessionSummary?.cashControl?.openingCash ??
                      sessionSummary?.totals.openingAmount ??
                      currentSession.openingAmount
                  )}
                  accent="blue"
                />
                <FinanceMetricCard
                  compact
                  label="Esperado"
                  value={
                    expectedCurrent === null || (loadingSummary && !sessionSummary)
                      ? "Calculando..."
                      : formatCurrency(expectedCurrent)
                  }
                  accent="amber"
                />
                <FinanceMetricCard
                  compact
                  label="Accion"
                  value={
                    canActOnCurrentSession ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => void handleOpenAuditModal()}
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          Arqueo
                        </Button>
                        <Button variant="warning" onClick={() => setCloseModal(true)}>
                          <Receipt className="h-4 w-4" />
                          Entregar mi cierre
                        </Button>
                      </div>
                    ) : (
                      "Solo lectura"
                    )
                  }
                  accent="slate"
                />
              </div>

              {sessionSummary ? (
                <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(155px,1fr))] gap-2">
                  <FinanceMetricCard
                    compact
                    label="Ingresos"
                    value={formatCurrency(
                      sessionSummary.sourceBreakdown?.totalIn ??
                        sessionSummary.totals.paymentsIn +
                          sessionSummary.totals.adjustmentsIn +
                          (sessionSummary.totals.deliveryFees ?? 0)
                    )}
                    accent="emerald"
                  />
                  <FinanceMetricCard
                    compact
                    label="Egresos"
                    value={formatCurrency(
                      sessionSummary.sourceBreakdown?.totalOut ??
                        sessionSummary.totals.paymentsOut +
                          sessionSummary.totals.expenses +
                          sessionSummary.totals.withdrawals +
                          sessionSummary.totals.adjustmentsOut
                    )}
                    accent="rose"
                  />
                  <FinanceMetricCard
                    compact
                    label="Ventas cobradas"
                    value={formatCurrency(
                      sessionSummary.sourceBreakdown?.posSales ??
                        sessionSummary.totals.salesPayments
                    )}
                    accent="blue"
                  />
                  <FinanceMetricCard
                    compact
                    label="Domicilios"
                    value={formatCurrency(
                      sessionSummary.sourceBreakdown?.deliveries ??
                        sessionSummary.totals.deliveryFees ??
                        0
                    )}
                    accent="emerald"
                  />
                  <FinanceMetricCard
                    compact
                    label="Ultimo arqueo"
                    value={
                      sessionSummary.cashControl?.countedCashAmount != null
                        ? formatCurrency(sessionSummary.cashControl.countedCashAmount)
                        : sessionSummary.lastCount
                          ? formatCurrency(sessionSummary.lastCount.countedCashAmount)
                          : "Sin arqueo"
                    }
                    accent="slate"
                  />
                </div>
              ) : null}

              {sessionSummary?.closureProgress ? (
                <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Entregas por cajero
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                        {sessionSummary.closureProgress.completedCount} de {sessionSummary.closureProgress.requiredCount} entregas registradas
                      </p>
                    </div>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      {sessionSummary.closureProgress.isComplete ? "Caja completa" : "Pendiente"}
                    </span>
                  </div>
                  <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
                        <tr>
                          <th className="px-2 py-1.5">Cajero</th>
                          <th className="px-2 py-1.5">Esperado</th>
                          <th className="px-2 py-1.5">Contado</th>
                          <th className="px-2 py-1.5">Diferencia</th>
                          <th className="px-2 py-1.5">Estado</th>
                          <th className="px-2 py-1.5">Tirilla</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionSummary.closureRecords.map((record) => (
                          <tr key={record.id} className="border-b border-slate-100 dark:border-slate-700">
                            <td className="px-2 py-1.5 font-medium">{record.countedByUserEmail ?? record.countedByUserId}</td>
                            <td className="px-2 py-1.5">{formatCurrency(record.expectedAmount)}</td>
                            <td className="px-2 py-1.5">{formatCurrency(record.countedCashAmount)}</td>
                            <td className="px-2 py-1.5">{formatCurrency(record.differenceAmount)}</td>
                            <td className="px-2 py-1.5 text-emerald-700">Entregado</td>
                            <td className="px-2 py-1.5">
                              <Button variant="ghost" size="sm" onClick={() => void handleDownloadIndividualTicket(record.id)}>
                                <Download className="h-4 w-4" /> PDF
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {sessionSummary.closureProgress.pendingUserIds.map((userId) => (
                          <tr key={userId} className="border-b border-slate-100 text-slate-500 dark:border-slate-700">
                            <td className="px-2 py-1.5">Cajero asignado</td>
                            <td className="px-2 py-1.5">-</td>
                            <td className="px-2 py-1.5">-</td>
                            <td className="px-2 py-1.5">-</td>
                            <td className="px-2 py-1.5">Pendiente</td>
                            <td className="px-2 py-1.5">-</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {sessionSummary ? (
                <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 dark:bg-slate-800 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Gestion del turno
                      </p>
                      <h3 className="mt-0.5 text-base font-semibold leading-tight text-slate-900 dark:text-white">
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
                    {canOperateCashSessions ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleOpenAuditModal()}
                      >
                        <ClipboardCheck className="h-4 w-4" />
                        Arqueo
                      </Button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(155px,1fr))] gap-2">
                    <FinanceMetricCard
                      compact
                      label="Ventas POS"
                      value={formatCurrency(
                        sessionSummary.sourceBreakdown?.posSales ??
                          sessionSummary.totals.salesPayments
                      )}
                      accent="blue"
                    />
                    <FinanceMetricCard
                      compact
                      label="Pedidos"
                      value={
                        (sessionSummary.sourceBreakdown?.orders ?? recentOrderAmount) > 0
                          ? formatCurrency(
                              sessionSummary.sourceBreakdown?.orders ?? recentOrderAmount
                            )
                          : "Sin pedidos"
                      }
                      accent="emerald"
                    />
                    <FinanceMetricCard
                      compact
                      label="Compras"
                      value={formatCurrency(
                        sessionSummary.sourceBreakdown?.purchases ??
                          sessionSummary.totals.purchasePayments
                      )}
                      accent="rose"
                    />
                    <FinanceMetricCard
                      compact
                      label="Domicilios"
                      value={`${sessionSummary.deliverySummary?.deliveredCount ?? 0} / ${formatCurrency(
                        sessionSummary.sourceBreakdown?.deliveries ??
                          sessionSummary.deliverySummary?.deliveredFeeTotal ??
                          0
                      )}`}
                      accent="emerald"
                    />
                    <FinanceMetricCard
                      compact
                      label="Movimientos"
                      value={sessionSummary.totals.movementCount}
                      accent="amber"
                    />
                    <FinanceMetricCard
                      compact
                      label="Arqueo"
                      value={
                        sessionSummary.cashControl?.countedCashAmount != null
                          ? formatCurrency(sessionSummary.cashControl.countedCashAmount)
                          : sessionSummary.lastCount
                            ? formatCurrency(sessionSummary.lastCount.countedCashAmount)
                            : "Sin arqueo"
                      }
                      accent="slate"
                    />
                    <FinanceMetricCard
                      compact
                      label="Tickets"
                      value="Ticket al cerrar"
                      accent="slate"
                    />
                  </div>

                  <div className="mt-3">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-left text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
                      aria-expanded={recentMovementsExpanded}
                      aria-controls="cash-session-recent-movements"
                      onClick={() => setRecentMovementsExpanded((expanded) => !expanded)}
                    >
                      <span>
                        Últimos movimientos ({sessionSummary.recentMovements.length})
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform ${
                          recentMovementsExpanded ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    {recentMovementsExpanded ? (
                      <div
                        id="cash-session-recent-movements"
                        className="mt-2 space-y-1.5"
                      >
                        {sessionSummary.recentMovements.length > 0 ? (
                          sessionSummary.recentMovements.slice(0, 4).map((movement) => (
                            <div
                              key={movement.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5 text-xs"
                            >
                              <span className="font-medium text-slate-700 dark:text-slate-200">
                                {movement.description ??
                                  movement.referenceType ??
                                  movement.movementType}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {movement.direction === "OUT" ? "-" : ""}
                                {formatCurrency(movement.amount)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                            Sin movimientos registrados en la caja abierta.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </article>

        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 dark:bg-slate-800 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              aria-expanded={historyExpanded}
              aria-controls="cash-session-history-panel"
              onClick={() => setHistoryExpanded((expanded) => !expanded)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
            >
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Historial de caja
                </span>
                <span className="block text-lg font-bold text-slate-900 dark:text-white">
                  Cierres y sesiones registradas
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${
                  historyExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
            <div className="flex flex-wrap items-center gap-2">
              {(tenantFilter || branchFilter || registerFilter || statusFilter !== "OPEN" || userFilter || dateFrom || dateTo) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void clearHistoryFilters()}
                  className="h-8 gap-1.5 px-2.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpiar filtros
                </Button>
              ) : null}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {filteredHistory.length} {filteredHistory.length === 1 ? "sesión" : "sesiones"}
              </span>
            </div>
          </div>

          {historyExpanded ? (
            <div id="cash-session-history-panel">
          <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
            {showTenantFilter ? (
              <Select
                label="Tenant"
                value={tenantFilter}
                onChange={(event) => {
                  setTenantFilter(event.target.value);
                  setBranchFilter("");
                  setRegisterFilter("");
                  setUserFilter("");
                  setPage(0);
                }}
              >
                <option value="">Tenant actual</option>
                {tenantOptions.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </Select>
            ) : null}
            {showBranchFilter ? (
              <Select
                label="Sucursal"
                value={branchFilter}
                onChange={(event) => {
                  setBranchFilter(event.target.value);
                  setRegisterFilter("");
                  setUserFilter("");
                  setPage(0);
                  void loadCashRegisters({
                    tenantId: selectedTenantId,
                    branchId: event.target.value || undefined,
                    activo: true,
                  });
                }}
              >
                <option value="">Todas las sucursales</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            ) : null}
            {showRegisterFilter ? (
              <Select
                label="Caja"
                value={registerFilter}
                onChange={(event) => {
                  setRegisterFilter(event.target.value);
                  setUserFilter("");
                  setPage(0);
                }}
              >
                <option value="">Todas las cajas</option>
                {registerOptions.map((register) => (
                  <option key={register.id} value={register.id}>
                    {register.nombre}
                  </option>
                ))}
              </Select>
            ) : null}

            <Select
              label="Estado"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(0);
              }}
            >
              <option value="all">Todos los estados</option>
              <option value="OPEN">Abiertas</option>
              <option value="CLOSED">Cerradas</option>
              <option value="CANCELLED">Canceladas</option>
            </Select>

            {!isCashierRole ? (
              <Select
                label="Cajero / Usuario"
                value={userFilter}
                onChange={(event) => {
                  setUserFilter(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">Todos los usuarios</option>
                {users.map((u) => {
                  const name = getUserDisplayName(u.id, u.email);
                  return (
                    <option key={u.id} value={u.id}>
                      {name}
                    </option>
                  );
                })}
              </Select>
            ) : null}

            <Input
              label="Desde"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(0);
              }}
            />

            <Input
              label="Hasta"
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(0);
              }}
            />

            <Select
              label="Filas por pág."
              value={String(pageSize)}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
            >
              <option value="10">10 filas</option>
              <option value="25">25 filas</option>
              <option value="50">50 filas</option>
            </Select>
            <div className="flex items-end gap-2">
              <Button size="sm" onClick={() => void searchHistory()} isLoading={loadingHistory}>
                <Filter className="h-3.5 w-3.5" />
                Buscar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void clearHistoryFilters()}>
                <X className="h-3.5 w-3.5" />
                Limpiar
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-4 dark:border-slate-700/60 dark:bg-slate-900/40">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Sesiones filtradas
              </p>
              <p className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                {historyReportSummary.totalSessions}{" "}
                <span className="text-xs font-normal text-slate-500">
                  ({historyReportSummary.closedCount} cerr. / {historyReportSummary.openCount} ab.)
                </span>
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Total Apertura
              </p>
              <p className="mt-0.5 text-base font-bold text-slate-900 tabular-nums dark:text-white">
                {formatCurrency(historyReportSummary.totalOpening)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Total Cierre
              </p>
              <p className="mt-0.5 text-base font-bold text-slate-900 tabular-nums dark:text-white">
                {formatCurrency(historyReportSummary.totalClosing)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Diferencia Total
              </p>
              <p
                className={`mt-0.5 text-base font-bold tabular-nums ${
                  historyReportSummary.totalDifference === 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : historyReportSummary.totalDifference < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {historyReportSummary.totalDifference > 0 ? "+" : ""}
                {formatCurrency(historyReportSummary.totalDifference)}
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900/60">
                <tr>
                  <th className="w-14 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Acciones
                  </th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Caja
                  </th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Cajero / Gestión
                  </th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Apertura
                  </th>
                  <th className="px-3.5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Cierre
                  </th>
                  <th className="px-3.5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    M. Apertura
                  </th>
                  <th className="px-3.5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    M. Cierre
                  </th>
                  <th className="px-3.5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Diferencia
                  </th>
                  <th className="px-3.5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                      Cargando historial...
                    </td>
                  </tr>
                ) : paginatedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                      No hay sesiones registradas que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  paginatedHistory.map((session) => {
                    const openedUserName = getUserDisplayName(
                      session.openedByUserId,
                      session.openedByUserEmail
                    );
                    const closedUserName = session.closedByUserId
                      ? getUserDisplayName(session.closedByUserId, session.closedByUserEmail)
                      : null;

                    return (
                      <tr
                        key={session.id}
                        className="transition hover:bg-slate-50/80 dark:hover:bg-slate-900/30"
                      >
                        <td className="whitespace-nowrap px-3 py-3 text-center">
                          {session.status === "CLOSED" ? (
                            <div className="flex justify-center">
                              <RowActionsMenu
                                label="Acciones de sesión"
                                items={[
                                  {
                                    label: "Ver ticket",
                                    icon: <Eye className="h-4 w-4" />,
                                    onSelect: () => openTicketPreview(session.id),
                                  },
                                  {
                                    label: "Descargar PDF",
                                    icon: <Download className="h-4 w-4" />,
                                    onSelect: () => void handleDownloadTicket(session.id),
                                  },
                                  {
                                    label: "Imprimir ticket",
                                    icon: <Printer className="h-4 w-4" />,
                                    onSelect: () => void handlePrintTicket(session.id),
                                  },
                                ]}
                              />
                            </div>
                          ) : (
                            <span className="text-[11px] italic text-slate-400">En curso</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3">
                          <div className="min-w-0">
                            <p className="font-semibold leading-tight text-slate-900 dark:text-white">
                              {session.cashRegisterNombre ?? "Caja"}
                            </p>
                            {session.cashRegisterCodigo ? (
                              <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                                {session.cashRegisterCodigo}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3">
                          <div className="min-w-0 max-w-[200px]">
                            <p
                              className="truncate font-medium leading-tight text-slate-900 dark:text-slate-100"
                              title={openedUserName}
                            >
                              {openedUserName}
                            </p>
                            {closedUserName && session.closedByUserId !== session.openedByUserId ? (
                              <p
                                className="truncate text-[11px] leading-tight text-slate-400"
                                title={`Cierre por: ${closedUserName}`}
                              >
                                Cierre: {closedUserName}
                              </p>
                            ) : (
                              <p className="truncate text-[11px] leading-tight text-slate-400">
                                {session.openedByUserEmail}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3 text-slate-700 dark:text-slate-300">
                          <p className="font-medium leading-tight">
                            {formatDateTime(session.openedAt)}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3 text-slate-700 dark:text-slate-300">
                          {session.closedAt ? (
                            <p className="font-medium leading-tight">
                              {formatDateTime(session.closedAt)}
                            </p>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3 text-right font-medium tabular-nums text-slate-900 dark:text-white">
                          {formatCurrency(session.openingAmount)}
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3 text-right font-medium tabular-nums text-slate-900 dark:text-white">
                          {session.closingAmount !== null && session.closingAmount !== undefined ? (
                            formatCurrency(session.closingAmount)
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3 text-right font-medium tabular-nums">
                          {session.differenceAmount !== null &&
                          session.differenceAmount !== undefined &&
                          session.status === "CLOSED" ? (
                            <span
                              className={
                                session.differenceAmount === 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : session.differenceAmount < 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-amber-600 dark:text-amber-400"
                              }
                            >
                              {session.differenceAmount > 0 ? "+" : ""}
                              {formatCurrency(session.differenceAmount)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-3 text-center">
                          <FinanceStatusBadge value={session.status} kind="session" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredHistory.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <span>
                Mostrando {page * pageSize + 1} -{" "}
                {Math.min((page + 1) * pageSize, filteredHistory.length)} de{" "}
                {filteredHistory.length} sesiones
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                  disabled={page === 0 || loadingHistory}
                >
                  Anterior
                </Button>
                <span className="px-1 text-xs font-semibold text-slate-500">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((prev) => Math.min(prev + 1, Math.max(totalPages - 1, 0)))
                  }
                  disabled={page >= totalPages - 1 || loadingHistory}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          ) : null}
            </div>
          ) : null}
        </article>
      </section>

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

      {closeModal && currentSession && canActOnCurrentSession ? (
        <Modal
          title="Entregar cierre de mi turno"
          className="max-h-[calc(100dvh-1rem)] overflow-hidden sm:max-h-[calc(100dvh-3rem)]"
          size="xl"
        >
          <CloseCashSessionForm
            value={closeForm}
            expectedAmount={expectedCurrent ?? 0}
            summary={sessionSummary}
            onChange={setCloseForm}
            onCancel={() => setCloseModal(false)}
            onSubmit={() => void handleCloseSession()}
            isSaving={saving}
          />
        </Modal>
      ) : null}

      {auditModal && currentSession && sessionSummary && canActOnCurrentSession ? (
        <Modal
          title="Arqueo de caja"
          description="Revision preliminar. No cierra la caja."
          className="max-w-5xl"
          size="xl"
          onClose={() => setAuditModal(false)}
        >
          <CashSessionAuditForm
            summary={sessionSummary}
            value={auditForm}
            onChange={setAuditForm}
            onCancel={() => setAuditModal(false)}
            onSubmit={() => void handleSaveAudit()}
            isSaving={auditSaving}
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
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {row.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {closeNotice.session.closureCount?.id ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openIndividualTicketPreview(closeNotice.session!.closureCount!.id)
                    }
                  >
                    <Eye className="h-4 w-4" />
                    Ver tirilla
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openTicketPreview(closeNotice.session!.id)}
                  >
                    <Eye className="h-4 w-4" />
                    Ver ticket
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    closeNotice.session!.closureCount?.id
                      ? void handleDownloadIndividualTicket(closeNotice.session!.closureCount!.id)
                      : void handleDownloadTicket(closeNotice.session!.id)
                  }
                >
                  <Download className="h-4 w-4" />
                  Descargar PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    closeNotice.session!.closureCount?.id
                      ? void handlePrintIndividualTicket(closeNotice.session!.closureCount!.id)
                      : void handlePrintTicket(closeNotice.session!.id)
                  }
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
