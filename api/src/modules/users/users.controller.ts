import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Inject,
} from "@nestjs/common";
import type { Request } from "express";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { MENU_KEYS } from "../../common/constants/menu-keys";
import { UsersService } from "./users.service";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";
import type { UpdateUserPasswordDto } from "./dto/update-password.dto";
import type { ListUsersQueryDto } from "./dto/list-users-query.dto";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "ADMIN")
export class UsersController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService
  ) {}

  private buildActor(request: Request & { user?: { roles?: string[]; tenantId?: string; id?: string } }) {
    const roles = Array.isArray(request.user?.roles)
      ? request.user.roles
      : [];
    return {
      roles,
      tenantId: request.user?.tenantId,
      userId: request.user?.id,
    };
  }

  @Get()
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_USUARIOS, level: "READ" })
  list(@Query() query: ListUsersQueryDto, @Req() request: Request) {
    return this.usersService.listUsers(query, this.buildActor(request));
  }

  @Get(":id")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_USUARIOS, level: "READ" })
  get(@Param("id") userId: string, @Req() request: Request) {
    return this.usersService.getUser(userId, this.buildActor(request));
  }

  @Post()
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_USUARIOS, level: "WRITE" })
  create(@Body() payload: CreateUserDto, @Req() request: Request) {
    return this.usersService.createUser(payload, this.buildActor(request));
  }

  @Patch(":id")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_USUARIOS, level: "WRITE" })
  update(
    @Param("id") userId: string,
    @Body() payload: UpdateUserDto,
    @Req() request: Request
  ) {
    return this.usersService.updateUser(userId, payload, this.buildActor(request));
  }

  @Patch(":id/password")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_USUARIOS, level: "WRITE" })
  updatePassword(
    @Param("id") userId: string,
    @Body() payload: UpdateUserPasswordDto,
    @Req() request: Request
  ) {
    return this.usersService.updatePassword(
      userId,
      payload,
      this.buildActor(request)
    );
  }
}
