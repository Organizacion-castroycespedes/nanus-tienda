import { Module } from "@nestjs/common";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";
import { TenantBootstrapService } from "./tenant-bootstrap.service";
import { DatabaseModule } from "../../common/db/database.module";
import { AccessControlModule } from "../../common/access-control.module";
import { PlatformTenantGuard } from "../../common/guards/platform-tenant.guard";

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantBootstrapService, PlatformTenantGuard],
})
export class TenantsModule {}
