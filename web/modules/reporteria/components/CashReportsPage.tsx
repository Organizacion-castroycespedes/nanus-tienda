"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Eye } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Tabs } from "../../../components/design-system/Tabs";
import { FinanceAccessNotice } from "../../finance/components/FinanceAccessNotice";
import { useCashReports } from "../hooks/use-cash-reports";
import { useReportingScope } from "../hooks/use-reporting-scope";
import {
  getCashAuditTicket,
  getCashClosingTicket,
} from "../services/reporting.service";
import type { CashAuditListRow, CashClosingListRow } from "../types";
import {
  downloadBlob,
  downloadReportWorkbook,
  formatCurrency,
  formatDateTime,
  getTodayRange,
} from "../utils";
import { FiltersBar } from "./FiltersBar";
import { PdfPreviewModal } from "./PdfPreviewModal";
import { ReportExportCard } from "./ReportExportCard";
import { ReportMetricCard } from "./ReportMetricCard";
import { ReportStatusBadge } from "./ReportStatusBadge";

type ActiveTab = "closings" | "audits";
type PdfConfig = {
  title: string;
  fileName: string;
  getPdf: () => Promise<Blob>;
};

const CashReportsPage = () => {
  const searchParams = useSearchParams();
  const initialRange = useMemo(() => getTodayRange(), []);
  const [dateRange, setDateRange] = useState(initialRange);
  const [pdfConfig, setPdfConfig] = useState<PdfConfig | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    searchParams.get("tab") === "audits" ? "audits" : "closings"
  );
  const {
    canViewReports,
    showTenantSelector,
    showBranchSelector,
    tenantId,
    branchId,
    setTenantId,
    setBranchId,
    tenantOptions,
    branchOptions,
    loadingTenants,
    loadingBranches,
    resolvedTenantLabel,
    resolvedBranchLabel,
  } = useReportingScope();
  const {
    closingsDataset,
    auditsDataset,
    loadingClosings,
    loadingAudits,
    searched,
    closingsError,
    auditsError,
    loadClosings,
    loadAudits,
  } = useCashReports();

  useEffect(() => {
    setActiveTab(searchParams.get("tab") === "audits" ? "audits" : "closings");
  }, [searchParams]);

  const handleSearch = useCallback(async () => {
    if (!tenantId) {
      return;
    }

    const filters = {
      tenantId,
      branchId: branchId || undefined,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
    };

    await Promise.all([loadClosings(filters), loadAudits(filters)]);
  }, [branchId, dateRange.from, dateRange.to, loadAudits, loadClosings, tenantId]);

  useEffect(() => {
    if (!canViewReports || !tenantId) {
      return;
    }

    const filters = {
      tenantId,
      branchId: branchId || undefined,
      dateFrom: initialRange.from,
      dateTo: initialRange.to,
    };

    void Promise.all([loadClosings(filters), loadAudits(filters)]);
  }, [branchId, canViewReports, initialRange, loadAudits, loadClosings, tenantId]);

  const closingsColumns = useMemo<DataTableColumn<CashClosingListRow>[]>(
    () => [
      {
        key: "openedAt",
        header: "Fecha apertura",
        render: (row) => (
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{formatDateTime(row.openedAt)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.branchName ?? "Sucursal"}</p>
          </div>
        ),
      },
      {
        key: "closedAt",
        header: "Fecha cierre",
        render: (row) => (
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{formatDateTime(row.closedAt)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.cashRegister ?? "Caja"}</p>
          </div>
        ),
      },
      {
        key: "openingAmount",
        header: "openingAmount",
        render: (row) => formatCurrency(row.openingAmount),
      },
      {
        key: "totalIn",
        header: "totalIn",
        render: (row) => formatCurrency(row.totalIn),
      },
      {
        key: "totalOut",
        header: "totalOut",
        render: (row) => formatCurrency(row.totalOut),
      },
      {
        key: "expectedAmount",
        header: "expectedAmount",
        render: (row) => formatCurrency(row.expectedAmount),
      },
      {
        key: "difference",
        header: "difference",
        render: (row) => (
          <div className="space-y-2">
            <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(row.difference)}</span>
            <ReportStatusBadge value={row.status} />
          </div>
        ),
      },
      {
        key: "actions",
        header: "Acciones",
        cellClassName: "min-w-[180px]",
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPdfConfig({
                  title: `Ticket de cierre ${row.cashSessionId.slice(0, 8)}`,
                  fileName: `ticket-cierre-${row.cashSessionId}.pdf`,
                  getPdf: () => getCashClosingTicket(row.cashSessionId),
                })
              }
            >
              <Eye className="h-4 w-4" />
              Ver ticket
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const blob = await getCashClosingTicket(row.cashSessionId);
                downloadBlob(blob, `ticket-cierre-${row.cashSessionId}.pdf`);
              }}
            >
              <Download className="h-4 w-4" />
              Descargar
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const auditsColumns = useMemo<DataTableColumn<CashAuditListRow>[]>(
    () => [
      {
        key: "countedAt",
        header: "Fecha",
        render: (row) => (
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{formatDateTime(row.countedAt)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.branchName ?? "Sucursal"}</p>
          </div>
        ),
      },
      {
        key: "user",
        header: "Usuario",
        render: (row) => (
          <div>
            <p className="font-medium text-slate-900 dark:text-white">{row.countedBy ?? "Usuario"}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.cashRegister ?? "Caja"}</p>
          </div>
        ),
      },
      {
        key: "counted",
        header: "Contado",
        render: (row) => formatCurrency(row.countedAmount),
      },
      {
        key: "expected",
        header: "Esperado",
        render: (row) => formatCurrency(row.expectedAmount),
      },
      {
        key: "difference",
        header: "Diferencia",
        render: (row) => (
          <div className="space-y-2">
            <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(row.difference)}</span>
            <ReportStatusBadge value={row.sessionStatus} />
          </div>
        ),
      },
      {
        key: "actions",
        header: "Acciones",
        cellClassName: "min-w-[180px]",
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPdfConfig({
                  title: `Ticket de arqueo ${row.cashCountId.slice(0, 8)}`,
                  fileName: `ticket-arqueo-${row.cashCountId}.pdf`,
                  getPdf: () => getCashAuditTicket(row.cashCountId),
                })
              }
            >
              <Eye className="h-4 w-4" />
              Ver ticket
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const blob = await getCashAuditTicket(row.cashCountId);
                downloadBlob(blob, `ticket-arqueo-${row.cashCountId}.pdf`);
              }}
            >
              <Download className="h-4 w-4" />
              Descargar
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  if (!canViewReports) {
    return (
      <FinanceAccessNotice description="No cuentas con permisos para consultar cierres y arqueos de caja." />
    );
  }

  const loading = activeTab === "closings" ? loadingClosings : loadingAudits;
  const error = activeTab === "closings" ? closingsError : auditsError;
  const canExportClosings = Boolean(closingsDataset?.rows.length);
  const canExportAudits = Boolean(auditsDataset?.rows.length);

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Reporteria caja</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Cierres y arqueos</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Consulta cierres y arqueos por fecha, sucursal y tenant; abre tickets PDF y mantén trazabilidad operativa del turno.
        </p>
      </section>

      <FiltersBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        tenantId={tenantId}
        branchId={branchId}
        onTenantChange={setTenantId}
        onBranchChange={setBranchId}
        showTenantSelector={showTenantSelector}
        showBranchSelector={showBranchSelector}
        tenantOptions={tenantOptions}
        branchOptions={branchOptions}
        loadingTenants={loadingTenants}
        loadingBranches={loadingBranches}
        tenantLabel={resolvedTenantLabel}
        branchLabel={resolvedBranchLabel}
        isSearching={loadingClosings || loadingAudits}
        onSearch={() => void handleSearch()}
      />

      <ReportExportCard
        title="Descargar reportes de caja para conciliacion"
        description="Genera archivos Excel separados para cierres y arqueos con resumen, diferencias y detalle por caja o sesion."
        helper="Ideal para conciliacion entre cierres, conteos fisicos y movimientos de caja del mismo rango."
        actions={[
          {
            label: "Excel cierres",
            disabled: !canExportClosings,
            onClick: () => {
              if (!closingsDataset) {
                return;
              }

              downloadReportWorkbook({
                fileName: `reporte-cierres-${tenantId}-${dateRange.from}-${dateRange.to}.xls`,
                summaryTitle: "Reporte de cierres de caja",
                detailTitle: "Detalle de cierres",
                filters: [
                  { label: "Tenant", value: resolvedTenantLabel },
                  { label: "Sucursal", value: resolvedBranchLabel },
                  { label: "Desde", value: dateRange.from },
                  { label: "Hasta", value: dateRange.to },
                ],
                summary: [
                  { label: "Cierres", value: closingsDataset.summary.count },
                  { label: "Monto apertura", value: closingsDataset.summary.openingAmount },
                  { label: "Ingresos", value: closingsDataset.summary.totalIn },
                  { label: "Egresos", value: closingsDataset.summary.totalOut },
                  { label: "Esperado", value: closingsDataset.summary.expectedAmount },
                  { label: "Diferencia", value: closingsDataset.summary.difference },
                ],
                columns: [
                  "Apertura",
                  "Cierre",
                  "Sucursal",
                  "Caja",
                  "Terminal",
                  "Abierto por",
                  "Cerrado por",
                  "Apertura monto",
                  "Ingresos",
                  "Egresos",
                  "Esperado",
                  "Cierre",
                  "Diferencia",
                  "Estado",
                ],
                rows: closingsDataset.rows.map((row) => [
                  formatDateTime(row.openedAt),
                  formatDateTime(row.closedAt),
                  row.branchName ?? "",
                  row.cashRegister ?? "",
                  row.terminal ?? "",
                  row.openedBy ?? "",
                  row.closedBy ?? "",
                  row.openingAmount,
                  row.totalIn,
                  row.totalOut,
                  row.expectedAmount,
                  row.closingAmount,
                  row.difference,
                  row.status,
                ]),
              });
            },
          },
          {
            label: "Excel arqueos",
            disabled: !canExportAudits,
            onClick: () => {
              if (!auditsDataset) {
                return;
              }

              downloadReportWorkbook({
                fileName: `reporte-arqueos-${tenantId}-${dateRange.from}-${dateRange.to}.xls`,
                summaryTitle: "Reporte de arqueos de caja",
                detailTitle: "Detalle de arqueos",
                filters: [
                  { label: "Tenant", value: resolvedTenantLabel },
                  { label: "Sucursal", value: resolvedBranchLabel },
                  { label: "Desde", value: dateRange.from },
                  { label: "Hasta", value: dateRange.to },
                ],
                summary: [
                  { label: "Arqueos", value: auditsDataset.summary.count },
                  { label: "Contado", value: auditsDataset.summary.countedAmount },
                  { label: "Esperado", value: auditsDataset.summary.expectedAmount },
                  { label: "Diferencia", value: auditsDataset.summary.difference },
                ],
                columns: [
                  "Fecha",
                  "Sucursal",
                  "Caja",
                  "Terminal",
                  "Usuario",
                  "Contado",
                  "Esperado",
                  "Diferencia",
                  "Estado sesion",
                  "Notas",
                ],
                rows: auditsDataset.rows.map((row) => [
                  formatDateTime(row.countedAt),
                  row.branchName ?? "",
                  row.cashRegister ?? "",
                  row.terminal ?? "",
                  row.countedBy ?? "",
                  row.countedAmount,
                  row.expectedAmount,
                  row.difference,
                  row.sessionStatus,
                  row.notes ?? "",
                ]),
              });
            },
          },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportMetricCard
          label="Cierres"
          value={closingsDataset ? closingsDataset.summary.count : searched ? 0 : "--"}
          helper="Sesiones cerradas encontradas."
          accent="blue"
        />
        <ReportMetricCard
          label="Ingresos"
          value={
            closingsDataset ? formatCurrency(closingsDataset.summary.totalIn) : searched ? "$ 0" : "--"
          }
          helper="Entradas consolidadas por cierres."
          accent="emerald"
        />
        <ReportMetricCard
          label="Egresos"
          value={
            closingsDataset ? formatCurrency(closingsDataset.summary.totalOut) : searched ? "$ 0" : "--"
          }
          helper="Salidas consolidadas por cierres."
          accent="amber"
        />
        <ReportMetricCard
          label="Arqueos"
          value={auditsDataset ? auditsDataset.summary.count : searched ? 0 : "--"}
          helper="Conteos registrados en el rango."
          accent="rose"
        />
      </section>

      <Tabs
        items={[
          {
            value: "closings",
            label: "Cierres",
            helper: `${closingsDataset?.summary.count ?? 0} registros`,
          },
          {
            value: "audits",
            label: "Arqueos",
            helper: `${auditsDataset?.summary.count ?? 0} registros`,
          },
        ]}
        value={activeTab}
        onChange={(value) => setActiveTab(value as ActiveTab)}
      />

      {activeTab === "closings" ? (
        <DataTable
          columns={closingsColumns}
          rows={closingsDataset?.rows ?? []}
          getRowKey={(row) => row.cashSessionId}
          loading={loading}
          error={error}
          emptyState={
            searched
              ? "No hay cierres para los filtros seleccionados."
              : "Usa los filtros y ejecuta la busqueda para cargar el reporte."
          }
        />
      ) : (
        <DataTable
          columns={auditsColumns}
          rows={auditsDataset?.rows ?? []}
          getRowKey={(row) => row.cashCountId}
          loading={loading}
          error={error}
          emptyState={
            searched
              ? "No hay arqueos para los filtros seleccionados."
              : "Usa los filtros y ejecuta la busqueda para cargar el reporte."
          }
        />
      )}

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

export default CashReportsPage;
