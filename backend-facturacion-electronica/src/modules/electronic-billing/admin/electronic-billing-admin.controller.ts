import {
  Controller,
  BadRequestException,
  Body,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Query,
  Patch,
  Post,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ElectronicBillingProviderAdminConflictError,
  ElectronicBillingProviderAdminNotFoundError,
  ElectronicBillingAdminService,
  ElectronicBillingProviderAdminValidationError,
  ElectronicBillingTenantConfigWriteUnavailableError,
  classifyFactuCoreContextFailure,
} from "./electronic-billing-admin.service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizeBearer = (value: string | undefined) => {
  if (!value) return null;
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : value.trim();
};

const assertInternalToken = (authorization: string | undefined) => {
  const configuredToken = process.env.API_INTERNAL_TOKEN?.trim();
  if (!configuredToken) {
    throw new UnauthorizedException("Internal auth token is not configured");
  }
  const token = normalizeBearer(authorization);
  if (!token) {
    throw new ForbiddenException("Missing internal authorization token");
  }
  if (token !== configuredToken) {
    throw new ForbiddenException("Invalid internal authorization token");
  }
};

@Controller("internal/electronic-billing/admin")
export class ElectronicBillingAdminController {
  constructor(
    @Inject(ElectronicBillingAdminService)
    private readonly service: ElectronicBillingAdminService,
  ) {}

  @Get("providers")
  async listProviders(@Headers("authorization") authorization: string | undefined) {
    assertInternalToken(authorization);
    try {
      return await this.service.listProviders();
    } catch {
      throw new ServiceUnavailableException("Billing provider catalog is unavailable");
    }
  }

  @Get("runtime/crypto-readiness")
  @Header("Cache-Control", "no-store")
  async getRuntimeCryptoReadiness(@Headers("authorization") authorization: string | undefined) {
    assertInternalToken(authorization);
    return this.service.getRuntimeCryptoReadiness();
  }

  @Post("providers")
  async createProvider(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
  ) {
    assertInternalToken(authorization);
    try {
      return await this.service.createProvider(body);
    } catch (error) {
      throw mapProviderAdminError(error);
    }
  }

  @Patch("providers/:providerId")
  async updateProvider(
    @Headers("authorization") authorization: string | undefined,
    @Param("providerId") providerId: string,
    @Body() body: unknown,
  ) {
    assertInternalToken(authorization);
    try {
      return await this.service.updateProvider(providerId, body);
    } catch (error) {
      throw mapProviderAdminError(error);
    }
  }

  @Patch("providers/:providerId/status")
  async updateProviderStatus(
    @Headers("authorization") authorization: string | undefined,
    @Param("providerId") providerId: string,
    @Body() body: unknown,
  ) {
    assertInternalToken(authorization);
    try {
      return await this.service.updateProviderStatus(providerId, body);
    } catch (error) {
      throw mapProviderAdminError(error);
    }
  }

  @Get("tenants/:tenantId/config")
  async getTenantConfiguration(
    @Headers("authorization") authorization: string | undefined,
    @Param("tenantId") tenantId: string,
  ) {
    assertInternalToken(authorization);
    if (!UUID_PATTERN.test(tenantId.trim())) {
      throw new NotFoundException("Tenant billing configuration not found");
    }
    try {
      const result = await this.service.getTenantConfiguration(tenantId.trim());
      if (!result) {
        throw new NotFoundException("Tenant billing configuration not found");
      }
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException("Tenant billing configuration is unavailable");
    }
  }

  @Post("tenants/:tenantId/config")
  async createTenantConfiguration(
    @Headers("authorization") authorization: string | undefined,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    assertInternalToken(authorization);
    try {
      return await this.service.createTenantConfiguration(tenantId.trim(), body);
    } catch (error) {
      throw mapTenantConfigWriteError(error);
    }
  }

  @Patch("tenants/:tenantId/config/:configId")
  async updateTenantConfiguration(
    @Headers("authorization") authorization: string | undefined,
    @Param("tenantId") tenantId: string,
    @Param("configId") configId: string,
    @Body() body: unknown,
  ) {
    assertInternalToken(authorization);
    try {
      return await this.service.updateTenantConfiguration(tenantId.trim(), configId.trim(), body);
    } catch (error) {
      throw mapTenantConfigWriteError(error);
    }
  }

  @Post("tenants/:tenantId/config/:configId/activate")
  async activateTenantConfiguration(
    @Headers("authorization") authorization: string | undefined,
    @Param("tenantId") tenantId: string,
    @Param("configId") configId: string,
    @Body() body: unknown,
  ) {
    assertInternalToken(authorization);
    try {
      return await this.service.activateTenantConfiguration(tenantId.trim(), configId.trim(), body);
    } catch (error) {
      throw mapTenantConfigWriteError(error);
    }
  }

  @Get("tenants/:tenantId/factucore-context")
  @Header("Cache-Control", "no-store")
  async getTenantFactuCoreContext(
    @Headers("authorization") authorization: string | undefined,
    @Headers("x-correlation-id") correlationId: string | undefined,
    @Param("tenantId") tenantId: string,
    @Query("configId") configId: string | undefined,
  ) {
    assertInternalToken(authorization);
    if (!UUID_PATTERN.test(tenantId.trim())) {
      throw new NotFoundException("Tenant FactuCore context not found");
    }
    const safeCorrelationId = typeof correlationId === "string"
      && /^[A-Za-z0-9._-]{1,100}$/.test(correlationId.trim())
      ? correlationId.trim()
      : undefined;
    try {
      return await this.service.getTenantFactuCoreContext(tenantId.trim(), safeCorrelationId, configId?.trim());
    } catch (error) {
      const response: Record<string, unknown> = { message: "FactuCore context is unavailable" };
      if (process.env.NODE_ENV?.trim().toLowerCase() === "qa") {
        response.diagnostic = {
          ...classifyFactuCoreContextFailure(error),
          correlationId: safeCorrelationId ?? null,
        };
      }
      throw new ServiceUnavailableException(response);
    }
  }
}

const mapProviderAdminError = (error: unknown) => {
  if (error instanceof ElectronicBillingProviderAdminValidationError) {
    return new BadRequestException(error.message);
  }
  if (error instanceof ElectronicBillingProviderAdminNotFoundError) {
    return new NotFoundException("Electronic billing provider not found");
  }
  if (error instanceof ElectronicBillingProviderAdminConflictError) {
    return new ConflictException(error.message);
  }
  return new ServiceUnavailableException("Billing provider catalog is unavailable");
};

const mapTenantConfigWriteError = (error: unknown) => {
  if (error instanceof ElectronicBillingProviderAdminValidationError) {
    return new BadRequestException(error.message);
  }
  if (error instanceof ElectronicBillingProviderAdminNotFoundError) {
    return new NotFoundException("Tenant billing configuration not found");
  }
  if (error instanceof ElectronicBillingProviderAdminConflictError) {
    return new ConflictException("Tenant billing configuration is in conflict");
  }
  if (error instanceof ElectronicBillingTenantConfigWriteUnavailableError) {
    return new ServiceUnavailableException("Tenant billing configuration writes are unavailable");
  }
  return new ServiceUnavailableException("Tenant billing configuration is unavailable");
};
