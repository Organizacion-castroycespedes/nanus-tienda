import { Controller, Get, Inject } from "@nestjs/common";
import type { PeripheralLog } from "../../shared/types/peripheral.types";
import { LogsService } from "./logs.service";

@Controller("logs")
export class LogsController {
  constructor(@Inject(LogsService) private readonly logsService: LogsService) {}

  @Get()
  getLogs(): PeripheralLog[] {
    return this.logsService.list();
  }
}
