import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/db/database.module";
import {
  ElectronicBillingProviderRepository,
  ElectronicDocumentAttachmentRepository,
  ElectronicDocumentDeliveryRepository,
  ElectronicDocumentEventRepository,
  ElectronicDocumentLineRepository,
  ElectronicDocumentReferenceRepository,
  ElectronicDocumentRepository,
  ElectronicDocumentTaxRepository,
  TenantElectronicBillingConfigRepository,
} from "./repositories/electronic-billing.repositories";
import {
  ElectronicBillingProviderRegistry,
} from "./providers/electronic-billing-provider-registry";
import {
  ElectronicBillingProviderResolver,
} from "./providers/electronic-billing-provider-resolver";
import { FactuCoreProviderBootstrap } from "./providers/factucore/factucore.bootstrap";
import { FactuCoreClient } from "./providers/factucore/factucore.client";
import { FactuCoreMapper } from "./providers/factucore/factucore.mapper";
import { FactuCoreProvider, NoopFactuCoreCredentialResolver } from "./providers/factucore/factucore.provider";
import { FACTUCORE_CREDENTIAL_RESOLVER } from "./providers/factucore/factucore.types";
import type { FactuCoreCredentialResolver } from "./providers/factucore/factucore.types";
import { ElectronicBillingBackgroundService } from "./electronic-billing-background.service";
import { ElectronicBillingService } from "./electronic-billing.service";
import { ElectronicBillingProcessingService } from "./electronic-billing-processing.service";

@Module({
  imports: [DatabaseModule],
  providers: [
    ElectronicBillingProviderRepository,
    TenantElectronicBillingConfigRepository,
    ElectronicDocumentRepository,
    ElectronicDocumentLineRepository,
    ElectronicDocumentTaxRepository,
    ElectronicDocumentReferenceRepository,
    ElectronicDocumentEventRepository,
    ElectronicDocumentAttachmentRepository,
    ElectronicDocumentDeliveryRepository,
    ElectronicBillingProviderRegistry,
    ElectronicBillingProviderResolver,
    FactuCoreClient,
    FactuCoreMapper,
    FactuCoreProviderBootstrap,
    {
      provide: FACTUCORE_CREDENTIAL_RESOLVER,
      useClass: NoopFactuCoreCredentialResolver,
    },
    {
      provide: FactuCoreProvider,
      useFactory: (
        client: FactuCoreClient,
        credentialResolver: FactuCoreCredentialResolver,
        mapper: FactuCoreMapper,
      ) => new FactuCoreProvider(client, credentialResolver, mapper),
      inject: [FactuCoreClient, FACTUCORE_CREDENTIAL_RESOLVER, FactuCoreMapper],
    },
    ElectronicBillingService,
    ElectronicBillingProcessingService,
    ElectronicBillingBackgroundService,
  ],
  exports: [
    ElectronicBillingProviderRepository,
    TenantElectronicBillingConfigRepository,
    ElectronicDocumentRepository,
    ElectronicDocumentLineRepository,
    ElectronicDocumentTaxRepository,
    ElectronicDocumentReferenceRepository,
    ElectronicDocumentEventRepository,
    ElectronicDocumentAttachmentRepository,
    ElectronicDocumentDeliveryRepository,
    ElectronicBillingProviderRegistry,
    ElectronicBillingProviderResolver,
    FactuCoreClient,
    FactuCoreMapper,
    FactuCoreProvider,
    ElectronicBillingService,
    ElectronicBillingProcessingService,
    ElectronicBillingBackgroundService,
  ],
})
export class ElectronicBillingModule {}
