import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { TenantsModule } from "./tenants/tenants.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { BranchesModule } from "./branches/branches.module";
import { LocationsModule } from "./locations/locations.module";
import { RolesModule } from "./roles/roles.module";
import { MenuModule } from "./menu/menu.module";

@Module({
  imports: [
    AuthModule,
    UsersModule,
    TenantsModule,
    PermissionsModule,
    BranchesModule,
    LocationsModule,
    RolesModule,
    MenuModule,
  ],
})
export class AppModule {}
