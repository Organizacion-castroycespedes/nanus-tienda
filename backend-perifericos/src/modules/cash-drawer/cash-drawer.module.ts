import { Module } from "@nestjs/common";
import { DevicesModule } from "../devices/devices.module";
import { CashDrawerController } from "./cash-drawer.controller";
import { CashDrawerService } from "./cash-drawer.service";

@Module({
  imports: [DevicesModule],
  controllers: [CashDrawerController],
  providers: [CashDrawerService],
})
export class CashDrawerModule {}
