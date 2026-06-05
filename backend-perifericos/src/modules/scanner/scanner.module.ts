import { Module } from "@nestjs/common";
import { DevicesModule } from "../devices/devices.module";
import { ScannerController } from "./scanner.controller";
import { ScannerService } from "./scanner.service";

@Module({
  imports: [DevicesModule],
  controllers: [ScannerController],
  providers: [ScannerService],
})
export class ScannerModule {}
