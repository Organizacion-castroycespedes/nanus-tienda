import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../../common/access-control.module";
import { DatabaseModule } from "../../../common/db/database.module";
import { CommonServicesModule } from "../../../common/services/common-services.module";
import { FinancialInstitutionsController } from "./financial-institutions.controller";
import { FinancialInstitutionsRepository } from "./financial-institutions.repository";
import { FinancialInstitutionsService } from "./financial-institutions.service";

@Module({
  imports: [DatabaseModule, AccessControlModule, CommonServicesModule],
  controllers: [FinancialInstitutionsController],
  providers: [FinancialInstitutionsRepository, FinancialInstitutionsService],
  exports: [FinancialInstitutionsService, FinancialInstitutionsRepository],
})
export class FinancialInstitutionsModule {}
