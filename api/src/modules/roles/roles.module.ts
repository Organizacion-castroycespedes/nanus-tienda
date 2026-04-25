import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/db/database.module";
import { AccessControlModule } from "../../common/access-control.module";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
