import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/db/database.module";
import { PlatformTenantGuard } from "../../common/guards/platform-tenant.guard";
import { ControlCenterAuditService } from "./control-center-audit.service";
import { ControlCenterDatabaseService } from "./control-center-database.service";
import { ControlCenterEnabledGuard } from "./control-center-enabled.guard";
import { ControlCenterReadinessController } from "./control-center-readiness.controller";
import { ControlCenterReadinessService } from "./control-center-readiness.service";
import { AccountsController } from "./accounts/accounts.controller";
import { AccountsService } from "./accounts/accounts.service";
import { AlertsController } from "./alerts/alerts.controller";
import { readAlertsConfig } from "./alerts/alerts.config";
import { ControlCenterAlertsService } from "./alerts/alerts.service";
import { EMAIL_SENDER, SmtpEmailSender } from "./alerts/email-sender";
import { BillingService } from "./billing/billing.service";
import { ControlCenterBillingWorker } from "./billing/billing.worker";
import { ChargesController } from "./billing/charges.controller";
import { ChargesService } from "./billing/charges.service";
import { ReceiptsController } from "./collections/receipts.controller";
import { ReceiptsService } from "./collections/receipts.service";
import { ContractsController } from "./contracts/contracts.controller";
import { ContractsService } from "./contracts/contracts.service";
import { PlansController } from "./plans/plans.controller";
import { PlansService } from "./plans/plans.service";
import { ReceivablesController } from "./receivables/receivables.controller";
import { ReceivablesService } from "./receivables/receivables.service";
import { TenantDirectoryController } from "./tenant-directory/tenant-directory.controller";
import { TenantDirectoryService } from "./tenant-directory/tenant-directory.service";

@Module({
  imports: [DatabaseModule],
  controllers: [
    ControlCenterReadinessController,
    TenantDirectoryController,
    AccountsController,
    PlansController,
    ContractsController,
    ChargesController,
    ReceiptsController,
    ReceivablesController,
    AlertsController,
  ],
  providers: [
    ControlCenterDatabaseService,
    ControlCenterReadinessService,
    TenantDirectoryService,
    AccountsService,
    PlansService,
    ContractsService,
    BillingService,
    ChargesService,
    ReceiptsService,
    ReceivablesService,
    ControlCenterBillingWorker,
    ControlCenterAlertsService,
    { provide: EMAIL_SENDER, useFactory: () => new SmtpEmailSender(readAlertsConfig()) },
    PlatformTenantGuard,
    ControlCenterEnabledGuard,
    { provide: ControlCenterAuditService, useFactory: () => new ControlCenterAuditService() },
  ],
  exports: [ControlCenterDatabaseService, ControlCenterAuditService],
})
export class ControlCenterModule {}
