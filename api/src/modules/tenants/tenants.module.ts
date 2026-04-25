import { Module } from "@nestjs/common";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";
import { DatabaseModule } from "../../common/db/database.module";
import { AccessControlModule } from "../../common/access-control.module";

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
