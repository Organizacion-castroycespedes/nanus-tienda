import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../common/access-control.module";
import { DatabaseModule } from "../../common/db/database.module";
import { DeliveryDriversController } from "./delivery-drivers.controller";
import { DeliveryDriversService } from "./delivery-drivers.service";
import { DeliveriesController } from "./deliveries.controller";
import { DeliveriesService } from "./deliveries.service";
import { DeliveryNumberService } from "./services/delivery-number.service";
import { DeliveryStateMachineService } from "./services/delivery-state-machine.service";

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [DeliveriesController, DeliveryDriversController],
  providers: [
    DeliveriesService,
    DeliveryDriversService,
    DeliveryNumberService,
    DeliveryStateMachineService,
  ],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
