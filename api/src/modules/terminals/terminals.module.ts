import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../common/access-control.module";
import { DatabaseModule } from "../../common/db/database.module";
import { TerminalsController } from "./terminals.controller";
import { TerminalsRepository } from "./terminals.repository";
import { TerminalsService } from "./terminals.service";

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [TerminalsController],
  providers: [TerminalsService, TerminalsRepository],
  exports: [TerminalsService, TerminalsRepository],
})
export class TerminalsModule {}
