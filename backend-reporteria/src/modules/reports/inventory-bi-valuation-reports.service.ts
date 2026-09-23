import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import type { QueryResultRow } from "pg";
import type { ReportUser } from "../auth/report-auth.types";
import { ReportBranchScopeService } from "../auth/report-branch-scope.service";
import { DatabaseService } from "../database/database.service";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";
import { DocumentExportService } from "./document-export.service";
import { buildInventoryValuationLayout } from "./inventory-bi-valuation-report.template";
import { formatGeneratedAt, formatPercent, stockStatusLabel } from "./inventory-bi-valuation-formatters";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STOCK_STATUSES = ["all", "in_stock", "out_of_stock", "negative"] as const;
type StockStatus = (typeof STOCK_STATUSES)[number];

export type InventoryValuationExportRequest = {
  tenantId?: unknown;
  branchId?: unknown;
  productIds?: unknown;
  categoryId?: unknown;
  stockStatus?: unknown;
  mode?: "preview" | "export";
};

export type InventoryValuationExportRow = {
  tenantId: string;
  branchId: string;
  productId: string;
  productName: string;
  sku: string | null;
  categoryId: string | null;
  categoryName: string | null;
  branchName: string;
  realStock: string;
  realUnitCost: string;
  inventoryCost: string;
  participationPercent: string | null;
  stockStatus: string;
};

export type InventoryValuationExportDataset = {
  generatedAt: string;
  generatedBy: string;
  filters: Record<string, string>;
  branding: { name: string; legalName: string | null; nit: string | null;
    address: string | null; phone: string | null; logo: string | null; primaryColor: string | null };
  summary: { totalCost: string; totalUnits: string; totalRows: number };
  rows: InventoryValuationExportRow[];
};

type DbRow = QueryResultRow & {
  tenant_id: string; branch_id: string; product_id: string; product_name: string;
  sku: string | null; category_id: string | null; category_name: string | null;
  branch_name: string; real_stock: string; real_unit_cost: string; inventory_cost: string;
  participation_percent: string | null; stock_status: string;
};

type CountRow = QueryResultRow & { total_rows: string; total_cost: string; total_units: string };
type BrandingRow = {
  name: string; legal_name: string | null; nit: string | null; address: string | null;
  phone: string | null; config: { logo?: string; logoUrl?: string; colors?: { primary?: string } } | null;
};
type ExportSummary = {
  totalCost: string;
  totalUnits: string;
  labels: { company: string; branch: string; products: string; category: string; stockStatus: string };
  branding: BrandingRow | null;
};

const assertUuid = (value: unknown, key: string) => {
  if (value !== undefined && value !== null && (typeof value !== "string" || !UUID.test(value))) {
    throw new BadRequestException(`Invalid UUID: ${key}`);
  }
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const parseRequest = (request: InventoryValuationExportRequest) => {
  const tenantId = assertUuid(request.tenantId, "tenantId");
  const branchId = assertUuid(request.branchId, "branchId");
  const categoryId = assertUuid(request.categoryId, "categoryId");
  const rawProductIds = request.productIds === undefined || request.productIds === null
    ? [] : request.productIds;
  if (!Array.isArray(rawProductIds) || rawProductIds.some((value) => typeof value !== "string" || !UUID.test(value))) {
    throw new BadRequestException("Invalid productIds");
  }
  const productIds = [...new Set(rawProductIds.map((value) => value.trim()).filter(Boolean))];
  const stockStatus = request.stockStatus === undefined || request.stockStatus === null || request.stockStatus === ""
    ? "all" : request.stockStatus;
  if (typeof stockStatus !== "string" || !STOCK_STATUSES.includes(stockStatus as StockStatus)) {
    throw new BadRequestException("Invalid stockStatus");
  }
  return { tenantId, branchId, categoryId, productIds, stockStatus: stockStatus as StockStatus };
};

const mapRow = (row: DbRow): InventoryValuationExportRow => ({
  tenantId: row.tenant_id, branchId: row.branch_id, productId: row.product_id,
  productName: row.product_name, sku: row.sku, categoryId: row.category_id,
  categoryName: row.category_name, branchName: row.branch_name,
  realStock: String(row.real_stock), realUnitCost: String(row.real_unit_cost),
  inventoryCost: String(row.inventory_cost),
  participationPercent: row.participation_percent == null ? null : String(row.participation_percent),
  stockStatus: row.stock_status,
});

const safeExcelDecimal = (value: string) => {
  const normalized = value.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
  const decimalPlaces = normalized.includes(".") ? normalized.split(".")[1].length : 0;
  const number = Number(normalized);
  return decimalPlaces <= 2 && Number.isFinite(number) && Math.abs(number) <= Number.MAX_SAFE_INTEGER
    && Number.isSafeInteger(Math.round(number * 100)) ? number : value;
};

@Injectable()
export class InventoryBiValuationReportsService {
  constructor(
    @Inject(ReportBranchScopeService) private readonly branchScope: ReportBranchScopeService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(DocumentExportService) private readonly documentExport: DocumentExportService,
    @Inject(PdfmakeEngine) private readonly pdf: PdfmakeEngine,
  ) {}

  async createPackage(request: InventoryValuationExportRequest, user?: ReportUser) {
    const filters = parseRequest(request);
    const scope = await this.branchScope.resolve(user, filters.branchId, filters.tenantId);
    const params = [scope.tenantId, scope.branchIds, filters.productIds.length ? filters.productIds : null,
      filters.categoryId ?? null, filters.stockStatus];
    const collected = await this.documentExport.collectWithSummary<DbRow, ExportSummary>(
      async (client) => {
        const result = await client.query<CountRow>(
          `SELECT COUNT(*)::bigint AS total_rows,
                  COALESCE(SUM(inventory_cost), 0)::numeric AS total_cost,
                  COALESCE(SUM(real_stock), 0)::numeric AS total_units
           FROM public.inventory_bi_base($1::uuid, $2::uuid[], $3::uuid[], $4::uuid, $5::text)`,
          params,
        );
        const row = result.rows[0];
        const brandingResult = await client.query<BrandingRow>(
          `SELECT t.nombre AS name, td.razon_social AS legal_name, td.nit,
                  td.direccion_principal AS address, td.telefono AS phone, t.config
           FROM tenants AS t LEFT JOIN tenants_detalles AS td ON td.tenant_id = t.id
           WHERE t.id = $1 AND t.activo = TRUE`, [scope.tenantId],
        );
        const company = brandingResult.rows[0] ?? null;
        const branchLabel = filters.branchId
          ? (await client.query<{ name: string }>(
              `SELECT nombre AS name FROM tenant_branches
               WHERE id = $1 AND tenant_id = $2 AND estado = 'ACTIVE' AND id = ANY($3::uuid[])`,
              [filters.branchId, scope.tenantId, scope.branchIds],
            )).rows[0]?.name
          : "Todas las autorizadas";
        if (filters.branchId && !branchLabel) {
          throw new BadRequestException("La sucursal aplicada no está autorizada");
        }
        const productNames = filters.productIds.length
          ? await client.query<{ id: string; name: string }>(
              `SELECT id, name FROM products
               WHERE tenant_id = $1 AND is_active = TRUE AND id = ANY($2::uuid[])
               ORDER BY name, id`, [scope.tenantId, filters.productIds],
            )
          : null;
        if (productNames && productNames.rows.length !== filters.productIds.length) {
          throw new BadRequestException("Un producto aplicado no está autorizado");
        }
        const categoryName = filters.categoryId
          ? (await client.query<{ name: string }>(
              `SELECT name FROM product_categories WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
              [scope.tenantId, filters.categoryId],
            )).rows[0]?.name
          : "Todas las categorías";
        if (filters.categoryId && !categoryName) {
          throw new BadRequestException("La categoría aplicada no está autorizada");
        }
        return { totalRows: Number(row?.total_rows ?? 0), summary: {
          totalCost: String(row?.total_cost ?? "0"), totalUnits: String(row?.total_units ?? "0"),
          labels: {
            company: company?.name ?? "Empresa autorizada",
            branch: branchLabel ?? "Sucursal autorizada",
            products: productNames ? productNames.rows.map((item) => item.name).join(", ") : "Todos los productos",
            category: categoryName ?? "Categoría autorizada",
            stockStatus: stockStatusLabel(filters.stockStatus),
          },
          branding: company,
        } };
      },
      async (client, offset, limit) => {
        const result = await client.query<DbRow>(
          `WITH base AS (
             SELECT * FROM public.inventory_bi_base($1::uuid, $2::uuid[], $3::uuid[], $4::uuid, $5::text)
           ), totals AS (
             SELECT COALESCE(SUM(inventory_cost), 0)::numeric AS total_cost FROM base
           )
           SELECT base.*, CASE WHEN totals.total_cost = 0 THEN NULL
             ELSE (base.inventory_cost / totals.total_cost * 100)::numeric END AS participation_percent
           FROM base CROSS JOIN totals
           ORDER BY base.product_name ASC, base.branch_name ASC, base.product_id ASC, base.branch_id ASC
           LIMIT $6::integer OFFSET $7::integer`,
          [...params, limit, offset],
        );
        return result.rows;
      },
    );
    const company = collected.summary.branding;
    const dataset: InventoryValuationExportDataset = {
      generatedAt: new Date().toISOString(), generatedBy: user?.email ?? user?.id ?? "",
      filters: { Empresa: collected.summary.labels.company, Sucursal: collected.summary.labels.branch,
        Productos: collected.summary.labels.products, Categoría: collected.summary.labels.category,
        "Estado de stock": collected.summary.labels.stockStatus },
      branding: { name: company?.name ?? "Manus POS", legalName: company?.legal_name ?? null,
        nit: company?.nit ?? null, address: company?.address ?? null, phone: company?.phone ?? null,
        logo: company?.config?.logo ?? company?.config?.logoUrl ?? null,
        primaryColor: company?.config?.colors?.primary ?? null },
      summary: { totalCost: collected.summary.totalCost, totalUnits: collected.summary.totalUnits, totalRows: collected.rows.length },
      rows: collected.rows.map(mapRow),
    };
    const pdf = await this.pdf.generatePdf(buildInventoryValuationLayout(dataset));
    const result: { dataset: InventoryValuationExportDataset; pdfBase64: string; xlsxBase64?: string } = {
      dataset, pdfBase64: pdf.toString("base64"),
    };
    if (request.mode === "export") result.xlsxBase64 = (await this.buildExcel(dataset)).toString("base64");
    return result;
  }

  private async buildExcel(dataset: InventoryValuationExportDataset): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const summary = workbook.addWorksheet("Resumen");
    summary.addRows([[dataset.branding.name], ["Reporte", "Valorización de Inventario"],
      ["Fecha de generación", formatGeneratedAt(dataset.generatedAt)], ["Filas de detalle", dataset.summary.totalRows],
      ["Costo total valorizado", safeExcelDecimal(dataset.summary.totalCost)],
      ["Unidades valorizadas", safeExcelDecimal(dataset.summary.totalUnits)], ["Filtros"]]);
    Object.entries(dataset.filters).forEach(([key, value]) => summary.addRow([key, value]));
    summary.getColumn(1).width = 28; summary.getColumn(2).width = 48;
    const sheet = workbook.addWorksheet("Detalle", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = ["Producto", "SKU", "Categoría", "Sucursal", "Stock actual", "Costo unitario",
      "Costo total", "Participación", "Estado"].map((header) => ({ header, width: 20 }));
    for (const row of dataset.rows) sheet.addRow([row.productName, row.sku ?? "", row.categoryName ?? "Sin categoría",
      row.branchName, safeExcelDecimal(row.realStock), safeExcelDecimal(row.realUnitCost),
      safeExcelDecimal(row.inventoryCost), row.participationPercent == null ? "" : formatPercent(row.participationPercent), stockStatusLabel(row.stockStatus)]);
    sheet.columns = ["Producto", "SKU", "Categoría", "Sucursal", "Stock actual", "Costo unitario",
      "Costo total", "Participación", "Estado"].map((header) => ({ header, width: 20 }));
    dataset.rows.forEach((row, index) => {
      if (row.categoryName === null) sheet.getCell(index + 2, 3).value = "Sin categoría";
    });
    const accent = (code: number) => String.fromCharCode(code);
    summary.getCell(2, 2).value = `Valorizaci${accent(243)}n de Inventario`;
    summary.getCell(3, 1).value = `Fecha de generaci${accent(243)}n`;
    const headers = ["Producto", "SKU", `Categor${accent(237)}a`, "Sucursal", "Stock actual", "Costo unitario",
      "Costo total", `Participaci${accent(243)}n`, "Estado"];
    headers.forEach((header, index) => { sheet.getCell(1, index + 1).value = header; });
    dataset.rows.forEach((row, index) => {
      if (row.categoryName === null) sheet.getCell(index + 2, 3).value = `Sin categor${accent(237)}a`;
    });
    for (const column of [5, 6, 7]) sheet.getColumn(column).numFmt = "#,##0.00";
    sheet.getColumn(8).numFmt = "0.00\"%\"";
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    sheet.autoFilter = { from: "A1", to: `I${Math.max(1, sheet.rowCount)}` };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
