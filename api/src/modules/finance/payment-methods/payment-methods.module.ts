import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../../common/access-control.module";
import { DatabaseModule } from "../../../common/db/database.module";
import { CommonServicesModule } from "../../../common/services/common-services.module";
import { FinanceAuthzGuard } from "../common/guards/finance-authz.guard";
import { PaymentMethodsController } from "./payment-methods.controller";
import { PaymentMethodsRepository } from "./payment-methods.repository";
import { PaymentMethodsService } from "./payment-methods.service";

@Module({
  imports: [DatabaseModule, AccessControlModule, CommonServicesModule],
  controllers: [PaymentMethodsController],
  providers: [
    PaymentMethodsService,
    PaymentMethodsRepository,
    FinanceAuthzGuard,
  ],
  exports: [PaymentMethodsService, PaymentMethodsRepository],
})
export class PaymentMethodsModule {}
