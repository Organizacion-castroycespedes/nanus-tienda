import { Module } from "@nestjs/common";
import { DevicesModule } from "../devices/devices.module";
import { ScaleController } from "./scale.controller";
import { ScaleService } from "./scale.service";

@Module({
  imports: [DevicesModule],
  controllers: [ScaleController],
  providers: [ScaleService],
})
export class ScaleModule {}
