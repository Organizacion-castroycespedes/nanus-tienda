import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import {
  ElectronicBillingSaleEventController,
  SaleCompletedForElectronicBillingConsumerService,
} from "./consumers";
import { ElectronicBillingProviderRegistry } from "./providers/electronic-billing-provider-registry";
import { ElectronicBillingProviderResolver } from "./providers/electronic-billing-provider-resolver";
import {
  ELECTRONIC_BILLING_CREDENTIAL_RESOLVER,
  ElectronicBillingClient,
  ElectronicBillingMapper,
  ElectronicBillingNoopCredentialResolver,
  ElectronicBillingProviderAdapter,
  ElectronicBillingProviderBootstrap,
} from "./providers/f\u0061ctucore";
import {
  ElectronicBillingProviderRepository,
  ElectronicBillingInboxRepository,
  ElectronicDocumentAttachmentRepository,
  ElectronicDocumentDeliveryRepository,
  ElectronicDocumentEventRepository,
  ElectronicDocumentLineRepository,
  ElectronicDocumentReferenceRepository,
  ElectronicDocumentRepository,
  ElectronicDocumentTaxRepository,
  TenantElectronicBillingConfigRepository,
} from "./repositories";
import { ElectronicBillingProcessingService, ElectronicBillingService } from "./services";
import { ElectronicBillingBackgroundService } from "./workers";

@Module({
  imports: [DatabaseModule],
  controllers: [ElectronicBillingSaleEventController],
  providers: [
    ElectronicBillingProviderRegistry,
    ElectronicBillingProviderResolver,
    ElectronicBillingClient,
    ElectronicBillingMapper,
    ElectronicBillingProviderAdapter,
    ElectronicBillingProviderBootstrap,
    {
      provide: ELECTRONIC_BILLING_CREDENTIAL_RESOLVER,
      useClass: ElectronicBillingNoopCredentialResolver,
    },
    SaleCompletedForElectronicBillingConsumerService,
    ElectronicBillingService,
    ElectronicBillingProcessingService,
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
  ],
  exports: [
    ElectronicBillingProviderRegistry,
    ElectronicBillingProviderResolver,
    ElectronicBillingClient,
    ElectronicBillingMapper,
    ElectronicBillingProviderAdapter,
    ElectronicBillingService,
    ElectronicBillingProcessingService,
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
  ],
})
export class ElectronicBillingModule {}
