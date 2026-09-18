import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import type { PoolClient, QueryResultRow } from "pg";
import type { ReportUser } from "../auth/report-auth.types";
import { ReportBranchScopeService } from "../auth/report-branch-scope.service";
import { DatabaseService } from "../database/database.service";
import { PdfmakeEngine } from "../pdf/pdfmake.engine";
import { buildProductInventoryLayout } from "../pdf/templates/reports/product-inventory-report.template";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRESETS = ["GENERAL", "PHYSICAL_COUNT", "LOTS_EXPIRATIONS"] as const;
const SALE_TYPES = ["UNIT", "WEIGHT", "BOTH"] as const;
const MEASUREMENT_UNITS = ["UND", "KG", "LB", "G", "OZ"] as const;
const OPERATIONS = ["ACTIVE", "INACTIVE", "BLOCKED", "DISCONTINUED"] as const;
const STOCK_STATES = ["AVAILABLE", "LOW_STOCK", "OUT_OF_STOCK"] as const;
const LOT_PRESENCE = ["WITH", "WITHOUT"] as const;
export const PREVIEW_PAGE_SIZE = 100;
export const MAX_PREVIEW_PAGE_SIZE = 500;
export const EXPORT_BATCH_SIZE = 1000;
export const MAX_EXPORT_ROWS = 100000;

export type ProductInventoryQuery = Record<string, string | undefined>;
export type ProductInventoryPagination = {
  page: number; pageSize: number; totalRows: number; totalPages: number;
};
type ReportQueryClient = Pick<PoolClient, "query">;

export type ProductInventoryRow = {
  productId: string; productName: string; sku: string;
  categoryId: string | null; categoryName: string | null;
  subcategoryId: string | null; subcategoryName: string | null;
  unitId: string; unitName: string; unitAbbreviation: string;
  saleType: string; measurementUnit: string; operationalStatus: string;
  branchId: string; branchName: string; price: number; catalogCost: number;
  stock: number; minStock: number | null; maxStock: number | null; stockState: string;
  primaryCode: string | null; assignedCodes: string[];
  requiresLot: boolean; requiresExpiration: boolean;
  lotId: string | null; lotCode: string | null; lotStatus: string | null;
  lotUnitCost: number | null; expirationDate: string | null;
  daysToExpiration: number | null; quantityOnHand: number | null;
  quantityReserved: number | null; quantityAvailable: number | null;
  locationId: string | null; locationCode: string | null; locationName: string | null;
};

type ProductInventoryDbRow = QueryResultRow & {
  product_id: string; product_name: string; sku: string;
  category_id: string | null; category_name: string | null;
  subcategory_id: string | null; subcategory_name: string | null;
  unit_id: string; unit_name: string; unit_abbreviation: string;
  sale_type: string; measurement_unit: string; operational_status: string;
  branch_id: string; branch_name: string; price: string; catalog_cost: string;
  stock: string; min_stock: string | null; max_stock: string | null;
  stock_state: string; primary_code: string | null; assigned_codes: string[];
  requires_lot: boolean; requires_expiration: boolean;
  lot_id: string | null; lot_code: string | null; lot_status: string | null;
  lot_unit_cost: string | null; expiration_date: Date | string | null;
  days_to_expiration: number | null; quantity_on_hand: string | null;
  quantity_reserved: string | null; quantity_available: string | null;
  location_id: string | null; location_code: string | null; location_name: string | null;
  total_rows: string | number;
};

export type ProductInventoryDataset = {
  preset: (typeof PRESETS)[number];
  generatedAt: string;
  generatedBy: string;
  tenantId: string;
  branchIds: string[];
  branding: {
    name: string; legalName: string | null; nit: string | null;
    address: string | null; phone: string | null;
    logo: string | null; primaryColor: string | null;
  };
  filters: Record<string, string>;
  rows: ProductInventoryRow[];
  pagination: ProductInventoryPagination;
};

const allowedKeys = new Set([
  "tenantId", "branchId", "preset", "search", "sku", "code", "categoryId",
  "subcategoryId", "unitId", "saleType", "measurementUnit",
  "operationalStatus", "stockState", "minStock", "maxStock", "lotCode",
  "lotPresence", "expirationFrom", "expirationTo", "expiredOnly", "locationId",
  "page", "pageSize",
]);

const parseFilters = (query: ProductInventoryQuery) => {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    throw new BadRequestException("Invalid report filters");
  }
  for (const [key, value] of Object.entries(query)) {
    if (!allowedKeys.has(key) || (value !== undefined && typeof value !== "string")) {
      throw new BadRequestException(`Invalid report filter: ${key}`);
    }
  }
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value?.trim()) {
      if (value.length > 150) throw new BadRequestException(`Filter too long: ${key}`);
      filters[key] = value.trim();
    }
  }
  for (const key of ["tenantId", "branchId", "categoryId", "subcategoryId", "unitId", "locationId"]) {
    if (filters[key] && !UUID.test(filters[key])) throw new BadRequestException(`Invalid UUID: ${key}`);
  }
  for (const [key, values] of [
    ["preset", PRESETS], ["saleType", SALE_TYPES], ["measurementUnit", MEASUREMENT_UNITS],
    ["operationalStatus", OPERATIONS], ["stockState", STOCK_STATES],
    ["lotPresence", LOT_PRESENCE],
  ] as const) {
    if (filters[key] && !(values as readonly string[]).includes(filters[key])) {
      throw new BadRequestException(`Invalid enum: ${key}`);
    }
  }
  for (const key of ["expirationFrom", "expirationTo"]) {
    const date = filters[key] ? new Date(`${filters[key]}T00:00:00Z`) : null;
    if (filters[key] && (!ISO_DATE.test(filters[key]) || !date ||
      Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== filters[key])) {
      throw new BadRequestException(`Invalid date: ${key}`);
    }
  }
  if (filters.expirationFrom && filters.expirationTo && filters.expirationFrom > filters.expirationTo) {
    throw new BadRequestException("Invalid expiration range");
  }
  for (const key of ["minStock", "maxStock"]) {
    if (filters[key] && (!/^-?\d+(\.\d{1,2})?$/.test(filters[key]) || !Number.isFinite(Number(filters[key])))) {
      throw new BadRequestException(`Invalid number: ${key}`);
    }
  }
  if (filters.minStock && filters.maxStock && Number(filters.minStock) > Number(filters.maxStock)) {
    throw new BadRequestException("Invalid stock range");
  }
  if (filters.expiredOnly && !["true", "false"].includes(filters.expiredOnly)) {
    throw new BadRequestException("Invalid expiredOnly");
  }
  const page = filters.page ? Number(filters.page) : 1;
  const pageSize = filters.pageSize ? Number(filters.pageSize) : PREVIEW_PAGE_SIZE;
  if (!Number.isInteger(page) || page < 1) throw new BadRequestException("Invalid page");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PREVIEW_PAGE_SIZE) {
    throw new BadRequestException(`Invalid pageSize; maximum is ${MAX_PREVIEW_PAGE_SIZE}`);
  }
  return filters;
};

const numberOrNull = (value: string | number | null) => value === null ? null : Number(value);
const dateOrNull = (value: Date | string | null) => value === null ? null :
  (value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10));

const mapRow = (row: ProductInventoryDbRow): ProductInventoryRow => ({
  productId: row.product_id, productName: row.product_name, sku: row.sku,
  categoryId: row.category_id, categoryName: row.category_name,
  subcategoryId: row.subcategory_id, subcategoryName: row.subcategory_name,
  unitId: row.unit_id, unitName: row.unit_name, unitAbbreviation: row.unit_abbreviation,
  saleType: row.sale_type, measurementUnit: row.measurement_unit,
  operationalStatus: row.operational_status, branchId: row.branch_id,
  branchName: row.branch_name, price: Number(row.price), catalogCost: Number(row.catalog_cost),
  stock: Number(row.stock), minStock: numberOrNull(row.min_stock),
  maxStock: numberOrNull(row.max_stock), stockState: row.stock_state,
  primaryCode: row.primary_code, assignedCodes: row.assigned_codes ?? [],
  requiresLot: row.requires_lot, requiresExpiration: row.requires_expiration,
  lotId: row.lot_id, lotCode: row.lot_code, lotStatus: row.lot_status,
  lotUnitCost: numberOrNull(row.lot_unit_cost), expirationDate: dateOrNull(row.expiration_date),
  daysToExpiration: row.days_to_expiration, quantityOnHand: numberOrNull(row.quantity_on_hand),
  quantityReserved: numberOrNull(row.quantity_reserved),
  quantityAvailable: numberOrNull(row.quantity_available),
  locationId: row.location_id, locationCode: row.location_code, locationName: row.location_name,
});

@Injectable()
export class ProductInventoryReportsService {
  constructor(
    @Inject(ReportBranchScopeService) private readonly branchScope: ReportBranchScopeService,
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(PdfmakeEngine) private readonly pdf: PdfmakeEngine
  ) {}

  async getDataset(query: ProductInventoryQuery, user?: ReportUser, options?: { exportBatch?: boolean; client?: ReportQueryClient }): Promise<ProductInventoryDataset> {
    const filters = parseFilters(query);
    const page = Number(filters.page ?? 1);
    const pageSize = options?.exportBatch ? EXPORT_BATCH_SIZE : Number(filters.pageSize ?? PREVIEW_PAGE_SIZE);
    const offset = (page - 1) * pageSize;
    const scope = await this.branchScope.resolve(user, filters.branchId, filters.tenantId);
    // One function call owns every operational field. Reject truncation instead of
    // silently exporting a partial inventory.
    const runQuery = <T extends QueryResultRow>(text: string, params: unknown[]) =>
      options?.client ? options.client.query<T>(text, params) : this.db.query<T>(text, params);
    const result = await runQuery<ProductInventoryDbRow>(
      `SELECT * FROM public.fnc_report_product_inventory(
        $1::uuid, $2::uuid[], $3::text, $4::text, $5::text, $6::text,
        $7::uuid, $8::uuid, $9::uuid, $10::text, $11::text,
        $12::text, $13::text, $14::numeric, $15::numeric,
        $16::text, $17::text, $18::date, $19::date, $20::boolean,
        $21::uuid, $22::integer, $23::integer)`,
      [scope.tenantId, scope.branchIds, filters.preset ?? "GENERAL", filters.search ?? null,
        filters.sku ?? null, filters.code ?? null, filters.categoryId ?? null,
        filters.subcategoryId ?? null, filters.unitId ?? null, filters.saleType ?? null,
        filters.measurementUnit ?? null, filters.operationalStatus ?? null,
        filters.stockState ?? null, filters.minStock ?? null, filters.maxStock ?? null,
        filters.lotCode ?? null, filters.lotPresence ?? null, filters.expirationFrom ?? null,
        filters.expirationTo ?? null, filters.expiredOnly === "true",
        filters.locationId ?? null, pageSize, offset]
    );
    const totalRows = result.rows.length ? Number(result.rows[0].total_rows ?? result.rows.length) : 0;
    if (!Number.isSafeInteger(totalRows) || totalRows > MAX_EXPORT_ROWS) {
      throw new BadRequestException(`Report exceeds ${MAX_EXPORT_ROWS} rows; narrow filters`);
    }

    const branding = await runQuery<{
      name: string; legal_name: string | null; nit: string | null;
      address: string | null; phone: string | null;
      config: { logo?: string; logoUrl?: string; colors?: { primary?: string } } | null;
    }>(
      `SELECT t.nombre AS name, td.razon_social AS legal_name, td.nit,
        td.direccion_principal AS address, td.telefono AS phone, t.config
       FROM public.tenants AS t
       LEFT JOIN public.tenants_detalles AS td ON td.tenant_id = t.id
       WHERE t.id = $1 AND t.activo = TRUE`,
      [scope.tenantId]
    );
    const company = branding.rows[0];
    const preset = (filters.preset ?? "GENERAL") as ProductInventoryDataset["preset"];
    const mapped = result.rows.map(mapRow);
    const rows = preset === "LOTS_EXPIRATIONS" ? mapped.filter((row) => row.lotId !== null) : mapped;
    return {
      preset,
      generatedAt: new Date().toISOString(), generatedBy: user?.email ?? user?.id ?? "",
      tenantId: scope.tenantId, branchIds: scope.branchIds,
      branding: {
        name: company?.name ?? "Manus POS", legalName: company?.legal_name ?? null,
        nit: company?.nit ?? null, address: company?.address ?? null,
        phone: company?.phone ?? null,
        logo: company?.config?.logo ?? company?.config?.logoUrl ?? null,
        primaryColor: company?.config?.colors?.primary ?? null,
      },
      filters, rows,
      pagination: { page, pageSize, totalRows, totalPages: Math.ceil(totalRows / pageSize) },
    };
  }

  async createPreviewPackage(query: ProductInventoryQuery, user?: ReportUser) {
    const dataset = await this.getDataset(query, user);
    const pdf = await this.pdf.generatePdf(buildProductInventoryLayout(dataset));
    return { dataset, pdfBase64: pdf.toString("base64") };
  }

  async createPackage(query: ProductInventoryQuery, user?: ReportUser) {
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const preview = await this.getDataset({ ...query, page: "1", pageSize: String(MAX_PREVIEW_PAGE_SIZE) }, user, { exportBatch: true, client });
      const datasets = [preview];
      for (let page = 2; page <= preview.pagination.totalPages; page += 1) {
        // Keep the public validation bound; exportBatch selects the internal 1000-row transport size.
        datasets.push(await this.getDataset({ ...query, page: String(page), pageSize: String(MAX_PREVIEW_PAGE_SIZE) }, user, { exportBatch: true, client }));
      }
      const dataset = { ...preview, rows: datasets.flatMap((item) => item.rows) };
      if (dataset.rows.length !== dataset.pagination.totalRows) {
        throw new BadRequestException("Report pagination changed while exporting; retry with narrower filters");
      }
      const [pdf, xlsx] = await Promise.all([
        this.pdf.generatePdf(buildProductInventoryLayout(dataset)),
        this.buildExcel(dataset),
      ]);
      await client.query("COMMIT");
      return {
        dataset,
        pdfBase64: pdf.toString("base64"),
        xlsxBase64: xlsx.toString("base64"),
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async buildExcel(dataset: ProductInventoryDataset): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const summary = workbook.addWorksheet("Resumen");
    summary.addRows([
      [dataset.branding.name], [dataset.branding.legalName ?? ""],
      ["NIT", dataset.branding.nit ?? ""], ["Reporte", dataset.preset],
      ["Generado", new Date(dataset.generatedAt)], ["Usuario", dataset.generatedBy],
      ["Sucursales autorizadas", dataset.branchIds.length],
      ["Filas de detalle", dataset.rows.length],
    ]);
    for (const [key, value] of Object.entries(dataset.filters)) summary.addRow([key, value]);
    summary.getColumn(1).width = 28;
    summary.getColumn(2).width = 45;
    const sheet = workbook.addWorksheet("Productos Inventario", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.columns = [
      ["Producto", "productName", 35], ["SKU", "sku", 19],
      ["Categoria", "categoryName", 22], ["Subcategoria", "subcategoryName", 22],
      ["Unidad", "unitAbbreviation", 12], ["Sucursal", "branchName", 24],
      ["Cod. principal", "primaryCode", 21], ["Codigos", "assignedCodes", 35],
      ["Precio", "price", 15], ["Costo catalogo", "catalogCost", 18],
      ["Stock general", "stock", 17], ["Stock minimo", "minStock", 16],
      ["Stock maximo", "maxStock", 16], ["Estado stock", "stockState", 18],
      ["Lote", "lotCode", 20], ["Estado lote", "lotStatus", 17],
      ["Costo lote", "lotUnitCost", 17], ["Vence", "expirationDate", 17],
      ["Dias para vencer", "daysToExpiration", 19],
      ["Cantidad lote", "quantityOnHand", 17], ["Reservada", "quantityReserved", 17],
      ["Disponible lote", "quantityAvailable", 19], ["Ubicacion", "locationName", 23],
      ["ID producto", "productId", 38], ["ID sucursal", "branchId", 38],
      ["Subcategoria", "subcategoryName", 23], ["Tipo venta", "saleType", 13],
      ["Unidad medida", "measurementUnit", 16], ["Estado operativo", "operationalStatus", 19],
      ["Requiere lote", "requiresLot", 16], ["Requiere vencimiento", "requiresExpiration", 22],
      ["ID lote", "lotId", 38], ["Codigo ubicacion", "locationCode", 20],
    ].map(([header, key, width]) => ({ header: String(header), key: String(key), width: Number(width) }));
    for (const row of dataset.rows) {
      sheet.addRow({ ...row, assignedCodes: row.assignedCodes.join(", "),
        expirationDate: row.expirationDate ? new Date(`${row.expirationDate}T00:00:00Z`) : null });
    }
    sheet.getColumn("expirationDate").numFmt = "yyyy-mm-dd";
    for (const key of ["price", "catalogCost", "stock", "minStock", "maxStock", "lotUnitCost",
      "quantityOnHand", "quantityReserved", "quantityAvailable"]) {
      sheet.getColumn(key).numFmt = "#,##0.00";
    }
    if (dataset.preset === "PHYSICAL_COUNT") {
      for (const [header, key] of [["Conteo fisico", "physicalCount"],
        ["Diferencia", "difference"], ["Observaciones", "observations"]]) {
        const column = sheet.columns.length + 1;
        sheet.getColumn(column).header = header;
        sheet.getColumn(column).key = key;
        sheet.getColumn(column).width = 20;
      }
    }
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    sheet.autoFilter = { from: "A1", to: sheet.getRow(1).getCell(sheet.columnCount).address };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
