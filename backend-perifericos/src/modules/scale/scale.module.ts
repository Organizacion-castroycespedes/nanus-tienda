import { Module } from "@nestjs/common";
import { DevicesModule } from "../devices/devices.module";
import { ScaleController } from "./scale.controller";
import { ROCHI_SERIAL_PORT_FACTORY, ScaleService } from "./scale.service";
import { createRochiSerialPort } from "./rochi-a01e.serial-port.factory";
import { AgentSecurityModule } from "../agent-security/agent-security.module";

@Module({
  imports: [DevicesModule, AgentSecurityModule],
  controllers: [ScaleController],
  providers: [ScaleService, { provide: ROCHI_SERIAL_PORT_FACTORY, useValue: createRochiSerialPort }],
})
export class ScaleModule {}
