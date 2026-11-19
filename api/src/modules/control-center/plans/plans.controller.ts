import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import { buildControlCenterRequestContext } from "../control-center-audit.service";
import { ControlCenterAdmin } from "../control-center-admin.decorator";
import { PlansService } from "./plans.service";

@Controller("admin/control-center/plans")
@ControlCenterAdmin()
export class PlansController {
  constructor(@Inject(PlansService) private readonly service: PlansService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get("taxes")
  listTaxes() {
    return this.service.listTaxes();
  }

  @Post()
  create(@Body() body: unknown, @Req() request: any) {
    return this.service.create(body, buildControlCenterRequestContext(request));
  }

  @Patch(":planId")
  update(@Param("planId") planId: string, @Body() body: unknown, @Req() request: any) {
    return this.service.update(planId, body, buildControlCenterRequestContext(request));
  }

  @Get(":planId/price-versions")
  listVersions(@Param("planId") planId: string) {
    return this.service.listVersions(planId);
  }

  @Post(":planId/price-versions")
  publishVersion(@Param("planId") planId: string, @Body() body: unknown, @Req() request: any) {
    return this.service.publishVersion(planId, body, buildControlCenterRequestContext(request));
  }
}
