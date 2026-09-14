import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../common/access-control.module";
import { DatabaseModule } from "../../common/db/database.module";
import { CommonServicesModule } from "../../common/services/common-services.module";
import { IntegrationOutboxModule } from "../integration-outbox/integration-outbox.module";
import { OperationalSalesController } from "./operational-sales.controller";
import { OperationalSalesRepository } from "./operational-sales.repository";
import { OperationalSalesService } from "./operational-sales.service";
import { OperationalDashboardRepository } from "./operational-dashboard.repository";
import { OperationalDashboardController } from "./operational-dashboard.controller";

@Module({
  imports: [DatabaseModule, AccessControlModule, CommonServicesModule, IntegrationOutboxModule],
  controllers: [OperationalSalesController, OperationalDashboardController],
  providers: [OperationalSalesRepository, OperationalDashboardRepository, OperationalSalesService],
})
export class OperationalSalesModule {}
