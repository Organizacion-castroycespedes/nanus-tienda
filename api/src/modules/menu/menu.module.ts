import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/db/database.module";
import { AccessControlModule } from "../../common/access-control.module";
import { CommonServicesModule } from "../../common/services/common-services.module";
import { MenuService } from "./menu.service";
import { MenuController } from "./menu.controller";
import { MenuAdminController } from "./menu-admin.controller";
import { MenuAdminService } from "./menu-admin.service";

@Module({
  imports: [DatabaseModule, AccessControlModule, CommonServicesModule],
  controllers: [MenuController, MenuAdminController],
  providers: [MenuService, MenuAdminService],
  exports: [MenuService],
})
export class MenuModule {}
