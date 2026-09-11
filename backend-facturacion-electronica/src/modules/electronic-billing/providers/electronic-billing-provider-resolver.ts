import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { ElectronicBillingProviderDisabledError } from "../contracts/electronic-billing-errors";
import type {
  ElectronicBillingProviderContext,
  ResolvedElectronicBillingProviderConfig,
  ResolveElectronicBillingProviderCommand,
} from "../contracts/electronic-billing-commands";
import type { ElectronicBillingProvider } from "../contracts/electronic-billing-provider";
import { ElectronicBillingProviderRegistry } from "./electronic-billing-provider-registry";
import {
  ElectronicBillingProviderRepository,
  TenantElectronicBillingConfigRepository,
} from "../repositories/electronic-billing.repositories";

export type ResolvedElectronicBillingProvider = {
  provider: ElectronicBillingProvider;
  context: ElectronicBillingProviderContext;
  config: ResolvedElectronicBillingProviderConfig;
};

@Injectable()
export class ElectronicBillingProviderResolver {
  constructor(
    @Inject(ElectronicBillingProviderRegistry)
    private readonly providerRegistry: ElectronicBillingProviderRegistry,
    @Inject(ElectronicBillingProviderRepository)
    private readonly providerRepository: ElectronicBillingProviderRepository,
    @Inject(TenantElectronicBillingConfigRepository)
    private readonly tenantConfigRepository: TenantElectronicBillingConfigRepository,
  ) {}

  async resolve(
    command: ResolveElectronicBillingProviderCommand,
    client?: PoolClient,
  ): Promise<ResolvedElectronicBillingProvider> {
    const config = command.providerConfigId
      ? await this.tenantConfigRepository.findById(command.providerConfigId, command.tenantId, client)
      : await this.tenantConfigRepository.findDefaultForTenant(command.tenantId, client);

    if (!config || !config.enabled) {
      throw new ElectronicBillingProviderDisabledError();
    }

    const providerRecord = await this.providerRepository.findById(config.provider_id, client);
    if (!providerRecord) {
      throw new ElectronicBillingProviderDisabledError(
        `Electronic billing provider config ${config.id} references an unavailable provider`,
      );
    }

    const provider = this.providerRegistry.resolve(providerRecord.code);
    return {
      provider,
      context: {
        tenantId: config.tenant_id,
        providerId: config.provider_id,
        providerConfigId: config.id,
        environment: config.environment,
        baseUrl: config.base_url,
        credentialReference: config.credential_reference,
        settings: config.settings,
      },
      config: {
        configId: config.id,
        tenantId: config.tenant_id,
        providerId: config.provider_id,
        providerCode: providerRecord.code,
        providerName: providerRecord.name,
        environment: config.environment,
        enabled: config.enabled,
        baseUrl: config.base_url,
        credentialReference: config.credential_reference,
        settings: config.settings,
        isDefault: config.is_default,
      },
    };
  }
}
