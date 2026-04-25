import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../common/db/database.module";
import { AccessControlModule } from "../../common/access-control.module";
import { CommonServicesModule } from "../../common/services/common-services.module";
import { BranchesController } from "./branches.controller";
import { BranchesService } from "./branches.service";
import { BranchesRepository } from "./branches.repository";

@Module({
  imports: [DatabaseModule, AccessControlModule, CommonServicesModule],
  controllers: [BranchesController],
  providers: [BranchesService, BranchesRepository],
})
export class BranchesModule {}
