"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Eye } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { RowActionsMenu } from "../../../components/design-system/RowActionsMenu";
import { Pagination } from "../../../components/design-system/Pagination";
import { ReportFilters } from "../../../components/design-system/ReportFilters";
import { ReportLayout } from "../../../components/design-system/ReportLayout";
import { ReportSummary } from "../../../components/design-system/ReportSummary";
import { Tabs } from "../../../components/design-system/Tabs";
import { FinanceAccessNotice } from "../../finance/components/FinanceAccessNotice";
import { useCashReports } from "../hooks/use-cash-reports";
import { useReportingScope } from "../hooks/use-reporting-scope";
import {
  getCashAuditTicket,
  getCashAuditsReportExcel,
  getCashAuditsReportPdf,
  getCashClosingTicket,
  getCashClosingsReportExcel,
  getCashClosingsReportPdf,
} from "../services/reporting.service";
import type { CashAuditListRow, CashClosingListRow } from "../types";
import { downloadBlob, formatCurrency, formatDateTime, getTodayRange } from "../utils";
import { PdfPreviewModal } from "./PdfPreviewModal";
import { ReportStatusBadge } from "./ReportStatusBadge";
import { createReportScopeFilters } from "./report-scope-filters";

type ActiveTab = "closings" | "audits";
type PdfConfig = { title: string; fileName: string; getPdf: () => Promise<Blob>; allowPrint?: boolean };

const CashReportsPage = () => {
  const searchParams = useSearchParams();
  const initialRange = useMemo(() => getTodayRange(), []);
  const [dateRange, setDateRange] = useState(initialRange);
  const [activeTab, setActiveTab] = useState<ActiveTab>(searchParams.get("tab") === "audits" ? "audits" : "closings");
  const [page, setPage] = useState(1);
  const [pdfConfig, setPdfConfig] = useState<PdfConfig | null>(null);
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const scope = useReportingScope();
  const reports = useCashReports();

  useEffect(() => setActiveTab(searchParams.get("tab") === "audits" ? "audits" : "closings"), [searchParams]);

  const load = useCallback(async (range: { from: string; to: string }) => {
    if (!scope.tenantId) return;
    const filters = { tenantId: scope.tenantId, branchId: scope.branchId || undefined, dateFrom: range.from, dateTo: range.to };
    await Promise.all([reports.loadClosings(filters), reports.loadAudits(filters)]);
    setPage(1);
  }, [reports.loadAudits, reports.loadClosings, scope.branchId, scope.tenantId]);

  useEffect(() => {
    if (!scope.canViewReports || !scope.tenantId) return;
    void load(initialRange);
  }, [initialRange, load, scope.canViewReports, scope.tenantId]);

  const closingsColumns = useMemo<DataTableColumn<CashClosingListRow>[]>(() => [
    {
      key: "actions",
      header: "Acciones",
      className: "text-center w-14",
      cellClassName: "text-center whitespace-nowrap",
      render: (row) =>
        row.status === "CLOSED" ? (
          <div className="flex justify-center">
            <RowActionsMenu
              label="Acciones"
              items={[
                {
                  label: "Ver ticket",
                  icon: <Eye className="h-4 w-4" />,
                  onSelect: () =>
                    setPdfConfig({
                      title: `Ticket de cierre ${row.cashSessionId.slice(0, 8)}`,
                      fileName: `ticket-cierre-${row.cashSessionId}.pdf`,
                      getPdf: () => getCashClosingTicket(row.cashSessionId),
                      allowPrint: true,
                    }),
                },
                {
                  label: "Descargar PDF",
                  icon: <Download className="h-4 w-4" />,
                  onSelect: async () =>
                    downloadBlob(
                      await getCashClosingTicket(row.cashSessionId),
                      `ticket-cierre-${row.cashSessionId}.pdf`
                    ),
                },
              ]}
            />
          </div>
        ) : (
          <span className="text-xs italic text-slate-400">En curso</span>
        ),
    },
    {
      key: "openedAt",
      header: "Fecha Apertura",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{formatDateTime(row.openedAt)}</p>
          <p className="text-xs text-slate-500">{row.openedBy ?? row.branchName ?? "Sucursal"}</p>
        </div>
      ),
    },
    {
      key: "closedAt",
      header: "Fecha Cierre",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{row.closedAt ? formatDateTime(row.closedAt) : "—"}</p>
          <p className="text-xs text-slate-500">{row.closedBy ?? row.cashRegister ?? "Caja"}</p>
        </div>
      ),
    },
    {
      key: "cashRegister",
      header: "Caja",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{row.cashRegister ?? "Caja"}</p>
          <p className="text-xs text-slate-500">{row.branchName ?? "Sucursal"}</p>
        </div>
      ),
    },
    {
      key: "openingAmount",
      header: "Apertura",
      className: "text-right",
      cellClassName: "text-right font-medium tabular-nums text-slate-900 dark:text-white",
      render: (row) => formatCurrency(row.openingAmount),
    },
    {
      key: "totalIn",
      header: "Ingresos",
      className: "text-right",
      cellClassName: "text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400",
      render: (row) => `+${formatCurrency(row.totalIn)}`,
    },
    {
      key: "totalOut",
      header: "Egresos",
      className: "text-right",
      cellClassName: "text-right font-medium tabular-nums text-rose-600 dark:text-rose-400",
      render: (row) => `-${formatCurrency(row.totalOut)}`,
    },
    {
      key: "expectedAmount",
      header: "Esperado",
      className: "text-right",
      cellClassName: "text-right font-medium tabular-nums text-slate-900 dark:text-white",
      render: (row) => formatCurrency(row.expectedAmount),
    },
    {
      key: "difference",
      header: "Diferencia",
      className: "text-right",
      cellClassName: "text-right font-semibold tabular-nums",
      render: (row) => (
        <span
          className={
            row.difference === 0
              ? "text-slate-700 dark:text-slate-300"
              : row.difference < 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-amber-600 dark:text-amber-400"
          }
        >
          {row.difference > 0 ? "+" : ""}
          {formatCurrency(row.difference)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      className: "text-center",
      cellClassName: "text-center whitespace-nowrap",
      render: (row) => <ReportStatusBadge value={row.status} />,
    },
  ], []);

  const auditsColumns = useMemo<DataTableColumn<CashAuditListRow>[]>(() => [
    {
      key: "actions",
      header: "Acciones",
      className: "text-center w-14",
      cellClassName: "text-center whitespace-nowrap",
      render: (row) => (
        <div className="flex justify-center">
          <RowActionsMenu
            label="Acciones"
            items={[
              {
                label: "Ver ticket",
                icon: <Eye className="h-4 w-4" />,
                onSelect: () =>
                  setPdfConfig({
                    title: `Ticket de arqueo ${row.cashCountId.slice(0, 8)}`,
                    fileName: `ticket-arqueo-${row.cashCountId}.pdf`,
                    getPdf: () => getCashAuditTicket(row.cashCountId),
                    allowPrint: true,
                  }),
              },
              {
                label: "Descargar PDF",
                icon: <Download className="h-4 w-4" />,
                onSelect: async () =>
                  downloadBlob(
                    await getCashAuditTicket(row.cashCountId),
                    `ticket-arqueo-${row.cashCountId}.pdf`
                  ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      key: "countedAt",
      header: "Fecha",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{formatDateTime(row.countedAt)}</p>
          <p className="text-xs text-slate-500">{row.branchName ?? "Sucursal"}</p>
        </div>
      ),
    },
    {
      key: "user",
      header: "Usuario / Cajero",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{row.countedBy ?? "Usuario"}</p>
          <p className="text-xs text-slate-500">{row.cashRegister ?? "Caja"}</p>
        </div>
      ),
    },
    {
      key: "cashRegister",
      header: "Caja",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{row.cashRegister ?? "Caja"}</p>
          <p className="text-xs text-slate-500">{row.terminal ?? "Terminal"}</p>
        </div>
      ),
    },
    {
      key: "counted",
      header: "Contado",
      className: "text-right",
      cellClassName: "text-right font-medium tabular-nums text-slate-900 dark:text-white",
      render: (row) => formatCurrency(row.countedAmount),
    },
    {
      key: "expected",
      header: "Esperado",
      className: "text-right",
      cellClassName: "text-right font-medium tabular-nums text-slate-900 dark:text-white",
      render: (row) => formatCurrency(row.expectedAmount),
    },
    {
      key: "difference",
      header: "Diferencia",
      className: "text-right",
      cellClassName: "text-right font-semibold tabular-nums",
      render: (row) => (
        <span
          className={
            row.difference === 0
              ? "text-slate-700 dark:text-slate-300"
              : row.difference < 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-amber-600 dark:text-amber-400"
          }
        >
          {row.difference > 0 ? "+" : ""}
          {formatCurrency(row.difference)}
        </span>
      ),
    },
    {
      key: "sessionStatus",
      header: "Estado",
      className: "text-center",
      cellClassName: "text-center whitespace-nowrap",
      render: (row) => <ReportStatusBadge value={row.sessionStatus} />,
    },
  ], []);

  if (!scope.canViewReports) return <FinanceAccessNotice description="No cuentas con permisos para consultar cierres y arqueos de caja." />;

  const activeDataset = activeTab === "closings" ? reports.closingsDataset : reports.auditsDataset;
  const activeRows = activeTab === "closings" ? reports.closingsDataset?.rows ?? [] : reports.auditsDataset?.rows ?? [];
  const summaryItems = activeTab === "closings"
    ? [{ label: "Cierres", value: reports.closingsDataset ? reports.closingsDataset.summary.count : reports.searched ? 0 : "--" }, { label: "Ingresos", value: reports.closingsDataset ? formatCurrency(reports.closingsDataset.summary.totalIn) : reports.searched ? "$ 0" : "--" }, { label: "Egresos", value: reports.closingsDataset ? formatCurrency(reports.closingsDataset.summary.totalOut) : reports.searched ? "$ 0" : "--" }, { label: "Diferencia", value: reports.closingsDataset ? formatCurrency(reports.closingsDataset.summary.difference) : reports.searched ? "$ 0" : "--" }]
    : [{ label: "Arqueos", value: reports.auditsDataset ? reports.auditsDataset.summary.count : reports.searched ? 0 : "--" }, { label: "Contado", value: reports.auditsDataset ? formatCurrency(reports.auditsDataset.summary.countedAmount) : reports.searched ? "$ 0" : "--" }, { label: "Esperado", value: reports.auditsDataset ? formatCurrency(reports.auditsDataset.summary.expectedAmount) : reports.searched ? "$ 0" : "--" }, { label: "Diferencia", value: reports.auditsDataset ? formatCurrency(reports.auditsDataset.summary.difference) : reports.searched ? "$ 0" : "--" }];
  const filters = createReportScopeFilters({ dateRange, initialRange, setDateRange, showTenantSelector: scope.showTenantSelector, showBranchSelector: scope.showBranchSelector, tenantId: scope.tenantId, branchId: scope.branchId, setTenantId: scope.setTenantId, setBranchId: scope.setBranchId, tenantOptions: scope.tenantOptions, branchOptions: scope.branchOptions, loadingTenants: scope.loadingTenants, loadingBranches: scope.loadingBranches, tenantLabel: scope.resolvedTenantLabel, branchLabel: scope.resolvedBranchLabel });
  const reportQuery = useMemo(() => ({
    tenantId: scope.tenantId || undefined,
    branchId: scope.branchId || undefined,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  }), [dateRange.from, dateRange.to, scope.branchId, scope.tenantId]);
  const downloadReportExcel = useCallback(async () => {
    const blob = activeTab === "closings"
      ? await getCashClosingsReportExcel(reportQuery)
      : await getCashAuditsReportExcel(reportQuery);
    downloadBlob(blob, `reporte-${activeTab === "closings" ? "cierres" : "arqueos"}-${dateRange.from}-${dateRange.to}.xlsx`);
  }, [activeTab, dateRange.from, dateRange.to, reportQuery]);

  return (
    <ReportLayout title="Cierres y arqueos" description="Consulta cierres y arqueos por fecha y alcance operativo.">
      <div className="space-y-3">
        <ReportFilters filters={filters} actions={<><Button size="sm" onClick={() => void load(dateRange)} isLoading={reports.loadingClosings || reports.loadingAudits}>Buscar</Button><Button variant="outline" size="sm" disabled={!activeDataset} onClick={() => setReportPreviewOpen(true)}><Eye className="h-4 w-4" /> Reporte</Button></>} />
        <ReportSummary items={summaryItems} />
        <Tabs items={[{ value: "closings", label: "Cierres", helper: `${reports.closingsDataset?.summary.count ?? 0} registros` }, { value: "audits", label: "Arqueos", helper: `${reports.auditsDataset?.summary.count ?? 0} registros` }]} value={activeTab} onChange={(value) => { setActiveTab(value as ActiveTab); setPage(1); }} />
        {activeTab === "closings" ? (
          <DataTable
            columns={closingsColumns}
            rows={activeRows.slice((page - 1) * pageSize, page * pageSize) as CashClosingListRow[]}
            getRowKey={(row) => row.cashSessionId}
            loading={reports.loadingClosings}
            error={reports.closingsError}
            emptyState={reports.searched ? "No hay cierres para los filtros seleccionados." : "Usa los filtros y ejecuta la búsqueda para cargar el reporte."}
            disableHeaderUppercase={true}
          />
        ) : (
          <DataTable
            columns={auditsColumns}
            rows={activeRows.slice((page - 1) * pageSize, page * pageSize) as CashAuditListRow[]}
            getRowKey={(row) => row.cashCountId}
            loading={reports.loadingAudits}
            error={reports.auditsError}
            emptyState={reports.searched ? "No hay arqueos para los filtros seleccionados." : "Usa los filtros y ejecuta la búsqueda para cargar el reporte."}
            disableHeaderUppercase={true}
          />
        )}
        {activeDataset ? <Pagination page={page} pageSize={pageSize} totalItems={activeRows.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /> : null}
      </div>
      {pdfConfig ? <PdfPreviewModal isOpen title={pdfConfig.title} fileName={pdfConfig.fileName} getPdf={pdfConfig.getPdf} allowPrint={pdfConfig.allowPrint} onClose={() => setPdfConfig(null)} /> : null}
      {reportPreviewOpen ? <PdfPreviewModal
        isOpen
        title={activeTab === "closings" ? "Reporte de cierres de caja" : "Reporte de arqueos de caja"}
        fileName={`reporte-${activeTab === "closings" ? "cierres" : "arqueos"}-${dateRange.from}-${dateRange.to}.pdf`}
        getPdf={() => activeTab === "closings" ? getCashClosingsReportPdf(reportQuery) : getCashAuditsReportPdf(reportQuery)}
        onDownloadExcel={() => void downloadReportExcel()}
        allowPrint
        onClose={() => setReportPreviewOpen(false)}
      /> : null}
    </ReportLayout>
  );
};

export default CashReportsPage;
