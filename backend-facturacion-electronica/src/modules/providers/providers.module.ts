import { Module } from "@nestjs/common";
import { getProviderConfig } from "../../config/provider.config";
import { DianDirectFiscalProviderService } from "./dian/dian-direct-fiscal-provider.service";
import { MockFiscalProviderService } from "./mock/mock-fiscal-provider.service";
import { FISCAL_PROVIDER_ADAPTER } from "./provider-adapter.interface";

export const selectFiscalProvider = (
  mockProvider: MockFiscalProviderService,
  dianProvider: DianDirectFiscalProviderService
) =>
  getProviderConfig().provider === "DIAN_DIRECT" ? dianProvider : mockProvider;

@Module({
  providers: [
    MockFiscalProviderService,
    DianDirectFiscalProviderService,
    {
      provide: FISCAL_PROVIDER_ADAPTER,
      useFactory: selectFiscalProvider,
      inject: [MockFiscalProviderService, DianDirectFiscalProviderService],
    },
  ],
  exports: [
    FISCAL_PROVIDER_ADAPTER,
    MockFiscalProviderService,
    DianDirectFiscalProviderService,
  ],
})
export class ProvidersModule {}
