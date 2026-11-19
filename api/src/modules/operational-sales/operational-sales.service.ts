import { BadGatewayException, BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { AuditService } from "../../common/services/audit.service";
import { OperationalSaleScopeService, type OperationalSaleActor } from "../../common/services/operational-sale-scope.service";
import {
  BillingIntegrationClient,
  type BillingCreditNoteIssueResult,
} from "../integration-outbox/services/billing-integration-client";
import {
  buildOnlineResultFromDelivery,
  buildOnlineResultFromDocument,
  ELECTRONIC_BILLING_STATUSES,
  type ElectronicBillingOnlineResult,
} from "../integration-outbox/contracts/electronic-billing-outcome";
import { normalizeOperationalSalesQuery, type OperationalSalesQueryDto } from "./dto/operational-sales-query.dto";
import { OperationalSalesRepository } from "./operational-sales.repository";
import { OperationalDashboardRepository } from "./operational-dashboard.repository";
import { normalizeOperationalDashboardQuery, type OperationalDashboardQueryDto } from "./dto/operational-dashboard-query.dto";

import { DatabaseService } from "../../common/db/database.service";
import { UpdateSaleCustomerDto } from "./dto/update-sale-customer.dto";
import { CorrectSalePaymentsDto } from "./dto/correct-sale-payments.dto";
import { VoidOperationalSaleDto } from "./dto/void-operational-sale.dto";
import { OperationalDebitNoteDto } from "./dto/operational-debit-note.dto";
import { StockMovementService } from "../inventory/services/stock-movement.service";
import { ProductSerialService } from "../inventory/serials/product-serial.service";

const OPERATIONAL_FE_PROVIDER_RECOVERY_AUDIT_ACTION = "OP_FE_PROVIDER_RECOVERY";
const VOID_REQUEST_RETRY_BASE_MS = 60_000;
const VOID_REQUEST_RETRY_MAX_MS = 30 * 60_000;
const VOID_REQUEST_MAX_ATTEMPTS = 20;

/** Linea fisica facturada en una venta de pedido que se devuelve al anularla. */
type OrderSaleVoidLine = {
  productId: string;
  quantity: number;
  isInventoryable: boolean;
  requiresSerial: boolean;
};

const isUndefinedTableError = (error: unknown) =>
  Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "42P01");

@Injectable()
export class OperationalSalesService {
  constructor(
    @Inject(OperationalSaleScopeService)
    private readonly scopeService: OperationalSaleScopeService,
    @Inject(OperationalSalesRepository)
    private readonly repository: OperationalSalesRepository,
    @Inject(BillingIntegrationClient)
    private readonly billingClient: BillingIntegrationClient,
    @Optional() @Inject(AuditService)
    private readonly auditService?: AuditService,
    @Optional() @Inject(OperationalDashboardRepository)
    private readonly dashboardRepository?: OperationalDashboardRepository,
    @Optional() @Inject(DatabaseService)
    private readonly db?: DatabaseService,
    @Optional() @Inject(StockMovementService)
    private readonly stockMovementService?: StockMovementService,
    @Optional() @Inject(ProductSerialService)
    private readonly productSerialService?: ProductSerialService,
  ) {}

  async list(actor: OperationalSaleActor, queryDto: OperationalSalesQueryDto) {
    let query;
    try {
      query = normalizeOperationalSalesQuery(queryDto);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid sales query");
    }
    const scope = await this.scopeService.resolveQueryScope(actor, query);
    return this.repository.findMany(scope, query);
  }

  async dashboard(actor: OperationalSaleActor, queryDto: OperationalDashboardQueryDto) {
    let query;
    try { query = normalizeOperationalDashboardQuery(queryDto); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "Invalid dashboard query"); }
    const scope = await this.scopeService.resolveQueryScope(actor, { branchId: query.branchId });
    if (!this.dashboardRepository) throw new Error("dashboard repository unavailable");
    return this.dashboardRepository.getDashboard(scope, query);
  }

  async detail(actor: OperationalSaleActor, saleId: string) {
    const scope = await this.scopeService.resolveScope(actor);
    const sale = await this.repository.findById(scope, saleId);
    if (!sale) {
      throw new NotFoundException("sale not found");
    }
    if (sale.electronicBilling?.status === "AMBIGUOUS") {
      throw new ConflictException("sale has ambiguous electronic documents");
    }
    return this.withRetryability(actor.tenantId, sale);
  }

  async refreshElectronicBillingStatus(actor: OperationalSaleActor, saleId: string) {
    const scope = await this.scopeService.resolveScope(actor);
    const sale = await this.repository.findById(scope, saleId);
    if (!sale) {
      throw new NotFoundException("sale not found");
    }
    if (sale.electronicBilling?.status === "AMBIGUOUS") {
      throw new ConflictException("sale has ambiguous electronic documents");
    }
    const electronicDocumentId = sale.electronicBilling?.electronicDocumentId;
    if (!electronicDocumentId) {
      throw new BadRequestException("sale has no electronic document");
    }
    if (!actor.tenantId) {
      throw new BadRequestException("tenant context is required");
    }

    try {
      await this.billingClient.refreshElectronicDocumentStatus(
        actor.tenantId,
        electronicDocumentId,
      );
    } catch {
      throw new BadGatewayException("electronic billing status is unavailable");
    }

    const refreshed = await this.repository.findById(scope, saleId);
    if (!refreshed) {
      throw new NotFoundException("sale not found");
    }
    return this.withRetryability(actor.tenantId, refreshed);
  }

  async retryElectronicBilling(actor: OperationalSaleActor, saleId: string) {
    const scope = await this.scopeService.resolveScope(actor);
    const sale = await this.repository.findById(scope, saleId);
    if (!sale) {
      throw new NotFoundException("sale not found");
    }
    const electronicDocumentId = sale.electronicBilling?.electronicDocumentId;
    if (!electronicDocumentId || !actor.tenantId) {
      throw new BadRequestException("sale has no electronic document");
    }

    const decision = await this.billingClient.getElectronicDocumentRetryability(
      actor.tenantId,
      electronicDocumentId,
    );
    const result = await this.billingClient.retryElectronicDocument(
      actor.tenantId,
      electronicDocumentId,
    );
    this.auditService?.logEvent({
      tenantId: actor.tenantId,
      userId: actor.id ?? null,
      module: "operations",
      entity: "electronic_documents",
      entityId: electronicDocumentId,
      action: "OPERATIONAL_ELECTRONIC_BILLING_RETRY",
      before: {
        saleId,
        status: sale.electronicBilling?.status ?? null,
        decision: decision.decision,
        reasonCode: decision.reasonCode,
        processingStage: decision.processingStage,
      },
      after: {
        saleId,
        allowed: result.allowed,
        disposition: result.disposition,
        status: result.status,
        processingStage: result.processingStage,
        reasonCode: result.reasonCode,
      },
    });

    const refreshed = await this.repository.findById(scope, saleId);
    if (!refreshed) {
      throw new NotFoundException("sale not found");
    }
    return {
      ...(await this.withRetryability(actor.tenantId, refreshed)),
      retryResult: result,
    };
  }

  async recoverProviderCreateIntent(actor: OperationalSaleActor, saleId: string) {
    const scope = await this.scopeService.resolveScope(actor);
    const sale = await this.repository.findById(scope, saleId);
    if (!sale) {
      throw new NotFoundException("sale not found");
    }
    const electronicDocumentId = sale.electronicBilling?.electronicDocumentId;
    if (!electronicDocumentId || !actor.tenantId) {
      throw new BadRequestException("sale has no electronic document");
    }

    try {
      const recoveryResult = await this.billingClient.recoverProviderCreateIntent(
        actor.tenantId,
        electronicDocumentId,
      );
      this.auditService?.logEvent({
        tenantId: actor.tenantId,
        userId: actor.id ?? null,
        module: "operations",
        entity: "electronic_documents",
        entityId: electronicDocumentId,
        action: OPERATIONAL_FE_PROVIDER_RECOVERY_AUDIT_ACTION,
        before: { saleId, electronicDocumentId },
        after: {
          recovery: recoveryResult.recovery,
          status: recoveryResult.status,
          processingStage: recoveryResult.processingStage,
        },
      });
      const refreshed = await this.repository.findById(scope, saleId);
      if (!refreshed) {
        throw new NotFoundException("sale not found");
      }
      return {
        ...(await this.withRetryability(actor.tenantId, refreshed)),
        recoveryResult,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadGatewayException("electronic billing recovery is unavailable");
    }
  }

  private async withRetryability(tenantId: string | undefined, sale: any) {
    const electronicDocumentId = sale.electronicBilling?.electronicDocumentId;
    if (!tenantId || !electronicDocumentId) {
      return sale;
    }
    try {
      const retryability = await this.billingClient.getElectronicDocumentRetryability(
        tenantId,
        electronicDocumentId,
      );
      return {
        ...sale,
        electronicBilling: { ...sale.electronicBilling, retryability },
      };
    } catch {
      return {
        ...sale,
        electronicBilling: {
          ...sale.electronicBilling,
          retryability: {
            canRetry: false,
            canRecoverProviderCreateIntent: false,
            retryClass: "NONE",
            decision: "NOT_RETRYABLE",
            reasonCode: "PROVIDER_UNAVAILABLE",
            requiredAction: "NO_ACTION",
            requiresReconciliation: true,
            providerDocumentExists: Boolean(sale.electronicBilling?.providerDocumentId),
            processingStage: "UNKNOWN",
            safeUserMessage: "No fue posible determinar si el documento admite reintento.",
          },
        },
      };
    }
  }

  async updateCustomer(
    actor: OperationalSaleActor,
    saleId: string,
    dto: UpdateSaleCustomerDto
  ) {
    if (!dto.customerId) {
      throw new BadRequestException("customerId es requerido");
    }
    const tenantId = actor.tenantId;
    if (!tenantId) {
      throw new BadRequestException("tenantId es requerido");
    }
    if (!this.db) {
      throw new Error("database unavailable");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const saleResult = await client.query<{
        id: string;
        tenant_id: string;
        branch_id: string;
        customer_id: string;
        status: string;
      }>(
        `SELECT id, tenant_id, branch_id, customer_id, status
           FROM sales
          WHERE id = $1 AND tenant_id = $2
          FOR UPDATE`,
        [saleId, tenantId]
      );
      const sale = saleResult.rows[0];
      if (!sale) {
        throw new NotFoundException("Venta no encontrada");
      }
      if (sale.status === "CANCELLED" || sale.status === "REFUNDED") {
        throw new BadRequestException("No se puede modificar el cliente de una venta cancelada o reembolsada");
      }

      const billingDoc = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM electronic_documents
          WHERE tenant_id = $1 AND source_type = 'SALE' AND source_id = $2
          ORDER BY created_at DESC LIMIT 1`,
        [tenantId, saleId]
      );
      if (billingDoc.rows[0]?.status === "ACCEPTED") {
        throw new ConflictException("No se puede modificar el cliente porque la venta ya tiene factura electrónica aceptada");
      }

      const customerResult = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM customers WHERE id = $1 AND tenant_id = $2`,
        [dto.customerId, tenantId]
      );
      if (!customerResult.rows[0]) {
        throw new NotFoundException("Cliente no encontrado");
      }

      const previousCustomerId = sale.customer_id;
      await client.query(
        `UPDATE sales SET customer_id = $1 WHERE id = $2 AND tenant_id = $3`,
        [dto.customerId, saleId, tenantId]
      );

      this.auditService?.logEvent({
        tenantId,
        userId: actor.id ?? null,
        module: "operations",
        entity: "sales",
        entityId: saleId,
        action: "UPDATE_SALE_CUSTOMER",
        before: { customerId: previousCustomerId },
        after: { customerId: dto.customerId },
      });

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return this.detail(actor, saleId);
  }

  async correctPayments(
    actor: OperationalSaleActor,
    saleId: string,
    dto: CorrectSalePaymentsDto
  ) {
    if (!dto.reason || dto.reason.trim().length < 5) {
      throw new BadRequestException("Motivo de corrección obligatorio (mínimo 5 caracteres)");
    }
    if (!Array.isArray(dto.payments) || dto.payments.length === 0) {
      throw new BadRequestException("Debe ingresar al menos un medio de pago");
    }

    for (const p of dto.payments) {
      if (typeof p.amount !== "number" || isNaN(p.amount) || p.amount <= 0) {
        throw new BadRequestException("Todos los montos de pago deben ser mayores a 0");
      }
      if (!p.paymentMethodId) {
        throw new BadRequestException("paymentMethodId es requerido para cada pago");
      }
    }

    const tenantId = actor.tenantId;
    if (!tenantId) {
      throw new BadRequestException("tenantId es requerido");
    }
    if (!this.db) {
      throw new Error("database unavailable");
    }

    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");

      const saleResult = await client.query<{
        id: string;
        tenant_id: string;
        branch_id: string;
        total: string;
        status: string;
        payment_status: string;
      }>(
        `SELECT id, tenant_id, branch_id, total::text, status, payment_status
           FROM sales
          WHERE id = $1 AND tenant_id = $2
          FOR UPDATE`,
        [saleId, tenantId]
      );
      const sale = saleResult.rows[0];
      if (!sale) {
        throw new NotFoundException("Venta no encontrada");
      }
      if (sale.status === "CANCELLED" || sale.status === "REFUNDED") {
        throw new BadRequestException("No se pueden modificar los pagos de una venta cancelada o reembolsada");
      }

      const billingDoc = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM electronic_documents
          WHERE tenant_id = $1 AND source_type = 'SALE' AND source_id = $2
          ORDER BY created_at DESC LIMIT 1`,
        [tenantId, saleId]
      );
      if (billingDoc.rows[0]?.status === "ACCEPTED") {
        throw new ConflictException("No se pueden modificar los pagos porque la venta ya tiene factura electrónica aceptada");
      }

      const saleTotal = Number(Number(sale.total).toFixed(2));
      const newTotal = Number(
        dto.payments.reduce((acc, p) => acc + Number(p.amount), 0).toFixed(2)
      );
      if (Math.abs(saleTotal - newTotal) > 0.01) {
        throw new BadRequestException(
          `La suma de los pagos (${newTotal}) no coincide con el total de la venta (${saleTotal})`
        );
      }

      const methodIds = [...new Set(dto.payments.map((p) => p.paymentMethodId))];
      const methodsResult = await client.query<{
        id: string;
        codigo: string;
        nombre: string;
        tipo: string;
        requires_reference: boolean;
      }>(
        `SELECT id, codigo, nombre, tipo, requires_reference
           FROM payment_methods
          WHERE tenant_id = $1 AND id = ANY($2::uuid[]) AND active = TRUE`,
        [tenantId, methodIds]
      );
      const methodsMap = new Map(methodsResult.rows.map((m) => [m.id, m]));
      for (const p of dto.payments) {
        const method = methodsMap.get(p.paymentMethodId);
        if (!method) {
          throw new BadRequestException(`Método de pago no válido o inactivo (${p.paymentMethodId})`);
        }
      }

      // Check current open cash session
      const sessionResult = await client.query<{
        id: string;
        branch_id: string;
        cash_register_id: string;
        status: string;
      }>(
        `SELECT id, branch_id, cash_register_id, status
           FROM cash_sessions
          WHERE tenant_id = $1
            AND branch_id = $2
            AND status = 'OPEN'
          ORDER BY opened_at DESC
          LIMIT 1`,
        [tenantId, sale.branch_id]
      );
      const currentCashSession = sessionResult.rows[0];
      if (!currentCashSession) {
        throw new BadRequestException(
          "Los medios de pago no pueden modificarse porque no hay una caja abierta."
        );
      }

      const prevPaymentsResult = await client.query<{
        id: string;
        payment_method_id: string;
        amount: string;
        reference_number: string | null;
        financial_institution_id: string | null;
        cash_session_id: string | null;
        status: string;
      }>(
        `SELECT id, payment_method_id, amount::text, reference_number, financial_institution_id, cash_session_id, status
           FROM payments
          WHERE tenant_id = $1
            AND reference_type = 'SALE'
            AND reference_id = $2
            AND status IN ('PENDING', 'COMPLETED')
          FOR UPDATE`,
        [tenantId, saleId]
      );
      const prevPayments = prevPaymentsResult.rows;

      if (
        prevPayments.some(
          (p) => p.cash_session_id && p.cash_session_id !== currentCashSession.id
        )
      ) {
        throw new BadRequestException(
          "Solo se pueden modificar los medios de pago de ventas realizadas en el turno de caja actual."
        );
      }

      for (const prev of prevPayments) {
        await client.query(
          `UPDATE payments
              SET status = 'CANCELLED',
                  notes = COALESCE(notes, '') || ' [Corregido: ' || $3 || ']'
            WHERE id = $1 AND tenant_id = $2`,
          [prev.id, tenantId, dto.reason.trim()]
        );
      }

      const createdPaymentIds: string[] = [];
      for (const p of dto.payments) {
        const paymentIdResult = await client.query<{ id: string }>(
          `INSERT INTO payments (
            tenant_id,
            branch_id,
            payment_method_id,
            cash_session_id,
            reference_type,
            reference_id,
            direction,
            status,
            amount,
            reference_number,
            financial_institution_id,
            notes,
            created_by
          )
          VALUES (
            $1, $2, $3, $4, 'SALE', $5, 'IN', 'COMPLETED',
            $6, $7, $8, $9, $10
          )
          RETURNING id`,
          [
            tenantId,
            sale.branch_id,
            p.paymentMethodId,
            currentCashSession.id,
            saleId,
            Number(p.amount.toFixed(2)),
            p.reference?.trim() || null,
            p.financialInstitutionId || null,
            `Corrección: ${dto.reason.trim()}`,
            actor.id,
          ]
        );
        createdPaymentIds.push(paymentIdResult.rows[0].id);
      }

      await client.query(
        `UPDATE sales
            SET payment_status = 'PAID',
                total_paid = total,
                balance_due = 0,
                balance = 0
          WHERE id = $1 AND tenant_id = $2`,
        [saleId, tenantId]
      );

      this.auditService?.logEvent({
        tenantId,
        userId: actor.id ?? null,
        module: "operations",
        entity: "sales_payments",
        entityId: saleId,
        action: "CORRECT_SALE_PAYMENTS",
        before: {
          payments: prevPayments,
        },
        after: {
          payments: dto.payments,
          createdPaymentIds,
          cashSessionId: currentCashSession.id,
          reason: dto.reason.trim(),
        },
      });

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return this.detail(actor, saleId);
  }

  async voidSale(
    actor: OperationalSaleActor,
    saleId: string,
    dto: VoidOperationalSaleDto
  ) {
    if (!dto.reason || dto.reason.trim().length < 5) {
      throw new BadRequestException("El motivo de anulación debe tener al menos 5 caracteres");
    }
    if (dto.discrepancyResponseCode && dto.discrepancyResponseCode !== "2") {
      throw new BadRequestException(
        "Solo se permite el motivo DIAN 2 - Anulación de factura electrónica (Total)"
      );
    }
    const tenantId = actor.tenantId;
    if (!tenantId) {
      throw new BadRequestException("tenantId es requerido");
    }
    if (!this.db) {
      throw new Error("database unavailable");
    }

    const prepared = await this.prepareSaleVoid(actor, tenantId, saleId);
    if (!prepared.invoice) {
      await this.applySaleVoid(actor, tenantId, saleId, dto, null);
      return { ...(await this.detail(actor, saleId)), creditNote: null, voidRequest: null };
    }

    const issue = await this.billingClient.issueCreditNote(
      tenantId,
      prepared.invoice.id,
      this.buildCreditNotePayload(dto),
    );
    return this.resolveVoidAfterCreditNote(actor, tenantId, saleId, dto, prepared.invoice.id, issue);
  }

  private async prepareSaleVoid(actor: OperationalSaleActor, tenantId: string, saleId: string) {
    const roles = actor.roles ?? [];
    const isAdmin =
      roles.includes("SUPER_ADMIN") ||
      roles.includes("ADMIN") ||
      roles.includes("SUPER_USER");

    const client = await this.db!.getClient();
    try {
      await client.query("BEGIN");

      const saleResult = await client.query<{
        id: string;
        tenant_id: string;
        branch_id: string;
        total: string;
        status: string;
        payment_status: string;
        order_id: string | null;
        user_id: string | null;
      }>(
        `SELECT id, tenant_id, branch_id, total::text, status, payment_status, order_id, user_id
           FROM sales
          WHERE id = $1 AND tenant_id = $2
          FOR UPDATE`,
        [saleId, tenantId]
      );
      const sale = saleResult.rows[0];
      if (!sale) {
        throw new NotFoundException("Venta no encontrada");
      }
      if (sale.status === "CANCELLED" || sale.status === "REFUNDED") {
        throw new BadRequestException("La venta ya ha sido anulada previamente");
      }

      // Check open cash session
      const openSessionResult = await client.query<{
        id: string;
      }>(
        `SELECT id FROM cash_sessions
          WHERE tenant_id = $1 AND branch_id = $2 AND status = 'OPEN'
          ORDER BY opened_at DESC LIMIT 1`,
        [tenantId, sale.branch_id]
      );
      const currentCashSession = openSessionResult.rows[0];

      if (!isAdmin) {
        if (!currentCashSession) {
          throw new BadRequestException(
            "No puede anular la venta porque no hay una caja/turno abierto en esta sucursal."
          );
        }

        const salePayments = await client.query<{ cash_session_id: string | null }>(
          `SELECT cash_session_id FROM payments
            WHERE tenant_id = $1 AND reference_type = 'SALE' AND reference_id = $2`,
          [tenantId, saleId]
        );
        if (
          salePayments.rows.some(
            (p) => p.cash_session_id && p.cash_session_id !== currentCashSession.id
          )
        ) {
          throw new BadRequestException(
            "El cajero solo puede anular ventas realizadas dentro de su turno de caja abierto actual."
          );
        }
      }

      const invoiceResult = await client.query<{ id: string; status: string }>(
        `SELECT id, status
           FROM electronic_documents
          WHERE tenant_id = $1 AND source_type = 'SALE' AND source_id = $2
            AND document_type = 'INVOICE'
          ORDER BY created_at DESC LIMIT 1`,
        [tenantId, saleId]
      );
      const invoice = invoiceResult.rows[0] ?? null;
      if (invoice && invoice.status !== ELECTRONIC_BILLING_STATUSES.ACCEPTED) {
        throw new BadRequestException(
          `No se puede anular la venta porque su factura electrónica está en estado ${invoice.status}. Primero actualice o reconcilie el estado fiscal; solo una factura aceptada puede anularse mediante nota crédito.`
        );
      }

      await client.query("COMMIT");
      return {
        invoice: invoice?.status === ELECTRONIC_BILLING_STATUSES.ACCEPTED
          ? invoice
          : null,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  private async resolveVoidAfterCreditNote(
    actor: OperationalSaleActor,
    tenantId: string,
    saleId: string,
    dto: VoidOperationalSaleDto,
    invoiceElectronicDocumentId: string,
    issue: BillingCreditNoteIssueResult,
  ) {
    if (issue.kind === "REQUEST_REJECTED") {
      throw new BadRequestException({
        message: `No fue posible emitir la nota crédito: ${issue.message}. La venta no fue anulada.`,
        errorCode: "CREDIT_NOTE_REQUEST_REJECTED",
        solution: null,
      });
    }

    const creditNote = issue.kind === "OUTCOME"
      ? buildOnlineResultFromDocument(issue.electronicDocument)
      : buildOnlineResultFromDelivery({
          outcome: "RETRYABLE",
          statusCode: null,
          errorCode: "BILLING_BACKEND_UNREACHABLE",
          message: issue.message,
          electronicDocument: null,
        });

    if (creditNote.status === ELECTRONIC_BILLING_STATUSES.ACCEPTED) {
      await this.applySaleVoid(actor, tenantId, saleId, dto, creditNote);
      await this.closeVoidRequest(tenantId, saleId, "COMPLETED", creditNote);
      return { ...(await this.detail(actor, saleId)), creditNote, voidRequest: null };
    }

    if (creditNote.status === "REJECTED") {
      await this.closeVoidRequest(tenantId, saleId, "REJECTED", creditNote);
      throw new BadRequestException({
        message: `La DIAN rechazó la nota crédito${creditNote.errorCode ? ` (${creditNote.errorCode})` : ""}. La venta no fue anulada.`,
        errorCode: creditNote.errorCode,
        solution: creditNote.failures.find((failure) => failure.solution)?.solution ?? null,
        creditNote,
      });
    }

    const voidRequest = await this.upsertPendingVoidRequest(
      actor,
      tenantId,
      saleId,
      dto,
      invoiceElectronicDocumentId,
      creditNote,
    );
    return { ...(await this.detail(actor, saleId)), creditNote, voidRequest };
  }

  private async upsertPendingVoidRequest(
    actor: OperationalSaleActor,
    tenantId: string,
    saleId: string,
    dto: VoidOperationalSaleDto,
    invoiceElectronicDocumentId: string,
    creditNote: ElectronicBillingOnlineResult,
  ) {
    const result = await this.runQuery<{ id: string; attempt_count: number; next_attempt_at: Date }>(
      `INSERT INTO sale_void_requests (
          tenant_id, sale_id, invoice_electronic_document_id, credit_note_electronic_document_id,
          status, request_payload, actor, attempt_count, next_attempt_at, last_error
        ) VALUES (
          $1, $2, $3, $4, 'PENDING_CREDIT_NOTE', $5::jsonb, $6::jsonb, 1,
          NOW() + ($7::int * INTERVAL '1 millisecond'), $8
        )
        ON CONFLICT (tenant_id, sale_id) WHERE status = 'PENDING_CREDIT_NOTE'
        DO UPDATE SET
          credit_note_electronic_document_id = COALESCE(
            EXCLUDED.credit_note_electronic_document_id,
            sale_void_requests.credit_note_electronic_document_id
          ),
          request_payload = EXCLUDED.request_payload,
          actor = EXCLUDED.actor,
          attempt_count = sale_void_requests.attempt_count + 1,
          next_attempt_at = EXCLUDED.next_attempt_at,
          last_error = EXCLUDED.last_error,
          lease_until = NULL,
          updated_at = NOW()
        RETURNING id, attempt_count, next_attempt_at`,
      [
        tenantId,
        saleId,
        invoiceElectronicDocumentId,
        creditNote.electronicDocumentId,
        JSON.stringify(dto),
        JSON.stringify({ id: actor.id ?? null, tenantId, roles: actor.roles ?? [] }),
        VOID_REQUEST_RETRY_BASE_MS,
        creditNote.errorMessage ?? creditNote.message,
      ],
    );
    const row = result.rows[0];
    this.auditService?.logEvent({
      tenantId,
      userId: actor.id ?? null,
      module: "operations",
      entity: "sales",
      entityId: saleId,
      action: "VOID_SALE_PENDING_CREDIT_NOTE",
      after: { reason: dto.reason.trim(), creditNote },
    });
    return {
      id: row?.id ?? null,
      status: "PENDING_CREDIT_NOTE" as const,
      attemptCount: row?.attempt_count ?? 1,
      nextAttemptAt: row?.next_attempt_at ?? null,
      message:
        "La nota crédito no tuvo respuesta de la DIAN (falla de red o DIAN lenta). La anulación quedó pendiente y se completará automáticamente cuando la nota crédito sea aceptada.",
    };
  }

  private async closeVoidRequest(
    tenantId: string,
    saleId: string,
    status: "COMPLETED" | "REJECTED",
    creditNote: ElectronicBillingOnlineResult,
  ) {
    try {
      await this.runQuery(
        `UPDATE sale_void_requests
            SET status = $3,
                credit_note_electronic_document_id = COALESCE($4, credit_note_electronic_document_id),
                last_error = $5,
                completed_at = CASE WHEN $3 = 'COMPLETED' THEN NOW() ELSE completed_at END,
                lease_until = NULL,
                updated_at = NOW()
          WHERE tenant_id = $1 AND sale_id = $2 AND status = 'PENDING_CREDIT_NOTE'`,
        [
          tenantId,
          saleId,
          status,
          creditNote.electronicDocumentId,
          status === "REJECTED" ? creditNote.errorMessage ?? creditNote.message : null,
        ],
      );
    } catch (error) {
      if (!isUndefinedTableError(error)) {
        throw error;
      }
    }
  }

  /**
   * Retries pending voids whose credit note had no fiscal answer. Credit note
   * issuing is idempotent in billing (deterministic external reference).
   */
  async processDueVoidRequests(limit = 10) {
    if (!this.db) {
      return { processed: 0 };
    }
    type ClaimedVoidRequest = {
      id: string;
      tenant_id: string;
      sale_id: string;
      invoice_electronic_document_id: string | null;
      request_payload: VoidOperationalSaleDto;
      actor: { id?: string | null; roles?: string[] };
      attempt_count: number;
    };
    const claimed = await this.runQuery<ClaimedVoidRequest>(
      `UPDATE sale_void_requests
          SET lease_until = NOW() + INTERVAL '5 minutes',
              updated_at = NOW()
        WHERE id IN (
          SELECT id
            FROM sale_void_requests
           WHERE status = 'PENDING_CREDIT_NOTE'
             AND next_attempt_at <= NOW()
             AND (lease_until IS NULL OR lease_until < NOW())
           ORDER BY next_attempt_at ASC
           LIMIT $1
           FOR UPDATE SKIP LOCKED
        )
        RETURNING id, tenant_id, sale_id, invoice_electronic_document_id, request_payload, actor, attempt_count`,
      [limit],
    ).catch((error: unknown) => {
      if (isUndefinedTableError(error)) {
        return { rows: [] as ClaimedVoidRequest[] };
      }
      throw error;
    });

    for (const request of claimed.rows) {
      const actor: OperationalSaleActor = {
        id: request.actor?.id ?? undefined,
        tenantId: request.tenant_id,
        roles: request.actor?.roles ?? [],
      } as OperationalSaleActor;
      const dto = Object.assign(new VoidOperationalSaleDto(), request.request_payload);
      try {
        if (!request.invoice_electronic_document_id) {
          throw new Error("void request has no invoice electronic document");
        }
        const issue = await this.billingClient.issueCreditNote(
          request.tenant_id,
          request.invoice_electronic_document_id,
          this.buildCreditNotePayload(dto),
        );
        const creditNote = issue.kind === "OUTCOME" ? buildOnlineResultFromDocument(issue.electronicDocument) : null;
        if (creditNote?.status === ELECTRONIC_BILLING_STATUSES.ACCEPTED) {
          await this.applySaleVoid(actor, request.tenant_id, request.sale_id, dto, creditNote);
          await this.closeVoidRequest(request.tenant_id, request.sale_id, "COMPLETED", creditNote);
          continue;
        }
        if (creditNote?.status === "REJECTED" || issue.kind === "REQUEST_REJECTED") {
          const rejected = creditNote ?? buildOnlineResultFromDelivery({
            outcome: "FAILED",
            statusCode: issue.kind === "REQUEST_REJECTED" ? issue.statusCode : null,
            errorCode: "CREDIT_NOTE_REQUEST_REJECTED",
            message: issue.kind === "REQUEST_REJECTED" ? issue.message : null,
            electronicDocument: null,
          });
          await this.closeVoidRequest(request.tenant_id, request.sale_id, "REJECTED", rejected);
          this.auditService?.logEvent({
            tenantId: request.tenant_id,
            userId: actor.id ?? null,
            module: "operations",
            entity: "sales",
            entityId: request.sale_id,
            action: "VOID_SALE_CREDIT_NOTE_REJECTED",
            after: { creditNote: rejected },
          });
          continue;
        }
        await this.rescheduleVoidRequest(
          request.id,
          request.attempt_count,
          creditNote?.errorMessage ?? (issue.kind === "NETWORK_FAILURE" ? issue.message : "Nota crédito en proceso"),
          creditNote?.electronicDocumentId ?? null,
        );
      } catch (error) {
        await this.rescheduleVoidRequest(
          request.id,
          request.attempt_count,
          error instanceof Error ? error.message : String(error),
          null,
        );
      }
    }

    return { processed: claimed.rows.length };
  }

  private async rescheduleVoidRequest(
    requestId: string,
    attemptCount: number,
    lastError: string,
    creditNoteElectronicDocumentId: string | null,
  ) {
    const nextAttempt = attemptCount + 1;
    const delayMs = Math.min(
      VOID_REQUEST_RETRY_BASE_MS * Math.pow(2, Math.max(0, attemptCount - 1)),
      VOID_REQUEST_RETRY_MAX_MS,
    );
    await this.runQuery(
      `UPDATE sale_void_requests
          SET attempt_count = $2,
              status = CASE WHEN $2::int > $5::int THEN 'FAILED' ELSE status END,
              next_attempt_at = NOW() + ($3::int * INTERVAL '1 millisecond'),
              last_error = $4,
              credit_note_electronic_document_id = COALESCE($6, credit_note_electronic_document_id),
              lease_until = NULL,
              updated_at = NOW()
        WHERE id = $1`,
      [requestId, nextAttempt, delayMs, lastError, VOID_REQUEST_MAX_ATTEMPTS, creditNoteElectronicDocumentId],
    );
  }

  private async runQuery<T>(text: string, params: unknown[]): Promise<{ rows: T[] }> {
    const client = await this.db!.getClient();
    try {
      const result = await client.query(text, params);
      return { rows: result.rows as T[] };
    } finally {
      client.release();
    }
  }

  private buildCreditNotePayload(dto: VoidOperationalSaleDto) {
    return {
      discrepancyResponseCode: dto.discrepancyResponseCode ?? "2",
      discrepancyResponseDescription: dto.discrepancyResponseDescription?.trim() || dto.reason.trim(),
      noteReason: dto.reason.trim(),
    };
  }

  /**
   * Lineas a devolver al anular una venta que viene de un pedido. Devuelve null si la venta
   * tiene salidas de inventario propias (reference_table = 'sales'): entonces es el flujo normal.
   */
  private async loadOrderSaleVoidLines(
    client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> },
    tenantId: string,
    saleId: string
  ): Promise<OrderSaleVoidLine[] | null> {
    const ownMovements = await client.query(
      `SELECT 1
         FROM stock_movements
        WHERE tenant_id = $1 AND reference_type = 'SALE' AND reference_id = $2
          AND reference_table = 'sales' AND type = 'OUT'
        LIMIT 1`,
      [tenantId, saleId]
    );
    if (ownMovements.rows.length > 0) {
      return null;
    }

    const linesResult = await client.query(
      `SELECT si.product_id,
              SUM(si.quantity)::text AS quantity,
              BOOL_OR(COALESCE((to_jsonb(p) ->> 'is_inventoryable')::boolean, TRUE)) AS is_inventoryable,
              BOOL_OR(COALESCE((to_jsonb(p) ->> 'requires_serial')::boolean, FALSE)) AS requires_serial
         FROM sale_items si
         JOIN products p ON p.id = si.product_id AND p.tenant_id = $1
        WHERE si.sale_id = $2
        GROUP BY si.product_id
        ORDER BY si.product_id`,
      [tenantId, saleId]
    );
    return linesResult.rows
      .map((row) => ({
        productId: String(row.product_id),
        quantity: Number(row.quantity),
        isInventoryable: row.is_inventoryable !== false,
        requiresSerial: Boolean(row.requires_serial),
      }))
      .filter((line) => line.isInventoryable && line.quantity > 0);
  }

  /**
   * Devuelve al inventario lo facturado en una venta de pedido: una entrada por producto en la
   * sucursal de la entrega y, si la entrega consumio lotes, el saldo vuelve a esos lotes (los de la
   * salida mas reciente primero), descontando lo ya devuelto por otras anulaciones del mismo pedido.
   * No toca la entrega, FEFO ni consumeDeliveryLots.
   */
  private async returnOrderSaleInventory(
    client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> },
    input: {
      tenantId: string;
      saleId: string;
      orderId: string;
      userId: string | null;
      lines: OrderSaleVoidLine[];
    }
  ) {
    const round3 = (value: number) => Math.round(value * 1000) / 1000;
    const { tenantId, saleId, orderId } = input;

    for (const line of input.lines) {
      const orderOuts = await client.query(
        `SELECT id, quantity::text AS quantity, branch_id, terminal_id, pos_session_code, user_id
           FROM stock_movements
          WHERE tenant_id = $1 AND reference_type = 'SALE' AND reference_table = 'orders'
            AND reference_id = $2 AND product_id = $3 AND type = 'OUT'
          ORDER BY created_at DESC, id DESC`,
        [tenantId, orderId, line.productId]
      );
      if (orderOuts.rows.length === 0) {
        continue;
      }

      const returnedResult = await client.query(
        `SELECT COALESCE(SUM(sm.quantity), 0)::text AS returned
           FROM stock_movements sm
           JOIN sales s ON s.id::text = sm.reference_id::text AND s.tenant_id = sm.tenant_id
          WHERE sm.tenant_id = $1 AND sm.reference_type = 'SALE' AND sm.reference_table = 'sales'
            AND sm.type = 'IN' AND sm.product_id = $3 AND s.order_id = $2 AND s.id <> $4`,
        [tenantId, orderId, line.productId, saleId]
      );
      const delivered = orderOuts.rows.reduce((sum, row) => sum + Number(row.quantity), 0);
      const returnable = round3(delivered - Number(returnedResult.rows[0]?.returned ?? 0));
      const quantity = round3(Math.min(line.quantity, returnable));
      if (quantity <= 0) {
        continue;
      }

      const reference = orderOuts.rows[0];
      const reverseMovement = await this.stockMovementService!.createMovement(
        {
          id: crypto.randomUUID(),
          tenantId,
          productId: line.productId,
          type: "IN",
          quantity,
          referenceType: "SALE",
          referenceId: saleId,
          branchId: reference.branch_id,
          terminalId: reference.terminal_id,
          posSessionCode: reference.pos_session_code,
          userId: input.userId ?? reference.user_id,
          referenceTable: "sales",
          createdAt: new Date(),
        },
        client as never
      );

      const deliveredLots = await client.query(
        `SELECT sml.lot_id, sml.location_id, sml.quantity::text AS quantity
           FROM stock_movement_lots sml
           JOIN stock_movements sm ON sm.id = sml.stock_movement_id
          WHERE sml.tenant_id = $1 AND sml.stock_movement_id = ANY($2::uuid[])
          ORDER BY sm.created_at DESC, sml.created_at DESC, sml.id DESC`,
        [tenantId, orderOuts.rows.map((row) => row.id)]
      );
      if (deliveredLots.rows.length === 0) {
        continue;
      }

      const returnedLots = await client.query(
        `SELECT sml.lot_id, sml.location_id, SUM(sml.quantity)::text AS quantity
           FROM stock_movement_lots sml
           JOIN stock_movements sm ON sm.id = sml.stock_movement_id
           JOIN sales s ON s.id::text = sm.reference_id::text AND s.tenant_id = sm.tenant_id
          WHERE sml.tenant_id = $1 AND sm.reference_table = 'sales' AND sm.type = 'IN'
            AND sm.product_id = $3 AND s.order_id = $2 AND s.id <> $4
          GROUP BY sml.lot_id, sml.location_id`,
        [tenantId, orderId, line.productId, saleId]
      );
      const lotKey = (lotId: string, locationId: string | null) => `${lotId}|${locationId ?? ""}`;
      const alreadyReturned = new Map<string, number>(
        returnedLots.rows.map((row) => [lotKey(row.lot_id, row.location_id), Number(row.quantity)])
      );

      let remaining = quantity;
      for (const lot of deliveredLots.rows) {
        if (remaining <= 0) {
          break;
        }
        const key = lotKey(lot.lot_id, lot.location_id);
        const consumedByPrevious = Math.min(alreadyReturned.get(key) ?? 0, Number(lot.quantity));
        alreadyReturned.set(key, round3((alreadyReturned.get(key) ?? 0) - consumedByPrevious));
        const available = round3(Number(lot.quantity) - consumedByPrevious);
        if (available <= 0) {
          continue;
        }
        const lotQty = round3(Math.min(available, remaining));
        remaining = round3(remaining - lotQty);

        const balanceResult = await client.query(
          `UPDATE inventory_lot_balances
              SET quantity_on_hand = quantity_on_hand + $1,
                  last_movement_at = NOW(),
                  updated_at = NOW()
            WHERE tenant_id = $2
              AND branch_id = $3
              AND product_id = $4
              AND lot_id = $5
              AND (($6::uuid IS NULL AND location_id IS NULL) OR location_id = $6::uuid)
            RETURNING id`,
          [lotQty, tenantId, reference.branch_id, line.productId, lot.lot_id, lot.location_id]
        );
        if (!balanceResult.rows[0]) {
          throw new BadRequestException("inventory lot balance not found for reversal");
        }

        await client.query(
          `INSERT INTO stock_movement_lots (
            id, tenant_id, stock_movement_id, product_id, lot_id,
            location_id, quantity, created_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
          )`,
          [tenantId, reverseMovement.id, line.productId, lot.lot_id, lot.location_id, lotQty]
        );
      }

      if (remaining > 0) {
        throw new BadRequestException(
          "No se encontraron los lotes de la entrega del pedido para devolver el inventario"
        );
      }
    }
  }

  /**
   * Reembolsa en caja lo pagado en el pedido hasta el total de la venta anulada, descontando lo ya
   * reembolsado por anulaciones de otras ventas del mismo pedido. Crea el pago REFUND (OUT) y su
   * movimiento de caja como el flujo del POS; marca REFUNDED el pago del pedido solo si se devuelve
   * completo. Devuelve el monto reembolsado.
   */
  private async refundOrderSalePayments(
    client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> },
    input: {
      tenantId: string;
      saleId: string;
      orderId: string;
      branchId: string;
      saleTotal: number;
      cashSessionId: string | null;
      reason: string;
      userId: string | null;
    }
  ) {
    const round2 = (value: number) => Math.round(value * 100) / 100;
    const { tenantId, saleId, orderId } = input;

    const orderPayments = await client.query(
      `SELECT id, payment_method_id, amount::text AS amount, reference_number, cash_session_id
         FROM payments
        WHERE tenant_id = $1 AND reference_type = 'SALES_ORDER' AND reference_id = $2
          AND direction = 'IN' AND status = 'COMPLETED'
        ORDER BY created_at DESC, id DESC
        FOR UPDATE`,
      [tenantId, orderId]
    );
    if (orderPayments.rows.length === 0) {
      return 0;
    }

    // Reembolsos de otras ventas del mismo pedido y pagos del pedido ya devueltos completos.
    const previous = await client.query(
      `SELECT
          COALESCE((
            SELECT SUM(p.amount)
              FROM payments p
              JOIN sales s ON s.id::text = p.reference_id::text AND s.tenant_id = p.tenant_id
             WHERE p.tenant_id = $1 AND p.reference_type = 'REFUND' AND p.direction = 'OUT'
               AND p.status = 'COMPLETED' AND s.order_id = $2 AND s.id <> $3
          ), 0)::text AS refunded_by_other_sales,
          COALESCE((
            SELECT SUM(p.amount)
              FROM payments p
             WHERE p.tenant_id = $1 AND p.reference_type = 'SALES_ORDER' AND p.reference_id = $2
               AND p.direction = 'IN' AND p.status = 'REFUNDED'
          ), 0)::text AS fully_refunded_order_payments`,
      [tenantId, orderId, saleId]
    );
    let consumed = round2(
      Math.max(
        Number(previous.rows[0]?.refunded_by_other_sales ?? 0) -
          Number(previous.rows[0]?.fully_refunded_order_payments ?? 0),
        0
      )
    );

    let remaining = round2(Math.max(input.saleTotal, 0));
    let refunded = 0;
    for (const payment of orderPayments.rows) {
      if (remaining <= 0) {
        break;
      }
      const paymentAmount = Number(payment.amount);
      const alreadyUsed = Math.min(consumed, paymentAmount);
      consumed = round2(consumed - alreadyUsed);
      const available = round2(paymentAmount - alreadyUsed);
      if (available <= 0) {
        continue;
      }
      const refundAmount = round2(Math.min(available, remaining));
      remaining = round2(remaining - refundAmount);
      refunded = round2(refunded + refundAmount);

      const targetCashSessionId = input.cashSessionId ?? payment.cash_session_id ?? null;
      const refundPayment = await client.query(
        `INSERT INTO payments (
          tenant_id, branch_id, payment_method_id, cash_session_id,
          reference_type, reference_id, direction, status, amount,
          reference_number, notes, created_by
        ) VALUES (
          $1, $2, $3, $4, 'REFUND', $5, 'OUT', 'COMPLETED', $6,
          $7, $8, $9
        ) RETURNING id`,
        [
          tenantId,
          input.branchId,
          payment.payment_method_id,
          targetCashSessionId,
          saleId,
          refundAmount,
          payment.reference_number,
          `Anulación de venta de pedido: ${input.reason}`,
          input.userId,
        ]
      );
      const refundPaymentId = refundPayment.rows[0]?.id;

      if (targetCashSessionId) {
        await client.query(
          `INSERT INTO cash_movements (
            tenant_id, branch_id, cash_session_id, payment_id,
            movement_type, direction, reference_type, reference_id,
            amount, description, created_by, created_at
          ) VALUES (
            $1, $2, $3, $4, 'PAYMENT', 'OUT', 'REFUND', $5, $6, $7, $8, NOW()
          )`,
          [
            tenantId,
            input.branchId,
            targetCashSessionId,
            refundPaymentId,
            saleId,
            refundAmount,
            `Anulación venta ${saleId} (pedido ${orderId}): ${input.reason}`,
            input.userId,
          ]
        );
      }

      if (alreadyUsed === 0 && refundAmount === paymentAmount) {
        await client.query(
          `UPDATE payments SET status = 'REFUNDED' WHERE id = $1 AND tenant_id = $2`,
          [payment.id, tenantId]
        );
      }
    }

    return refunded;
  }

  private async applySaleVoid(
    actor: OperationalSaleActor,
    tenantId: string,
    saleId: string,
    dto: VoidOperationalSaleDto,
    creditNote: ElectronicBillingOnlineResult | null,
  ) {
    const client = await this.db!.getClient();
    try {
      await client.query("BEGIN");

      const saleResult = await client.query<{
        id: string;
        branch_id: string;
        status: string;
        payment_status: string;
        order_id?: string | null;
        total?: string | null;
      }>(
        `SELECT id, branch_id, status, payment_status, order_id, total::text AS total
           FROM sales
          WHERE id = $1 AND tenant_id = $2
          FOR UPDATE`,
        [saleId, tenantId]
      );
      const sale = saleResult.rows[0];
      if (!sale) {
        throw new NotFoundException("Venta no encontrada");
      }
      if (sale.status === "CANCELLED" || sale.status === "REFUNDED") {
        await client.query("COMMIT");
        return false;
      }

      const openSessionResult = await client.query<{ id: string }>(
        `SELECT id FROM cash_sessions
          WHERE tenant_id = $1 AND branch_id = $2 AND status = 'OPEN'
          ORDER BY opened_at DESC LIMIT 1`,
        [tenantId, sale.branch_id]
      );
      const currentCashSession = openSessionResult.rows[0];

      // Venta que viene de un pedido: su salida de inventario se creo al entregar el pedido
      // (reference_table = 'orders'), no a nombre de la venta. Flujo aparte; las ventas del POS
      // (con salidas propias) siguen exactamente el flujo de abajo.
      const orderSaleLines = sale.order_id
        ? await this.loadOrderSaleVoidLines(client, tenantId, saleId)
        : null;

      // 1. Return inventory / Kardex if requested
      if (dto.returnInventory !== false) {
        const stockMovements = await client.query<{
          id: string;
          product_id: string;
          quantity: string;
          branch_id: string;
          terminal_id: string | null;
          pos_session_code: string | null;
          user_id: string | null;
        }>(
          `SELECT id, product_id, quantity::text, branch_id, terminal_id, pos_session_code, user_id
             FROM stock_movements
            WHERE tenant_id = $1 AND reference_type = 'SALE' AND reference_id = $2
            AND reference_table = 'sales' AND type = 'OUT'
            ORDER BY created_at ASC, id ASC`,
          [tenantId, saleId]
        );

        for (const mov of stockMovements.rows) {
          const reverseMovement = await this.stockMovementService!.createMovement(
            {
              id: crypto.randomUUID(),
              tenantId,
              productId: mov.product_id,
              type: "IN",
              quantity: Number(mov.quantity),
              referenceType: "SALE",
              referenceId: saleId,
              branchId: mov.branch_id,
              terminalId: mov.terminal_id,
              posSessionCode: mov.pos_session_code,
              userId: actor.id ?? mov.user_id,
              referenceTable: "sales",
              createdAt: new Date(),
            },
            client
          );
          const reverseMovId = reverseMovement.id;

          const lotLinks = await client.query<{
            product_id: string;
            lot_id: string;
            location_id: string | null;
            quantity: string;
          }>(
            `SELECT product_id, lot_id, location_id, quantity::text
               FROM stock_movement_lots
              WHERE tenant_id = $1 AND stock_movement_id = $2
              ORDER BY created_at ASC, id ASC`,
            [tenantId, mov.id]
          );

          for (const link of lotLinks.rows) {
            const lotQty = Number(link.quantity);
            const balanceResult = await client.query<{ id: string }>(
              `UPDATE inventory_lot_balances
                  SET quantity_on_hand = quantity_on_hand + $1,
                      last_movement_at = NOW(),
                      updated_at = NOW()
                WHERE tenant_id = $2
                  AND branch_id = $3
                  AND product_id = $4
                  AND lot_id = $5
                  AND (($6::uuid IS NULL AND location_id IS NULL) OR location_id = $6::uuid)
                RETURNING id`,
              [
                lotQty,
                tenantId,
                mov.branch_id,
                mov.product_id,
                link.lot_id,
                link.location_id,
              ]
            );

            if (!balanceResult.rows[0]) {
              throw new BadRequestException(
                "inventory lot balance not found for reversal"
              );
            }

            await client.query(
              `INSERT INTO stock_movement_lots (
                id, tenant_id, stock_movement_id, product_id, lot_id,
                location_id, quantity, created_at
              ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
              )`,
              [
                tenantId,
                reverseMovId,
                link.product_id,
                link.lot_id,
                link.location_id,
                lotQty,
              ]
            );
          }
        }
      }

      if (orderSaleLines && sale.order_id && dto.returnInventory !== false) {
        await this.returnOrderSaleInventory(client, {
          tenantId,
          saleId,
          orderId: sale.order_id,
          userId: actor.id ?? null,
          lines: orderSaleLines,
        });
      }

      // 1b. Series: RETURNED si el inventario vuelve; si no, evento VOIDED_NOT_RETURNED.
      if (this.productSerialService) {
        await this.productSerialService.markReturnedForSale(client, {
          tenantId,
          saleId,
          returnInventory: dto.returnInventory !== false,
          userId: actor.id ?? null,
          reason: dto.reason ?? null,
        });
        if (orderSaleLines && sale.order_id) {
          await this.productSerialService.markReturnedForOrderSale(client, {
            tenantId,
            saleId,
            orderId: sale.order_id,
            lines: orderSaleLines
              .filter((line) => line.requiresSerial)
              .map((line) => ({ productId: line.productId, quantity: line.quantity })),
            returnInventory: dto.returnInventory !== false,
            userId: actor.id ?? null,
            reason: dto.reason ?? null,
          });
        }
      }

      // 2. Payments & Cash session refund
      const paymentsResult = await client.query<{
        id: string;
        payment_method_id: string;
        amount: string;
        reference_number: string | null;
        cash_session_id: string | null;
        status: string;
      }>(
        `SELECT id, payment_method_id, amount::text, reference_number, cash_session_id, status
           FROM payments
          WHERE tenant_id = $1 AND reference_type = 'SALE' AND reference_id = $2
            AND status IN ('PENDING', 'COMPLETED')
          FOR UPDATE`,
        [tenantId, saleId]
      );
      let finalSaleStatus = paymentsResult.rows.some(
        (payment) => payment.status === "COMPLETED"
      )
        ? "REFUNDED"
        : "CANCELLED";

      for (const p of paymentsResult.rows) {
        const pAmount = Number(p.amount);
        if (p.status === "COMPLETED") {
          const targetCashSessionId = currentCashSession?.id ?? p.cash_session_id;

          const refundPaymentResult = await client.query<{ id: string }>(
            `INSERT INTO payments (
              tenant_id, branch_id, payment_method_id, cash_session_id,
              reference_type, reference_id, direction, status, amount,
              reference_number, notes, created_by
            ) VALUES (
              $1, $2, $3, $4, 'REFUND', $5, 'OUT', 'COMPLETED', $6,
              $7, $8, $9
            ) RETURNING id`,
            [
              tenantId,
              sale.branch_id,
              p.payment_method_id,
              targetCashSessionId,
              saleId,
              pAmount,
              p.reference_number,
              `Anulación de venta: ${dto.reason.trim()}`,
              actor.id,
            ]
          );
          const refundPaymentId = refundPaymentResult.rows[0].id;

          if (targetCashSessionId) {
            await client.query(
              `INSERT INTO cash_movements (
                tenant_id, branch_id, cash_session_id, payment_id,
                movement_type, direction, reference_type, reference_id,
                amount, description, created_by, created_at
              ) VALUES (
                $1, $2, $3, $4, 'PAYMENT', 'OUT', 'REFUND', $5, $6, $7, $8, NOW()
              )`,
              [
                tenantId,
                sale.branch_id,
                targetCashSessionId,
                refundPaymentId,
                saleId,
                pAmount,
                `Anulación venta ${saleId}: ${dto.reason.trim()}`,
                actor.id,
              ]
            );
          }

          await client.query(
            `UPDATE payments SET status = 'REFUNDED' WHERE id = $1 AND tenant_id = $2`,
            [p.id, tenantId]
          );
        } else {
          await client.query(
            `UPDATE payments SET status = 'CANCELLED' WHERE id = $1 AND tenant_id = $2`,
            [p.id, tenantId]
          );
        }
      }

      // 2b. Venta de pedido: los pagos quedaron a nombre del pedido (SALES_ORDER), no de la venta.
      // Flujo aparte: solo si la venta no tiene pagos propios; las ventas del POS no entran aqui.
      if (sale.order_id && paymentsResult.rows.length === 0) {
        const refunded = await this.refundOrderSalePayments(client, {
          tenantId,
          saleId,
          orderId: sale.order_id,
          branchId: sale.branch_id,
          saleTotal: Number(sale.total ?? 0),
          cashSessionId: currentCashSession?.id ?? null,
          reason: dto.reason.trim(),
          userId: actor.id ?? null,
        });
        if (refunded > 0) {
          finalSaleStatus = "REFUNDED";
        }
      }

      // 3. Update Sale
      await client.query(
        `UPDATE sales
            SET status = $3,
                total_paid = 0,
                balance = 0,
                balance_due = 0,
                payment_status = 'PENDING'
          WHERE id = $1 AND tenant_id = $2`,
        [saleId, tenantId, finalSaleStatus]
      );

      this.auditService?.logEvent({
        tenantId,
        userId: actor.id ?? null,
        module: "operations",
        entity: "sales",
        entityId: saleId,
        action: "VOID_SALE",
        before: {
          status: sale.status,
          paymentStatus: sale.payment_status,
        },
        after: {
          status: finalSaleStatus,
          paymentStatus: "PENDING",
          reason: dto.reason.trim(),
          discrepancyResponseCode: dto.discrepancyResponseCode ?? "2",
          creditNote,
        },
      });

      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async issueDebitNote(
    actor: OperationalSaleActor,
    saleId: string,
    dto: OperationalDebitNoteDto
  ) {
    const tenantId = actor.tenantId;
    if (!tenantId) {
      throw new BadRequestException("tenantId es requerido");
    }
    if (!this.db) {
      throw new Error("database unavailable");
    }

    const client = await this.db.getClient();
    try {
      const billingDocResult = await client.query<{
        id: string;
        status: string;
        document_type: string;
      }>(
        `SELECT id, status, document_type
           FROM electronic_documents
          WHERE tenant_id = $1 AND source_type = 'SALE' AND source_id = $2
            AND document_type = 'INVOICE'
          ORDER BY created_at DESC LIMIT 1`,
        [tenantId, saleId]
      );
      const billingDoc = billingDocResult.rows[0];
      if (!billingDoc || billingDoc.status !== ELECTRONIC_BILLING_STATUSES.ACCEPTED) {
        throw new BadRequestException(
          "No se puede emitir una Nota Débito sin una factura electrónica aceptada previa."
        );
      }

      const debitNoteResult = await this.billingClient.issueDebitNote(tenantId, billingDoc.id, {
        discrepancyResponseCode: dto.discrepancyResponseCode,
        discrepancyResponseDescription: dto.discrepancyResponseDescription ?? dto.reason,
        noteReason: dto.reason,
        amount: dto.amount,
      });

      if (debitNoteResult?.id) {
        await client.query(
          `INSERT INTO electronic_documents (
            id, tenant_id, source_type, source_id, document_type,
            status, provider_status, provider_document_id,
            created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, 'SALE', $2, 'DEBIT_NOTE',
            $3, $4, $5, NOW(), NOW()
          )`,
          [
            tenantId,
            saleId,
            debitNoteResult.status ?? "SENT",
            debitNoteResult.status ?? "SENT",
            debitNoteResult.id,
          ]
        );
      }

      this.auditService?.logEvent({
        tenantId,
        userId: actor.id ?? null,
        module: "operations",
        entity: "sales",
        entityId: saleId,
        action: "ISSUE_DEBIT_NOTE",
        after: {
          debitNoteResult,
          reason: dto.reason,
          amount: dto.amount,
        },
      });
    } finally {
      client.release();
    }

    return this.detail(actor, saleId);
  }
}

