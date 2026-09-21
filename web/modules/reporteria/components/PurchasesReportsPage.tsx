"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Pagination } from "../../../components/design-system/Pagination";
import { ReportFilters, type ReportFilterDefinition } from "../../../components/design-system/ReportFilters";
import { ReportLayout } from "../../../components/design-system/ReportLayout";
import { ReportSummary } from "../../../components/design-system/ReportSummary";
import { Select } from "../../../components/design-system/Select";
import { FinanceAccessNotice } from "../../finance/components/FinanceAccessNotice";
import { usePurchasesReports } from "../hooks/use-purchases-reports";
import { useReportingScope } from "../hooks/use-reporting-scope";
import { getPurchaseTicket } from "../services/reporting.service";
import type { PurchasesListRow } from "../types";
import { downloadBlob, downloadReportWorkbook, formatCurrency, formatDateTime, getTodayRange } from "../utils";
import { PdfPreviewModal } from "./PdfPreviewModal";
import { ReportStatusBadge } from "./ReportStatusBadge";
import { createReportScopeFilters } from "./report-scope-filters";

type PdfConfig = { title: string; fileName: string; getPdf: () => Promise<Blob> };

const PurchasesReportsPage = () => {
  const initialRange = useMemo(() => getTodayRange(), []);
  const [dateRange, setDateRange] = useState(initialRange);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pdfConfig, setPdfConfig] = useState<PdfConfig | null>(null);
  const pageSize = 25;
  const scope = useReportingScope();
  const reports = usePurchasesReports();

  const load = useCallback(async (range: { from: string; to: string }) => {
    if (!scope.tenantId) return;
    await reports.loadReports({ tenantId: scope.tenantId, branchId: scope.branchId || undefined, dateFrom: range.from, dateTo: range.to, status: status || undefined });
    setPage(1);
  }, [reports.loadReports, scope.branchId, scope.tenantId, status]);

  useEffect(() => {
    if (!scope.canViewReports || !scope.tenantId) return;
    void load(initialRange);
  }, [initialRange, load, scope.canViewReports, scope.tenantId]);

  const columns = useMemo<DataTableColumn<PurchasesListRow>[]>(() => [
    { key: "date", header: "Fecha", render: (row) => <div><p className="font-medium">{formatDateTime(row.date)}</p><p className="text-xs text-slate-500">{row.branchName ?? "Sucursal"}</p></div> },
    { key: "supplier", header: "Proveedor", render: (row) => <div><p className="font-medium">{row.supplierName}</p><p className="text-xs text-slate-500">Compra #{row.purchaseId.slice(0, 8)}</p></div> },
    { key: "total", header: "Total", render: (row) => <div><p className="font-medium">{formatCurrency(row.total)}</p>{row.status === "CERRADA_PARCIAL" ? <p className="text-xs text-slate-500">Pedido: {formatCurrency(row.totalPedido ?? row.total)}</p> : null}</div> },
    { key: "difference", header: "No recibido", render: (row) => formatCurrency(row.diferenciaNoRecibida ?? 0) },
    { key: "paid", header: "Pagado", render: (row) => formatCurrency(row.paid) },
    { key: "balance", header: "Saldo", render: (row) => formatCurrency(row.balance) },
    { key: "status", header: "Estado", render: (row) => <div><ReportStatusBadge value={row.status} /><p className="text-sm">{row.paymentStatus}</p></div> },
    { key: "actions", header: "Acciones", cellClassName: "min-w-[200px]", render: (row) => <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setPdfConfig({ title: `Ticket de compra ${row.purchaseId.slice(0, 8)}`, fileName: `ticket-compra-${row.purchaseId}.pdf`, getPdf: () => getPurchaseTicket(row.purchaseId) })}><Eye className="h-4 w-4" /> Ver ticket</Button><Button variant="ghost" size="sm" onClick={async () => downloadBlob(await getPurchaseTicket(row.purchaseId), `ticket-compra-${row.purchaseId}.pdf`)}><Download className="h-4 w-4" /> Descargar</Button></div> },
  ], []);

  const filters = useMemo<ReportFilterDefinition[]>(() => createReportScopeFilters({ dateRange, initialRange, setDateRange, showTenantSelector: scope.showTenantSelector, showBranchSelector: scope.showBranchSelector, tenantId: scope.tenantId, branchId: scope.branchId, setTenantId: scope.setTenantId, setBranchId: scope.setBranchId, tenantOptions: scope.tenantOptions, branchOptions: scope.branchOptions, loadingTenants: scope.loadingTenants, loadingBranches: scope.loadingBranches, tenantLabel: scope.resolvedTenantLabel, branchLabel: scope.resolvedBranchLabel, extra: [{ key: "status", label: "Estado", priority: "secondary", active: Boolean(status), activeLabel: status || "Todos", render: () => <Select label="Estado" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="PENDING">PENDING</option><option value="PARTIAL">PARTIAL</option><option value="RECEIVED">RECEIVED</option><option value="CERRADA_PARCIAL">CERRADA_PARCIAL</option><option value="CANCELLED">CANCELLED</option></Select>, clear: () => setStatus("") }] }), [dateRange, initialRange, scope, status]);

  const exportReport = () => {
    const dataset = reports.dataset;
    if (!dataset) return;
    downloadReportWorkbook({ fileName: `reporte-compras-${scope.tenantId}-${dateRange.from}-${dateRange.to}.xls`, summaryTitle: "Reporte de compras", detailTitle: "Detalle de compras", filters: [{ label: "Tenant", value: scope.resolvedTenantLabel }, { label: "Sucursal", value: scope.resolvedBranchLabel }, { label: "Desde", value: dateRange.from }, { label: "Hasta", value: dateRange.to }, { label: "Estado", value: status || "Todos" }], summary: [{ label: "Compras", value: dataset.summary.count }, { label: "Total", value: dataset.summary.total }, { label: "Diferencia no recibida", value: dataset.summary.totalNoRecibido ?? 0 }, { label: "Pagado", value: dataset.summary.paid }, { label: "Saldo", value: dataset.summary.balance }], columns: ["Fecha", "Sucursal", "Proveedor", "Compra ID", "Total", "Total pedido", "Total liquidado", "Diferencia no recibida", "Pagado", "Saldo", "Estado", "Estado pago"], rows: dataset.rows.map((row) => [formatDateTime(row.date), row.branchName ?? "", row.supplierName, row.purchaseId, row.total, row.totalPedido ?? row.total, row.totalLiquidado ?? row.total, row.diferenciaNoRecibida ?? 0, row.paid, row.balance, row.status, row.paymentStatus]) });
  };

  if (!scope.canViewReports) return <FinanceAccessNotice description="No cuentas con permisos para consultar la reportería de compras." />;

  return (
    <ReportLayout title="Compras y tickets de proveedor" description="Consulta compras por fecha, estado y alcance operativo.">
      <div className="space-y-3">
        <ReportFilters filters={filters} actions={<><Button size="sm" onClick={() => void load(dateRange)} isLoading={reports.loading} disabled={!dateRange.from || !dateRange.to}>Buscar</Button><Button variant="outline" size="sm" disabled={!reports.dataset?.rows.length} onClick={exportReport}><Download className="h-4 w-4" /> Descargar reporte</Button></>} />
        <ReportSummary items={[{ label: "Compras", value: reports.dataset ? reports.dataset.summary.count : reports.searched ? 0 : "--" }, { label: "Total", value: reports.dataset ? formatCurrency(reports.dataset.summary.total) : reports.searched ? "$ 0" : "--" }, { label: "Pagado", value: reports.dataset ? formatCurrency(reports.dataset.summary.paid) : reports.searched ? "$ 0" : "--" }, { label: "Saldo", value: reports.dataset ? formatCurrency(reports.dataset.summary.balance) : reports.searched ? "$ 0" : "--" }]} />
        <DataTable columns={columns} rows={reports.dataset?.rows.slice((page - 1) * pageSize, page * pageSize) ?? []} getRowKey={(row) => row.purchaseId} loading={reports.loading} error={reports.error} emptyState={reports.searched ? "No hay compras para los filtros seleccionados." : "Usa los filtros y ejecuta la búsqueda para cargar el reporte."} />
        {reports.dataset ? <Pagination page={page} pageSize={pageSize} totalItems={reports.dataset.rows.length} onPageChange={setPage} /> : null}
      </div>
      {pdfConfig ? <PdfPreviewModal isOpen title={pdfConfig.title} fileName={pdfConfig.fileName} getPdf={pdfConfig.getPdf} onClose={() => setPdfConfig(null)} /> : null}
    </ReportLayout>
  );
};

export default PurchasesReportsPage;
