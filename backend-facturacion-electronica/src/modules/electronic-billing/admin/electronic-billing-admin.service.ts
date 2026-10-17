import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import {
  ElectronicBillingProviderRepository,
  TenantElectronicBillingConfigRepository,
} from "../repositories";
import { ElectronicBillingProviderResolver } from "../providers/electronic-billing-provider-resolver";
import { FACTUCORE_TENANT_ID_SETTING } from "../providers/factucore/factucore.types";
import type { ElectronicBillingProviderCapabilities } from "../domain/electronic-billing.types";
import { ElectronicBillingProviderRegistry } from "../providers/electronic-billing-provider-registry";
import {
  ELECTRONIC_BILLING_PROVIDER_TYPE,
  type CreateElectronicBillingProviderDto,
  type UpdateElectronicBillingProviderMetadataDto,
  type UpdateElectronicBillingProviderStatusDto,
} from "./electronic-billing-provider-admin.dto";
import {
  encryptElectronicBillingCredentials,
  inspectElectronicBillingCredentialRuntimeReadiness,
} from "../credentials";
import type {
  ElectronicBillingRuntimeCryptoReadinessDto,
  ElectronicBillingRuntimeKeyringStatus,
} from "./electronic-billing-runtime-readiness.dto";
import type {
  CreateTenantElectronicBillingConfigDto,
  UpdateTenantElectronicBillingConfigDto,
} from "./tenant-electronic-billing-config-admin.dto";
import {
  DefaultElectronicBillingOperationalApproval,
  ELECTRONIC_BILLING_OPERATIONAL_APPROVAL,
  isElectronicBillingCredentialWriteReady,
  type ElectronicBillingOperationalApproval,
} from "./electronic-billing-write-readiness";

const PROVIDER_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAPABILITY_KEYS = [
  "invoice",
  "creditNote",
  "debitNote",
  "retry",
  "pdf",
  "xml",
  "signedXml",
  "asyncStatus",
  "attachmentDownload",
] as const;

const V106_MIGRATION_VERSION = "V106__electronic_billing_configuration_audit.sql";
const V106_MIGRATION_CHECKSUM =
  "6bbf2efab517bd5521a042a1ec7db99a6e67f66ad7f6daeb1f074e0a1d5e7f5f";

export class ElectronicBillingProviderAdminValidationError extends Error {}
export class ElectronicBillingProviderAdminNotFoundError extends Error {}
export class ElectronicBillingProviderAdminConflictError extends Error {}
export class ElectronicBillingTenantConfigWriteUnavailableError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertAllowedFields = (value: unknown, allowed: readonly string[]) => {
  if (!isRecord(value)) {
    throw new ElectronicBillingProviderAdminValidationError("Invalid provider payload");
  }
  const unknownFields = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknownFields.length > 0) {
    throw new ElectronicBillingProviderAdminValidationError("Unsupported provider fields");
  }
};

const normalizeCode = (value: unknown) => {
  if (typeof value !== "string") {
    throw new ElectronicBillingProviderAdminValidationError("Provider code is required");
  }
  const code = value.trim().toUpperCase();
  if (!PROVIDER_CODE_PATTERN.test(code)) {
    throw new ElectronicBillingProviderAdminValidationError("Provider code is invalid");
  }
  return code;
};

const normalizeName = (value: unknown) => {
  if (typeof value !== "string") {
    throw new ElectronicBillingProviderAdminValidationError("Provider name is required");
  }
  const name = value.trim();
  if (name.length < 1 || name.length > 160) {
    throw new ElectronicBillingProviderAdminValidationError("Provider name is invalid");
  }
  return name;
};

const normalizeCapabilities = (value: unknown): ElectronicBillingProviderCapabilities => {
  if (!isRecord(value) || Object.keys(value).some((key) => !CAPABILITY_KEYS.includes(key as never))) {
    throw new ElectronicBillingProviderAdminValidationError("Provider capabilities are invalid");
  }

  const capabilities = {} as ElectronicBillingProviderCapabilities;
  for (const key of CAPABILITY_KEYS) {
    if (typeof value[key] !== "boolean") {
      throw new ElectronicBillingProviderAdminValidationError("Provider capabilities are invalid");
    }
    capabilities[key] = value[key] as boolean;
  }
  return capabilities;
};

const assertProviderId = (providerId: string) => {
  if (!PROVIDER_ID_PATTERN.test(providerId.trim())) {
    throw new ElectronicBillingProviderAdminValidationError("Provider identifier is invalid");
  }
  return providerId.trim();
};

const isUniqueViolation = (error: unknown) =>
  isRecord(error) && error.code === "23505";

export type SafeElectronicBillingProvider = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  capabilities: unknown;
};

export type SafeTenantElectronicBillingConfig = {
  id: string;
  tenantId: string;
  providerId: string;
  providerCode: string;
  providerName: string;
  providerActive: boolean;
  environment: string;
  enabled: boolean;
  isDefault: boolean;
  configurationStatus: "COMPLETE" | "INCOMPLETE" | "INCONSISTENT";
  baseUrlConfigured: boolean;
  credentialStatus: {
    encryptedConfigured: boolean;
    legacyReferenceConfigured: boolean;
  };
  settings: {
    factuCoreTenantId: string | null;
  };
};

export type SafeFactuCoreClientContext = {
  tenantId: string;
  providerCode: "FACTUCORE";
  configuredFactuCoreTenantId: string | null;
  context: Awaited<ReturnType<NonNullable<import("../providers/factucore/factucore.client").FactuCoreClient["getClientContext"]>>>;
};

export const classifyFactuCoreContextFailure = (error: unknown) => {
  const errorRecord = typeof error === "object" && error !== null
    ? error as { httpStatus?: unknown; responseBodyPresent?: unknown }
    : null;
  const status = errorRecord && typeof errorRecord.httpStatus === "number"
    ? errorRecord.httpStatus
    : null;
  const responseBodyPresent = errorRecord && typeof errorRecord.responseBodyPresent === "boolean"
    ? errorRecord.responseBodyPresent
    : false;
  const category = status === 401
    ? "FACTUCORE_AUTHENTICATION_401"
    : status === 403
      ? "FACTUCORE_AUTHORIZATION_403"
      : error instanceof Error && error.name === "FactuCoreTimeoutError"
        ? "FACTUCORE_TIMEOUT"
        : error instanceof Error && error.name === "FactuCoreNetworkError"
          ? "FACTUCORE_NETWORK"
          : error instanceof Error && error.name === "ElectronicBillingCredentialResolutionError"
            ? "CREDENTIAL_RESOLUTION_FAILED"
            : "FACTUCORE_CONTEXT_UNAVAILABLE";
  return {
    category,
    layer: status !== null ? "factucore-http" : "billing-backend",
    upstreamStatus: status,
    responseBodyPresent,
  } as const;
};

@Injectable()
export class ElectronicBillingAdminService {
  private readonly logger = new Logger(ElectronicBillingAdminService.name);

  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
    @Inject(ElectronicBillingProviderRepository)
    private readonly providerRepository: ElectronicBillingProviderRepository,
    @Inject(TenantElectronicBillingConfigRepository)
    private readonly configRepository: TenantElectronicBillingConfigRepository,
    @Inject(ElectronicBillingProviderResolver)
    private readonly providerResolver: ElectronicBillingProviderResolver,
    @Inject(ElectronicBillingProviderRegistry)
    private readonly providerRegistry: ElectronicBillingProviderRegistry,
    @Optional()
    @Inject(ELECTRONIC_BILLING_OPERATIONAL_APPROVAL)
  private readonly operationalApproval: {
      getApproval: () => ElectronicBillingOperationalApproval | Promise<ElectronicBillingOperationalApproval>;
    } = new DefaultElectronicBillingOperationalApproval(),
  ) {}

  async createTenantConfiguration(tenantId: string, input: unknown) {
    this.assertTenantConfigWriteInput(tenantId, input, false);
    await this.assertCredentialWriteReady();
    const value = input as CreateTenantElectronicBillingConfigDto;
    const now = new Date();
    try {
      return await this.db.transaction(async (client) => {
        const tenant = await client.query<{ id: string }>(
          "SELECT id FROM tenants WHERE id = $1 FOR UPDATE",
          [tenantId],
        );
        if (!tenant.rows[0]) throw new ElectronicBillingProviderAdminNotFoundError("Tenant not found");
        const provider = await this.providerRepository.findByIdForUpdate(value.providerId, client);
        if (!provider) throw new ElectronicBillingProviderAdminNotFoundError("Provider not found");
        this.assertRegisteredCapabilities(provider.code, provider.capabilities as ElectronicBillingProviderCapabilities);
        const existing = await this.configRepository.findByTenantAndProvider(
          tenantId,
          provider.id,
          value.environment,
          client,
        );
        if (existing) throw new ElectronicBillingProviderAdminConflictError("Tenant provider configuration already exists");
        const id = randomUUID();
        const encryptedCredentials = encryptElectronicBillingCredentials(
          { clientKey: value.clientKey, clientSecret: value.clientSecret },
          { tenantId, providerId: provider.id, providerConfigId: id },
        );
        const created = await this.configRepository.create({
          id,
          tenantId,
          providerId: provider.id,
          environment: value.environment,
          enabled: false,
          isDefault: false,
          baseUrl: value.baseUrl ?? null,
          encryptedCredentials,
          settings: value.settings ?? {},
          createdAt: now,
          updatedAt: now,
        }, client);
        if (!created) throw new Error("Tenant configuration creation returned no row");
        await this.configRepository.insertAdministrativeAudit({
          id: randomUUID(),
          tenantId,
          configId: id,
          action: "CONFIG_CREATED",
          metadata: { environment: created.environment, providerId: provider.id },
          createdAt: now,
        }, client);
        return this.toTenantConfigWriteResponse(created);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ElectronicBillingProviderAdminConflictError("Tenant provider configuration already exists");
      }
      throw error;
    }
  }

  async updateTenantConfiguration(tenantId: string, configId: string, input: unknown) {
    this.assertTenantConfigWriteInput(tenantId, input, true);
    if (!UUID_PATTERN.test(configId.trim())) {
      throw new ElectronicBillingProviderAdminValidationError("Configuration identifier is invalid");
    }
    const value = input as UpdateTenantElectronicBillingConfigDto;
    const credentialsProvided = value.clientKey !== undefined || value.clientSecret !== undefined;
    if (credentialsProvided) await this.assertCredentialWriteReady();
    const now = new Date();
    return this.db.transaction(async (client) => {
      const current = await this.configRepository.findByIdForUpdate(configId.trim(), tenantId, client);
      if (!current) throw new ElectronicBillingProviderAdminNotFoundError("Tenant configuration not found");
      const encryptedCredentials = credentialsProvided
        ? encryptElectronicBillingCredentials(
          { clientKey: value.clientKey!, clientSecret: value.clientSecret! },
          { tenantId, providerId: current.provider_id, providerConfigId: current.id },
        )
        : null;
      const updated = await this.configRepository.updateAdministrative(
        current.id,
        tenantId,
        {
          baseUrl: value.baseUrl,
          settings: value.settings,
          encryptedCredentials,
          updatedAt: now,
        },
        client,
      );
      if (!updated) throw new ElectronicBillingProviderAdminNotFoundError("Tenant configuration not found");
      await this.configRepository.insertAdministrativeAudit({
        id: randomUUID(),
        tenantId,
        configId: current.id,
        action: credentialsProvided ? "CONFIG_CREDENTIAL_REPLACED" : "CONFIG_METADATA_UPDATED",
        metadata: { providerId: current.provider_id, environment: current.environment },
        createdAt: now,
      }, client);
      return this.toTenantConfigWriteResponse(updated);
    });
  }

  async activateTenantConfiguration(tenantId: string, configId: string, input: unknown) {
    if (!UUID_PATTERN.test(tenantId.trim()) || !UUID_PATTERN.test(configId.trim())
      || !isRecord(input) || Object.keys(input).some((key) => key !== "clearLegacyReference")
      || input.clearLegacyReference !== true) {
      throw new ElectronicBillingProviderAdminValidationError("Activation requires explicit legacy-reference removal");
    }
    const now = new Date();
    try {
      return await this.db.transaction(async (client) => {
        const tenant = await client.query<{ id: string }>(
          "SELECT id FROM tenants WHERE id = $1 FOR UPDATE",
          [tenantId],
        );
        if (!tenant.rows[0]) throw new ElectronicBillingProviderAdminNotFoundError("Tenant not found");
        const current = await this.configRepository.findByIdForUpdate(configId.trim(), tenantId, client);
        if (!current) throw new ElectronicBillingProviderAdminNotFoundError("Tenant configuration not found");
        const provider = await this.providerRepository.findByIdForUpdate(current.provider_id, client);
        if (!provider || provider.code !== "FACTUCORE" || !provider.active) {
          throw new ElectronicBillingProviderAdminValidationError("Provider is not active");
        }
        if (!current.encrypted_credentials?.startsWith("v2.")) {
          throw new ElectronicBillingProviderAdminValidationError("V2 credentials are required");
        }
        const settings = current.settings as Record<string, unknown> | null;
        if (!settings || typeof settings.factuCoreTenantId !== "string" || !UUID_PATTERN.test(settings.factuCoreTenantId)) {
          throw new ElectronicBillingProviderAdminValidationError("FactuCore tenant binding is required");
        }
        const updated = await this.configRepository.activateAdministrative(
          current.id,
          tenantId,
          true,
          now,
          client,
        );
        if (!updated) throw new ElectronicBillingProviderAdminNotFoundError("Tenant configuration not found");
        await this.configRepository.insertAdministrativeAudit({
          id: randomUUID(),
          tenantId,
          configId: current.id,
          action: "CONFIG_METADATA_UPDATED",
          metadata: {
            providerId: current.provider_id,
            environment: current.environment,
            transition: "ACTIVATED_AND_DEFAULTED",
            legacyReferenceCleared: true,
          },
          createdAt: now,
        }, client);
        return this.toTenantConfigWriteResponse(updated);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ElectronicBillingProviderAdminConflictError("Tenant default configuration changed concurrently");
      }
      throw error;
    }
  }

  private async assertCredentialWriteReady() {
    const readiness = await this.getRuntimeCryptoReadiness();
    if (!readiness.writeReady) {
      throw new ElectronicBillingTenantConfigWriteUnavailableError(
        "Tenant billing credential writes are not operationally approved",
      );
    }
  }

  private toTenantConfigWriteResponse(config: {
    id: string;
    tenant_id: string;
    provider_id: string;
    environment: "TEST" | "HABILITATION" | "PRODUCTION";
    enabled: boolean;
    is_default: boolean;
    encrypted_credentials: string | null;
  }) {
    return {
      id: config.id,
      tenantId: config.tenant_id,
      providerId: config.provider_id,
      environment: config.environment,
      enabled: config.enabled,
      isDefault: config.is_default,
      credentialConfigured: Boolean(config.encrypted_credentials),
    };
  }

  private assertTenantConfigWriteInput(tenantId: string, input: unknown, update: boolean) {
    if (!UUID_PATTERN.test(tenantId.trim()) || !isRecord(input)) {
      throw new ElectronicBillingProviderAdminValidationError("Tenant billing configuration payload is invalid");
    }
    const allowed = update
      ? ["baseUrl", "settings", "clientKey", "clientSecret"]
      : ["providerId", "environment", "baseUrl", "settings", "clientKey", "clientSecret"];
    if (Object.keys(input).some((key) => !allowed.includes(key))) {
      throw new ElectronicBillingProviderAdminValidationError("Tenant billing configuration payload is invalid");
    }
    const value = input as Partial<CreateTenantElectronicBillingConfigDto & UpdateTenantElectronicBillingConfigDto>;
    if (!update && !PROVIDER_ID_PATTERN.test(String(value.providerId ?? "").trim())) {
      throw new ElectronicBillingProviderAdminValidationError("Provider identifier is invalid");
    }
    if (!update && !["TEST", "HABILITATION", "PRODUCTION"].includes(String(value.environment))) {
      throw new ElectronicBillingProviderAdminValidationError("Billing environment is invalid");
    }
    if (!update && (typeof value.clientKey !== "string" || !value.clientKey.trim()
      || typeof value.clientSecret !== "string" || !value.clientSecret.trim())) {
      throw new ElectronicBillingProviderAdminValidationError("Both billing credentials are required");
    }
    if (update && ((value.clientKey === undefined) !== (value.clientSecret === undefined))) {
      throw new ElectronicBillingProviderAdminValidationError("Both billing credentials are required for replacement");
    }
  }

  async createProvider(input: unknown) {
    assertAllowedFields(input, ["code", "name", "providerType", "capabilities"]);
    const payload = input as Partial<CreateElectronicBillingProviderDto>;
    const code = normalizeCode(payload.code);
    const name = normalizeName(payload.name);
    if (payload.providerType !== ELECTRONIC_BILLING_PROVIDER_TYPE) {
      throw new ElectronicBillingProviderAdminValidationError("Provider type is invalid");
    }
    const capabilities = normalizeCapabilities(payload.capabilities);
    this.assertRegisteredCapabilities(code, capabilities);

    const now = new Date();
    try {
      return await this.db.transaction(async (client) => {
        const existing = await this.providerRepository.findByCode(code, client);
        if (existing) {
          throw new ElectronicBillingProviderAdminConflictError("Provider code already exists");
        }
        const created = await this.providerRepository.create({
          id: randomUUID(),
          code,
          name,
          providerType: ELECTRONIC_BILLING_PROVIDER_TYPE,
          active: true,
          capabilities,
          createdAt: now,
          updatedAt: now,
        }, client);
        if (!created) {
          throw new Error("Provider creation returned no row");
        }
        return this.toAdminResponse(created, await this.providerRepository.countDependencies(created.id, client));
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ElectronicBillingProviderAdminConflictError("Provider code already exists");
      }
      throw error;
    }
  }

  async updateProvider(providerId: string, input: unknown) {
    const id = assertProviderId(providerId);
    assertAllowedFields(input, ["name", "capabilities"]);
    const payload = input as UpdateElectronicBillingProviderMetadataDto;
    if (payload.name === undefined && payload.capabilities === undefined) {
      throw new ElectronicBillingProviderAdminValidationError("Provider update is empty");
    }

    return this.db.transaction(async (client) => {
      const current = await this.providerRepository.findByIdForUpdate(id, client);
      if (!current) {
        throw new ElectronicBillingProviderAdminNotFoundError("Provider not found");
      }
      const name = payload.name === undefined ? current.name : normalizeName(payload.name);
      const capabilities = payload.capabilities === undefined
        ? normalizeCapabilities(current.capabilities)
        : normalizeCapabilities(payload.capabilities);
      this.assertRegisteredCapabilities(current.code, capabilities);
      const updated = await this.providerRepository.updateMetadata(id, { name, capabilities, updatedAt: new Date() }, client);
      if (!updated) {
        throw new Error("Provider update returned no row");
      }
      return this.toAdminResponse(updated, await this.providerRepository.countDependencies(id, client));
    });
  }

  async updateProviderStatus(providerId: string, input: unknown) {
    const id = assertProviderId(providerId);
    assertAllowedFields(input, ["active"]);
    const payload = input as Partial<UpdateElectronicBillingProviderStatusDto>;
    if (typeof payload.active !== "boolean") {
      throw new ElectronicBillingProviderAdminValidationError("Provider status is invalid");
    }
    const active = payload.active;

    return this.db.transaction(async (client) => {
      const current = await this.providerRepository.findByIdForUpdate(id, client);
      if (!current) {
        throw new ElectronicBillingProviderAdminNotFoundError("Provider not found");
      }
      this.assertRegisteredCapabilities(current.code, normalizeCapabilities(current.capabilities));
      if (!active) {
        const dependencies = await this.providerRepository.countDependencies(id, client);
        if (dependencies.enabledTenantConfigurations > 0) {
          throw new ElectronicBillingProviderAdminConflictError("Provider has enabled tenant configurations");
        }
      }
      const updated = await this.providerRepository.updateStatus(id, active, new Date(), client);
      if (!updated) {
        throw new Error("Provider status update returned no row");
      }
      return this.toAdminResponse(updated, await this.providerRepository.countDependencies(id, client));
    });
  }

  private assertRegisteredCapabilities(code: string, capabilities: ElectronicBillingProviderCapabilities) {
    let adapter: { capabilities: ElectronicBillingProviderCapabilities };
    try {
      adapter = this.providerRegistry.resolve(code);
    } catch {
      throw new ElectronicBillingProviderAdminValidationError("Provider adapter is unavailable");
    }
    for (const key of CAPABILITY_KEYS) {
      if (capabilities[key] && !adapter.capabilities[key]) {
        throw new ElectronicBillingProviderAdminValidationError("Provider capability is not supported by adapter");
      }
    }
  }

  private toAdminResponse(
    provider: {
      id: string;
      code: string;
      name: string;
      provider_type: string;
      active: boolean;
      capabilities: unknown;
      created_at: string | Date;
      updated_at: string | Date;
    },
    dependencySummary: { enabledTenantConfigurations: number; historicalDocuments: number },
  ) {
    if (provider.provider_type !== ELECTRONIC_BILLING_PROVIDER_TYPE) {
      throw new Error("Provider type is incompatible");
    }
    return {
      id: provider.id,
      code: provider.code,
      name: provider.name,
      providerType: ELECTRONIC_BILLING_PROVIDER_TYPE,
      active: provider.active,
      capabilities: normalizeCapabilities(provider.capabilities),
      dependencySummary,
      createdAt: new Date(provider.created_at).toISOString(),
      updatedAt: new Date(provider.updated_at).toISOString(),
    };
  }

  async listProviders(): Promise<{ providers: SafeElectronicBillingProvider[] }> {
    const providers = await this.providerRepository.listAll();
    return {
      providers: providers.map((provider) => ({
        id: provider.id,
        code: provider.code,
        name: provider.name,
        active: provider.active,
        capabilities: provider.capabilities,
      })),
    };
  }

  private async inspectSchemaMigration(): Promise<"READY" | "MISSING" | "UNKNOWN"> {
    const expectedDatabase = this.db.getConnectionConfig().database;
    try {
      const result = await this.db.query<{
        databaseName: string;
        schemaName: string;
        auditTableExists: boolean;
        historyRows: number;
        exactHistoryRows: number;
        expectedColumns: number;
        expectedIndexes: number;
      }>(
        `WITH expected_columns(column_name, udt_name, is_nullable) AS (
           VALUES
             ('id', 'uuid', 'NO'),
             ('tenant_id', 'uuid', 'NO'),
             ('config_id', 'uuid', 'YES'),
             ('action', 'text', 'NO'),
             ('actor_source', 'text', 'NO'),
             ('metadata', 'jsonb', 'NO'),
             ('created_at', 'timestamptz', 'NO')
         ),
         expected_indexes(index_name) AS (
           VALUES
             ('idx_electronic_billing_configuration_audit_tenant'),
             ('idx_electronic_billing_configuration_audit_config')
         )
         SELECT
           current_database() AS "databaseName",
           current_schema() AS "schemaName",
           to_regclass('public.electronic_billing_configuration_audit') IS NOT NULL
             AS "auditTableExists",
           (
             SELECT COUNT(*)::int
             FROM public.migrations_history
             WHERE version = $1
           ) AS "historyRows",
           (
             SELECT COUNT(*)::int
             FROM public.migrations_history
             WHERE version = $1
               AND success = TRUE
               AND LOWER(checksum) = LOWER($2)
           ) AS "exactHistoryRows",
           (
             SELECT COUNT(*)::int
             FROM expected_columns expected
             JOIN information_schema.columns actual
               ON actual.table_schema = 'public'
              AND actual.table_name = 'electronic_billing_configuration_audit'
              AND actual.column_name = expected.column_name
              AND actual.udt_name = expected.udt_name
              AND actual.is_nullable = expected.is_nullable
           ) AS "expectedColumns",
           (
             SELECT COUNT(*)::int
             FROM expected_indexes expected
             JOIN pg_indexes actual
               ON actual.schemaname = 'public'
              AND actual.tablename = 'electronic_billing_configuration_audit'
              AND actual.indexname = expected.index_name
           ) AS "expectedIndexes"`,
        [V106_MIGRATION_VERSION, V106_MIGRATION_CHECKSUM],
      );
      const row = result.rows[0];
      if (!row || row.databaseName !== expectedDatabase || row.schemaName !== "public") {
        return "UNKNOWN";
      }
      if (row.historyRows === 0 || !row.auditTableExists) {
        return "MISSING";
      }
      if (
        row.historyRows !== 1
        || row.exactHistoryRows !== 1
        || row.expectedColumns !== 7
        || row.expectedIndexes !== 2
      ) {
        return "UNKNOWN";
      }
      return "READY";
    } catch {
      return "UNKNOWN";
    }
  }

  async getRuntimeCryptoReadiness(): Promise<ElectronicBillingRuntimeCryptoReadinessDto> {
    const writesEnabled = process.env.ELECTRONIC_BILLING_CREDENTIAL_WRITES_ENABLED?.trim().toLowerCase() === "true";
    const schemaMigration = await this.inspectSchemaMigration();
    const approval = await this.operationalApproval.getApproval();
    try {
      const readiness = inspectElectronicBillingCredentialRuntimeReadiness();
      const status: ElectronicBillingRuntimeKeyringStatus = readiness.configured
        ? "READY"
        : readiness.reason === "KEYRING_MISSING"
          ? "MISSING"
          : readiness.reason === "KEYRING_INVALID"
            ? "INVALID"
            : readiness.reason === "ACTIVE_KEY_MISSING"
              ? "ACTIVE_KEY_MISSING"
              : "SELF_TEST_FAILED";
      return {
        schemaMigration,
        keyringStatus: status,
        syntheticSelfTest: readiness.configured ? "PASS" : "FAIL",
        historicalDecryptReady: "UNKNOWN",
        operationalOwnership: approval.operationalOwnership,
        recoveryReadiness: approval.recoveryReadiness,
        credentialWrites: writesEnabled ? "ENABLED" : "DISABLED",
        writeReady: isElectronicBillingCredentialWriteReady({
          runtimeEnvironment: process.env.NODE_ENV ?? "development",
          schemaMigration,
          keyringStatus: status,
          syntheticSelfTest: readiness.configured ? "PASS" : "FAIL",
          operationalOwnership: approval.operationalOwnership,
          recoveryReadiness: approval.recoveryReadiness,
          credentialWrites: writesEnabled ? "ENABLED" : "DISABLED",
        }),
      };
    } catch {
      return {
        schemaMigration,
        keyringStatus: "UNKNOWN",
        syntheticSelfTest: "NOT_RUN",
        historicalDecryptReady: "UNKNOWN",
        operationalOwnership: approval.operationalOwnership,
        recoveryReadiness: approval.recoveryReadiness,
        credentialWrites: writesEnabled ? "ENABLED" : "DISABLED",
        writeReady: false,
      };
    }
  }

  async getTenantConfiguration(tenantId: string) {
    const tenant = await this.db.query<{ id: string }>(
      "SELECT id FROM tenants WHERE id = $1 LIMIT 1",
      [tenantId],
    );
    if (!tenant.rows[0]) {
      return null;
    }

    const configurations = await this.configRepository.listSafeForTenant(tenantId);
    return {
      tenantId,
      configurations: configurations.map((config) => {
        const configurationStatus = !config.provider_active
          ? "INCONSISTENT"
          : config.base_url_configured &&
              (config.encrypted_credentials_present || config.legacy_credential_reference_present) &&
              Boolean(config.factucore_tenant_id)
            ? "COMPLETE"
            : "INCOMPLETE";
        return {
        id: config.id,
        tenantId: config.tenant_id,
        providerId: config.provider_id,
        providerCode: config.provider_code,
        providerName: config.provider_name,
        providerActive: config.provider_active,
        environment: config.environment,
        enabled: config.enabled,
        isDefault: config.is_default,
        configurationStatus,
        baseUrlConfigured: Boolean(config.base_url_configured),
        credentialStatus: {
          encryptedConfigured: Boolean(config.encrypted_credentials_present),
          legacyReferenceConfigured: Boolean(config.legacy_credential_reference_present),
        },
        settings: {
          factuCoreTenantId: config.factucore_tenant_id,
        },
        } satisfies SafeTenantElectronicBillingConfig;
      }),
    };
  }

  async getTenantFactuCoreContext(tenantId: string, correlationId?: string, providerConfigId?: string): Promise<SafeFactuCoreClientContext> {
    const diagnosticCorrelationId = correlationId?.trim() || randomUUID();
    try {
      const resolved = await this.providerResolver.resolveForAdministrativeContext(tenantId, undefined, providerConfigId);
      if (resolved.config.providerCode !== "FACTUCORE" || typeof resolved.provider.getClientContext !== "function") {
        throw new Error("FactuCore provider context is unavailable");
      }

      const configuredValue = resolved.context.settings[FACTUCORE_TENANT_ID_SETTING];
      const context = await resolved.provider.getClientContext({
        ...resolved.context,
        correlationId: diagnosticCorrelationId,
      });
      this.logger.log(JSON.stringify({
        event: "electronic_billing.factucore_context.result",
        operation: "get_client_context",
        layer: "billing-backend",
        correlationId: diagnosticCorrelationId,
        result: "RECEIVED",
      }));
      return {
        tenantId,
        providerCode: "FACTUCORE",
        configuredFactuCoreTenantId: typeof configuredValue === "string" && configuredValue.trim()
          ? configuredValue.trim()
          : null,
        context,
      };
    } catch (error) {
      const diagnostic = classifyFactuCoreContextFailure(error);
      this.logger.warn(JSON.stringify({
        event: "electronic_billing.factucore_context.failure",
        operation: "get_client_context",
        correlationId: diagnosticCorrelationId,
        ...diagnostic,
      }));
      throw error;
    }
  }
}
