import { Inject, Injectable } from "@nestjs/common";
import { ControlCenterAuditService, type ControlCenterRequestContext } from "../control-center-audit.service";
import { ControlCenterDatabaseService, type ControlCenterQueryable } from "../control-center-database.service";
import { CONTROL_CENTER_ACTIONS } from "../control-center.constants";
import { readBillingConfig } from "../billing/billing.config";
import { parseIdempotencyKey } from "../contracts/contracts.parsers";
import { badRequest, conflict, mapDatabaseError, notFound, unprocessable } from "../shared/errors";
import { fromCents } from "../shared/money";
import { asBody, assertUuid, isUuid, likePattern, parseLimit, parseOffset, parseSearch, requireReason } from "../shared/parsing";
import { applyAllocations, autoAllocate, lockReceipt, reverseAllocationInTx } from "./allocations";
import {
  deleteReceiptAttachment,
  readReceiptAttachment,
  saveReceiptAttachment,
  validateReceiptAttachment,
  type UploadedReceiptFile,
  type ValidatedAttachment,
} from "./receipt-attachments";
import { parseAllocationBody, parseReceiptCreate } from "./receipts.parsers";

const IDEMPOTENCY_SCOPE = "receipts.create";
const RECEIPT_STATUSES = ["CONFIRMED", "VOID"];
const RECEIPT_SOURCES = ["PAYMENT", "PRORATION_CREDIT"];

const RECEIPT_COLUMNS = `r.id, r.receipt_number AS "receiptNumber", r.account_id AS "accountId", a.legal_name AS "accountLegalName",
  r.received_on::text AS "receivedOn", r.amount::text AS amount, r.allocated_amount::text AS "allocatedAmount",
  (r.amount - r.allocated_amount)::text AS unallocated, r.source, r.payment_method_id AS "paymentMethodId",
  r.payment_method_code AS "paymentMethodCode", r.payment_method_name AS "paymentMethodName",
  r.financial_institution_id AS "financialInstitutionId", r.financial_institution_name AS "financialInstitutionName",
  r.reference, r.notes, (r.attachment_storage_key IS NOT NULL) AS "hasAttachment",
  r.attachment_original_name AS "attachmentName", r.attachment_mime AS "attachmentMime", r.attachment_size AS "attachmentSize",
  r.contract_id AS "contractId", r.status, r.void_reason AS "voidReason", r.voided_at AS "voidedAt",
  r.created_by AS "createdBy", r.created_at AS "createdAt"`;
const RECEIPT_FROM = `FROM control_center.receipts r JOIN control_center.commercial_accounts a ON a.id = r.account_id`;

type PaymentMethodRow = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  requires_reference: boolean;
  requires_financial_institution: boolean;
  active: boolean;
};

@Injectable()
export class ReceiptsService {
  private readonly maxAttachmentBytes = readBillingConfig().receiptMaxSizeBytes;

  constructor(
    @Inject(ControlCenterDatabaseService) private readonly db: ControlCenterDatabaseService,
    @Inject(ControlCenterAuditService) private readonly audit: ControlCenterAuditService,
  ) {}

  /** Catálogo de medios de pago del tenant plataforma (Finanzas de MANUS) y entidades financieras. */
  async paymentCatalog() {
    const platformTenantId = this.db.getConfig().platformTenantId;
    const [methods, institutions] = await Promise.all([
      this.db.query(
        `SELECT id, codigo AS code, nombre AS name, tipo AS type, requires_reference AS "requiresReference",
                requires_financial_institution AS "requiresFinancialInstitution", icon, color
         FROM public.payment_methods
         WHERE tenant_id = $1 AND active AND tipo <> 'CREDIT'
         ORDER BY sort_order, nombre`,
        [platformTenantId],
      ),
      this.db.query(
        `SELECT id, codigo AS code, nombre AS name, nombre_corto AS "shortName", tipo AS type
         FROM public.financial_institutions
         WHERE active AND (tenant_id = $1 OR tenant_id IS NULL)
         ORDER BY sort_order, nombre`,
        [platformTenantId],
      ),
    ]);
    return { methods: methods.rows, institutions: institutions.rows };
  }

  async list(query: Record<string, unknown>) {
    const limit = parseLimit(query.limit, 20, 100);
    const offset = parseOffset(query.offset);
    const params: unknown[] = [];
    const where: string[] = [];
    if (query.accountId) {
      params.push(assertUuid(query.accountId, "accountId"));
      where.push(`r.account_id = $${params.length}`);
    }
    if (typeof query.status === "string" && query.status) {
      const status = query.status.toUpperCase();
      if (!RECEIPT_STATUSES.includes(status)) throw badRequest("CONTROL_CENTER_INVALID_FIELD", "status inválido");
      params.push(status);
      where.push(`r.status = $${params.length}`);
    }
    if (typeof query.source === "string" && query.source) {
      const source = query.source.toUpperCase();
      if (!RECEIPT_SOURCES.includes(source)) throw badRequest("CONTROL_CENTER_INVALID_FIELD", "source inválido");
      params.push(source);
      where.push(`r.source = $${params.length}`);
    }
    if (query.withBalance === "true") where.push(`r.status = 'CONFIRMED' AND r.amount > r.allocated_amount`);
    const search = parseSearch(query.search);
    if (search) {
      params.push(likePattern(search));
      where.push(`(r.receipt_number ILIKE $${params.length} OR r.reference ILIKE $${params.length} OR a.legal_name ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [rows, count] = await Promise.all([
      this.db.query(
        `SELECT ${RECEIPT_COLUMNS} ${RECEIPT_FROM} ${whereSql}
         ORDER BY r.received_on DESC, r.receipt_number DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.db.query(`SELECT COUNT(*)::int AS total ${RECEIPT_FROM} ${whereSql}`, params),
    ]);
    return { items: rows.rows, total: count.rows[0]?.total ?? 0, limit, offset };
  }

  async get(idParam: string) {
    const id = assertUuid(idParam, "receiptId");
    const receipt = await this.db.query(`SELECT ${RECEIPT_COLUMNS} ${RECEIPT_FROM} WHERE r.id = $1`, [id]);
    if (!receipt.rows[0]) throw notFound("CONTROL_CENTER_RECEIPT_NOT_FOUND", "Recaudo no encontrado");
    const allocations = await this.db.query(
      `SELECT ra.id, ra.amount::text AS amount, ra.created_at AS "createdAt", ra.reversed_at AS "reversedAt",
              ra.reversal_reason AS "reversalReason", ch.id AS "chargeId", ch.charge_number AS "chargeNumber",
              ch.due_date::text AS "dueDate", ch.status AS "chargeStatus", c.contract_number AS "contractNumber"
       FROM control_center.receipt_allocations ra
       JOIN control_center.charges ch ON ch.id = ra.charge_id
       JOIN control_center.contracts c ON c.id = ch.contract_id
       WHERE ra.receipt_id = $1 ORDER BY ra.created_at`,
      [id],
    );
    return { ...receipt.rows[0], allocations: allocations.rows };
  }

  async create(raw: unknown, file: UploadedReceiptFile | undefined, idempotencyHeader: unknown, ctx: ControlCenterRequestContext) {
    const input = parseReceiptCreate(raw);
    const idempotencyKey = parseIdempotencyKey(idempotencyHeader);
    if (idempotencyKey) {
      const existing = await this.findIdempotent(idempotencyKey);
      if (existing) return this.get(existing);
    }
    const attachment: ValidatedAttachment | null = file ? validateReceiptAttachment(file, this.maxAttachmentBytes) : null;
    const platformTenantId = this.db.getConfig().platformTenantId;
    const method = await this.loadPaymentMethod(this.db, input.paymentMethodId, platformTenantId);
    if (method.requires_reference && !input.reference) {
      throw badRequest("CONTROL_CENTER_REFERENCE_REQUIRED", `El medio de pago ${method.nombre} exige una referencia`);
    }
    if (method.requires_financial_institution && !input.financialInstitutionId) {
      throw badRequest("CONTROL_CENTER_FINANCIAL_INSTITUTION_REQUIRED", `El medio de pago ${method.nombre} exige la entidad financiera`);
    }
    const institution = input.financialInstitutionId
      ? await this.loadInstitution(input.financialInstitutionId, platformTenantId)
      : null;
    const account = await this.db.query(`SELECT id FROM control_center.commercial_accounts WHERE id = $1`, [input.accountId]);
    if (!account.rows[0]) throw notFound("CONTROL_CENTER_ACCOUNT_NOT_FOUND", "Cuenta comercial no encontrada");

    const storageKey = attachment ? await saveReceiptAttachment(attachment, input.receivedOn) : null;
    try {
      const receiptId = await this.db.transaction(async (tx) => {
        const sequence = await tx.query(`SELECT nextval('control_center.receipt_number_seq') AS n`);
        const receiptNumber = `MCC-REC-${input.receivedOn.slice(0, 4)}-${String(sequence.rows[0].n).padStart(6, "0")}`;
        const inserted = await tx.query(
          `INSERT INTO control_center.receipts (
             receipt_number, account_id, received_on, amount, source, payment_method_id, payment_method_code,
             payment_method_name, financial_institution_id, financial_institution_name, reference, notes,
             attachment_storage_key, attachment_original_name, attachment_mime, attachment_size, created_by, updated_by
           ) VALUES ($1, $2, $3, $4, 'PAYMENT', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)
           RETURNING id`,
          [
            receiptNumber, input.accountId, input.receivedOn, fromCents(input.amountCents), method.id, method.codigo,
            method.nombre, institution?.id ?? null, institution?.nombre ?? null, input.reference, input.notes,
            storageKey, attachment?.originalName ?? null, attachment?.mime ?? null, attachment?.size ?? null, ctx.actorUserId,
          ],
        );
        const id: string = inserted.rows[0].id;
        if (idempotencyKey) {
          await tx.query(
            `INSERT INTO control_center.idempotency_keys (scope, key, resource_id, created_by) VALUES ($1, $2, $3, $4)`,
            [IDEMPOTENCY_SCOPE, idempotencyKey, id, ctx.actorUserId],
          );
        }
        await this.audit.record(tx, {
          ...ctx,
          action: CONTROL_CENTER_ACTIONS.RECEIPT_REGISTERED,
          entityType: "receipt",
          entityId: id,
          after: {
            receiptNumber,
            accountId: input.accountId,
            receivedOn: input.receivedOn,
            amount: fromCents(input.amountCents),
            paymentMethod: method.codigo,
            financialInstitution: institution?.nombre ?? null,
            reference: input.reference,
            hasAttachment: storageKey !== null,
          },
        });
        await this.allocateAndAudit(tx, id, input.allocations, input.autoAllocate, ctx);
        return id;
      });
      return this.get(receiptId);
    } catch (error) {
      if (storageKey) await deleteReceiptAttachment(storageKey);
      const pg = error as { code?: string; constraint?: string };
      if (idempotencyKey && pg?.code === "23505" && pg.constraint === "idempotency_keys_pkey") {
        const existing = await this.findIdempotent(idempotencyKey);
        if (existing) return this.get(existing);
      }
      if (pg?.code === "23505" && pg.constraint === "uq_cc_receipts_reference") {
        throw conflict("CONTROL_CENTER_DUPLICATE_PAYMENT", "Ya existe un pago confirmado de esta cuenta con el mismo medio y referencia");
      }
      return mapDatabaseError(error);
    }
  }

  async allocate(idParam: string, raw: unknown, ctx: ControlCenterRequestContext) {
    const id = assertUuid(idParam, "receiptId");
    const input = parseAllocationBody(raw);
    await this.db
      .transaction((tx) => this.allocateAndAudit(tx, id, input.allocations, input.autoAllocate, ctx))
      .catch((error) => mapDatabaseError(error));
    return this.get(id);
  }

  async void(idParam: string, raw: unknown, ctx: ControlCenterRequestContext) {
    const id = assertUuid(idParam, "receiptId");
    const reason = requireReason(asBody(raw ?? {}));
    await this.db
      .transaction(async (tx) => {
        const receipt = await lockReceipt(tx, id);
        if (receipt.status === "VOID") throw conflict("CONTROL_CENTER_RECEIPT_VOID", "El recaudo ya está anulado");
        const active = await tx.query(
          `SELECT id FROM control_center.receipt_allocations WHERE receipt_id = $1 AND reversed_at IS NULL ORDER BY id`,
          [id],
        );
        const reversed = [];
        for (const row of active.rows) reversed.push(await reverseAllocationInTx(tx, row.id, reason, ctx.actorUserId));
        await tx.query(
          `UPDATE control_center.receipts
           SET status = 'VOID', void_reason = $2, voided_at = NOW(), voided_by = $3, updated_by = $3, updated_at = NOW()
           WHERE id = $1`,
          [id, reason, ctx.actorUserId],
        );
        await this.audit.record(tx, {
          ...ctx,
          action: CONTROL_CENTER_ACTIONS.RECEIPT_VOIDED,
          entityType: "receipt",
          entityId: id,
          before: { status: "CONFIRMED", receiptNumber: receipt.receipt_number, amount: receipt.amount },
          after: { status: "VOID", reversedAllocations: reversed },
          reason,
        });
      })
      .catch((error) => mapDatabaseError(error));
    return this.get(id);
  }

  async reverseAllocation(idParam: string, raw: unknown, ctx: ControlCenterRequestContext) {
    const id = assertUuid(idParam, "allocationId");
    const reason = requireReason(asBody(raw ?? {}));
    const result = await this.db
      .transaction(async (tx) => {
        const reversed = await reverseAllocationInTx(tx, id, reason, ctx.actorUserId);
        await this.audit.record(tx, {
          ...ctx,
          action: CONTROL_CENTER_ACTIONS.ALLOCATION_REVERSED,
          entityType: "receipt",
          entityId: reversed.receiptId,
          after: reversed,
          reason,
        });
        return reversed;
      })
      .catch((error) => mapDatabaseError(error));
    return this.get(result.receiptId);
  }

  async attachment(idParam: string) {
    const id = assertUuid(idParam, "receiptId");
    const result = await this.db.query(
      `SELECT attachment_storage_key AS key, attachment_original_name AS name, attachment_mime AS mime
       FROM control_center.receipts WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row?.key) throw notFound("CONTROL_CENTER_ATTACHMENT_NOT_FOUND", "El recaudo no tiene comprobante");
    const content = await readReceiptAttachment(row.key).catch(() => {
      throw notFound("CONTROL_CENTER_ATTACHMENT_NOT_FOUND", "No se encontró el archivo del comprobante");
    });
    return { content, name: row.name as string, mime: row.mime as string };
  }

  private async allocateAndAudit(
    tx: ControlCenterQueryable,
    receiptId: string,
    allocations: { chargeId: string; amountCents: bigint }[],
    automatic: boolean,
    ctx: ControlCenterRequestContext,
  ) {
    if (!automatic && allocations.length === 0) return;
    const result = automatic
      ? await autoAllocate(tx, receiptId, ctx.actorUserId)
      : await applyAllocations(tx, receiptId, allocations, ctx.actorUserId);
    if (result.applied.length === 0) return;
    await this.audit.record(tx, {
      ...ctx,
      action: CONTROL_CENTER_ACTIONS.RECEIPT_ALLOCATED,
      entityType: "receipt",
      entityId: receiptId,
      after: { automatic, total: fromCents(result.totalCents), allocations: result.applied },
    });
  }

  private async loadPaymentMethod(db: ControlCenterQueryable, id: string, platformTenantId: string): Promise<PaymentMethodRow> {
    const result = await db.query(
      `SELECT id, codigo, nombre, tipo, requires_reference, requires_financial_institution, active
       FROM public.payment_methods WHERE id = $1 AND tenant_id = $2`,
      [id, platformTenantId],
    );
    const method: PaymentMethodRow | undefined = result.rows[0];
    if (!method || !method.active || method.tipo === "CREDIT") {
      throw unprocessable("CONTROL_CENTER_PAYMENT_METHOD_INVALID", "El medio de pago no está activo en el catálogo de MANUS o no se permite");
    }
    return method;
  }

  private async loadInstitution(id: string, platformTenantId: string) {
    const result = await this.db.query(
      `SELECT id, nombre FROM public.financial_institutions
       WHERE id = $1 AND active AND (tenant_id = $2 OR tenant_id IS NULL)`,
      [id, platformTenantId],
    );
    if (!result.rows[0]) {
      throw unprocessable("CONTROL_CENTER_FINANCIAL_INSTITUTION_INVALID", "La entidad financiera no está activa en el catálogo");
    }
    return result.rows[0] as { id: string; nombre: string };
  }

  private async findIdempotent(key: string): Promise<string | null> {
    const result = await this.db.query(
      `SELECT resource_id FROM control_center.idempotency_keys WHERE scope = $1 AND key = $2`,
      [IDEMPOTENCY_SCOPE, key],
    );
    const id = result.rows[0]?.resource_id;
    return isUuid(id) ? id : null;
  }
}
