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
type PdfConfig = { title: string; fileName: string; getPdf: () => Promise<Blob> };

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
    { key: "openedAt", header: "Fecha apertura", render: (row) => <div><p className="font-medium">{formatDateTime(row.openedAt)}</p><p className="text-xs text-slate-500">{row.branchName ?? "Sucursal"}</p></div> },
    { key: "closedAt", header: "Fecha cierre", render: (row) => <div><p className="font-medium">{formatDateTime(row.closedAt)}</p><p className="text-xs text-slate-500">{row.cashRegister ?? "Caja"}</p></div> },
    { key: "openingAmount", header: "Apertura", render: (row) => formatCurrency(row.openingAmount) },
    { key: "totalIn", header: "Ingresos", render: (row) => formatCurrency(row.totalIn) },
    { key: "totalOut", header: "Egresos", render: (row) => formatCurrency(row.totalOut) },
    { key: "expectedAmount", header: "Esperado", render: (row) => formatCurrency(row.expectedAmount) },
    { key: "difference", header: "Diferencia", render: (row) => <div><p className="font-medium">{formatCurrency(row.difference)}</p><ReportStatusBadge value={row.status} /></div> },
    { key: "actions", actionFirst: true, header: "Acciones", cellClassName: "w-14", render: (row) => <RowActionsMenu><Button variant="outline" size="sm" onClick={() => setPdfConfig({ title: `Ticket de cierre ${row.cashSessionId.slice(0, 8)}`, fileName: `ticket-cierre-${row.cashSessionId}.pdf`, getPdf: () => getCashClosingTicket(row.cashSessionId) })}><Eye className="h-4 w-4" /> Ver ticket</Button><Button variant="ghost" size="sm" onClick={async () => downloadBlob(await getCashClosingTicket(row.cashSessionId), `ticket-cierre-${row.cashSessionId}.pdf`)}><Download className="h-4 w-4" /> Descargar</Button></RowActionsMenu> },
  ], []);

  const auditsColumns = useMemo<DataTableColumn<CashAuditListRow>[]>(() => [
    { key: "countedAt", header: "Fecha", render: (row) => <div><p className="font-medium">{formatDateTime(row.countedAt)}</p><p className="text-xs text-slate-500">{row.branchName ?? "Sucursal"}</p></div> },
    { key: "user", header: "Usuario", render: (row) => <div><p className="font-medium">{row.countedBy ?? "Usuario"}</p><p className="text-xs text-slate-500">{row.cashRegister ?? "Caja"}</p></div> },
    { key: "counted", header: "Contado", render: (row) => formatCurrency(row.countedAmount) },
    { key: "expected", header: "Esperado", render: (row) => formatCurrency(row.expectedAmount) },
    { key: "difference", header: "Diferencia", render: (row) => <div><p className="font-medium">{formatCurrency(row.difference)}</p><ReportStatusBadge value={row.sessionStatus} /></div> },
    { key: "actions", actionFirst: true, header: "Acciones", cellClassName: "w-14", render: (row) => <RowActionsMenu><Button variant="outline" size="sm" onClick={() => setPdfConfig({ title: `Ticket de arqueo ${row.cashCountId.slice(0, 8)}`, fileName: `ticket-arqueo-${row.cashCountId}.pdf`, getPdf: () => getCashAuditTicket(row.cashCountId) })}><Eye className="h-4 w-4" /> Ver ticket</Button><Button variant="ghost" size="sm" onClick={async () => downloadBlob(await getCashAuditTicket(row.cashCountId), `ticket-arqueo-${row.cashCountId}.pdf`)}><Download className="h-4 w-4" /> Descargar</Button></RowActionsMenu> },
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
        {activeTab === "closings" ? <DataTable columns={closingsColumns} rows={activeRows.slice((page - 1) * pageSize, page * pageSize) as CashClosingListRow[]} getRowKey={(row) => row.cashSessionId} loading={reports.loadingClosings} error={reports.closingsError} emptyState={reports.searched ? "No hay cierres para los filtros seleccionados." : "Usa los filtros y ejecuta la búsqueda para cargar el reporte."} /> : <DataTable columns={auditsColumns} rows={activeRows.slice((page - 1) * pageSize, page * pageSize) as CashAuditListRow[]} getRowKey={(row) => row.cashCountId} loading={reports.loadingAudits} error={reports.auditsError} emptyState={reports.searched ? "No hay arqueos para los filtros seleccionados." : "Usa los filtros y ejecuta la búsqueda para cargar el reporte."} />}
        {activeDataset ? <Pagination page={page} pageSize={pageSize} totalItems={activeRows.length} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /> : null}
      </div>
      {pdfConfig ? <PdfPreviewModal isOpen title={pdfConfig.title} fileName={pdfConfig.fileName} getPdf={pdfConfig.getPdf} onClose={() => setPdfConfig(null)} /> : null}
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
