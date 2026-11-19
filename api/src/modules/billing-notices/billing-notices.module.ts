import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/db/database.module";
import { BillingNoticesController } from "./billing-notices.controller";
import { BillingNoticesService } from "./billing-notices.service";

@Module({
  imports: [DatabaseModule],
  controllers: [BillingNoticesController],
  providers: [BillingNoticesService],
})
export class BillingNoticesModule {}
