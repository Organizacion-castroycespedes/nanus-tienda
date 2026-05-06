import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../../common/access-control.module";
import { DatabaseModule } from "../../../common/db/database.module";
import { CommonServicesModule } from "../../../common/services/common-services.module";
import { FinanceAuthzGuard } from "../common/guards/finance-authz.guard";
import { FinanceAccessRepository } from "../common/repositories/finance-access.repository";
import { CashRegistersRepository } from "../cash-registers/cash-registers.repository";
import { CashSessionsRepository } from "../cash-sessions/cash-sessions.repository";
import { PaymentsRepository } from "../payments/payments.repository";
import { CashMovementsController } from "./cash-movements.controller";
import { CashMovementsRepository } from "./cash-movements.repository";
import { CashMovementsService } from "./cash-movements.service";

@Module({
  imports: [DatabaseModule, AccessControlModule, CommonServicesModule],
  controllers: [CashMovementsController],
  providers: [
    CashMovementsService,
    CashMovementsRepository,
    CashSessionsRepository,
    CashRegistersRepository,
    PaymentsRepository,
    FinanceAccessRepository,
    FinanceAuthzGuard,
  ],
  exports: [CashMovementsService, CashMovementsRepository],
})
export class CashMovementsModule {}
