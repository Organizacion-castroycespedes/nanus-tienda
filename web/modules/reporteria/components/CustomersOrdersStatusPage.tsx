"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Input } from "../../../components/design-system/Input";
import { Pagination } from "../../../components/design-system/Pagination";
import { ReportFilters } from "../../../components/design-system/ReportFilters";
import { ReportLayout } from "../../../components/design-system/ReportLayout";
import { ReportSummary } from "../../../components/design-system/ReportSummary";
import { FinanceAccessNotice } from "../../finance/components/FinanceAccessNotice";
import { useCustomersOrdersStatus } from "../hooks/use-customers-orders-status";
import { useReportingScope } from "../hooks/use-reporting-scope";
import type { CustomerOrdersStatusRow } from "../types";
import { downloadReportWorkbook, formatCurrency } from "../utils";
import { createReportScopeFilters } from "./report-scope-filters";

const CustomersOrdersStatusPage = () => {
  const [customerDocument, setCustomerDocument] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const scope = useReportingScope();
  const reports = useCustomersOrdersStatus();

  const load = useCallback(async (customerFilters: { customerDocument?: string; customerName?: string }) => {
    if (!scope.tenantId) return;
    await reports.loadReports({ tenantId: scope.tenantId, branchId: scope.branchId || undefined, ...customerFilters });
    setPage(1);
  }, [reports.loadReports, scope.branchId, scope.tenantId]);

  useEffect(() => {
    if (!scope.canViewReports || !scope.tenantId) return;
    void load({});
  }, [load, scope.canViewReports, scope.tenantId]);

  const columns = useMemo<DataTableColumn<CustomerOrdersStatusRow>[]>(() => [
    { key: "customer", header: "Cliente", render: (row) => <div><p className="font-medium">{row.customerName}</p><p className="text-xs text-slate-500">Cliente #{row.customerId.slice(0, 8)}</p></div> },
    { key: "totalOrders", header: "Total pedidos", render: (row) => row.totalOrders },
    { key: "pendingOrders", header: "Pendientes", render: (row) => row.pendingOrders },
    { key: "partialOrders", header: "Parciales", render: (row) => row.partialOrders },
    { key: "completedOrders", header: "Completados", render: (row) => row.completedOrders },
    { key: "totalAmount", header: "Monto total", render: (row) => formatCurrency(row.totalAmount) },
    { key: "totalPending", header: "Saldo pendiente", render: (row) => formatCurrency(row.totalPending) },
  ], []);

  const filters = useMemo(() => createReportScopeFilters({ dateRange: { from: "", to: "" }, initialRange: { from: "", to: "" }, setDateRange: () => undefined, showTenantSelector: scope.showTenantSelector, showBranchSelector: scope.showBranchSelector, tenantId: scope.tenantId, branchId: scope.branchId, setTenantId: scope.setTenantId, setBranchId: scope.setBranchId, tenantOptions: scope.tenantOptions, branchOptions: scope.branchOptions, loadingTenants: scope.loadingTenants, loadingBranches: scope.loadingBranches, tenantLabel: scope.resolvedTenantLabel, branchLabel: scope.resolvedBranchLabel, extra: [{ key: "customerDocument", label: "Documento", priority: "secondary", active: Boolean(customerDocument), activeLabel: customerDocument, render: () => <Input label="Documento" placeholder="Buscar por documento" value={customerDocument} onChange={(event) => setCustomerDocument(event.target.value)} />, clear: () => setCustomerDocument("") }, { key: "customerName", label: "Nombre", priority: "secondary", active: Boolean(customerName), activeLabel: customerName, render: () => <Input label="Nombre" placeholder="Buscar por nombre" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />, clear: () => setCustomerName("") }] }).filter((filter) => filter.key !== "date"), [customerDocument, customerName, scope]);

  const exportReport = () => {
    const dataset = reports.dataset;
    if (!dataset) return;
    downloadReportWorkbook({ fileName: `reporte-clientes-pedidos-${scope.tenantId}.xls`, summaryTitle: "Clientes con pedidos por estado", detailTitle: "Detalle por cliente", filters: [{ label: "Tenant", value: scope.resolvedTenantLabel }, { label: "Sucursal", value: scope.resolvedBranchLabel }, { label: "Documento", value: customerDocument || "-" }, { label: "Nombre", value: customerName || "-" }], summary: [{ label: "Clientes", value: dataset.summary.count }, { label: "Pedidos", value: dataset.summary.totalOrders }, { label: "Pendientes", value: dataset.summary.pendingOrders }, { label: "Parciales", value: dataset.summary.partialOrders }, { label: "Completados", value: dataset.summary.completedOrders }, { label: "Monto total", value: dataset.summary.totalAmount }, { label: "Saldo pendiente", value: dataset.summary.totalPending }], columns: ["Cliente", "Cliente ID", "Total pedidos", "Pendientes", "Parciales", "Completados", "Monto total", "Saldo pendiente"], rows: dataset.rows.map((row) => [row.customerName, row.customerId, row.totalOrders, row.pendingOrders, row.partialOrders, row.completedOrders, row.totalAmount, row.totalPending]) });
  };

  if (!scope.canViewReports) return <FinanceAccessNotice description="No cuentas con permisos para consultar clientes con pedidos." />;

  return (
    <ReportLayout title="Clientes con pedidos por estado" description="Agrupa pedidos por cliente para identificar estados y saldo pendiente.">
      <div className="space-y-3">
        <ReportFilters filters={filters} actions={<><Button size="sm" onClick={() => void load({ customerDocument: customerDocument || undefined, customerName: customerName || undefined })} isLoading={reports.loading}>Buscar</Button><Button variant="outline" size="sm" disabled={!reports.dataset?.rows.length} onClick={exportReport}><Download className="h-4 w-4" /> Descargar reporte</Button></>} />
        <ReportSummary items={[{ label: "Clientes", value: reports.dataset ? reports.dataset.summary.count : reports.searched ? 0 : "--" }, { label: "Pedidos", value: reports.dataset ? reports.dataset.summary.totalOrders : reports.searched ? 0 : "--" }, { label: "Monto total", value: reports.dataset ? formatCurrency(reports.dataset.summary.totalAmount) : reports.searched ? "$ 0" : "--" }, { label: "Pendiente", value: reports.dataset ? formatCurrency(reports.dataset.summary.totalPending) : reports.searched ? "$ 0" : "--" }]} />
        <DataTable columns={columns} rows={reports.dataset?.rows.slice((page - 1) * pageSize, page * pageSize) ?? []} getRowKey={(row) => row.customerId} loading={reports.loading} error={reports.error} emptyState={reports.searched ? "No hay clientes con pedidos para los filtros seleccionados." : "Usa los filtros y ejecuta la búsqueda para cargar el reporte."} />
        {reports.dataset ? <Pagination page={page} pageSize={pageSize} totalItems={reports.dataset.rows.length} onPageChange={setPage} /> : null}
      </div>
    </ReportLayout>
  );
};

export default CustomersOrdersStatusPage;
