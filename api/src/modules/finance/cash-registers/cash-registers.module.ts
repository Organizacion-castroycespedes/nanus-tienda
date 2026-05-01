import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../../common/access-control.module";
import { DatabaseModule } from "../../../common/db/database.module";
import { CommonServicesModule } from "../../../common/services/common-services.module";
import { FinanceAuthzGuard } from "../common/guards/finance-authz.guard";
import { FinanceAccessRepository } from "../common/repositories/finance-access.repository";
import { CashRegistersController } from "./cash-registers.controller";
import { CashRegistersRepository } from "./cash-registers.repository";
import { CashRegistersService } from "./cash-registers.service";

@Module({
  imports: [DatabaseModule, AccessControlModule, CommonServicesModule],
  controllers: [CashRegistersController],
  providers: [
    CashRegistersService,
    CashRegistersRepository,
    FinanceAccessRepository,
    FinanceAuthzGuard,
  ],
  exports: [CashRegistersService, CashRegistersRepository],
})
export class CashRegistersModule {}
