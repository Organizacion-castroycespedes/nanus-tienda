import { CanActivate, Inject, Injectable } from "@nestjs/common";
import { ControlCenterDatabaseService } from "./control-center-database.service";

/** Responde 503 CONTROL_CENTER_DISABLED cuando el modulo no esta configurado. */
@Injectable()
export class ControlCenterEnabledGuard implements CanActivate {
  constructor(
    @Inject(ControlCenterDatabaseService)
    private readonly database: ControlCenterDatabaseService,
  ) {}

  canActivate(): boolean {
    this.database.assertEnabled();
    return true;
  }
}
