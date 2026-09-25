import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import crypto from "node:crypto";
import ExcelJS from "exceljs";
import type { PoolClient } from "pg";
import { DatabaseService } from "../../../common/db/database.service";
import { AuditService } from "../../../common/services/audit.service";
import {
  AccessControlService,
  type AccessActor,
} from "../../../common/services/access-control.service";
import { todayInBusinessTimeZone } from "../imports/business-date";
import {
  parseXlsxSheet,
  XlsxImportParseError,
} from "../imports/xlsx-import.parser";
import {
  STOCK_IMPORT_COLUMNS,
  STOCK_IMPORT_HEADER_ALIASES,
  STOCK_IMPORT_MAX_ROWS,
  STOCK_IMPORT_PRODUCT_HEADERS,
  STOCK_IMPORT_REFERENCE_TABLE,
  STOCK_IMPORT_REQUIRED_HEADERS,
  STOCK_IMPORT_SHEET_NAME,
  STOCK_IMPORT_SHEET_NAMES,
  STOCK_IMPORT_TEMPLATE_KEYS,
  type StockImportColumnKey,
} from "./stock-import.columns";
import {
  StockImportRepository,
  type StockImportBalanceUpsert,
  type StockImportLotInsert,
  type StockImportMovementInsert,
  type StockImportMovementLotInsert,
} from "./stock-import.repository";
import {
  resolveStockImport,
  type StockImportCatalogs,
  type StockImportRawRow,
  type StockImportReport,
  type StockImportRowPlan,
} from "./stock-import.resolver";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEMPLATE_VALIDATION_ROWS = 500;

export type StockImportValidation = {
  report: StockImportReport;
  ignoredHeaders: string[];
};

export type StockImportCommitRow = {
  rowNumber: number;
  sku: string;
  productName: string;
  branchCode: string;
  lotCode: string | null;
  action: StockImportRowPlan["action"];
  skipped: boolean;
  before: number;
  after: number;
  delta: number;
  movementId: string | null;
};

export type StockImportCommitResult = {
  referenceId: string | null;
  summary: {
    total: number;
    in: number;
    out: number;
    unchanged: number;
    quantityIn: number;
    quantityOut: number;
  };
  rows: StockImportCommitRow[];
};

type BranchCatalogs = Pick<StockImportCatalogs, "branches" | "accessibleBranchIds">;

@Injectable()
export class StockImportService {
  constructor(
    @Inject(StockImportRepository)
    private readonly repository: StockImportRepository,
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(AccessControlService)
    private readonly accessControl: AccessControlService
  ) {}

  private async parse(buffer: Buffer) {
    try {
      return await parseXlsxSheet<StockImportColumnKey>(buffer, {
        sheetNames: STOCK_IMPORT_SHEET_NAMES,
        columns: STOCK_IMPORT_COLUMNS.map((column) => column.key),
        required: STOCK_IMPORT_REQUIRED_HEADERS,
        requiredAnyOf: [STOCK_IMPORT_PRODUCT_HEADERS],
        aliases: STOCK_IMPORT_HEADER_ALIASES,
        maxRows: STOCK_IMPORT_MAX_ROWS,
      });
    } catch (error) {
      if (error instanceof XlsxImportParseError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async loadBranchCatalogs(
    tenantId: string,
    actor: AccessActor
  ): Promise<BranchCatalogs> {
    const branches = await this.repository.listBranches(tenantId);
    const accessibleBranchIds = new Set<string>();
    for (const branch of branches) {
      if (await this.accessControl.canAccessBranch(actor, tenantId, branch.id)) {
        accessibleBranchIds.add(branch.id);
      }
    }
    return { branches, accessibleBranchIds };
  }

  private collectProductKeys(rows: StockImportRawRow[]) {
    const ids = new Set<string>();
    const skus = new Set<string>();
    const barcodes = new Set<string>();
    for (const row of rows) {
      const id = row.values.producto_id?.trim();
      if (id && UUID_PATTERN.test(id)) {
        ids.add(id.toLowerCase());
      }
      const sku = row.values.sku?.trim();
      if (sku) {
        skus.add(sku.toUpperCase());
      }
      const barcode = row.values.codigo_barras?.trim();
      if (barcode) {
        barcodes.add(barcode);
      }
    }
    return { ids: [...ids], skus: [...skus], barcodes: [...barcodes] };
  }

  private async loadStockCatalogs(
    tenantId: string,
    rows: StockImportRawRow[],
    branchCatalogs: BranchCatalogs,
    client?: PoolClient
  ): Promise<StockImportCatalogs> {
    const { products, barcodes } = await this.repository.findProducts(
      tenantId,
      this.collectProductKeys(rows),
      client
    );
    const productIds = products.map((product) => product.id);
    const [currentStock, lots] = await Promise.all([
      this.repository.currentStock(tenantId, productIds, client),
      this.repository.listLots(tenantId, productIds, client),
    ]);
    return { ...branchCatalogs, products, barcodes, currentStock, lots };
  }

  async validate(
    tenantId: string,
    actor: AccessActor,
    buffer: Buffer
  ): Promise<StockImportValidation> {
    const parsed = await this.parse(buffer);
    const branchCatalogs = await this.loadBranchCatalogs(tenantId, actor);
    const catalogs = await this.loadStockCatalogs(tenantId, parsed.rows, branchCatalogs);
    return {
      report: resolveStockImport(parsed.rows, catalogs, {
        today: todayInBusinessTimeZone(),
      }),
      ignoredHeaders: parsed.ignoredHeaders,
    };
  }

  async commit(
    tenantId: string,
    actor: AccessActor,
    buffer: Buffer
  ): Promise<StockImportCommitResult> {
    const parsed = await this.parse(buffer);
    const branchCatalogs = await this.loadBranchCatalogs(tenantId, actor);
    const today = todayInBusinessTimeZone();
    const preliminary = resolveStockImport(
      parsed.rows,
      await this.loadStockCatalogs(tenantId, parsed.rows, branchCatalogs),
      { today }
    );
    if (!preliminary.canCommit) {
      throw new BadRequestException({
        message: "El archivo tiene errores. Corrígelos y vuelve a prevalidar.",
        report: preliminary,
      });
    }

    const client = await this.db.getClient();
    let report: StockImportReport;
    let referenceId: string | null = null;
    const movementIds = new Map<number, string>();
    try {
      await client.query("BEGIN");
      await this.repository.lockTenant(client, tenantId);

      report = resolveStockImport(
        parsed.rows,
        await this.loadStockCatalogs(tenantId, parsed.rows, branchCatalogs, client),
        { today }
      );
      if (!report.canCommit) {
        await client.query("ROLLBACK");
        throw new BadRequestException({
          message:
            "El stock cambió mientras se procesaba la carga y ahora hay errores. Vuelve a prevalidar.",
          report,
        });
      }

      const changed = report.rows.filter((row) => row.action !== "NONE");
      if (changed.length > 0) {
        referenceId = crypto.randomUUID();
        await this.writeChanges(client, {
          tenantId,
          userId: actor.id ?? null,
          referenceId,
          rows: changed,
          movementIds,
        });
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    if (referenceId) {
      this.auditService.logEvent({
        tenantId,
        userId: actor.id ?? null,
        module: "inventory",
        entity: "stock_movements",
        entityId: referenceId,
        action: "STOCK_INITIAL_LOAD",
        after: {
          referenceTable: STOCK_IMPORT_REFERENCE_TABLE,
          referenceId,
          ...report.summary,
          movements: movementIds.size,
        },
      });
    }

    return {
      referenceId,
      summary: {
        total: report.summary.total,
        in: report.summary.in,
        out: report.summary.out,
        unchanged: report.summary.unchanged,
        quantityIn: report.summary.quantityIn,
        quantityOut: report.summary.quantityOut,
      },
      rows: report.rows.map((row) => ({
        rowNumber: row.rowNumber,
        sku: row.sku,
        productName: row.productName,
        branchCode: row.branchCode,
        lotCode: row.lot?.lotCode ?? null,
        action: row.action,
        skipped: row.skipped,
        before: row.before,
        after: row.target,
        delta: row.delta,
        movementId: movementIds.get(row.rowNumber) ?? null,
      })),
    };
  }

  private async writeChanges(
    client: PoolClient,
    input: {
      tenantId: string;
      userId: string | null;
      referenceId: string;
      rows: StockImportRowPlan[];
      movementIds: Map<number, string>;
    }
  ) {
    const now = new Date();
    const lotKey = (productId: string, branchId: string, lotCode: string) =>
      `${productId}|${branchId}|${lotCode}`;

    const newLots: StockImportLotInsert[] = input.rows
      .filter((row) => row.lot?.isNew)
      .map((row) => ({
        id: crypto.randomUUID(),
        productId: row.productId!,
        branchId: row.branchId!,
        lotCode: row.lot!.lotCode,
        expirationDate: row.lot!.expirationDate,
        unitCost: row.lot!.unitCost,
      }));
    const createdLotIds = newLots.length
      ? await this.repository.insertLots(client, {
          tenantId: input.tenantId,
          receivedAt: now,
          lots: newLots,
        })
      : new Map<string, string>();

    const movements: StockImportMovementInsert[] = [];
    const balances: StockImportBalanceUpsert[] = [];
    const links: StockImportMovementLotInsert[] = [];

    for (const row of input.rows) {
      const productId = row.productId!;
      const branchId = row.branchId!;
      const movementId = crypto.randomUUID();
      const quantity = Math.abs(row.delta);
      input.movementIds.set(row.rowNumber, movementId);
      movements.push({
        id: movementId,
        productId,
        branchId,
        type: row.action === "IN" ? "IN" : "OUT",
        quantity,
        stockBefore: row.movementStockBefore,
        stockAfter: row.movementStockAfter,
      });

      if (row.lot) {
        const lotId =
          row.lot.lotId ?? createdLotIds.get(lotKey(productId, branchId, row.lot.lotCode));
        if (!lotId) {
          throw new BadRequestException(
            `No se pudo registrar el lote ${row.lot.lotCode} de la fila ${row.rowNumber}.`
          );
        }
        const locationId = row.lot.locationId;
        balances.push({ productId, branchId, lotId, locationId, quantityOnHand: row.target });
        links.push({ stockMovementId: movementId, productId, lotId, locationId, quantity });
      }
    }

    await this.repository.insertMovements(client, {
      tenantId: input.tenantId,
      referenceId: input.referenceId,
      userId: input.userId,
      createdAt: now,
      movements,
    });
    if (balances.length > 0) {
      await this.repository.upsertLotBalances(client, {
        tenantId: input.tenantId,
        movedAt: now,
        balances,
      });
      await this.repository.insertMovementLots(client, {
        tenantId: input.tenantId,
        createdAt: now,
        links,
      });
    }
  }

  async buildTemplate(
    tenantId: string,
    actor: AccessActor,
    options: { branchId?: string; prefill?: boolean } = {}
  ): Promise<Buffer> {
    const { branches, accessibleBranchIds } = await this.loadBranchCatalogs(tenantId, actor);
    const available = branches.filter(
      (branch) => branch.isActive && accessibleBranchIds.has(branch.id)
    );
    let branch = available[0];
    if (options.branchId) {
      branch = available.find((item) => item.id === options.branchId) as typeof branch;
      if (!branch) {
        throw new ForbiddenException("No tienes acceso a la sucursal seleccionada.");
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Manus Tienda";
    workbook.created = new Date();

    const columns = STOCK_IMPORT_TEMPLATE_KEYS.map(
      (key) => STOCK_IMPORT_COLUMNS.find((column) => column.key === key)!
    );
    const sheet = workbook.addWorksheet(STOCK_IMPORT_SHEET_NAME, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.columns = columns.map((column) => ({
      header: column.key,
      key: column.key,
      width: Math.max(14, column.key.length + 4),
    }));
    sheet.getColumn("nombre").width = 40;
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    columns.forEach((column, index) => {
      const cell = header.getCell(index + 1);
      const informative = "informative" in column && column.informative;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: column.required ? "FFB91C1C" : informative ? "FF94A3B8" : "FF334155",
        },
      };
      cell.note = column.description;
    });

    if (options.prefill && branch) {
      const [products, lots] = await Promise.all([
        this.repository.listTemplateProducts(tenantId, branch.id),
        this.repository.listTemplateLots(tenantId, branch.id),
      ]);
      for (const product of products) {
        const productLots = product.requiresLot
          ? lots.filter((lot) => lot.productId === product.id)
          : [];
        if (productLots.length === 0) {
          sheet.addRow({
            sku: product.sku,
            nombre: product.name,
            sucursal: branch.code,
            stock_actual: product.stock,
            cantidad: product.requiresLot ? null : product.stock,
          });
          continue;
        }
        for (const lot of productLots) {
          sheet.addRow({
            sku: product.sku,
            nombre: product.name,
            sucursal: branch.code,
            stock_actual: lot.onHand,
            cantidad: lot.onHand,
            lote_codigo: lot.lotCode,
            fecha_vencimiento: lot.expirationDate,
          });
        }
      }
    }

    const branchColumn = STOCK_IMPORT_TEMPLATE_KEYS.indexOf("sucursal") + 1;
    if (available.length > 0) {
      const lastRow = Math.max(TEMPLATE_VALIDATION_ROWS, sheet.rowCount) + 1;
      for (let row = 2; row <= lastRow; row += 1) {
        sheet.getCell(row, branchColumn).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`Catalogos!$A$2:$A$${available.length + 1}`],
          showErrorMessage: false,
        };
      }
    }

    const catalogSheet = workbook.addWorksheet("Catalogos");
    catalogSheet.columns = [
      { header: "sucursal", key: "code", width: 22 },
      { header: "nombre sucursal", key: "name", width: 32 },
    ];
    catalogSheet.getRow(1).font = { bold: true };
    available.forEach((item) => catalogSheet.addRow({ code: item.code, name: item.name }));

    const instructions = workbook.addWorksheet("Instrucciones");
    instructions.columns = [
      { header: "Campo", key: "key", width: 22 },
      { header: "Obligatorio", key: "required", width: 12 },
      { header: "Descripción", key: "description", width: 100 },
      { header: "Ejemplo", key: "example", width: 26 },
    ];
    instructions.getRow(1).font = { bold: true };
    STOCK_IMPORT_COLUMNS.forEach((column) =>
      instructions.addRow({
        key: column.key,
        required: column.required ? "SI" : "NO",
        description: column.description,
        example: column.example,
      })
    );
    instructions.addRow({});
    [
      "cantidad es el stock final que debe quedar. Si es mayor al actual se registra una entrada; si es menor, una salida; si es igual, no se hace nada.",
      "Para productos con lote, cantidad es el saldo final de ese lote. Los demás lotes del producto no cambian.",
      "Puede cargar el mismo archivo dos veces: la segunda vez no genera movimientos porque el stock ya coincide.",
      "Primero se prevalida el archivo. Solo se puede confirmar la carga si no hay errores; todo se guarda en una sola operación.",
      "Las filas se identifican por sku (o codigo_barras / producto_id) y el código de la sucursal.",
    ].forEach((note) => instructions.addRow({ key: "Nota", description: note }));

    const output = await workbook.xlsx.writeBuffer();
    return Buffer.from(output as ArrayBuffer);
  }
}
