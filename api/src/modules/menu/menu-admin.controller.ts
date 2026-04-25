import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  Inject,
} from "@nestjs/common";
import type { Request } from "express";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { MenuAdminService } from "./menu-admin.service";
import type {
  CreateMenuItemDto,
  UpdateMenuItemDto,
  UpdateMenuItemStatusDto,
} from "./dto/menu-item.dto";
import type {
  PatchRoleMenuPermissionsDto,
  ReplaceRoleMenuPermissionsDto,
} from "./dto/role-menu-permissions.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPER_ADMIN")
export class MenuAdminController {
  constructor(
    @Inject(MenuAdminService) private readonly menuAdminService: MenuAdminService
  ) {}

  private buildActor(request: Request) {
    const roles = Array.isArray(request.user?.roles) ? request.user.roles : [];
    return {
      roles,
      tenantId: request.user?.tenantId,
      userId: request.user?.id,
      ip: request.headers["x-forwarded-for"]?.toString() ?? request.ip,
      userAgent: request.headers["user-agent"],
    };
  }

  @Post("menu-items")
  createMenuItem(@Body() payload: CreateMenuItemDto, @Req() request: Request) {
    return this.menuAdminService.createMenuItem(payload, this.buildActor(request));
  }

  @Get("menu-items")
  listMenuItems(@Query("tenantId") tenantId: string, @Req() request: Request) {
    if (!tenantId) {
      throw new UnauthorizedException("Tenant requerido");
    }
    return this.menuAdminService.listMenuItems(tenantId, this.buildActor(request));
  }

  @Get("menu-items/:id")
  getMenuItem(@Param("id") id: string, @Req() request: Request) {
    return this.menuAdminService.getMenuItem(id, this.buildActor(request));
  }

  @Patch("menu-items/:id")
  updateMenuItem(
    @Param("id") id: string,
    @Body() payload: UpdateMenuItemDto,
    @Req() request: Request
  ) {
    return this.menuAdminService.updateMenuItem(id, payload, this.buildActor(request));
  }

  @Patch("menu-items/:id/status")
  updateMenuItemStatus(
    @Param("id") id: string,
    @Body() payload: UpdateMenuItemStatusDto,
    @Req() request: Request
  ) {
    return this.menuAdminService.updateMenuItemStatus(
      id,
      payload.visible,
      this.buildActor(request)
    );
  }

  @Delete("menu-items/:id")
  deleteMenuItem(@Param("id") id: string, @Req() request: Request) {
    return this.menuAdminService.deleteMenuItem(id, this.buildActor(request));
  }

  @Get("roles/:roleId/menu-permissions")
  listRolePermissions(
    @Param("roleId") roleId: string,
    @Query("tenantId") tenantId: string,
    @Req() request: Request
  ) {
    if (!tenantId) {
      throw new UnauthorizedException("Tenant requerido");
    }
    return this.menuAdminService.listRolePermissions(
      roleId,
      tenantId,
      this.buildActor(request)
    );
  }

  @Put("roles/:roleId/menu-permissions")
  replaceRolePermissions(
    @Param("roleId") roleId: string,
    @Body() payload: ReplaceRoleMenuPermissionsDto,
    @Req() request: Request
  ) {
    return this.menuAdminService.replaceRolePermissions(
      roleId,
      payload,
      this.buildActor(request)
    );
  }

  @Patch("roles/:roleId/menu-permissions")
  patchRolePermissions(
    @Param("roleId") roleId: string,
    @Body() payload: PatchRoleMenuPermissionsDto,
    @Req() request: Request
  ) {
    return this.menuAdminService.patchRolePermissions(
      roleId,
      payload,
      this.buildActor(request)
    );
  }
}
