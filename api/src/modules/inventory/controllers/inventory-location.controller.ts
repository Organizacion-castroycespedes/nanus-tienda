import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import type { InventoryLocationType } from "../entities/inventory-location.entity";
import { InventoryLocationService } from "../services/inventory-location.service";

type AuthRequest = Request & {
  user?: {
    tenantId?: string;
    id?: string;
    roles?: string[];
  };
  context?: {
    tenantId?: string;
    userId?: string;
    branchId?: string;
  };
};

type CreateInventoryLocationBody = {
  branchId: string;
  code: string;
  name: string;
  type?: InventoryLocationType;
  description?: string | null;
};

type UpdateInventoryLocationBody = Partial<
  Omit<CreateInventoryLocationBody, "branchId"> & {
    isActive?: boolean;
    branchId?: string;
  }
>;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

@Controller("inventory/locations")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class InventoryLocationController {
  constructor(
    @Inject(InventoryLocationService)
    private readonly inventoryLocationService: InventoryLocationService
  ) {}

  private getTenantId(request: AuthRequest) {
    const tenantId = request.context?.tenantId ?? request.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException("tenant not found in request context");
    }
    return tenantId;
  }

  private buildActor(request: AuthRequest) {
    return {
      roles: Array.isArray(request.user?.roles) ? request.user.roles : [],
      userId: request.context?.userId ?? request.user?.id,
      tenantId: request.context?.tenantId ?? request.user?.tenantId,
      branchId: request.context?.branchId,
    };
  }

  private assertUuid(value: string, field: string) {
    if (!isUuid(value)) {
      throw new BadRequestException(`${field} must be a valid UUID`);
    }
  }

  private parseOptionalBoolean(value: string | undefined, field: string) {
    if (value === undefined) {
      return undefined;
    }

    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }

    throw new BadRequestException(`${field} must be true or false`);
  }

  @Get()
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "READ" })
  list(
    @Query("branchId") branchId: string | undefined,
    @Query("type") type: InventoryLocationType | undefined,
    @Query("isActive") isActive: string | undefined,
    @Query("search") search: string | undefined,
    @Req() request: AuthRequest
  ) {
    if (branchId) {
      this.assertUuid(branchId, "branchId");
    }

    return this.inventoryLocationService.list(
      this.getTenantId(request),
      {
        branchId,
        type,
        isActive: this.parseOptionalBoolean(isActive, "isActive"),
        search,
      },
      this.buildActor(request)
    );
  }

  @Get(":locationId")
  @Roles("SUPER_ADMIN", "SUPER_USER", "ADMIN", "USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "READ" })
  getById(
    @Param("locationId") locationId: string,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(locationId, "locationId");
    return this.inventoryLocationService.getById(
      this.getTenantId(request),
      locationId,
      this.buildActor(request)
    );
  }

  @Post()
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "WRITE" })
  create(@Body() body: CreateInventoryLocationBody, @Req() request: AuthRequest) {
    this.assertUuid(body.branchId, "branchId");
    return this.inventoryLocationService.create(
      {
        ...body,
        tenantId: this.getTenantId(request),
      },
      this.buildActor(request)
    );
  }

  @Put(":locationId")
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "WRITE" })
  update(
    @Param("locationId") locationId: string,
    @Body() body: UpdateInventoryLocationBody,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(locationId, "locationId");
    if (body.branchId !== undefined) {
      this.assertUuid(body.branchId, "branchId");
    }

    return this.inventoryLocationService.update(
      {
        ...body,
        tenantId: this.getTenantId(request),
        locationId,
      },
      this.buildActor(request)
    );
  }

  @Patch(":locationId/deactivate")
  @Roles("SUPER_ADMIN", "SUPER_USER")
  @RequirePermission({ menuKey: "INVENTORY", level: "WRITE" })
  deactivate(
    @Param("locationId") locationId: string,
    @Req() request: AuthRequest
  ) {
    this.assertUuid(locationId, "locationId");
    return this.inventoryLocationService.deactivate(
      this.getTenantId(request),
      locationId,
      this.buildActor(request)
    );
  }
}
