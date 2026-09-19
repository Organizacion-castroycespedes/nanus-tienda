"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listBranches } from "../../../domains/branches/api";
import { listTenants } from "../../../domains/tenants/api";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { Select } from "../../../components/design-system/Select";
import { getUnits, type UnitResponse } from "../../inventory/services/unit.service";
import { listInventoryLocations, type InventoryLocationResponse } from "../../inventory/services/inventory-location.service";
import type { ProductCategoryResponse, ProductSubcategoryResponse } from "../../inventory/services/product-classification.service";
import { downloadBlob, getApiErrorMessage } from "../utils";
import { createProductInventoryReport, reportBase64ToBlob,
  type ProductInventoryReportFilters, type ProductInventoryReportPackage } from "../services/product-inventory-report.service";
import { PdfPreviewModal } from "./PdfPreviewModal";

type Props = {
  defaultTenantId: string;
  role: string;
  categories: ProductCategoryResponse[];
  subcategories: ProductSubcategoryResponse[];
  onClose: () => void;
};

const choices = {
  preset: [["GENERAL", "Inventario general"], ["PHYSICAL_COUNT", "Conteo fisico"],
    ["LOTS_EXPIRATIONS", "Lotes y vencimientos"]],
  saleType: [["UNIT", "Unidad"], ["WEIGHT", "Peso"], ["BOTH", "Ambos"]],
  measurementUnit: [["UND", "UND"], ["KG", "KG"], ["LB", "LB"], ["G", "G"], ["OZ", "OZ"]],
  operationalStatus: [["ACTIVE", "Activo"], ["INACTIVE", "Inactivo"],
    ["BLOCKED", "Bloqueado"], ["DISCONTINUED", "Descontinuado"]],
  stockState: [["AVAILABLE", "Disponible"], ["LOW_STOCK", "Stock bajo"],
    ["OUT_OF_STOCK", "Sin stock"]],
  lotPresence: [["WITH", "Con lotes"], ["WITHOUT", "Sin lotes"]],
};

export const ProductInventoryReportDialog = ({
  defaultTenantId, role, categories, subcategories, onClose,
}: Props) => {
  const [filters, setFilters] = useState<ProductInventoryReportFilters>({
    tenantId: role === "SUPER_ADMIN" ? defaultTenantId : undefined,
    preset: "GENERAL",
  });
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [units, setUnits] = useState<UnitResponse[]>([]);
  const [locations, setLocations] = useState<InventoryLocationResponse[]>([]);
  const [report, setReport] = useState<ProductInventoryReportPackage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tenantId = filters.tenantId || defaultTenantId;

  useEffect(() => {
    if (role !== "SUPER_ADMIN") return;
    void listTenants().then((items) => {
      const available = items.filter((item) => item.activo)
        .map((item) => ({ id: item.id, name: item.nombre ?? item.slug }));
      setTenants(available);
      setFilters((current) => current.tenantId ? current : {
        ...current, tenantId: available[0]?.id ?? "",
      });
    }).catch(() => setError("No se pudieron cargar los tenants."));
  }, [role]);

  useEffect(() => {
    if (!tenantId) return;
    void listBranches({ tenantId }).then((items) => setBranches(items
      .filter((item) => item.estado === "ACTIVE")
      .map((item) => ({ id: item.id, name: item.nombre })))).catch(() =>
      setError("No se pudieron cargar las sucursales."));
  }, [tenantId]);

  useEffect(() => {
    if (tenantId !== defaultTenantId) return;
    void getUnits().then(setUnits).catch(() => setUnits([]));
  }, [defaultTenantId, tenantId]);

  useEffect(() => {
    if (!filters.branchId || tenantId !== defaultTenantId) {
      setLocations([]);
      return;
    }
    void listInventoryLocations({ branchId: filters.branchId }).then(setLocations)
      .catch(() => setLocations([]));
  }, [defaultTenantId, filters.branchId, tenantId]);

  const set = (key: keyof ProductInventoryReportFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value,
      ...(key !== "page" && key !== "pageSize" ? { page: "1" } : {}),
      ...(key === "tenantId" ? { branchId: "", categoryId: "", subcategoryId: "", unitId: "", locationId: "" } : {}),
      ...(key === "branchId" ? { locationId: "" } : {}),
      ...(key === "categoryId" ? { subcategoryId: "" } : {}),
    }));
    setError(null);
  };

  const select = (key: keyof typeof choices, label: string) => (
    <Select label={label} value={filters[key] ?? ""} onChange={(event) => set(key, event.target.value)}>
      {key === "preset" ? null : <option value="">Todos</option>}
      {choices[key].map(([value, name]) => <option key={value} value={value}>{name}</option>)}
    </Select>
  );

  const availableCategories = useMemo(() => categories.filter((item) => item.tenantId === tenantId), [categories, tenantId]);
  const availableSubcategories = useMemo(() => subcategories.filter((item) =>
    item.tenantId === tenantId && (!filters.categoryId || item.categoryId === filters.categoryId)),
  [filters.categoryId, subcategories, tenantId]);

  const openPreview = async (requestedPage?: number) => {
    setBusy(true);
    setError(null);
    try {
      const clean = Object.fromEntries(Object.entries({ ...filters, page: String(requestedPage ?? filters.page ?? "1"), pageSize: filters.pageSize ?? "100" }).filter(([, value]) => Boolean(value)));
      setReport(await createProductInventoryReport(clean, "preview"));
    } catch (caught) {
      setError(getApiErrorMessage(caught, "No se pudo generar el reporte."));
    } finally {
      setBusy(false);
    }
  };

  const getPdf = useCallback(async () => reportBase64ToBlob(report!.pdfBase64, "application/pdf"), [report]);
  const exportReport = async (format: "pdf" | "xlsx") => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value)));
    const full = await createProductInventoryReport(clean, "export");
    const base64 = format === "pdf" ? full.pdfBase64 : full.xlsxBase64;
    if (!base64) return;
    downloadBlob(reportBase64ToBlob(base64, format === "pdf" ? "application/pdf" :
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    format === "pdf" ? "productos-inventario.pdf" : "productos-inventario.xlsx");
  };
  const changePage = (page: number) => {
    if (!report || page < 1 || page > report.dataset.pagination.totalPages) return;
    setFilters((current) => ({ ...current, page: String(page) }));
    void openPreview(page);
  };

  return report ? (
    <PdfPreviewModal isOpen title="Productos e inventario" description={`${report.dataset.branding.name} - ${report.dataset.rows.length} filas de detalle`}
      fileName="productos-inventario.pdf" onClose={onClose} getPdf={getPdf}
      onDownloadExcel={() => void exportReport("xlsx")} onDownloadPdf={() => void exportReport("pdf")} allowPrint
      pagination={{ ...report.dataset.pagination, onPageChange: changePage }} />
  ) : (
    <Modal title="Reporte de productos e inventario" size="xl" responsive onClose={onClose}
      description="Configure filtros y revise la vista previa antes de descargar o imprimir."
      footer={<><Button variant="ghost" onClick={onClose}>Cerrar</Button>
        <Button onClick={() => void openPreview()} isLoading={busy}>Generar vista previa</Button></>}>
      {error ? <p role="alert" className="mb-3 text-sm text-rose-600">{error}</p> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {role === "SUPER_ADMIN" ? <Select label="Tenant" value={tenantId}
          onChange={(event) => set("tenantId", event.target.value)}>
          {tenants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select> : null}
        <Select label="Sucursal" value={filters.branchId ?? ""}
          onChange={(event) => set("branchId", event.target.value)}>
          <option value="">Todas las autorizadas</option>
          {branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
        {select("preset", "Presentacion")}
        <Input label="Producto / nombre" value={filters.search ?? ""} onChange={(event) => set("search", event.target.value)} />
        <Input label="SKU" value={filters.sku ?? ""} onChange={(event) => set("sku", event.target.value)} />
        <Input label="Codigo de barras" value={filters.code ?? ""} onChange={(event) => set("code", event.target.value)} />
        <Select label="Categoria" value={filters.categoryId ?? ""} onChange={(event) => set("categoryId", event.target.value)}>
          <option value="">Todas</option>
          {availableCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
        <Select label="Subcategoria" value={filters.subcategoryId ?? ""} onChange={(event) => set("subcategoryId", event.target.value)}>
          <option value="">Todas</option>
          {availableSubcategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
        <Select label="Unidad" value={filters.unitId ?? ""} onChange={(event) => set("unitId", event.target.value)}>
          <option value="">Todas</option>
          {units.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.abbreviation})</option>)}
        </Select>
        {select("saleType", "Tipo de venta")}
        {select("measurementUnit", "Unidad de medida")}
        {select("operationalStatus", "Estado operativo")}
        {select("stockState", "Estado de stock")}
        <Input label="Stock desde" type="number" step="0.01" value={filters.minStock ?? ""} onChange={(event) => set("minStock", event.target.value)} />
        <Input label="Stock hasta" type="number" step="0.01" value={filters.maxStock ?? ""} onChange={(event) => set("maxStock", event.target.value)} />
        {select("lotPresence", "Lotes")}
        <Input label="Codigo de lote" value={filters.lotCode ?? ""} onChange={(event) => set("lotCode", event.target.value)} />
        <Input label="Vence desde" type="date" value={filters.expirationFrom ?? ""} onChange={(event) => set("expirationFrom", event.target.value)} />
        <Input label="Vence hasta" type="date" value={filters.expirationTo ?? ""} onChange={(event) => set("expirationTo", event.target.value)} />
        <Select label="Vencimiento" value={filters.expiredOnly ?? ""} onChange={(event) => set("expiredOnly", event.target.value)}>
          <option value="">Todos</option><option value="true">Solo vencidos</option>
        </Select>
        <Select label="Ubicacion" value={filters.locationId ?? ""} onChange={(event) => set("locationId", event.target.value)}>
          <option value="">Todas</option>
          {locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </div>
      <p className="mt-4 text-xs text-slate-500">Stock general y saldos de lote son cantidades distintas. El conteo exportado no ajusta inventario.</p>
    </Modal>
  );
};
