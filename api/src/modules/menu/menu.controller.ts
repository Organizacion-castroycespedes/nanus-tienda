import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
  Inject,
} from "@nestjs/common";
import jwt from "jsonwebtoken";
import { MenuService } from "./menu.service";
import { AccessControlService } from "../../common/services/access-control.service";

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";

type TokenPayload = {
  sub?: string;
  tenant_id?: string;
};

@Controller("me")
export class MenuController {
  constructor(
     @Inject(MenuService) private readonly menuService: MenuService,
     @Inject(AccessControlService) private readonly accessControlService: AccessControlService
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
  async permissions(@Headers("authorization") authorization?: string) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : null;
    if (!token) {
      throw new UnauthorizedException("Token requerido");
    }
    const payload = this.decodeAccessToken(token);
    if (!payload?.sub || !payload?.tenant_id) {
      throw new UnauthorizedException("Token inválido");
    }
    const permissions = await this.accessControlService.fetchPermissions(
      payload.sub,
      payload.tenant_id
    );
    return {
      items: Array.from(permissions.values()),
    };
  }

  private decodeAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (typeof decoded === "string") {
        return {};
      }
      return decoded as TokenPayload;
    } catch {
      throw new UnauthorizedException("Token inválido");
    }
  }
}
