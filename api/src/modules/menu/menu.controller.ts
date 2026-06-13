import {
  Controller,
  Get,
  Headers,
  Inject,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AccessControlService } from "../../common/services/access-control.service";
import { MenuService } from "./menu.service";

@Controller("me")
@UseGuards(JwtAuthGuard)
export class MenuController {
  constructor(
    @Inject(MenuService) private readonly menuService: MenuService,
    @Inject(AccessControlService)
    private readonly accessControlService: AccessControlService
  ) {}

  @Get("menu")
  async menu(@Headers("authorization") authorization?: string) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : null;
    if (!token) {
      throw new UnauthorizedException("Token requerido");
    }
    return this.menuService.getMenuForAccessToken(token);
  }

  @Get("permissions")
  async permissions(
    @Req() request: Request & { user?: { id?: string; tenantId?: string } }
  ) {
    if (!request.user?.id || !request.user?.tenantId) {
      throw new UnauthorizedException("Token invalido");
    }
    const permissions = await this.accessControlService.fetchPermissions(
      request.user.id,
      request.user.tenantId
    );
    return {
      items: Array.from(permissions.values()),
    };
  }
}
