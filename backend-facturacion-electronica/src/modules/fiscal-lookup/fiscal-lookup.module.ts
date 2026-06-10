import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { SyncModule } from "../sync/sync.module";
import { FiscalLookupController } from "./fiscal-lookup.controller";
import { FiscalLookupService } from "./fiscal-lookup.service";

@Module({
  imports: [ProvidersModule, SyncModule],
  controllers: [FiscalLookupController],
  providers: [FiscalLookupService],
  exports: [FiscalLookupService],
})
export class FiscalLookupModule {}
