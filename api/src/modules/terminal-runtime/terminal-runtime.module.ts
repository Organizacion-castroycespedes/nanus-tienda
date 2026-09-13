import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../common/access-control.module";
import { DatabaseModule } from "../../common/db/database.module";
import { TerminalDevicesModule } from "../terminal-devices/terminal-devices.module";
import { TerminalRuntimeController } from "./terminal-runtime.controller";
import { TerminalRuntimeService } from "./terminal-runtime.service";

@Module({
  imports: [DatabaseModule, AccessControlModule, TerminalDevicesModule],
  controllers: [TerminalRuntimeController],
  providers: [TerminalRuntimeService],
})
export class TerminalRuntimeModule {}
