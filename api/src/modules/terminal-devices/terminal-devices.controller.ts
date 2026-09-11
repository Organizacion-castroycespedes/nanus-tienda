import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { MENU_KEYS } from "../../common/constants/menu-keys"; import { RequirePermission } from "../../common/decorators/require-permission.decorator"; import { Roles } from "../../common/decorators/roles.decorator"; import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"; import { RolesGuard } from "../../common/guards/roles.guard"; import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { TerminalDevicesService } from "./terminal-devices.service"; import type { RegisterTerminalDeviceDto } from "./dto/register-terminal-device.dto"; import type { CreateTerminalDeviceBindingDto, TerminalDeviceBindingActionDto } from "./dto/terminal-device-binding.dto";
type R = Request & { user?: { roles?: string[]; tenantId?: string; id?: string } };
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard) @Roles("SUPER_ADMIN")
@Controller("terminal-devices")
export class TerminalDevicesController { constructor(@Inject(TerminalDevicesService) private readonly service: TerminalDevicesService) {} private actor(r: R) { return { roles: r.user?.roles ?? [], tenantId: r.user?.tenantId, userId: r.user?.id }; }
  @Post("register") @RequirePermission({ menuKey: MENU_KEYS.CONFIG_TERMINALS, level: "WRITE" }) register(@Body() p: RegisterTerminalDeviceDto, @Req() r: R) { return this.service.register(p, this.actor(r)); }
  @Get() @RequirePermission({ menuKey: MENU_KEYS.CONFIG_TERMINALS, level: "READ" }) list(@Query("tenantId") t: string|undefined, @Req() r: R) { return this.service.list(this.actor(r), t); }
  @Get(":id") @RequirePermission({ menuKey: MENU_KEYS.CONFIG_TERMINALS, level: "READ" }) get(@Param("id") id: string, @Req() r: R) { return this.service.get(id, this.actor(r)); }
}
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard) @Roles("SUPER_ADMIN") @Controller("terminal-device-bindings")
export class TerminalDeviceBindingsController { constructor(@Inject(TerminalDevicesService) private readonly service: TerminalDevicesService) {} private actor(r: R) { return { roles: r.user?.roles ?? [], tenantId: r.user?.tenantId, userId: r.user?.id }; }
  @Get() @RequirePermission({ menuKey: MENU_KEYS.CONFIG_TERMINALS, level: "READ" }) list(@Query("terminalId") t: string|undefined, @Query("deviceId") d: string|undefined, @Req() r: R) { return this.service.bindings(this.actor(r), t, d); }
  @Post() @RequirePermission({ menuKey: MENU_KEYS.CONFIG_TERMINALS, level: "WRITE" }) bind(@Body() p: CreateTerminalDeviceBindingDto, @Req() r: R) { return this.service.bind(p, this.actor(r)); }
  @Post("unbind") @RequirePermission({ menuKey: MENU_KEYS.CONFIG_TERMINALS, level: "WRITE" }) unbind(@Body() p: TerminalDeviceBindingActionDto, @Req() r: R) { return this.service.unbind(p, this.actor(r)); }
  @Post("revoke") @RequirePermission({ menuKey: MENU_KEYS.CONFIG_TERMINALS, level: "WRITE" }) revoke(@Body() p: TerminalDeviceBindingActionDto, @Req() r: R) { return this.service.revoke(p, this.actor(r)); }
}
