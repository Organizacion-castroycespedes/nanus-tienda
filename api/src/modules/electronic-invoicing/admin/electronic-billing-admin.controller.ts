import {
  Controller,
  Body,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { RequirePermission } from "../../../common/decorators/require-permission.decorator";
import { MENU_KEYS } from "../../../common/constants/menu-keys";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { ElectronicBillingAdminService } from "./electronic-billing-admin.service";

@Controller("admin/electronic-billing")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles("SUPER_ADMIN")
export class ElectronicBillingAdminController {
  constructor(
    @Inject(ElectronicBillingAdminService)
    private readonly service: ElectronicBillingAdminService,
  ) {}

  @Get("providers")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_BILLING_PROVIDERS, level: "READ" })
  listProviders() {
    return this.service.listProviders();
  }

  @Post("providers")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_BILLING_PROVIDERS, level: "WRITE" })
  createProvider(@Body() body: unknown) {
    return this.service.createProvider(body);
  }

  @Patch("providers/:providerId")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_BILLING_PROVIDERS, level: "WRITE" })
  updateProvider(@Param("providerId") providerId: string, @Body() body: unknown) {
    return this.service.updateProvider(providerId, body);
  }

  @Patch("providers/:providerId/status")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_BILLING_PROVIDERS, level: "WRITE" })
  updateProviderStatus(@Param("providerId") providerId: string, @Body() body: unknown) {
    return this.service.updateProviderStatus(providerId, body);
  }

  @Get("tenants/:tenantId/config")
  getTenantConfiguration(@Param("tenantId") tenantId: string) {
    return this.service.getTenantConfiguration(tenantId);
  }

  @Get("runtime/crypto-readiness")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_BILLING_PROVIDERS, level: "WRITE" })
  getRuntimeCryptoReadiness() {
    return this.service.getRuntimeCryptoReadiness();
  }

  @Post("tenants/:tenantId/config")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_BILLING_PROVIDERS, level: "WRITE" })
  createTenantConfiguration(@Param("tenantId") tenantId: string, @Body() body: unknown) {
    return this.service.createTenantConfiguration(tenantId, body);
  }

  @Patch("tenants/:tenantId/config/:configId")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_BILLING_PROVIDERS, level: "WRITE" })
  updateTenantConfiguration(
    @Param("tenantId") tenantId: string,
    @Param("configId") configId: string,
    @Body() body: unknown,
  ) {
    return this.service.updateTenantConfiguration(tenantId, configId, body);
  }

  @Post("tenants/:tenantId/config/:configId/activate")
  @RequirePermission({ menuKey: MENU_KEYS.ELECTRONIC_BILLING_PROVIDERS, level: "WRITE" })
  activateTenantConfiguration(@Param("tenantId") tenantId: string, @Param("configId") configId: string) {
    return this.service.activateTenantConfiguration(tenantId, configId);
  }

  @Get("tenants/:tenantId/factucore-context")
  @Header("Cache-Control", "no-store")
  getTenantFactuCoreContext(@Param("tenantId") tenantId: string) {
    return this.service.getTenantFactuCoreContext(tenantId);
  }
}
