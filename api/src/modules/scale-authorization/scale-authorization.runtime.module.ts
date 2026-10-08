import { Module } from "@nestjs/common";
import { AccessControlModule } from "../../common/access-control.module";
import { DatabaseModule } from "../../common/db/database.module";
import { AgentCredentialPersistence, ScaleBindingPersistence } from "./persistence/scale-authorization.repositories";
import { ScaleAuthorizationAdminController, ScaleAuthorizationPairingController } from "./scale-authorization.runtime.controller";
import { ScaleAuthorizationRuntimeService } from "./scale-authorization.runtime.service";

@Module({
  imports: [DatabaseModule, AccessControlModule],
  controllers: [ScaleAuthorizationPairingController, ScaleAuthorizationAdminController],
  providers: [AgentCredentialPersistence, ScaleBindingPersistence, ScaleAuthorizationRuntimeService],
})
export class ScaleAuthorizationRuntimeModule {}
