import { Module } from "@nestjs/common";
import { DatabaseModule } from "./db/database.module";
import { AccessControlService } from "./services/access-control.service";
import { PermissionsGuard } from "./guards/permissions.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@Module({
  imports: [DatabaseModule],
  providers: [AccessControlService, PermissionsGuard, JwtAuthGuard],
  exports: [AccessControlService, PermissionsGuard, JwtAuthGuard],
})
export class AccessControlModule {}
