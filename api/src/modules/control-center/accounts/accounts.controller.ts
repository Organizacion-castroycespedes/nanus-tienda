import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { buildControlCenterRequestContext } from "../control-center-audit.service";
import { ControlCenterAdmin } from "../control-center-admin.decorator";
import { AccountsService } from "./accounts.service";

@Controller("admin/control-center/accounts")
@ControlCenterAdmin()
export class AccountsController {
  constructor(@Inject(AccountsService) private readonly service: AccountsService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.service.list(query);
  }

  @Post()
  create(@Body() body: unknown, @Req() request: any) {
    return this.service.create(body, buildControlCenterRequestContext(request));
  }

  @Get(":accountId")
  get(@Param("accountId") accountId: string) {
    return this.service.get(accountId);
  }

  @Patch(":accountId")
  update(@Param("accountId") accountId: string, @Body() body: unknown, @Req() request: any) {
    return this.service.update(accountId, body, buildControlCenterRequestContext(request));
  }

  @Post(":accountId/tenants")
  linkTenant(@Param("accountId") accountId: string, @Body() body: unknown, @Req() request: any) {
    return this.service.linkTenant(accountId, body, buildControlCenterRequestContext(request));
  }

  @Post(":accountId/tenants/:tenantId/end")
  endTenantLink(
    @Param("accountId") accountId: string,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
    @Req() request: any,
  ) {
    return this.service.endTenantLink(accountId, tenantId, body, buildControlCenterRequestContext(request));
  }
}
