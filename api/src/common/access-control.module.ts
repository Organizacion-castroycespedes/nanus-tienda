import { Module } from "@nestjs/common";
import { DatabaseModule } from "./db/database.module";
import { AccessControlService } from "./services/access-control.service";
import { PermissionsGuard } from "./guards/permissions.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { OperationalSaleScopeService } from "./services/operational-sale-scope.service";

@Module({
  imports: [DatabaseModule],
  providers: [
    AccessControlService,
    OperationalSaleScopeService,
    PermissionsGuard,
    JwtAuthGuard,
  ],
  exports: [
    AccessControlService,
    OperationalSaleScopeService,
    PermissionsGuard,
    JwtAuthGuard,
  ],
})
export class AccessControlModule {}
