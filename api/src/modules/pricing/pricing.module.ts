import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../common/access-control.module";
import { DatabaseModule } from "../../common/db/database.module";
import { PromotionsController } from "./promotions.controller";
import { PromotionsRepository } from "./promotions.repository";
import { PromotionsService } from "./promotions.service";
import { PricingController } from "./pricing.controller";
import { PricingRepository } from "./pricing.repository";
import { PricingService } from "./pricing.service";

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [PricingController, PromotionsController],
  providers: [
    PricingRepository,
    PricingService,
    PromotionsRepository,
    PromotionsService,
  ],
  exports: [PricingService, PromotionsService],
})
export class PricingModule {}
