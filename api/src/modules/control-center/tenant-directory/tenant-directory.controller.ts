import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ControlCenterAdmin } from "../control-center-admin.decorator";
import { TenantDirectoryService } from "./tenant-directory.service";

@Controller("admin/control-center/tenants")
@ControlCenterAdmin()
export class TenantDirectoryController {
  constructor(@Inject(TenantDirectoryService) private readonly service: TenantDirectoryService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.service.list(query);
  }

  @Get(":tenantId")
  get(@Param("tenantId") tenantId: string) {
    return this.service.get(tenantId);
  }
}
