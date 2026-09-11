import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { ElectronicBillingProviderRegistry } from "../electronic-billing-provider-registry";
import { FactuCoreProvider } from "./factucore.provider";

@Injectable()
export class FactuCoreProviderBootstrap implements OnModuleInit {
  constructor(
    @Inject(ElectronicBillingProviderRegistry)
    private readonly registry: ElectronicBillingProviderRegistry,
    @Inject(FactuCoreProvider)
    private readonly factuCoreProvider: FactuCoreProvider,
  ) {}

  onModuleInit() {
    if (!this.registry.has(this.factuCoreProvider.code)) {
      this.registry.register(this.factuCoreProvider);
    }
  }
}
