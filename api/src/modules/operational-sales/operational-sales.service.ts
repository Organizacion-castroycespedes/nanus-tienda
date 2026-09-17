import { BadGatewayException, BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { AuditService } from "../../common/services/audit.service";
import { OperationalSaleScopeService, type OperationalSaleActor } from "../../common/services/operational-sale-scope.service";
import { BillingIntegrationClient } from "../integration-outbox/services/billing-integration-client";
import { normalizeOperationalSalesQuery, type OperationalSalesQueryDto } from "./dto/operational-sales-query.dto";
import { OperationalSalesRepository } from "./operational-sales.repository";
import { OperationalDashboardRepository } from "./operational-dashboard.repository";
import { normalizeOperationalDashboardQuery, type OperationalDashboardQueryDto } from "./dto/operational-dashboard-query.dto";

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
}
