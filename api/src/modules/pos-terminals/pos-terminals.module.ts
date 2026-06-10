import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/db/database.module";
import { AccessControlModule } from "../../common/access-control.module";
import { PosTerminalsController } from "./pos-terminals.controller";
import { PosTerminalsRepository } from "./pos-terminals.repository";
import { PosTerminalsService } from "./pos-terminals.service";

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [PosTerminalsController],
  providers: [PosTerminalsService, PosTerminalsRepository],
  exports: [PosTerminalsService],
})
export class PosTerminalsModule {}
