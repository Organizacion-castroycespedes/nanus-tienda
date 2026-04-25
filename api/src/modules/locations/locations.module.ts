import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/db/database.module";
import { AccessControlModule } from "../../common/access-control.module";
import { LocationsController } from "./locations.controller";
import { LocationsService } from "./locations.service";

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [LocationsController],
  providers: [LocationsService],
})
export class LocationsModule {}
