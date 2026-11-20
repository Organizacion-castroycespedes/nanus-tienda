import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../common/access-control.module";
import { DatabaseModule } from "../../common/db/database.module";
import { CommonServicesModule } from "../../common/services/common-services.module";
import { FinanceAccessRepository } from "../finance/common/repositories/finance-access.repository";
import { InventoryModule } from "../inventory/inventory.module";
import { PricingModule } from "../pricing/pricing.module";
import { QuotationController } from "./quotation.controller";
import { QuotationMailer, QuotationPdfClient } from "./quotation-mail";
import { QuotationRepository } from "./quotation.repository";
import { QuotationService } from "./quotation.service";

@Module({
  imports: [DatabaseModule, AccessControlModule, CommonServicesModule, InventoryModule, PricingModule],
  controllers: [QuotationController],
  providers: [QuotationService, QuotationRepository, FinanceAccessRepository, QuotationMailer, QuotationPdfClient],
  exports: [QuotationService],
})
export class QuotationsModule {}
