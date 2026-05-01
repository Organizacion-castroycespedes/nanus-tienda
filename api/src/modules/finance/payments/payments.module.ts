import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../../common/access-control.module";
import { DatabaseModule } from "../../../common/db/database.module";
import { CommonServicesModule } from "../../../common/services/common-services.module";
import { FinanceAuthzGuard } from "../common/guards/finance-authz.guard";
import { FinanceAccessRepository } from "../common/repositories/finance-access.repository";
import { CashMovementsRepository } from "../cash-movements/cash-movements.repository";
import { CashSessionsRepository } from "../cash-sessions/cash-sessions.repository";
import { PaymentMethodsRepository } from "../payment-methods/payment-methods.repository";
import { PaymentsController } from "./payments.controller";
import { PaymentsRepository } from "./payments.repository";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [DatabaseModule, AccessControlModule, CommonServicesModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsRepository,
    PaymentMethodsRepository,
    CashSessionsRepository,
    CashMovementsRepository,
    FinanceAccessRepository,
    FinanceAuthzGuard,
  ],
  exports: [PaymentsService, PaymentsRepository],
})
export class PaymentsModule {}
