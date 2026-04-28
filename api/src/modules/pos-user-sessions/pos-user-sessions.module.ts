import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../common/access-control.module";
import { DatabaseModule } from "../../common/db/database.module";
import { PosUserSessionsController } from "./pos-user-sessions.controller";
import { PosUserSessionsRepository } from "./pos-user-sessions.repository";
import { PosUserSessionsService } from "./pos-user-sessions.service";

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [PosUserSessionsController],
  providers: [PosUserSessionsService, PosUserSessionsRepository],
  exports: [PosUserSessionsService, PosUserSessionsRepository],
})
export class PosUserSessionsModule {}
