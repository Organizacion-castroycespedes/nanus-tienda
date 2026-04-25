import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { BranchesService } from "./branches.service";
import type { CreateBranchDto } from "./dto/create-branch.dto";
import type { UpdateBranchDto } from "./dto/update-branch.dto";
import type { UpdateBranchStatusDto } from "./dto/update-branch-status.dto";

type AuthRequest = Request & {
  user?: {
    roles?: string[];
    tenantId?: string;
    id?: string;
  };
};

@Controller("branches")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN", "ADMIN")
export class BranchesController {
  constructor(
    @Inject(BranchesService) private readonly branchesService: BranchesService
  ) {}

  private buildActor(request: AuthRequest) {
    const roles = Array.isArray(request.user?.roles)
      ? request.user.roles
      : [];
    return {
      roles,
      tenantId: request.user?.tenantId,
      userId: request.user?.id,
      ip: request.headers["x-forwarded-for"]?.toString() ?? request.ip,
      userAgent: request.headers["user-agent"],
    };
  }

  @Get()
  list(
    @Query("tenantId") tenantId: string | undefined,
    @Req() request: AuthRequest
  ) {
    return this.branchesService.listBranches(
      tenantId,
      this.buildActor(request)
    );
  }

  @Get(":id")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "READ" })
  get(@Param("id") branchId: string, @Req() request: AuthRequest) {
    return this.branchesService.getBranch(branchId, this.buildActor(request));
  }

  @Post()
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "WRITE" })
  create(@Body() payload: CreateBranchDto, @Req() request: AuthRequest) {
    return this.branchesService.createBranch(payload, this.buildActor(request));
  }

  @Put(":id")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "WRITE" })
  update(
    @Param("id") branchId: string,
    @Body() payload: UpdateBranchDto,
    @Req() request: AuthRequest
  ) {
    return this.branchesService.updateBranch(
      branchId,
      payload,
      this.buildActor(request)
    );
  }

  @Patch(":id/status")
  @RequirePermission({ menuKey: MENU_KEYS.CONFIG_GENERAL, level: "WRITE" })
  updateStatus(
    @Param("id") branchId: string,
    @Body() payload: UpdateBranchStatusDto,
    @Req() request: AuthRequest
  ) {
    return this.branchesService.updateStatus(
      branchId,
      payload,
      this.buildActor(request)
    );
  }
}
