import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../../common/access-control.module";
import { DatabaseModule } from "../../../common/db/database.module";
import { CommonServicesModule } from "../../../common/services/common-services.module";
import { FinanceAuthzGuard } from "../common/guards/finance-authz.guard";
import { FinanceAccessRepository } from "../common/repositories/finance-access.repository";
import { CashMovementsRepository } from "../cash-movements/cash-movements.repository";
import { CashRegistersRepository } from "../cash-registers/cash-registers.repository";
import { CashSessionsController } from "./cash-sessions.controller";
import { CashSessionsRepository } from "./cash-sessions.repository";
import { CashSessionsService } from "./cash-sessions.service";

@Module({
  imports: [DatabaseModule, AccessControlModule, CommonServicesModule],
  controllers: [CashSessionsController],
  providers: [
    CashSessionsService,
    CashSessionsRepository,
    CashRegistersRepository,
    CashMovementsRepository,
    FinanceAccessRepository,
    FinanceAuthzGuard,
  ],
  exports: [CashSessionsService, CashSessionsRepository],
})
export class CashSessionsModule {}
