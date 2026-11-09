import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ControlCenterAdmin } from "../control-center-admin.decorator";
import { ReceivablesService } from "./receivables.service";

@Controller("admin/control-center/receivables")
@ControlCenterAdmin()
export class ReceivablesController {
  constructor(@Inject(ReceivablesService) private readonly service: ReceivablesService) {}

  @Get("summary")
  summary(@Query() query: Record<string, unknown>) {
    return this.service.summary(query);
  }
}
