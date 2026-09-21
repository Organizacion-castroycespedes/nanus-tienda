"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Pagination } from "../../../components/design-system/Pagination";
import { ReportFilters } from "../../../components/design-system/ReportFilters";
import { ReportLayout } from "../../../components/design-system/ReportLayout";
import { ReportSummary } from "../../../components/design-system/ReportSummary";
import { FinanceAccessNotice } from "../../finance/components/FinanceAccessNotice";
import { useOrdersReports } from "../hooks/use-orders-reports";
import { useReportingScope } from "../hooks/use-reporting-scope";
import { getOrderSaleTicket, getOrderSalesReportExcel, getOrderSalesReportPdf } from "../services/reporting.service";
import type { OrderSalesListRow } from "../types";
import { downloadBlob, downloadReportWorkbook, formatCurrency, formatDateTime, getTodayRange } from "../utils";
import { PdfPreviewModal } from "./PdfPreviewModal";
import { ReportStatusBadge } from "./ReportStatusBadge";
import { createReportScopeFilters } from "./report-scope-filters";

type PdfConfig = { title: string; fileName: string; getPdf: () => Promise<Blob>; onDownloadExcel?: () => void };

const OrdersReportsPage = () => {
  const initialRange = useMemo(() => getTodayRange(), []);
  const [dateRange, setDateRange] = useState(initialRange);
  const [page, setPage] = useState(1);
  const [pdfConfig, setPdfConfig] = useState<PdfConfig | null>(null);
  const pageSize = 25;
  const scope = useReportingScope();
  const reports = useOrdersReports();

  const load = useCallback(async (range: { from: string; to: string }) => {
    if (!scope.tenantId) return;
    await reports.loadReports({ tenantId: scope.tenantId, branchId: scope.branchId || undefined, dateFrom: range.from, dateTo: range.to });
    setPage(1);
  }, [reports.loadReports, scope.branchId, scope.tenantId]);

  useEffect(() => {
    if (!scope.canViewReports || !scope.tenantId) return;
    void load(initialRange);
  }, [initialRange, load, scope.canViewReports, scope.tenantId]);

  const columns = useMemo<DataTableColumn<OrderSalesListRow>[]>(() => [
    { key: "date", header: "Fecha", render: (row) => <div><p className="font-medium">{formatDateTime(row.date)}</p><p className="text-xs text-slate-500">{row.branchName ?? "Sucursal"}</p></div> },
    { key: "customer", header: "Cliente", render: (row) => <div><p className="font-medium">{row.customerName || "Cliente sin nombre"}</p><p className="text-xs text-slate-500">Pedido #{row.orderId.slice(0, 8)}</p></div> },
    { key: "total", header: "Total", render: (row) => formatCurrency(row.total) },
    { key: "paid", header: "Pagado", render: (row) => formatCurrency(row.paid) },
    { key: "balance", header: "Saldo", render: (row) => formatCurrency(row.balance) },
    { key: "status", header: "Estado", render: (row) => <div><ReportStatusBadge value={row.status} /><p className="text-sm">{row.paymentStatus}</p><p className="text-xs text-slate-500">{row.generatedSaleId ? `Venta ${row.generatedSaleId.slice(0, 8)}` : "Sin venta generada"}</p></div> },
    { key: "actions", header: "Acciones", cellClassName: "min-w-[200px]", render: (row) => <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setPdfConfig({ title: `Ticket de pedido ${row.orderId.slice(0, 8)}`, fileName: `ticket-pedido-${row.orderId}.pdf`, getPdf: () => getOrderSaleTicket(row.orderId) })}><Eye className="h-4 w-4" /> Ver ticket</Button><Button variant="ghost" size="sm" onClick={async () => downloadBlob(await getOrderSaleTicket(row.orderId), `ticket-pedido-${row.orderId}.pdf`)}><Download className="h-4 w-4" /> Descargar</Button></div> },
  ], []);

  const filters = useMemo(() => createReportScopeFilters({ dateRange, initialRange, setDateRange, showTenantSelector: scope.showTenantSelector, showBranchSelector: scope.showBranchSelector, tenantId: scope.tenantId, branchId: scope.branchId, setTenantId: scope.setTenantId, setBranchId: scope.setBranchId, tenantOptions: scope.tenantOptions, branchOptions: scope.branchOptions, loadingTenants: scope.loadingTenants, loadingBranches: scope.loadingBranches, tenantLabel: scope.resolvedTenantLabel, branchLabel: scope.resolvedBranchLabel }), [dateRange, initialRange, scope]);

  const exportReport = () => {
    const dataset = reports.dataset;
    if (!dataset) return;
    downloadReportWorkbook({ fileName: `reporte-pedidos-${scope.tenantId}-${dateRange.from}-${dateRange.to}.xls`, summaryTitle: "Reporte de pedidos", detailTitle: "Detalle de pedidos", filters: [{ label: "Tenant", value: scope.resolvedTenantLabel }, { label: "Sucursal", value: scope.resolvedBranchLabel }, { label: "Desde", value: dateRange.from }, { label: "Hasta", value: dateRange.to }], summary: [{ label: "Pedidos", value: dataset.summary.count }, { label: "Total", value: dataset.summary.total }, { label: "Pagado", value: dataset.summary.paid }, { label: "Saldo", value: dataset.summary.balance }, { label: "Completados", value: dataset.summary.completed }, { label: "Parciales", value: dataset.summary.partial }, { label: "Pendientes", value: dataset.summary.pending }], columns: ["Fecha", "Sucursal", "Cliente", "Pedido ID", "Venta generada", "Total", "Pagado", "Saldo", "Estado", "Estado pago"], rows: dataset.rows.map((row) => [formatDateTime(row.date), row.branchName ?? "", row.customerName, row.orderId, row.generatedSaleId ?? "", row.total, row.paid, row.balance, row.status, row.paymentStatus]) });
  };

  const reportFilters = { tenantId: scope.tenantId, branchId: scope.branchId || undefined, dateFrom: dateRange.from, dateTo: dateRange.to };
  const openReport = () => setPdfConfig({
    title: "Reporte de pedidos",
    fileName: `reporte-pedidos-${dateRange.from}-${dateRange.to}.pdf`,
    getPdf: () => getOrderSalesReportPdf(reportFilters),
    onDownloadExcel: () => void getOrderSalesReportExcel(reportFilters).then((blob) => downloadBlob(blob, `reporte-pedidos-${dateRange.from}-${dateRange.to}.xlsx`)),
  });

  if (!scope.canViewReports) return <FinanceAccessNotice description="No cuentas con permisos para consultar la reportería de pedidos." />;

  return (
    <ReportLayout title="Pedidos y venta generada" description="Revisa pedidos por estado, pagos y venta asociada.">
      <div className="space-y-3">
        <ReportFilters filters={filters} actions={<><Button size="sm" onClick={() => void load(dateRange)} isLoading={reports.loading} disabled={!dateRange.from || !dateRange.to}>Buscar</Button><Button variant="outline" size="sm" onClick={openReport} disabled={!scope.tenantId || !dateRange.from || !dateRange.to}>Reporte</Button><Button variant="outline" size="sm" disabled={!reports.dataset?.rows.length} onClick={exportReport}><Download className="h-4 w-4" /> Descargar reporte</Button></>} />
        <ReportSummary items={[{ label: "Pedidos", value: reports.dataset ? reports.dataset.summary.count : reports.searched ? 0 : "--" }, { label: "Completados", value: reports.dataset ? reports.dataset.summary.completed : reports.searched ? 0 : "--" }, { label: "Parciales", value: reports.dataset ? reports.dataset.summary.partial : reports.searched ? 0 : "--" }, { label: "Pendientes", value: reports.dataset ? reports.dataset.summary.pending : reports.searched ? 0 : "--" }]} />
        <DataTable columns={columns} rows={reports.dataset?.rows.slice((page - 1) * pageSize, page * pageSize) ?? []} getRowKey={(row) => row.orderId} loading={reports.loading} error={reports.error} emptyState={reports.searched ? "No hay pedidos para los filtros seleccionados." : "Usa los filtros y ejecuta la búsqueda para cargar el reporte."} />
        {reports.dataset ? <Pagination page={page} pageSize={pageSize} totalItems={reports.dataset.rows.length} onPageChange={setPage} /> : null}
      </div>
      {pdfConfig ? <PdfPreviewModal isOpen title={pdfConfig.title} fileName={pdfConfig.fileName} getPdf={pdfConfig.getPdf} onDownloadExcel={pdfConfig.onDownloadExcel} allowPrint onClose={() => setPdfConfig(null)} /> : null}
    </ReportLayout>
  );
};

export default OrdersReportsPage;
