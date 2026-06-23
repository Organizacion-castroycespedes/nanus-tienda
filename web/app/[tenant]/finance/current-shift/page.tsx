"use client";

import {
  Download,
  Eye,
  Printer,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../../components/design-system/Button";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { FinanceAccessNotice } from "../../../../modules/finance/components/FinanceAccessNotice";
import { FinanceMetricCard } from "../../../../modules/finance/components/FinanceMetricCard";
import { FinancePageHeader } from "../../../../modules/finance/components/FinancePageHeader";
import { FinanceSectionNav } from "../../../../modules/finance/components/FinanceSectionNav";
import { FinanceStatusBadge } from "../../../../modules/finance/components/FinanceStatusBadge";
import { getFinancePermissions } from "../../../../modules/finance/permissions";
import { formatCurrency, formatDateTime } from "../../../../modules/finance/utils";
import { PdfPreviewModal } from "../../../../modules/reporteria/components/PdfPreviewModal";
import {
  buildCurrentShiftSessionOptionLabel,
  filterCurrentShiftSessions,
  getCurrentShiftSessionCashRegisterLabel,
} from "../../../../modules/reporteria/current-shift-session-options";
import {
  getCashAuditTicket,
  getCashClosingTicket,
  getCurrentShiftReport,
  getOrderSaleTicket,
  getPosSaleTicket,
  getPurchaseTicket,
} from "../../../../modules/reporteria/services/reporting.service";
import type {
  CurrentShiftCashCountRow,
  CurrentShiftCashSession,
  CurrentShiftMovementRow,
  CurrentShiftOrderRow,
  CurrentShiftPurchaseRow,
  CurrentShiftResponse,
  CurrentShiftSaleRow,
  CurrentShiftTicketRow,
  CurrentShiftTicketType,
} from "../../../../modules/reporteria/types";
import {
  downloadBlob,
  getApiErrorMessage,
} from "../../../../modules/reporteria/utils";
import { useAppSelector } from "../../../../store/hooks";

type ShiftTab = "sales" | "orders" | "purchases" | "movements" | "cashCount" | "tickets";

type PdfConfig = {
  title: string;
  fileName: string;
  getPdf: () => Promise<Blob>;
};

type TicketActionsProps = {
  type: CurrentShiftTicketType;
  entityId: string;
  disabled?: boolean;
};

type TicketActionsComponent = ComponentType<TicketActionsProps>;

const tabs: Array<{ key: ShiftTab; label: string }> = [
  { key: "sales", label: "Ventas" },
  { key: "orders", label: "Pedidos" },
  { key: "purchases", label: "Compras" },
  { key: "movements", label: "Movimientos" },
  { key: "cashCount", label: "Arqueo" },
  { key: "tickets", label: "Tickets" },
];

const ticketLabelByType: Record<CurrentShiftTicketType, string> = {
  POS_SALE: "Venta POS",
  ORDER: "Pedido",
  PURCHASE: "Compra",
  CASH_COUNT: "Arqueo",
  CASH_CLOSING: "Cierre de caja",
};

const getTicketFileName = (type: CurrentShiftTicketType, entityId: string) =>
  `ticket-${type.toLowerCase().replace(/_/g, "-")}-${entityId}.pdf`;

const buildSessionSelectLabel = (session: CurrentShiftCashSession) =>
  buildCurrentShiftSessionOptionLabel(session, (value) =>
    formatDateTime(value ?? null)
  );

const getTicketPdf = (type: CurrentShiftTicketType, entityId: string) => {
  switch (type) {
    case "POS_SALE":
      return () => getPosSaleTicket(entityId);
    case "ORDER":
      return () => getOrderSaleTicket(entityId);
    case "PURCHASE":
      return () => getPurchaseTicket(entityId);
    case "CASH_COUNT":
      return () => getCashAuditTicket(entityId);
    case "CASH_CLOSING":
      return () => getCashClosingTicket(entityId);
    default:
      return null;
  }
};

const EmptyTab = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
    {message}
  </div>
);

const CurrentShiftPage = () => {
  const router = useRouter();
  const authUser = useAppSelector((state) => state.auth.user);
  const role = authUser?.role ?? "";
  const tenantSlug = authUser?.tenantId ?? "default";
  const { canViewFinance } = getFinancePermissions(role);
  const [activeTab, setActiveTab] = useState<ShiftTab>("sales");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [selectedCashSessionId, setSelectedCashSessionId] = useState<string | null>(
    null
  );
  const [shift, setShift] = useState<CurrentShiftResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [pdfConfig, setPdfConfig] = useState<PdfConfig | null>(null);

  useAutoClearState(toastMessage, setToastMessage);

  const loadShift = useCallback(async () => {
    if (!canViewFinance || !authUser?.tenantId) {
      return;
    }
    setLoading(true);
    try {
      const result = await getCurrentShiftReport({
        tenantId: authUser.tenantId,
        cashSessionId: selectedCashSessionId ?? undefined,
        pageSize: 50,
        search: appliedSearch || undefined,
      });
      setShift(result);
      const resultAvailableCashSessions = result.availableCashSessions ?? [];
      if (
        selectedCashSessionId &&
        !resultAvailableCashSessions.some(
          (session) => session.id === selectedCashSessionId
        )
      ) {
        setSelectedCashSessionId(resultAvailableCashSessions[0]?.id ?? null);
      }
    } catch (error) {
      setToastMessage(
        getApiErrorMessage(error, "No se pudo consultar la gestion del turno.")
      );
      setToastVariant("error");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, authUser?.tenantId, canViewFinance, selectedCashSessionId]);

  useEffect(() => {
    setSelectedCashSessionId(null);
    setSessionFilter("");
  }, [authUser?.tenantId]);

  useEffect(() => {
    void loadShift();
    const onCashSessionChanged = () => void loadShift();
    window.addEventListener("manus:cash-session-changed", onCashSessionChanged);
    return () => {
      window.removeEventListener("manus:cash-session-changed", onCashSessionChanged);
    };
  }, [loadShift]);

  const tabCounters = useMemo(() => {
    if (!shift?.tabs) {
      return {
        sales: 0,
        orders: 0,
        purchases: 0,
        movements: 0,
        cashCount: 0,
        tickets: 0,
      };
    }
    return {
      sales: shift.tabs.sales.total,
      orders: shift.tabs.orders.total,
      purchases: shift.tabs.purchases.total,
      movements: shift.tabs.movements.total,
      cashCount: shift.tabs.cashCount.total,
      tickets: shift.tabs.tickets.total,
    };
  }, [shift]);

  const showTicketError = (error: unknown, fallbackMessage: string) => {
    setToastMessage(getApiErrorMessage(error, fallbackMessage));
    setToastVariant("error");
  };

  const openTicketPreview = (type: CurrentShiftTicketType, entityId: string) => {
    const getPdf = getTicketPdf(type, entityId);
    if (!getPdf) {
      setToastMessage("Este ticket no tiene endpoint disponible.");
      setToastVariant("warning");
      return;
    }
    setPdfConfig({
      title: `${ticketLabelByType[type]} ${entityId.slice(0, 8)}`,
      fileName: getTicketFileName(type, entityId),
      getPdf,
    });
  };

  const downloadTicket = async (type: CurrentShiftTicketType, entityId: string) => {
    const getPdf = getTicketPdf(type, entityId);
    if (!getPdf) {
      setToastMessage("Este ticket no tiene endpoint disponible.");
      setToastVariant("warning");
      return;
    }
    try {
      const blob = await getPdf();
      downloadBlob(blob, getTicketFileName(type, entityId));
    } catch (error) {
      showTicketError(error, "No se pudo descargar el ticket.");
    }
  };

  const printTicket = async (type: CurrentShiftTicketType, entityId: string) => {
    const getPdf = getTicketPdf(type, entityId);
    if (!getPdf) {
      setToastMessage("Este ticket no tiene endpoint disponible.");
      setToastVariant("warning");
      return;
    }
    try {
      const blob = await getPdf();
      const objectUrl = window.URL.createObjectURL(blob);
      const printWindow = window.open(objectUrl, "_blank");
      if (!printWindow) {
        window.URL.revokeObjectURL(objectUrl);
        setToastMessage("El navegador bloqueo la impresion. Usa Ver ticket.");
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
      showTicketError(error, "No se pudo imprimir el ticket.");
    }
  };

  const TicketActions = ({
    type,
    entityId,
    disabled = false,
  }: {
    type: CurrentShiftTicketType;
    entityId: string;
    disabled?: boolean;
  }) => (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => openTicketPreview(type, entityId)}
      >
        <Eye className="h-4 w-4" />
        Ver
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => void downloadTicket(type, entityId)}
      >
        <Download className="h-4 w-4" />
        PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => void printTicket(type, entityId)}
      >
        <Printer className="h-4 w-4" />
        Imprimir
      </Button>
    </div>
  );

  const availableCashSessions = useMemo(
    () => shift?.availableCashSessions ?? [],
    [shift?.availableCashSessions]
  );
  const currentCashSessionId = selectedCashSessionId ?? shift?.cashSession?.id ?? "";
  const filteredCashSessions = useMemo(
    () => filterCurrentShiftSessions(availableCashSessions, sessionFilter),
    [availableCashSessions, sessionFilter]
  );
  const selectorCashSessions = useMemo(() => {
    if (
      !currentCashSessionId ||
      filteredCashSessions.some((session) => session.id === currentCashSessionId)
    ) {
      return filteredCashSessions;
    }

    const currentSession = availableCashSessions.find(
      (session) => session.id === currentCashSessionId
    );
    return currentSession
      ? [currentSession, ...filteredCashSessions]
      : filteredCashSessions;
  }, [availableCashSessions, currentCashSessionId, filteredCashSessions]);

  const handleCashSessionSelection = (cashSessionId: string) => {
    setSelectedCashSessionId(cashSessionId || null);
  };

  if (!canViewFinance) {
    return (
      <FinanceAccessNotice description="No tienes acceso a Gestion del turno." />
    );
  }

  const cashSession = shift?.cashSession;
  const summary = shift?.summary;

  return (
    <div className="space-y-6">
      <FinancePageHeader
        eyebrow="Finance / Turno"
        title="Gestion del turno"
        description="Consulta operativa de la caja abierta actual, sin mezclar historico ni cajas ajenas."
        actions={
          <>
            <Button variant="ghost" onClick={() => void loadShift()} isLoading={loading}>
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/${tenantSlug}/finance/cash-sessions`)}
            >
              Sesiones
            </Button>
          </>
        }
      />

      <FinanceSectionNav tenantSlug={tenantSlug} />

      {!shift?.hasOpenCashSession ? (
        <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-900">
            {shift?.message ?? "No hay cajas abiertas para el alcance seleccionado."}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Abre caja desde seleccion de contexto o ajusta el alcance operativo.
          </p>
          <Button
            className="mt-5"
            onClick={() => router.push(`/${tenantSlug}/pos/select-context`)}
          >
            Ir a seleccion de contexto
          </Button>
        </section>
      ) : (
        <>
          {availableCashSessions.length > 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Turno actual
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">
                    {availableCashSessions.length > 1
                      ? "Seleccionar caja abierta"
                      : "Caja abierta actual"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {availableCashSessions.length > 1
                      ? `${availableCashSessions.length} cajas abiertas disponibles para este alcance.`
                      : "Una caja abierta disponible para este alcance."}
                  </p>
                </div>

                {availableCashSessions.length > 1 ? (
                  <div className="grid w-full gap-2 lg:max-w-3xl lg:grid-cols-[minmax(12rem,0.8fr)_minmax(18rem,1.6fr)]">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Buscar
                      </span>
                      <input
                        className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                        value={sessionFilter}
                        onChange={(event) => setSessionFilter(event.target.value)}
                        placeholder="Usuario, caja o codigo"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Sesion abierta
                      </span>
                      <select
                        className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                        value={
                          selectorCashSessions.some(
                            (session) => session.id === currentCashSessionId
                          )
                            ? currentCashSessionId
                            : ""
                        }
                        onChange={(event) =>
                          handleCashSessionSelection(event.target.value)
                        }
                        disabled={selectorCashSessions.length === 0}
                      >
                        {selectorCashSessions.length === 0 ? (
                          <option value="">Sin coincidencias</option>
                        ) : null}
                        {selectorCashSessions.map((session) => (
                          <option key={session.id} value={session.id}>
                            {buildSessionSelectLabel(session)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Sucursal
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {cashSession?.branchName ?? cashSession?.branchId ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Terminal
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {cashSession?.terminalName ?? "Sin terminal"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Caja
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {cashSession
                      ? getCurrentShiftSessionCashRegisterLabel(cashSession)
                      : "Caja abierta"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Apertura
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDateTime(cashSession?.openedAt ?? null)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {cashSession?.userName ?? "Usuario operativo"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Estado
                  </p>
                  <div className="mt-1">
                    {cashSession ? (
                      <FinanceStatusBadge value={cashSession.status} kind="session" />
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FinanceMetricCard
              label="Caja"
              value={cashSession?.cashRegisterName ?? "Caja abierta"}
              accent="amber"
            />
            <FinanceMetricCard
              label="Sucursal"
              value={cashSession?.branchName ?? cashSession?.branchId ?? "-"}
              accent="blue"
            />
            <FinanceMetricCard
              label="Terminal"
              value={cashSession?.terminalName ?? "Sin terminal"}
              accent="emerald"
            />
            <FinanceMetricCard
              label="Estado"
              value={
                cashSession ? (
                  <FinanceStatusBadge value={cashSession.status} kind="session" />
                ) : (
                  "-"
                )
              }
              accent="slate"
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Apertura
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {formatDateTime(cashSession?.openedAt ?? null)}
                </p>
                <p className="text-xs text-slate-500">
                  {cashSession?.userName ?? "Usuario operativo"}
                </p>
              </div>
              <FinanceMetricCard
                label="Monto apertura"
                value={formatCurrency(summary?.openingAmount ?? 0)}
                accent="blue"
              />
              <FinanceMetricCard
                label="Entradas"
                value={formatCurrency(summary?.cashInTotal ?? 0)}
                accent="emerald"
              />
              <FinanceMetricCard
                label="Salidas"
                value={formatCurrency(summary?.cashOutTotal ?? 0)}
                accent="rose"
              />
              <FinanceMetricCard
                label="Ventas POS"
                value={formatCurrency(summary?.posSalesTotal ?? 0)}
                accent="blue"
              />
              <FinanceMetricCard
                label="Pedidos"
                value={formatCurrency(summary?.orderSalesTotal ?? 0)}
                accent="emerald"
              />
              <FinanceMetricCard
                label="Compras"
                value={formatCurrency(summary?.purchasesTotal ?? 0)}
                accent="rose"
              />
              <FinanceMetricCard
                label="Domicilios"
                value={formatCurrency(summary?.deliveryFees ?? 0)}
                accent="emerald"
              />
              <FinanceMetricCard
                label="Esperado"
                value={formatCurrency(summary?.expectedAmount ?? 0)}
                accent="amber"
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-end md:justify-between">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      activeTab === tab.key
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {tab.label} ({tabCounters[tab.key]})
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  setAppliedSearch(search);
                }}
              >
                <input
                  className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar en turno"
                />
                <Button type="submit" variant="outline">
                  <Search className="h-4 w-4" />
                  Buscar
                </Button>
              </form>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              {activeTab === "sales" ? (
                <SalesTable rows={shift.tabs.sales.rows} actions={TicketActions} />
              ) : null}
              {activeTab === "orders" ? (
                <OrdersTable rows={shift.tabs.orders.rows} actions={TicketActions} />
              ) : null}
              {activeTab === "purchases" ? (
                <PurchasesTable rows={shift.tabs.purchases.rows} actions={TicketActions} />
              ) : null}
              {activeTab === "movements" ? (
                <MovementsTable rows={shift.tabs.movements.rows} />
              ) : null}
              {activeTab === "cashCount" ? (
                <CashCountTable rows={shift.tabs.cashCount.rows} actions={TicketActions} />
              ) : null}
              {activeTab === "tickets" ? (
                <TicketsTable rows={shift.tabs.tickets.rows} actions={TicketActions} />
              ) : null}
            </div>
          </section>
        </>
      )}

      <PdfPreviewModal
        isOpen={Boolean(pdfConfig)}
        title={pdfConfig?.title ?? "Ticket"}
        fileName={pdfConfig?.fileName ?? "ticket.pdf"}
        onClose={() => setPdfConfig(null)}
        getPdf={pdfConfig?.getPdf ?? (() => Promise.reject(new Error("PDF no disponible")))}
      />

      {toastMessage ? (
        <Toast
          variant={toastVariant}
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      ) : null}
    </div>
  );
};

const SalesTable = ({
  rows,
  actions: Actions,
}: {
  rows: CurrentShiftSaleRow[];
  actions: TicketActionsComponent;
}) => {
  if (rows.length === 0) {
    return <EmptyTab message="Sin ventas POS asociadas a la caja abierta." />;
  }
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
        <tr>
          <th className="px-4 py-3">Fecha</th>
          <th className="px-4 py-3">Cliente</th>
          <th className="px-4 py-3">Metodo</th>
          <th className="px-4 py-3">Total</th>
          <th className="px-4 py-3">Ticket</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="px-4 py-3">{formatDateTime(row.createdAt)}</td>
            <td className="px-4 py-3 font-medium text-slate-900">
              {row.customerName ?? "Consumidor final"}
            </td>
            <td className="px-4 py-3">{row.paymentMethod ?? "-"}</td>
            <td className="px-4 py-3 font-semibold">{formatCurrency(row.total)}</td>
            <td className="px-4 py-3">
              <Actions
                type="POS_SALE"
                entityId={row.id}
                disabled={!row.ticketAvailable}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const OrdersTable = ({
  rows,
  actions: Actions,
}: {
  rows: CurrentShiftOrderRow[];
  actions: TicketActionsComponent;
}) => {
  if (rows.length === 0) {
    return <EmptyTab message="Sin pedidos con pago asociado a la caja abierta." />;
  }
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
        <tr>
          <th className="px-4 py-3">Fecha</th>
          <th className="px-4 py-3">Pedido</th>
          <th className="px-4 py-3">Cliente</th>
          <th className="px-4 py-3">Pagado</th>
          <th className="px-4 py-3">Ticket</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="px-4 py-3">{formatDateTime(row.createdAt)}</td>
            <td className="px-4 py-3 font-medium text-slate-900">
              {(row.orderNumber ?? row.id).slice(0, 8)}
            </td>
            <td className="px-4 py-3">{row.customerName ?? "-"}</td>
            <td className="px-4 py-3 font-semibold">{formatCurrency(row.paidAmount)}</td>
            <td className="px-4 py-3">
              <Actions type="ORDER" entityId={row.id} disabled={!row.ticketAvailable} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const PurchasesTable = ({
  rows,
  actions: Actions,
}: {
  rows: CurrentShiftPurchaseRow[];
  actions: TicketActionsComponent;
}) => {
  if (rows.length === 0) {
    return <EmptyTab message="Sin compras con pago asociado a la caja abierta." />;
  }
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
        <tr>
          <th className="px-4 py-3">Fecha</th>
          <th className="px-4 py-3">Proveedor</th>
          <th className="px-4 py-3">Estado</th>
          <th className="px-4 py-3">Pagado</th>
          <th className="px-4 py-3">Ticket</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="px-4 py-3">{formatDateTime(row.createdAt)}</td>
            <td className="px-4 py-3 font-medium text-slate-900">
              {row.supplierName ?? "-"}
            </td>
            <td className="px-4 py-3">{row.status}</td>
            <td className="px-4 py-3 font-semibold">{formatCurrency(row.paidAmount)}</td>
            <td className="px-4 py-3">
              <Actions
                type="PURCHASE"
                entityId={row.id}
                disabled={!row.ticketAvailable}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const MovementsTable = ({ rows }: { rows: CurrentShiftMovementRow[] }) => {
  if (rows.length === 0) {
    return <EmptyTab message="Sin movimientos de caja en el turno actual." />;
  }
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
        <tr>
          <th className="px-4 py-3">Fecha</th>
          <th className="px-4 py-3">Tipo</th>
          <th className="px-4 py-3">Detalle</th>
          <th className="px-4 py-3">Direccion</th>
          <th className="px-4 py-3">Monto</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="px-4 py-3">{formatDateTime(row.createdAt)}</td>
            <td className="px-4 py-3 font-medium text-slate-900">{row.type}</td>
            <td className="px-4 py-3">{row.description ?? row.referenceType ?? "-"}</td>
            <td className="px-4 py-3">{row.direction}</td>
            <td className="px-4 py-3 font-semibold">
              {row.direction === "OUT" ? "-" : ""}
              {formatCurrency(row.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const CashCountTable = ({
  rows,
  actions: Actions,
}: {
  rows: CurrentShiftCashCountRow[];
  actions: TicketActionsComponent;
}) => {
  if (rows.length === 0) {
    return <EmptyTab message="Sin arqueos registrados en la caja abierta." />;
  }
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
        <tr>
          <th className="px-4 py-3">Fecha</th>
          <th className="px-4 py-3">Esperado</th>
          <th className="px-4 py-3">Contado</th>
          <th className="px-4 py-3">Diferencia</th>
          <th className="px-4 py-3">Ticket</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="px-4 py-3">{formatDateTime(row.createdAt)}</td>
            <td className="px-4 py-3">{formatCurrency(row.expectedAmount)}</td>
            <td className="px-4 py-3">{formatCurrency(row.countedAmount)}</td>
            <td className="px-4 py-3 font-semibold">{formatCurrency(row.difference)}</td>
            <td className="px-4 py-3">
              <Actions
                type="CASH_COUNT"
                entityId={row.id}
                disabled={!row.ticketAvailable}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const TicketsTable = ({
  rows,
  actions: Actions,
}: {
  rows: CurrentShiftTicketRow[];
  actions: TicketActionsComponent;
}) => {
  if (rows.length === 0) {
    return <EmptyTab message="Sin tickets disponibles para el turno actual." />;
  }
  return (
    <table className="min-w-full divide-y divide-slate-200 text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
        <tr>
          <th className="px-4 py-3">Fecha</th>
          <th className="px-4 py-3">Tipo</th>
          <th className="px-4 py-3">Documento</th>
          <th className="px-4 py-3">Acciones</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={`${row.type}-${row.entityId}`}>
            <td className="px-4 py-3">{formatDateTime(row.createdAt)}</td>
            <td className="px-4 py-3 font-medium text-slate-900">
              {ticketLabelByType[row.type]}
            </td>
            <td className="px-4 py-3">{row.label}</td>
            <td className="px-4 py-3">
              <Actions type={row.type} entityId={row.entityId} disabled={!row.printable} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default CurrentShiftPage;
