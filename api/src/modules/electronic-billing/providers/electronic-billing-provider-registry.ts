import { Injectable } from "@nestjs/common";
import {
  ElectronicBillingProviderCapabilityError,
  ElectronicBillingProviderNotRegisteredError,
} from "../contracts/electronic-billing-errors";
import type { ElectronicBillingProvider } from "../contracts/electronic-billing-provider";

const normalizeProviderCode = (code: string) => code.trim().toUpperCase();

@Injectable()
export class ElectronicBillingProviderRegistry {
  private readonly providers = new Map<string, ElectronicBillingProvider>();

  register(provider: ElectronicBillingProvider) {
    this.providers.set(normalizeProviderCode(provider.code), provider);
    return provider;
  }

  resolve(code: string) {
    const provider = this.providers.get(normalizeProviderCode(code));
    if (!provider) {
      throw new ElectronicBillingProviderNotRegisteredError(code);
    }
    return provider;
  }

  has(code: string) {
    return this.providers.has(normalizeProviderCode(code));
  }

  listCodes() {
    return [...this.providers.keys()].sort();
  }

  assertCapability(code: string, capability: keyof ElectronicBillingProvider["capabilities"]) {
    const provider = this.resolve(code);
    if (!provider.capabilities[capability]) {
      throw new ElectronicBillingProviderCapabilityError(provider.code, capability);
    }
  }
}
