import { Module } from "@nestjs/common";
import { DevicesModule } from "../devices/devices.module";
import { PrinterController } from "./printer.controller";
import { PrinterService } from "./printer.service";

@Module({
  imports: [DevicesModule],
  controllers: [PrinterController],
  providers: [PrinterService],
  exports: [PrinterService],
})
export class PrinterModule {}
