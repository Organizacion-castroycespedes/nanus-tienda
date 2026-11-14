import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import ExcelJS from "exceljs";
import { FinanceAccessRepository } from "../../finance/common/repositories/finance-access.repository";
import { cellValueToText } from "../imports/xlsx-import.parser";
import { canViewAllBranches, type BranchScopedActor } from "../utils/access";
import {
  isSerialHeader,
  isValidSerialNumber,
  MAX_SERIALS_PER_REQUEST,
  normalizeSerialNumber,
  parseSerialText,
} from "./product-serial.normalize";
import {
  PRODUCT_SERIAL_STATUSES,
  ProductSerialRepository,
  type ProductSerialEventRow,
  type ProductSerialRow,
  type ProductSerialStatus,
} from "./product-serial.repository";

export type SerialPrevalidationResult = {
  total: number;
  valid: string[];
  invalidFormat: string[];
  duplicatesInPayload: string[];
  alreadyRegistered: Array<{ serialNumber: string; status: ProductSerialStatus }>;
  existsInOtherProduct: Array<{ serialNumber: string; productName: string; productSku: string }>;
  ok: boolean;
};

export type SerialFile = { originalname?: string; buffer?: Buffer; size?: number };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_FILE_ROWS = MAX_SERIALS_PER_REQUEST;

const toIso = (value: Date | string | null) =>
  value === null ? null : value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export const mapSerial = (row: ProductSerialRow) => ({
  id: row.id,
  productId: row.product_id,
  productName: row.product_name,
  productSku: row.product_sku,
  branchId: row.branch_id,
  branchName: row.branch_name,
  locationId: row.location_id,
  locationCode: row.location_code,
  locationName: row.location_name,
  serialNumber: row.serial_number_normalized,
  capturedSerialNumber: row.serial_number,
  status: row.status,
  sourceType: row.source_type,
  purchaseId: row.purchase_id,
  saleId: row.sale_id,
  orderId: row.order_id,
  customerId: row.customer_id,
  receivedAt: toIso(row.received_at),
  soldAt: toIso(row.sold_at),
});

const mapEvent = (row: ProductSerialEventRow) => ({
  id: row.id,
  eventType: row.event_type,
  fromStatus: row.from_status,
  toStatus: row.to_status,
  branchId: row.branch_id,
  fromLocationCode: row.from_location_code,
  toLocationCode: row.to_location_code,
  referenceType: row.reference_type,
  referenceId: row.reference_id,
  stockMovementId: row.stock_movement_id,
  userId: row.user_id,
  reason: row.reason,
  createdAt: toIso(row.created_at),
});

@Injectable()
export class ProductSerialService {
  constructor(
    @Inject(ProductSerialRepository)
    private readonly repository: ProductSerialRepository,
    @Inject(FinanceAccessRepository)
    private readonly financeAccessRepository: FinanceAccessRepository
  ) {}

  private normalizeLimit(limit?: number) {
    if (limit === undefined || limit === null || Number.isNaN(limit)) {
      return DEFAULT_LIMIT;
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new BadRequestException(`limit debe ser un entero entre 1 y ${MAX_LIMIT}`);
    }
    return limit;
  }

  private normalizeOffset(offset?: number) {
    if (offset === undefined || offset === null || Number.isNaN(offset)) {
      return 0;
    }
    if (!Number.isInteger(offset) || offset < 0) {
      throw new BadRequestException("offset debe ser un entero mayor o igual a 0");
    }
    return offset;
  }

  private normalizeStatus(status?: string) {
    if (status === undefined || status === "") {
      return undefined;
    }
    const normalized = status.trim().toUpperCase() as ProductSerialStatus;
    if (!PRODUCT_SERIAL_STATUSES.includes(normalized)) {
      throw new BadRequestException("status no válido");
    }
    return normalized;
  }

  private normalizeSearch(search?: string) {
    const normalized = search?.trim();
    return normalized ? normalized.toUpperCase().slice(0, 100) : undefined;
  }

  /** null = todas las sucursales del tenant (SUPER_ADMIN / SUPER_USER). */
  private async resolveAccessibleBranchIds(tenantId: string, actor: BranchScopedActor): Promise<string[] | null> {
    if (canViewAllBranches(actor)) {
      return null;
    }
    if (!actor.userId) {
      if (actor.branchId) {
        return [actor.branchId];
      }
      throw new ForbiddenException("user is required");
    }
    const branchIds = await this.financeAccessRepository.findAccessibleBranchIds(actor.userId, tenantId);
    if (branchIds.length === 0 && actor.branchId) {
      return [actor.branchId];
    }
    return branchIds;
  }

  private async assertBranchAccess(tenantId: string, branchId: string, actor: BranchScopedActor) {
    if (!(await this.repository.branchBelongsToTenant(tenantId, branchId))) {
      throw new BadRequestException("branchId is invalid");
    }
    const allowed = await this.resolveAccessibleBranchIds(tenantId, actor);
    if (allowed !== null && !allowed.includes(branchId)) {
      throw new ForbiddenException("not authorized for this branch");
    }
  }

  private async getSerialProduct(tenantId: string, productId: string) {
    const product = await this.repository.findProduct(tenantId, productId);
    if (!product) {
      throw new NotFoundException("product not found");
    }
    if (!product.requires_serial) {
      throw new BadRequestException({ code: "SERIAL_NOT_REQUIRED", message: "El producto no maneja número de serie." });
    }
    return product;
  }

  /** Prevalidación de solo lectura para escáner, pegado masivo o archivo, antes de recibir. */
  async prevalidate(
    tenantId: string,
    input: { productId: string; branchId: string; serialNumbers: unknown },
    actor: BranchScopedActor
  ): Promise<SerialPrevalidationResult> {
    if (!Array.isArray(input.serialNumbers)) {
      throw new BadRequestException("serialNumbers debe ser una lista");
    }
    if (input.serialNumbers.length > MAX_SERIALS_PER_REQUEST) {
      throw new BadRequestException(`Máximo ${MAX_SERIALS_PER_REQUEST} series por validación`);
    }
    await this.assertBranchAccess(tenantId, input.branchId, actor);
    await this.getSerialProduct(tenantId, input.productId);

    const invalidFormat: string[] = [];
    const duplicatesInPayload = new Set<string>();
    const seen = new Set<string>();
    const candidates: string[] = [];

    for (const raw of input.serialNumbers) {
      const normalized = normalizeSerialNumber(raw);
      if (!isValidSerialNumber(normalized)) {
        invalidFormat.push(typeof raw === "string" ? raw : String(raw));
        continue;
      }
      if (seen.has(normalized)) {
        duplicatesInPayload.add(normalized);
        continue;
      }
      seen.add(normalized);
      candidates.push(normalized);
    }

    const [registered, inOtherProducts] = await Promise.all([
      this.repository.findRegistered(tenantId, input.productId, candidates),
      this.repository.findInOtherProducts(tenantId, input.productId, candidates),
    ]);
    const registeredSet = new Set(registered.map((row) => row.serial_number_normalized));
    const valid = candidates.filter((serial) => !registeredSet.has(serial) && !duplicatesInPayload.has(serial));

    return {
      total: input.serialNumbers.length,
      valid,
      invalidFormat,
      duplicatesInPayload: [...duplicatesInPayload],
      alreadyRegistered: registered.map((row) => ({ serialNumber: row.serial_number_normalized, status: row.status })),
      existsInOtherProduct: inOtherProducts.map((row) => ({
        serialNumber: row.serial_number_normalized,
        productName: row.product_name,
        productSku: row.product_sku,
      })),
      ok:
        input.serialNumbers.length > 0 &&
        invalidFormat.length === 0 &&
        duplicatesInPayload.size === 0 &&
        registered.length === 0,
    };
  }

  /** Lee series de un archivo .csv/.txt (una por línea) o .xlsx (columna "serie" o la primera columna). */
  async parseFile(file: SerialFile | undefined): Promise<{ serialNumbers: string[] }> {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException("Adjunta un archivo .csv, .txt o .xlsx en el campo file.");
    }
    const name = file.originalname?.toLowerCase() ?? "";
    let serialNumbers: string[];
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      serialNumbers = parseSerialText(file.buffer.toString("utf8"));
    } else if (name.endsWith(".xlsx")) {
      serialNumbers = await this.parseWorkbook(file.buffer);
    } else {
      throw new BadRequestException("Solo se permiten archivos .csv, .txt o .xlsx.");
    }
    if (serialNumbers.length === 0) {
      throw new BadRequestException("El archivo no contiene series.");
    }
    if (serialNumbers.length > MAX_FILE_ROWS) {
      throw new BadRequestException(`El archivo supera el máximo de ${MAX_FILE_ROWS} series.`);
    }
    return { serialNumbers };
  }

  private async parseWorkbook(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException("No se pudo leer el archivo .xlsx.");
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException("El archivo .xlsx no tiene hojas.");
    }
    let column = 1;
    let startRow = 1;
    const header = sheet.getRow(1);
    header.eachCell((cell, colNumber) => {
      if (startRow === 1 && isSerialHeader(cellValueToText(cell.value))) {
        column = colNumber;
        startRow = 2;
      }
    });
    const serials: string[] = [];
    for (let rowNumber = startRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const text = cellValueToText(sheet.getRow(rowNumber).getCell(column).value).trim();
      if (text) {
        serials.push(text);
      }
      if (serials.length > MAX_FILE_ROWS) {
        break;
      }
    }
    return serials;
  }

  /** Series de un producto en una sucursal (por defecto AVAILABLE), con búsqueda por texto parcial. */
  async listByProduct(
    tenantId: string,
    input: { productId: string; branchId: string; status?: string; search?: string; limit?: number; offset?: number },
    actor: BranchScopedActor
  ) {
    await this.assertBranchAccess(tenantId, input.branchId, actor);
    const product = await this.repository.findProduct(tenantId, input.productId);
    if (!product) {
      throw new NotFoundException("product not found");
    }
    const limit = this.normalizeLimit(input.limit);
    const offset = this.normalizeOffset(input.offset);
    const rows = await this.repository.listByProduct({
      tenantId,
      productId: input.productId,
      branchId: input.branchId,
      status: this.normalizeStatus(input.status) ?? "AVAILABLE",
      search: this.normalizeSearch(input.search),
      limit,
      offset,
    });
    return {
      items: rows.map(mapSerial),
      total: rows.length > 0 ? Number(rows[0].total_count ?? rows.length) : 0,
      limit,
      offset,
    };
  }

  /** Búsqueda exacta por número de serie (escaneo en POS, entregas o consulta). */
  async lookup(
    tenantId: string,
    input: { serialNumber?: string; branchId?: string; productId?: string },
    actor: BranchScopedActor
  ) {
    const normalized = normalizeSerialNumber(input.serialNumber);
    if (!isValidSerialNumber(normalized)) {
      throw new BadRequestException("serial no válido");
    }
    let branchIds = await this.resolveAccessibleBranchIds(tenantId, actor);
    if (input.branchId) {
      await this.assertBranchAccess(tenantId, input.branchId, actor);
      branchIds = [input.branchId];
    }
    const rows = await this.repository.findBySerialNumber({
      tenantId,
      normalized,
      branchIds,
      productId: input.productId,
    });
    return { items: rows.map(mapSerial) };
  }

  async search(
    tenantId: string,
    input: { search?: string; productId?: string; branchId?: string; status?: string; limit?: number; offset?: number },
    actor: BranchScopedActor
  ) {
    let branchIds = await this.resolveAccessibleBranchIds(tenantId, actor);
    if (input.branchId) {
      await this.assertBranchAccess(tenantId, input.branchId, actor);
      branchIds = [input.branchId];
    }
    const limit = this.normalizeLimit(input.limit);
    const offset = this.normalizeOffset(input.offset);
    const rows = await this.repository.search({
      tenantId,
      branchIds,
      productId: input.productId,
      status: this.normalizeStatus(input.status),
      search: this.normalizeSearch(input.search),
      limit,
      offset,
    });
    return {
      items: rows.map(mapSerial),
      total: rows.length > 0 ? Number(rows[0].total_count ?? rows.length) : 0,
      limit,
      offset,
    };
  }

  async getHistory(tenantId: string, serialId: string, actor: BranchScopedActor) {
    const serial = await this.repository.findById(tenantId, serialId);
    if (!serial) {
      throw new NotFoundException("Serie no encontrada");
    }
    const allowed = await this.resolveAccessibleBranchIds(tenantId, actor);
    if (allowed !== null && !allowed.includes(serial.branch_id)) {
      throw new ForbiddenException("not authorized for this branch");
    }
    const events = await this.repository.findEvents(tenantId, serialId);
    return { serial: mapSerial(serial), events: events.map(mapEvent) };
  }
}
