import { Controller, Get, Inject } from "@nestjs/common";
import { SystemService } from "./system.service";

@Controller("system")
export class SystemController {
  constructor(@Inject(SystemService) private readonly systemService: SystemService) {}

  @Get("version")
  getVersion() {
    return this.systemService.getVersion();
  }
}
