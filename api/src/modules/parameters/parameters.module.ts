import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../common/access-control.module";
import { DatabaseModule } from "../../common/db/database.module";
import { ParametersController } from "./parameters.controller";
import { ParametersRepository } from "./parameters.repository";
import { ParametersService } from "./parameters.service";
import { TenantSettingsController } from "./tenant-settings.controller";

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [ParametersController, TenantSettingsController],
  providers: [ParametersRepository, ParametersService],
  exports: [ParametersService],
})
export class ParametersModule {}
