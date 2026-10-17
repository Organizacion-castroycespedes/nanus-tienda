import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { ELECTRONIC_BILLING_CREDENTIAL_RESOLVER, TenantElectronicBillingCredentialResolver } from "./credentials";
import {
  ElectronicBillingSaleEventController,
  SaleCompletedForElectronicBillingConsumerService,
} from "./consumers";
import { ElectronicBillingProviderRegistry } from "./providers/electronic-billing-provider-registry";
import { ElectronicBillingAdminController } from "./admin/electronic-billing-admin.controller";
import { ElectronicBillingAdminService } from "./admin/electronic-billing-admin.service";
import { ElectronicBillingProviderResolver } from "./providers/electronic-billing-provider-resolver";
import {
  ElectronicBillingClient,
  ElectronicBillingMapper,
  ElectronicBillingProviderAdapter,
  ElectronicBillingProviderBootstrap,
} from "./providers/f\u0061ctucore";
import {
  ElectronicBillingProviderRepository,
  ElectronicBillingInboxRepository,
  ElectronicDocumentAttachmentRepository,
  ElectronicDocumentDeliveryRepository,
  ElectronicDocumentEventRepository,
  ElectronicDocumentFailureRepository,
  ElectronicDocumentLineRepository,
  ElectronicDocumentReferenceRepository,
  ElectronicDocumentRepository,
  ElectronicDocumentTaxRepository,
  TenantElectronicBillingConfigRepository,
} from "./repositories";
import {
  ElectronicBillingCreditNoteService,
  ElectronicBillingFailureService,
  ElectronicBillingProcessingService,
  ElectronicBillingService,
} from "./services";
import { ElectronicBillingBackgroundService, ElectronicBillingGraphicBackfillWorker } from "./workers";
import {
  ELECTRONIC_BILLING_OPERATIONAL_APPROVAL,
} from "./admin/electronic-billing-write-readiness";
import { DatabaseElectronicBillingOperationalApproval } from "./admin/electronic-billing-operational-approval.repository";

@Module({
  imports: [DatabaseModule],
  controllers: [ElectronicBillingSaleEventController, ElectronicBillingAdminController],
  providers: [
    ElectronicBillingProviderRegistry,
    ElectronicBillingProviderResolver,
    ElectronicBillingClient,
    ElectronicBillingMapper,
    ElectronicBillingProviderAdapter,
    ElectronicBillingProviderBootstrap,
    ElectronicBillingAdminService,
    DatabaseElectronicBillingOperationalApproval,
    {
      provide: ELECTRONIC_BILLING_OPERATIONAL_APPROVAL,
      useExisting: DatabaseElectronicBillingOperationalApproval,
    },
    {
      provide: ELECTRONIC_BILLING_CREDENTIAL_RESOLVER,
      useClass: TenantElectronicBillingCredentialResolver,
    },
    SaleCompletedForElectronicBillingConsumerService,
    ElectronicBillingService,
    ElectronicBillingProcessingService,
    ElectronicBillingFailureService,
    ElectronicBillingCreditNoteService,
    ElectronicBillingBackgroundService,
    ElectronicBillingGraphicBackfillWorker,
    ElectronicBillingProviderRepository,
    ElectronicBillingInboxRepository,
    TenantElectronicBillingConfigRepository,
    ElectronicDocumentRepository,
    ElectronicDocumentLineRepository,
    ElectronicDocumentTaxRepository,
    ElectronicDocumentReferenceRepository,
    ElectronicDocumentEventRepository,
    ElectronicDocumentAttachmentRepository,
    ElectronicDocumentDeliveryRepository,
    ElectronicDocumentFailureRepository,
  ],
  exports: [
    ElectronicBillingProviderRegistry,
    ElectronicBillingProviderResolver,
    ElectronicBillingClient,
    ElectronicBillingMapper,
    ElectronicBillingProviderAdapter,
    ElectronicBillingService,
    ElectronicBillingProcessingService,
    ElectronicBillingFailureService,
    ElectronicBillingBackgroundService,
    ElectronicBillingProviderRepository,
    ElectronicBillingInboxRepository,
    TenantElectronicBillingConfigRepository,
    ElectronicDocumentRepository,
    ElectronicDocumentLineRepository,
    ElectronicDocumentTaxRepository,
    ElectronicDocumentReferenceRepository,
    ElectronicDocumentEventRepository,
    ElectronicDocumentAttachmentRepository,
    ElectronicDocumentDeliveryRepository,
    ElectronicDocumentFailureRepository,
  ],
})
export class ElectronicBillingModule {}
