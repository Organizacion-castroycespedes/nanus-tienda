import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../common/access-control.module";
import { DatabaseModule } from "../../common/db/database.module";
import { CommonServicesModule } from "../../common/services/common-services.module";
import { CashMovementsModule } from "./cash-movements/cash-movements.module";
import { CashRegistersModule } from "./cash-registers/cash-registers.module";
import { CashSessionsModule } from "./cash-sessions/cash-sessions.module";
import { PaymentMethodsModule } from "./payment-methods/payment-methods.module";
import { PaymentsModule } from "./payments/payments.module";
import { FinanceAuthzGuard } from "./common/guards/finance-authz.guard";

@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    CommonServicesModule,
    PaymentMethodsModule,
    PaymentsModule,
    CashRegistersModule,
    CashSessionsModule,
    CashMovementsModule,
  ],
  providers: [FinanceAuthzGuard],
  exports: [
    PaymentMethodsModule,
    PaymentsModule,
    CashRegistersModule,
    CashSessionsModule,
    CashMovementsModule,
  ],
})
export class FinanceModule {}
