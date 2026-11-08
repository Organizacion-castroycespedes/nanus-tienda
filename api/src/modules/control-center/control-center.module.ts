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
import { ContractsController } from "./contracts/contracts.controller";
import { ContractsService } from "./contracts/contracts.service";
import { PlansController } from "./plans/plans.controller";
import { PlansService } from "./plans/plans.service";
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
  ],
  providers: [
    ControlCenterDatabaseService,
    ControlCenterReadinessService,
    TenantDirectoryService,
    AccountsService,
    PlansService,
    ContractsService,
    PlatformTenantGuard,
    ControlCenterEnabledGuard,
    { provide: ControlCenterAuditService, useFactory: () => new ControlCenterAuditService() },
  ],
  exports: [ControlCenterDatabaseService, ControlCenterAuditService],
})
export class ControlCenterModule {}
