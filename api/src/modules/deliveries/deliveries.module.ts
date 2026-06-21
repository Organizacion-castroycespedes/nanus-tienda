import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/db/database.module";
import { DeliveriesController } from "./deliveries.controller";
import { DeliveriesService } from "./deliveries.service";
import { DeliveryNumberService } from "./services/delivery-number.service";

@Module({
  imports: [DatabaseModule],
  controllers: [DeliveriesController],
  providers: [DeliveriesService, DeliveryNumberService],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
