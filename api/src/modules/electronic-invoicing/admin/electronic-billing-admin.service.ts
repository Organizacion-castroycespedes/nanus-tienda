import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../../common/db/database.service";
import { isUuid } from "../../../common/services/access-control.service";
import {
  BillingIntegrationClient,
  BillingAdminRequestError,
  type BillingAdminProviderMutationResponse,
  type BillingAdminFactuCoreContext,
  type BillingAdminProviderCatalog,
  type BillingAdminTenantConfiguration,
  type BillingAdminTenantConfigCreateRequest,
  type BillingAdminTenantConfigUpdateRequest,
  type BillingAdminTenantConfigMutationResponse,
  type BillingAdminRuntimeCryptoReadiness,
  type BillingFactuCoreContextDiagnostic,
} from "../../integration-outbox/services/billing-integration-client";
import {
  ELECTRONIC_BILLING_PROVIDER_CAPABILITIES,
  ELECTRONIC_BILLING_PROVIDER_TYPE,
  type CreateElectronicBillingProviderDto,
  type ElectronicBillingProviderCapabilitiesDto,
  type UpdateElectronicBillingProviderMetadataDto,
  type UpdateElectronicBillingProviderStatusDto,
} from "./dto/electronic-billing-provider-admin.dto";
import {
  TENANT_ELECTRONIC_BILLING_ENVIRONMENTS,
  type TenantElectronicBillingConfigCreateDto,
  type TenantElectronicBillingConfigUpdateDto,
} from "./dto/tenant-electronic-billing-config-admin.dto";

const PROVIDER_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertFields = (value: unknown, allowed: readonly string[]) => {
  if (!isRecord(value) || Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new BadRequestException("Payload de proveedor invalido");
  }
};

const normalizeCode = (value: unknown) => {
  if (typeof value !== "string") throw new BadRequestException("Codigo de proveedor requerido");
  const code = value.trim().toUpperCase();
  if (!PROVIDER_CODE_PATTERN.test(code)) throw new BadRequestException("Codigo de proveedor invalido");
  return code;
};

const normalizeName = (value: unknown) => {
  if (typeof value !== "string") throw new BadRequestException("Nombre de proveedor requerido");
  const name = value.trim();
  if (!name || name.length > 160) throw new BadRequestException("Nombre de proveedor invalido");
  return name;
};

const normalizeCapabilities = (value: unknown): ElectronicBillingProviderCapabilitiesDto => {
  if (!isRecord(value)) throw new BadRequestException("Capacidades de proveedor invalidas");
  const keys = Object.keys(value);
  if (keys.length !== ELECTRONIC_BILLING_PROVIDER_CAPABILITIES.length
    || keys.some((key) => !ELECTRONIC_BILLING_PROVIDER_CAPABILITIES.includes(key as never))) {
    throw new BadRequestException("Capacidades de proveedor invalidas");
  }
  const capabilities = {} as ElectronicBillingProviderCapabilitiesDto;
  for (const key of ELECTRONIC_BILLING_PROVIDER_CAPABILITIES) {
    if (typeof value[key] !== "boolean") throw new BadRequestException("Capacidades de proveedor invalidas");
    capabilities[key] = value[key] as boolean;
  }
  return capabilities;
};

const assertCredentialPair = (clientKey: unknown, clientSecret: unknown) => {
  if (typeof clientKey !== "string" || !clientKey.trim()
    || typeof clientSecret !== "string" || !clientSecret.trim()) {
    throw new BadRequestException("Credenciales FactuCore incompletas");
  }
};

const normalizeOptionalUrl = (value: unknown) => {
  if (value === undefined || value === null || value === "") return value ?? null;
  if (typeof value !== "string" || value.length > 2048) {
    throw new BadRequestException("Base URL invalida");
  }
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    return parsed.toString();
  } catch {
    throw new BadRequestException("Base URL invalida");
  }
};

const normalizeTenantSettings = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "factuCoreTenantId")) {
    throw new BadRequestException("Configuracion FactuCore invalida");
  }
  if (value.factuCoreTenantId !== undefined && value.factuCoreTenantId !== null
    && (typeof value.factuCoreTenantId !== "string" || !isUuid(value.factuCoreTenantId))) {
    throw new BadRequestException("Tenant FactuCore invalido");
  }
  return { factuCoreTenantId: value.factuCoreTenantId ?? null };
};

const mapBillingAdminError = (error: unknown): never => {
  if (error instanceof BillingAdminRequestError) {
    if (error.statusCode === 400) throw new BadRequestException("Solicitud de proveedor invalida");
    if (error.statusCode === 404) throw new NotFoundException("Proveedor no encontrado");
    if (error.statusCode === 409) throw new ConflictException("Operacion de proveedor en conflicto");
  }
  throw new ServiceUnavailableException("Catalogo de proveedores no disponible");
};

const mapTenantConfigurationError = (error: unknown): never => {
  if (error instanceof BillingAdminRequestError) {
    if (error.statusCode === 400) throw new BadRequestException("Configuracion de facturacion invalida");
    if (error.statusCode === 404) throw new NotFoundException("Configuracion de facturacion no encontrada");
    if (error.statusCode === 409) throw new ConflictException("Configuracion de facturacion en conflicto");
    if (error.statusCode === 503) throw new ServiceUnavailableException("Persistencia de credenciales no disponible");
  }
  throw new ServiceUnavailableException("Configuracion de facturacion no disponible");
};

type FactuCoreIdentityStatus = "MATCH" | "MISMATCH" | "UNKNOWN" | "UNAVAILABLE";

const normalized = (value: unknown) => typeof value === "string"
  ? value.trim().toLocaleUpperCase("es-CO").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  : "";

const digits = (value: unknown) => typeof value === "string" || typeof value === "number"
  ? String(value).replace(/\D/g, "")
  : "";

const compareFactuCoreIdentity = (
  context: BillingAdminFactuCoreContext,
  requestedTenantId: string,
  fiscalProfile: { nit: unknown; dv: unknown; razonSocial: unknown } | null,
): FactuCoreIdentityStatus => {
  if (context.tenantId !== requestedTenantId) return "MISMATCH";
  if (!context.context.tenantId || !context.configuredFactuCoreTenantId) return "UNKNOWN";
  if (context.context.tenantId !== context.configuredFactuCoreTenantId) return "MISMATCH";
  if (!fiscalProfile) return "UNKNOWN";
  const issuer = context.context.issuer;
  if (!issuer.identificationNumber || !issuer.verificationDigit || !issuer.legalName) return "UNKNOWN";
  if (digits(issuer.identificationNumber) !== digits(fiscalProfile.nit)
    || digits(issuer.verificationDigit) !== digits(fiscalProfile.dv)
    || normalized(issuer.legalName) !== normalized(fiscalProfile.razonSocial)) return "MISMATCH";
  return "MATCH";
};

@Injectable()
export class ElectronicBillingAdminService {
  private readonly logger = new Logger(ElectronicBillingAdminService.name);

  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(BillingIntegrationClient)
    private readonly billingClient: BillingIntegrationClient,
  ) {}

  async listProviders(): Promise<BillingAdminProviderCatalog> {
    try {
      return await this.billingClient.getElectronicBillingProviders();
    } catch {
      throw new ServiceUnavailableException("Billing provider catalog is unavailable");
    }
  }

  async createProvider(input: unknown): Promise<BillingAdminProviderMutationResponse> {
    assertFields(input, ["code", "name", "providerType", "capabilities"]);
    const payload = input as Partial<CreateElectronicBillingProviderDto>;
    const safePayload: CreateElectronicBillingProviderDto = {
      code: normalizeCode(payload.code),
      name: normalizeName(payload.name),
      providerType: ELECTRONIC_BILLING_PROVIDER_TYPE,
      capabilities: normalizeCapabilities(payload.capabilities),
    };
    if (payload.providerType !== ELECTRONIC_BILLING_PROVIDER_TYPE) {
      throw new BadRequestException("Tipo de proveedor invalido");
    }
    try {
      return await this.billingClient.createElectronicBillingProvider(safePayload);
    } catch (error) {
      return mapBillingAdminError(error);
    }
  }

  async updateProvider(providerId: string, input: unknown): Promise<BillingAdminProviderMutationResponse> {
    if (!isUuid(providerId)) throw new BadRequestException("Proveedor invalido");
    assertFields(input, ["name", "capabilities"]);
    const payload = input as UpdateElectronicBillingProviderMetadataDto;
    if (payload.name === undefined && payload.capabilities === undefined) {
      throw new BadRequestException("Actualizacion de proveedor vacia");
    }
    const safePayload: UpdateElectronicBillingProviderMetadataDto = {};
    if (payload.name !== undefined) safePayload.name = normalizeName(payload.name);
    if (payload.capabilities !== undefined) safePayload.capabilities = normalizeCapabilities(payload.capabilities);
    try {
      return await this.billingClient.updateElectronicBillingProvider(providerId.trim(), safePayload);
    } catch (error) {
      return mapBillingAdminError(error);
    }
  }

  async updateProviderStatus(providerId: string, input: unknown): Promise<BillingAdminProviderMutationResponse> {
    if (!isUuid(providerId)) throw new BadRequestException("Proveedor invalido");
    assertFields(input, ["active"]);
    const payload = input as Partial<UpdateElectronicBillingProviderStatusDto>;
    if (typeof payload.active !== "boolean") throw new BadRequestException("Estado de proveedor invalido");
    try {
      return await this.billingClient.updateElectronicBillingProviderStatus(providerId.trim(), { active: payload.active });
    } catch (error) {
      return mapBillingAdminError(error);
    }
  }

  async getTenantConfiguration(tenantId: string): Promise<BillingAdminTenantConfiguration> {
    const normalizedTenantId = tenantId.trim();
    if (!isUuid(normalizedTenantId)) {
      throw new BadRequestException("Tenant invalido");
    }

    let tenant;
    try {
      tenant = await this.db.query<{ id: string }>(
        "SELECT id FROM tenants WHERE id = $1 LIMIT 1",
        [normalizedTenantId],
      );
    } catch {
      throw new ServiceUnavailableException("Tenant directory is unavailable");
    }
    if (!tenant.rows[0]) {
      throw new NotFoundException("Tenant no encontrado");
    }

    try {
      return await this.billingClient.getTenantElectronicBillingConfiguration(normalizedTenantId);
    } catch {
      throw new ServiceUnavailableException("Tenant billing configuration is unavailable");
    }
  }

  async createTenantConfiguration(
    tenantId: string,
    input: unknown,
  ): Promise<BillingAdminTenantConfigMutationResponse> {
    const normalizedTenantId = this.assertTenantId(tenantId);
    const payload = this.normalizeTenantConfigCreate(input);
    await this.assertTenantExists(normalizedTenantId);
    try {
      return await this.billingClient.createTenantElectronicBillingConfiguration(
        normalizedTenantId,
        payload,
      );
    } catch (error) {
      return mapTenantConfigurationError(error);
    }
  }

  async updateTenantConfiguration(
    tenantId: string,
    configId: string,
    input: unknown,
  ): Promise<BillingAdminTenantConfigMutationResponse> {
    const normalizedTenantId = this.assertTenantId(tenantId);
    if (!isUuid(configId)) throw new BadRequestException("Configuracion invalida");
    const payload = this.normalizeTenantConfigUpdate(input);
    await this.assertTenantExists(normalizedTenantId);
    try {
      return await this.billingClient.updateTenantElectronicBillingConfiguration(
        normalizedTenantId,
        configId.trim(),
        payload,
      );
    } catch (error) {
      return mapTenantConfigurationError(error);
    }
  }

  async activateTenantConfiguration(tenantId: string, configId: string) {
    const normalizedTenantId = this.assertTenantId(tenantId);
    if (!isUuid(configId)) throw new BadRequestException("Configuracion invalida");
    await this.assertTenantExists(normalizedTenantId);
    const configuration = await this.billingClient.getTenantElectronicBillingConfiguration(normalizedTenantId);
    const selected = configuration.configurations.find((item) => item.id === configId.trim());
    if (!selected) throw new NotFoundException("Configuracion de facturacion no encontrada");
    const context = await this.getTenantFactuCoreContext(normalizedTenantId, configId.trim());
    if (context.identityStatus !== "MATCH" || context.factuCore?.tenantId !== selected.settings.factuCoreTenantId) {
      throw new ConflictException("La identidad FactuCore debe estar validada antes de activar");
    }
    try {
      return await this.billingClient.activateTenantElectronicBillingConfiguration(
        normalizedTenantId,
        configId.trim(),
      );
    } catch (error) {
      return mapTenantConfigurationError(error);
    }
  }

  async getRuntimeCryptoReadiness(): Promise<BillingAdminRuntimeCryptoReadiness> {
    try {
      return await this.billingClient.getElectronicBillingRuntimeReadiness();
    } catch (error) {
      const statusCode = error instanceof BillingAdminRequestError ? error.statusCode : 503;
      if (statusCode === 403) throw new ForbiddenException("Readiness de escritura no autorizada");
      throw new ServiceUnavailableException("Readiness de escritura no disponible");
    }
  }

  private assertTenantId(tenantId: string) {
    const normalizedTenantId = tenantId.trim();
    if (!isUuid(normalizedTenantId)) throw new BadRequestException("Tenant invalido");
    return normalizedTenantId;
  }

  private async assertTenantExists(tenantId: string) {
    try {
      const result = await this.db.query<{ id: string }>(
        "SELECT id FROM tenants WHERE id = $1 LIMIT 1",
        [tenantId],
      );
      if (!result.rows[0]) throw new NotFoundException("Tenant no encontrado");
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException("Tenant directory is unavailable");
    }
  }

  private normalizeTenantConfigCreate(input: unknown): BillingAdminTenantConfigCreateRequest {
    assertFields(input, ["providerId", "environment", "baseUrl", "settings", "clientKey", "clientSecret"]);
    const value = input as Partial<TenantElectronicBillingConfigCreateDto>;
    if (typeof value.providerId !== "string" || !isUuid(value.providerId)) {
      throw new BadRequestException("Proveedor invalido");
    }
    if (typeof value.environment !== "string"
      || !TENANT_ELECTRONIC_BILLING_ENVIRONMENTS.includes(value.environment as never)) {
      throw new BadRequestException("Ambiente invalido");
    }
    if (typeof value.clientKey !== "string" || typeof value.clientSecret !== "string") {
      throw new BadRequestException("Credenciales FactuCore incompletas");
    }
    assertCredentialPair(value.clientKey, value.clientSecret);
    return {
      providerId: value.providerId.trim(),
      environment: value.environment,
      baseUrl: normalizeOptionalUrl(value.baseUrl),
      settings: normalizeTenantSettings(value.settings),
      clientKey: value.clientKey.trim(),
      clientSecret: value.clientSecret,
    };
  }

  private normalizeTenantConfigUpdate(input: unknown): BillingAdminTenantConfigUpdateRequest {
    assertFields(input, ["baseUrl", "settings", "clientKey", "clientSecret"]);
    const value = input as Partial<TenantElectronicBillingConfigUpdateDto>;
    if (value.clientKey !== undefined || value.clientSecret !== undefined) {
      assertCredentialPair(value.clientKey, value.clientSecret);
    }
    return {
      baseUrl: value.baseUrl === undefined ? undefined : normalizeOptionalUrl(value.baseUrl),
      settings: value.settings === undefined ? undefined : normalizeTenantSettings(value.settings),
      clientKey: value.clientKey?.trim(),
      clientSecret: value.clientSecret,
    };
  }

  async getTenantFactuCoreContext(tenantId: string, configId?: string) {
    const normalizedTenantId = tenantId.trim();
    if (!isUuid(normalizedTenantId)) {
      throw new BadRequestException("Tenant invalido");
    }

    let tenant;
    try {
      tenant = await this.db.query<{ id: string }>(
        "SELECT id FROM tenants WHERE id = $1 LIMIT 1",
        [normalizedTenantId],
      );
    } catch {
      throw new ServiceUnavailableException("Tenant directory is unavailable");
    }
    if (!tenant.rows[0]) {
      throw new NotFoundException("Tenant no encontrado");
    }

    const correlationId = randomUUID();
    this.logger.log(JSON.stringify({
      event: "electronic_billing.factucore_context.start",
      operation: "get_client_context",
      layer: "manus-api",
      correlationId,
    }));

    let factuCoreContext: BillingAdminFactuCoreContext;
    try {
      factuCoreContext = await this.billingClient.getTenantFactuCoreContext(normalizedTenantId, correlationId, configId);
    } catch (error) {
      const upstreamStatus = error instanceof BillingAdminRequestError ? error.statusCode : null;
      this.logger.warn(JSON.stringify({
        event: "electronic_billing.factucore_context.failure",
        operation: "get_client_context",
        layer: "manus-api",
        correlationId,
        category: upstreamStatus === 401
          ? "BILLING_AUTHENTICATION_401"
          : upstreamStatus === 403
            ? "BILLING_AUTHORIZATION_403"
            : upstreamStatus === 504
              ? "BILLING_TIMEOUT"
              : "BILLING_UNAVAILABLE",
        upstreamStatus,
      }));
      return {
        tenantId: normalizedTenantId,
        identityStatus: "UNAVAILABLE" as const,
        factuCore: null,
        ...(process.env.NODE_ENV?.trim().toLowerCase() === "qa" && error instanceof BillingAdminRequestError && error.diagnostic
          ? { diagnostic: error.diagnostic satisfies BillingFactuCoreContextDiagnostic }
          : {}),
      };
    }

    let fiscalProfile;
    try {
      const profile = await this.db.query<{ nit: string | null; dv: string | null; razonSocial: string | null }>(
        `SELECT nit, dv, razon_social AS "razonSocial"
         FROM tenants_detalles
         WHERE tenant_id = $1
         LIMIT 1`,
        [normalizedTenantId],
      );
      fiscalProfile = profile.rows[0] ?? null;
    } catch {
      fiscalProfile = null;
    }

    const identityStatus = compareFactuCoreIdentity(factuCoreContext, normalizedTenantId, fiscalProfile);
    this.logger.log(JSON.stringify({
      event: "electronic_billing.factucore_context.result",
      operation: "get_client_context",
      layer: "manus-api",
      correlationId,
      identityStatus,
      readinessStatus: factuCoreContext.context.dianReadiness.status,
    }));

    return {
      tenantId: normalizedTenantId,
      identityStatus,
      factuCore: factuCoreContext.context,
    };
  }
}
