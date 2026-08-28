import { Module } from "@nestjs/common";
import { CertificatesModule } from "./modules/certificates/certificates.module";
import { DianModule } from "./modules/dian/dian.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { FiscalLookupModule } from "./modules/fiscal-lookup/fiscal-lookup.module";
import { HealthModule } from "./modules/health/health.module";
import { DatabaseModule } from "./modules/database/database.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { ElectronicBillingModule } from "./modules/electronic-billing/electronic-billing.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { RetriesModule } from "./modules/retries/retries.module";
import { SyncModule } from "./modules/sync/sync.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";

@Module({
  imports: [
    HealthModule,
    DatabaseModule,
    ElectronicBillingModule,
    ProvidersModule,
    FiscalLookupModule,
    SyncModule,
    InvoicesModule,
    DianModule,
    CertificatesModule,
    DocumentsModule,
    RetriesModule,
    WebhooksModule,
  ],
})
export class AppModule {}
