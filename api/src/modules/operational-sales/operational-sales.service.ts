import { BadGatewayException, BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { AuditService } from "../../common/services/audit.service";
import { OperationalSaleScopeService, type OperationalSaleActor } from "../../common/services/operational-sale-scope.service";
import { BillingIntegrationClient } from "../integration-outbox/services/billing-integration-client";
import { normalizeOperationalSalesQuery, type OperationalSalesQueryDto } from "./dto/operational-sales-query.dto";
import { OperationalSalesRepository } from "./operational-sales.repository";
import { OperationalDashboardRepository } from "./operational-dashboard.repository";
import { normalizeOperationalDashboardQuery, type OperationalDashboardQueryDto } from "./dto/operational-dashboard-query.dto";

import { DatabaseService } from "../../common/db/database.service";
import { UpdateSaleCustomerDto } from "./dto/update-sale-customer.dto";
import { CorrectSalePaymentsDto } from "./dto/correct-sale-payments.dto";

const OPERATIONAL_FE_PROVIDER_RECOVERY_AUDIT_ACTION = "OP_FE_PROVIDER_RECOVERY";

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
}

