import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/db/database.module";
import { getIntegrationOutboxConfig } from "./config/integration-outbox.config";
import { INTEGRATION_OUTBOX_CONFIG } from "./integration-outbox.tokens";
import { BillingIntegrationClient } from "./services/billing-integration-client";
import { IntegrationOutboxDispatcher } from "./services/integration-outbox-dispatcher";
import { IntegrationOutboxService } from "./services/integration-outbox.service";
import { IntegrationOutboxRepository } from "./repositories/integration-outbox.repository";

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: INTEGRATION_OUTBOX_CONFIG,
      useFactory: getIntegrationOutboxConfig,
    },
    IntegrationOutboxRepository,
    IntegrationOutboxService,
    BillingIntegrationClient,
    IntegrationOutboxDispatcher,
  ],
  exports: [
    INTEGRATION_OUTBOX_CONFIG,
    IntegrationOutboxRepository,
    IntegrationOutboxService,
    BillingIntegrationClient,
    IntegrationOutboxDispatcher,
  ],
})
export class IntegrationOutboxModule {}
