import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/db/database.module";
import { PlatformTenantGuard } from "../../common/guards/platform-tenant.guard";
import { ControlCenterAuditService } from "./control-center-audit.service";
import { ControlCenterDatabaseService } from "./control-center-database.service";
import { ControlCenterEnabledGuard } from "./control-center-enabled.guard";
import { ControlCenterReadinessController } from "./control-center-readiness.controller";
import { ControlCenterReadinessService } from "./control-center-readiness.service";

@Module({
  imports: [DatabaseModule],
  controllers: [ControlCenterReadinessController],
  providers: [
    ControlCenterDatabaseService,
    ControlCenterReadinessService,
    PlatformTenantGuard,
    ControlCenterEnabledGuard,
    { provide: ControlCenterAuditService, useFactory: () => new ControlCenterAuditService() },
  ],
  exports: [ControlCenterDatabaseService, ControlCenterAuditService],
})
export class ControlCenterModule {}
