import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { DatabaseModule } from "../../common/db/database.module";
import { MenuModule } from "../menu/menu.module";
import { UsersModule } from "../users/users.module";
import { AccessControlModule } from "../../common/access-control.module";

@Module({
  imports: [DatabaseModule, MenuModule, UsersModule, AccessControlModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
