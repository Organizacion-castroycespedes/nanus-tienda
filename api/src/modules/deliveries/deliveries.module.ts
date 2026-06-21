import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/db/database.module";
import { DeliveriesController } from "./deliveries.controller";
import { DeliveriesService } from "./deliveries.service";
import { DeliveryNumberService } from "./services/delivery-number.service";
import { DeliveryStateMachineService } from "./services/delivery-state-machine.service";

@Module({
  imports: [DatabaseModule],
  controllers: [DeliveriesController],
  providers: [DeliveriesService, DeliveryNumberService, DeliveryStateMachineService],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
