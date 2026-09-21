"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "../../../components/design-system/Button";
import { DataTable, type DataTableColumn } from "../../../components/design-system/DataTable";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { Pagination } from "../../../components/design-system/Pagination";
import { ReportFilters, type ReportFilterDefinition } from "../../../components/design-system/ReportFilters";
import { ReportLayout } from "../../../components/design-system/ReportLayout";
import { ReportSummary } from "../../../components/design-system/ReportSummary";
import { Select } from "../../../components/design-system/Select";
import { FinanceAccessNotice } from "../../finance/components/FinanceAccessNotice";
import { getCustomerMasterReport, getCustomerMasterReportExcel, getCustomerMasterReportPdf } from "../services/reporting.service";
import { useReportingScope } from "../hooks/use-reporting-scope";
import type { CustomerMasterDataset, CustomerMasterRow } from "../types";
import { downloadBlob, downloadReportWorkbook, formatDateTime, getApiErrorMessage } from "../utils";
import { PdfPreviewModal } from "./PdfPreviewModal";
import { ReportStatusBadge } from "./ReportStatusBadge";

type PdfConfig = { title: string; fileName: string; getPdf: () => Promise<Blob>; onDownloadExcel: () => void };
const display = (value: string | null | undefined) => value?.trim() || "-";

const CustomerDetail = ({ row }: { row: CustomerMasterRow }) => (
  <div className="grid gap-4 md:grid-cols-2">
    <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <h4 className="mb-3 text-sm font-semibold">Información comercial</h4>
      <div className="grid gap-2 text-sm">
        <p><strong>Nombre:</strong> {display(row.name)}</p>
        <p><strong>Nombre comercial:</strong> {display(row.tradeName)}</p>
        <p><strong>Documento:</strong> {display(row.documentNumber)}</p>
        <p><strong>Teléfono:</strong> {display(row.phone)}</p>
        <p><strong>Correo:</strong> {display(row.email)}</p>
        <p><strong>Dirección:</strong> {display(row.address)}</p>
        <p><strong>Ciudad:</strong> {display(row.city)}</p>
        <p><strong>Departamento:</strong> {display(row.department)}</p>
        <p><strong>Estado:</strong> {row.isActive ? "Activo" : "Inactivo"}</p>
        <p><strong>Consumidor final:</strong> {row.isFinalConsumer ? "Sí" : "No"}</p>
      </div>
    </section>
    <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <h4 className="mb-3 text-sm font-semibold">Información fiscal</h4>
      <div className="grid gap-2 text-sm">
        <p><strong>Razón social:</strong> {display(row.legalName)}</p>
        <p><strong>Tipo documento:</strong> {display(row.dianIdentificationType ?? row.documentTypeCode)}</p>
        <p><strong>Número fiscal:</strong> {display(row.identificationNumber ?? row.documentNumber)}</p>
        <p><strong>DV:</strong> {display(row.verificationDigit)}</p>
        <p><strong>Tipo persona:</strong> {display(row.personType)}</p>
        <p><strong>Régimen:</strong> {display(row.taxRegime)}</p>
        <p><strong>Responsabilidades:</strong> {row.taxResponsibilities.length ? <span className="inline-flex flex-wrap gap-1">{row.taxResponsibilities.map((code) => <span key={code} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-700">{code}</span>)}</span> : "-"}</p>
        <p><strong>Estado fiscal:</strong> {display(row.fiscalStatus)}</p>
        <p><strong>Validado DIAN:</strong> {row.isDianValidated ? "Sí" : "No"}</p>
        <p><strong>Fuente fiscal:</strong> {display(row.fiscalDataSource)}</p>
        <p><strong>Correo fiscal:</strong> {display(row.fiscalEmail)}</p>
        <p><strong>Correo factura:</strong> {display(row.invoiceEmail)}</p>
        <p><strong>País:</strong> {display(row.country ?? row.countryCode)}</p>
        <p><strong>Municipio codigo:</strong> {display(row.municipalityCode)}</p>
        <p><strong>Última consulta DIAN:</strong> {row.dianLastLookupAt ? formatDateTime(row.dianLastLookupAt) : "-"}</p>
        <p><strong>Estado consulta DIAN:</strong> {display(row.dianLastLookupStatus)}</p>
      </div>
    </section>
  </div>
);

const CustomersOrdersStatusPage = () => {
  const scope = useReportingScope();
  const [customerDocument, setCustomerDocument] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [dataset, setDataset] = useState<CustomerMasterDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<CustomerMasterRow | null>(null);
  const [pdfConfig, setPdfConfig] = useState<PdfConfig | null>(null);
  const pageSize = 25;

  const load = useCallback(async (filters: { customerDocument?: string; customerName?: string } = {}) => {
    if (!scope.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getCustomerMasterReport({ tenantId: scope.tenantId, customerDocument: filters.customerDocument || undefined, customerName: filters.customerName || undefined });
      setDataset(response);
      setSearched(true);
      setPage(1);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "No se pudo cargar el maestro de clientes."));
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [scope.tenantId]);

  useEffect(() => {
    if (scope.canViewReports && scope.tenantId) void load();
  }, [load, scope.canViewReports, scope.tenantId]);

  const columns = useMemo<DataTableColumn<CustomerMasterRow>[]>(() => [
    { key: "name", header: "Cliente", render: (row) => <div><p className="font-medium">{display(row.legalName ?? row.tradeName ?? row.name)}</p><p className="text-xs text-slate-500">{display(row.name)}</p></div> },
    { key: "documentType", header: "Tipo documento", render: (row) => display(row.dianIdentificationType ?? row.documentTypeCode) },
    { key: "documentNumber", header: "Número documento", render: (row) => display(row.identificationNumber ?? row.documentNumber) },
    { key: "phone", header: "Teléfono", render: (row) => display(row.phone) },
    { key: "email", header: "Correo", render: (row) => display(row.email ?? row.fiscalEmail ?? row.invoiceEmail) },
    { key: "fiscalStatus", header: "Estado fiscal", render: (row) => <ReportStatusBadge value={row.fiscalStatus} /> },
    { key: "isActive", header: "Estado", render: (row) => row.isActive ? "Activo" : "Inactivo" },
    { key: "actions", header: "Acción", render: (row) => <Button variant="ghost" size="sm" onClick={() => setDetail(row)}><Eye className="h-4 w-4" /> Ver detalle</Button> },
  ], []);

  const filters = useMemo<ReportFilterDefinition[]>(() => [
    { key: "customerDocument", label: "Número de documento", priority: "primary", active: Boolean(customerDocument), activeLabel: customerDocument, render: () => <Input label="Número de documento" placeholder="Buscar documento" value={customerDocument} onChange={(event) => setCustomerDocument(event.target.value)} />, clear: () => setCustomerDocument("") },
    ...(scope.showTenantSelector ? [{ key: "tenant", label: "Tenant", priority: "secondary" as const, active: Boolean(scope.tenantId), activeLabel: scope.resolvedTenantLabel, render: () => <Select label="Tenant" value={scope.tenantId} onChange={(event) => scope.setTenantId(event.target.value)} disabled={scope.loadingTenants}><option value="">Selecciona un tenant</option>{scope.tenantOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>, clear: () => scope.setTenantId("") }] : []),
    { key: "customerName", label: "Nombre", priority: "secondary", active: Boolean(customerName), activeLabel: customerName, render: () => <Input label="Nombre" placeholder="Buscar por nombre" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />, clear: () => setCustomerName("") },
  ], [customerDocument, customerName, scope]);

  const activeFilters = { tenantId: scope.tenantId, customerDocument: customerDocument || undefined, customerName: customerName || undefined };
  const openReport = () => setPdfConfig({ title: "Reporte de clientes", fileName: "reporte-clientes.pdf", getPdf: () => getCustomerMasterReportPdf(activeFilters), onDownloadExcel: () => void getCustomerMasterReportExcel(activeFilters).then((blob) => downloadBlob(blob, "reporte-clientes.xlsx")) });

  const exportLegacy = () => {
    if (!dataset) return;
    downloadReportWorkbook({ fileName: `reporte-clientes-${scope.tenantId}.xls`, summaryTitle: "Maestro de clientes", detailTitle: "Clientes", filters: [{ label: "Tenant", value: scope.resolvedTenantLabel }, { label: "Documento", value: customerDocument || "-" }, { label: "Nombre", value: customerName || "-" }], summary: [{ label: "Clientes", value: dataset.summary.count }], columns: ["Cliente ID", "Nombre", "Razón social", "Tipo documento", "Número documento", "Correo", "Estado fiscal", "Estado"], rows: dataset.rows.map((row) => [row.customerId, row.name, row.legalName ?? "", row.dianIdentificationType ?? row.documentTypeCode ?? "", row.identificationNumber ?? row.documentNumber ?? "", row.email ?? "", row.fiscalStatus, row.isActive ? "Activo" : "Inactivo"]) });
  };

  if (!scope.canViewReports) return <FinanceAccessNotice description="No cuentas con permisos para consultar clientes." />;

  return (
    <ReportLayout title="Clientes" description="Información comercial y fiscal de clientes.">
      <div className="space-y-3">
        <ReportFilters filters={filters} actions={<><Button size="sm" onClick={() => void load(activeFilters)} isLoading={loading}>Buscar</Button><Button variant="outline" size="sm" onClick={openReport} disabled={!scope.tenantId}>Reporte</Button><Button variant="outline" size="sm" disabled={!dataset?.rows.length} onClick={exportLegacy}><Download className="h-4 w-4" /> Descargar reporte</Button></>} />
        <ReportSummary items={[{ label: "Clientes", value: dataset ? dataset.summary.count : searched ? 0 : "--" }]} />
        <DataTable columns={columns} rows={dataset?.rows.slice((page - 1) * pageSize, page * pageSize) ?? []} getRowKey={(row) => row.customerId} loading={loading} error={error} emptyState={searched ? "No hay clientes para los filtros seleccionados." : "Usa los filtros y ejecuta la búsqueda para cargar el maestro."} />
        {dataset ? <Pagination page={page} pageSize={pageSize} totalItems={dataset.rows.length} onPageChange={setPage} /> : null}
      </div>
      {detail ? <Modal title={display(detail.legalName ?? detail.tradeName ?? detail.name)} description="Detalle comercial y fiscal" responsive size="xl" onClose={() => setDetail(null)} footer={<Button variant="ghost" onClick={() => setDetail(null)}>Cerrar</Button>}><CustomerDetail row={detail} /></Modal> : null}
      {pdfConfig ? <PdfPreviewModal isOpen title={pdfConfig.title} fileName={pdfConfig.fileName} getPdf={pdfConfig.getPdf} onDownloadExcel={pdfConfig.onDownloadExcel} allowPrint onClose={() => setPdfConfig(null)} /> : null}
    </ReportLayout>
  );
};

export default CustomersOrdersStatusPage;
